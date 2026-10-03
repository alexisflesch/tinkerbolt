import type { Page } from '@playwright/test';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { z } from 'zod';

import type { DraftCreationContent } from '../src/application/drafts/draft-repository';
import type { Preferences } from '../src/application/preferences/preferences-repository';
import type { CampaignProgress } from '../src/application/progression';
import { createTinkerboltDatabase } from '../src/infrastructure/storage/tinkerbolt-database';
import { createIndexedDBDraftRepository } from '../src/infrastructure/storage/indexed-db-draft-repository';
import { createIndexedDBReceivedLevelRepository } from '../src/infrastructure/storage/indexed-db-received-level-repository';
import { createIndexedDBPreferencesRepository } from '../src/infrastructure/storage/indexed-db-preferences-repository';
import { createIndexedDBProgressRepository } from '../src/infrastructure/storage/indexed-db-progress-repository';

export type StorageTable =
  | 'creations'
  | 'receivedLevels'
  | 'progress'
  | 'preferences'
  | 'backups'
  | 'playerConstructions';
export interface FixtureRow {
  readonly table: StorageTable;
  readonly value: unknown;
}
const clock = () => new Date('2026-10-01T12:00:00.000Z');
const mirrorDatabase = () => createTinkerboltDatabase({ indexedDB: new IDBFactory(), IDBKeyRange });

/** Fixtures are encoded by the production adapters; the browser gets the exact v1 rows. */
export async function creationFixture(content: DraftCreationContent): Promise<FixtureRow> {
  const db = mirrorDatabase();
  const saved = await createIndexedDBDraftRepository(db, clock).save(content);
  if (saved.status !== 'ok') throw new Error(saved.code);
  const value: unknown = await db.table('creations').get(content.document.id);
  db.close();
  return { table: 'creations', value };
}
export async function preferencesFixture(preferences: Preferences): Promise<FixtureRow> {
  const db = mirrorDatabase();
  const saved = await createIndexedDBPreferencesRepository(db, clock).save(preferences);
  if (saved.status !== 'ok') throw new Error(saved.code);
  const value: unknown = await db.table('preferences').get('player');
  db.close();
  return { table: 'preferences', value };
}
export async function progressFixture(progress: CampaignProgress): Promise<FixtureRow> {
  const db = mirrorDatabase();
  const saved = await createIndexedDBProgressRepository(db, clock).save(progress);
  if (saved.status !== 'ok') throw new Error(saved.code);
  const value: unknown = await db.table('progress').get('campaign');
  db.close();
  return { table: 'progress', value };
}

/** Native version 10 is Dexie version 1. Called after reaching the app's origin. */
export async function seedIndexedDB(page: Page, rows: readonly FixtureRow[]): Promise<void> {
  await page.evaluate(async (values) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tinkerbolt', 10);
      request.onupgradeneeded = () => {
        const database = request.result;
        database
          .createObjectStore('creations', { keyPath: 'id' })
          .createIndex('updatedAt', 'updatedAt');
        database
          .createObjectStore('receivedLevels', { keyPath: 'id' })
          .createIndex('receivedAt', 'receivedAt');
        database.createObjectStore('progress', { keyPath: 'id' });
        database.createObjectStore('preferences', { keyPath: 'id' });
        database
          .createObjectStore('playerConstructions', { keyPath: ['scope', 'levelId'] })
          .createIndex('scope', 'scope');
        database.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('Lecture IndexedDB impossible'));
      };
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(
          [...new Set(values.map(({ table }) => table))],
          'readwrite',
        );
        transaction.oncomplete = () => {
          resolve();
        };
        transaction.onabort = () => {
          reject(transaction.error ?? new Error('Transaction IndexedDB annulée'));
        };
        for (const { table, value } of values) transaction.objectStore(table).put(value);
      });
    } finally {
      db.close();
    }
  }, rows);
}
export async function browserRows(page: Page, table: StorageTable): Promise<unknown[]> {
  return page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('tinkerbolt', 10);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('Lecture IndexedDB impossible'));
      };
    });
    try {
      return await new Promise<unknown[]>((resolve, reject) => {
        const request = db.transaction(name).objectStore(name).getAll();
        request.onsuccess = () => {
          const values: unknown[] = request.result;
          resolve(values);
        };
        request.onerror = () => {
          reject(request.error ?? new Error('Lecture IndexedDB impossible'));
        };
      });
    } finally {
      db.close();
    }
  }, table);
}
const rowIdentity = z.object({ id: z.string(), envelope: z.unknown() });
export async function storedEnvelope(
  page: Page,
  table: 'creations' | 'receivedLevels' | 'preferences' | 'progress',
  id: string,
): Promise<unknown> {
  const rows = await browserRows(page, table);
  const raw = rows.find((row) => rowIdentity.safeParse(row).data?.id === id);
  if (raw === undefined) return null;
  // The same repositories and file codecs validate browser persistence before assertions.
  const db = mirrorDatabase();
  try {
    await db.table(table).put(raw);
    const result =
      table === 'creations'
        ? await createIndexedDBDraftRepository(db, clock).load(id)
        : table === 'receivedLevels'
          ? await createIndexedDBReceivedLevelRepository(db, clock).load(id)
          : table === 'preferences'
            ? await createIndexedDBPreferencesRepository(db, clock).load()
            : await createIndexedDBProgressRepository(db, clock).load();
    if (result.status !== 'ok' || result.warning !== undefined)
      throw new Error('Enregistrement navigateur invalide');
    return rowIdentity.parse(raw).envelope;
  } finally {
    db.close();
  }
}
export async function storedDraft(page: Page, id: string) {
  const db = mirrorDatabase();
  try {
    const rows = await browserRows(page, 'creations');
    await db.table('creations').bulkPut(rows);
    const result = await createIndexedDBDraftRepository(db, clock).load(id);
    if (result.status !== 'ok') throw new Error(result.code);
    return result.creation;
  } finally {
    db.close();
  }
}
