import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { embeddedLevels } from '../../content/embedded-levels';
import type { LevelDocument } from '../../domain/level-document';
import { decodeLevelFile, encodeLevelFile } from '../level-file/level-file-codec';
import { createIndexedDBDraftRepository } from './indexed-db-draft-repository';
import { createTinkerboltDatabase } from './tinkerbolt-database';

const source = embeddedLevels[0];
if (source === undefined) throw new Error('Niveau de test absent');
const document: LevelDocument = { ...source, id: 'creation-1' };
const instant = '2026-10-03T12:00:00.000Z';
const clock = (): Date => new Date(instant);
const open = () =>
  createTinkerboltDatabase({ name: 'draft-contracts', indexedDB: new IDBFactory(), IDBKeyRange });
const stored = (level: LevelDocument): unknown => JSON.parse(encodeLevelFile(level));
const validRow = () => ({
  id: document.id,
  updatedAt: instant,
  envelope: { kind: 'draft', version: 2, data: { document: stored(document), updatedAt: instant } },
});
const quota = (): DOMException => new DOMException('Quota exceeded', 'QuotaExceededError');

describe('contrats historiques des créations sur IndexedDB', () => {
  it('migre aussi une création v1 par v2 vers v3', async () => {
    const db = open();
    const legacy = {
      schemaVersion: 1,
      id: document.id,
      metadata: { title: document.metadata.title },
      objects: document.objects,
      inventory: document.inventory.filter(({ type }) => type !== 'wire'),
      goal: document.goal,
      buildZones: document.buildZones,
    };

    const decoded = decodeLevelFile(JSON.stringify(legacy));
    expect(decoded.status).toBe('ok');
    if (decoded.status !== 'ok') return;
    await db.table('creations').put({
      id: document.id,
      updatedAt: instant,
      envelope: { kind: 'draft', version: 2, data: { document: legacy, updatedAt: instant } },
    });
    expect(await createIndexedDBDraftRepository(db, clock).load(document.id)).toEqual({
      status: 'ok',
      creation: { document: decoded.document, updatedAt: instant },
    });
  });

  it('migre document et copie source v2 en conservant la date', async () => {
    const db = open();
    const raw = {
      id: document.id,
      updatedAt: instant,
      envelope: {
        kind: 'draft',
        version: 2,
        data: {
          document: { ...document, schemaVersion: 2 },
          source: { ...source, schemaVersion: 2 },
          updatedAt: instant,
        },
      },
    };
    await db.table('creations').put(raw);
    expect(await createIndexedDBDraftRepository(db, clock).load(document.id)).toEqual({
      status: 'ok',
      creation: { document, source, updatedAt: instant },
    });
    expect(await db.table('creations').get(document.id)).toMatchObject({
      envelope: {
        data: { document: { schemaVersion: 3 }, source: { schemaVersion: 3 }, updatedAt: instant },
      },
    });
    expect(await db.table('backups').count()).toBe(0);
  });

  it('protège un document futur dans une enveloppe courante', async () => {
    const db = open();
    const raw = {
      ...validRow(),
      envelope: {
        ...validRow().envelope,
        data: { document: { ...document, schemaVersion: 4 }, updatedAt: instant },
      },
    };
    await db.table('creations').put(raw);
    const repository = createIndexedDBDraftRepository(db, clock);
    expect(await repository.load(document.id)).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await repository.save({ document })).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await repository.delete(document.id)).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await db.table('creations').get(document.id)).toEqual(raw);
  });

  it('met à jour une création sous le même id et date le dernier document', async () => {
    const db = open();
    const repository = createIndexedDBDraftRepository(db, clock);
    expect(await repository.save({ document })).toEqual({ status: 'ok' });
    const changed = { ...document, metadata: { ...document.metadata, title: 'Titre changé' } };
    expect(await repository.save({ document: changed, source })).toEqual({ status: 'ok' });
    expect(await repository.list()).toEqual({ status: 'ok', ids: [document.id] });
    expect(await repository.load(document.id)).toEqual({
      status: 'ok',
      creation: { document: changed, source, updatedAt: instant },
    });
    expect(await db.table('creations').count()).toBe(1);
  });

  it('refuse identifiant, document, source et horloge invalides avant écriture', async () => {
    const db = open();
    const repository = createIndexedDBDraftRepository(db, clock);
    expect(await repository.save({ document: { ...document, id: '../invalide' } })).toEqual({
      status: 'error',
      code: 'invalid-draft',
    });
    expect(
      await repository.save({
        document: { ...document, challenge: { elegantObjectCount: -1, minimalObjectCount: -2 } },
      }),
    ).toEqual({ status: 'error', code: 'invalid-draft' });
    expect(
      await repository.save({
        document,
        source: { ...source, challenge: { elegantObjectCount: -1, minimalObjectCount: -2 } },
      }),
    ).toEqual({ status: 'error', code: 'invalid-draft' });
    const badClock = createIndexedDBDraftRepository(db, () => new Date(Number.NaN));
    expect(await badClock.save({ document })).toEqual({ status: 'error', code: 'invalid-draft' });
    expect(await db.table('creations').count()).toBe(0);
  });

  it('sauvegarde une ligne invalide avant remplacement et garde la source intacte', async () => {
    const db = open();
    const raw = {
      ...validRow(),
      envelope: {
        ...validRow().envelope,
        data: { ...validRow().envelope.data, document: { schemaVersion: 3 } },
      },
    };
    await db.table('creations').put(raw);
    const repository = createIndexedDBDraftRepository(db, clock);
    expect(await repository.save({ document, source })).toEqual({
      status: 'ok',
      warning: 'invalid-data-backed-up',
    });
    expect(await repository.load(document.id)).toEqual({
      status: 'ok',
      creation: { document, source, updatedAt: instant },
    });
    expect(await db.table('backups').toArray()).toMatchObject([
      { table: 'creations', key: document.id, rawValue: raw },
    ]);
  });

  it('n’écrase pas une ligne invalide si son secours échoue', async () => {
    const db = open();
    const raw = { ...validRow(), updatedAt: 'hier' };
    await db.table('creations').put(raw);
    db.table('backups').hook('creating', () => {
      throw quota();
    });
    expect(await createIndexedDBDraftRepository(db, clock).save({ document })).toEqual({
      status: 'error',
      code: 'quota-exceeded',
    });
    expect(await db.table('creations').get(document.id)).toEqual(raw);
  });

  it('sauvegarde une ligne invalide avant suppression, puis retire seulement celle-ci', async () => {
    const db = open();
    const raw = { ...validRow(), updatedAt: 'hier' };
    await db.table('creations').put(raw);
    const other = {
      ...validRow(),
      id: 'creation-2',
      envelope: {
        ...validRow().envelope,
        data: { ...validRow().envelope.data, document: stored({ ...document, id: 'creation-2' }) },
      },
    };
    await db.table('creations').put(other);
    expect(await createIndexedDBDraftRepository(db, clock).delete(document.id)).toEqual({
      status: 'ok',
      warning: 'invalid-data-backed-up',
    });
    expect(await db.table('creations').get(document.id)).toBeUndefined();
    expect(await db.table('creations').get('creation-2')).toEqual(other);
    expect(await db.table('backups').toArray()).toMatchObject([
      { table: 'creations', key: document.id, rawValue: raw },
    ]);
  });
});
