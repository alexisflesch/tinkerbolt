import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { embeddedLevels } from '../../content/embedded-levels';
import type { LevelDocument } from '../../domain/level-document';
import { decodeLevelFile, encodeLevelFile } from '../level-file/level-file-codec';
import type { ReceivedLevel } from '../../application/received/received-level-repository';
import { createIndexedDBReceivedLevelRepository } from './indexed-db-received-level-repository';
import { createTinkerboltDatabase } from './tinkerbolt-database';

const document = embeddedLevels[0];
if (document === undefined) throw new Error('Niveau de test absent');
const id = 'recu-0123456789abcdef';
const instant = '2026-10-03T12:00:00.000Z';
const clock = (): Date => new Date(instant);
const open = () =>
  createTinkerboltDatabase({
    name: 'received-contracts',
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
const stored = (level: LevelDocument): unknown => JSON.parse(encodeLevelFile(level));
const entry = (extra: Partial<ReceivedLevel> = {}): ReceivedLevel => ({
  id,
  document,
  origin: 'file',
  receivedAt: instant,
  solved: false,
  ...extra,
});
const row = (level: ReceivedLevel) => ({
  id: level.id,
  receivedAt: level.receivedAt,
  envelope: {
    kind: 'received-level',
    version: 1,
    data: { ...level, document: stored(level.document) },
  },
});
const quota = (): DOMException => new DOMException('Quota exceeded', 'QuotaExceededError');

describe('contrats historiques des niveaux reçus sur IndexedDB', () => {
  it('migre aussi un reçu v1 par v2 vers v3', async () => {
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
    await db.table('receivedLevels').put({
      ...row(entry()),
      envelope: { ...row(entry()).envelope, data: { ...entry(), document: legacy } },
    });
    expect(await createIndexedDBReceivedLevelRepository(db, clock).load(id)).toEqual({
      status: 'ok',
      level: { ...entry(), document: decoded.document },
    });
  });

  it('migre un reçu v2 en conservant identité, résultat, date et solution joueur', async () => {
    const db = open();
    const level = entry({ solved: true, bestObjectCount: 1, playerSolution: { placements: [] } });
    const raw = {
      ...row(level),
      envelope: {
        ...row(level).envelope,
        data: { ...level, document: { ...document, schemaVersion: 2 } },
      },
    };
    await db.table('receivedLevels').put(raw);
    expect(await createIndexedDBReceivedLevelRepository(db, clock).load(id)).toEqual({
      status: 'ok',
      level,
    });
    expect(await db.table('receivedLevels').get(id)).toMatchObject({
      envelope: {
        data: {
          document: { schemaVersion: 3 },
          bestObjectCount: 1,
          receivedAt: instant,
          playerSolution: { placements: [] },
        },
      },
    });
    expect(await db.table('backups').count()).toBe(0);
  });

  it('protège un reçu de format futur dans une enveloppe courante', async () => {
    const db = open();
    const raw = {
      ...row(entry()),
      envelope: {
        ...row(entry()).envelope,
        data: { ...entry(), document: { ...document, schemaVersion: 4 } },
      },
    };
    await db.table('receivedLevels').put(raw);
    const repository = createIndexedDBReceivedLevelRepository(db, clock);
    expect(await repository.load(id)).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await repository.save(entry())).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await repository.delete(id)).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await db.table('receivedLevels').get(id)).toEqual(raw);
  });

  it('fait un aller-retour complet avec record et solution, et accepte les champs facultatifs absents', async () => {
    const db = open();
    const repository = createIndexedDBReceivedLevelRepository(db, clock);
    const solved = entry({ solved: true, bestObjectCount: 2, playerSolution: { placements: [] } });
    expect(await repository.save(solved)).toEqual({ status: 'ok' });
    expect(await repository.load(id)).toEqual({ status: 'ok', level: solved });
    expect(await repository.save(entry())).toEqual({ status: 'ok' });
    expect(await repository.load(id)).toEqual({ status: 'ok', level: entry() });
    expect(await db.table('receivedLevels').count()).toBe(1);
  });

  it('refuse une entrée incohérente ou un document que le codec rejette avant écriture', async () => {
    const db = open();
    const repository = createIndexedDBReceivedLevelRepository(db, clock);
    expect(await repository.save(entry({ id: '../bad' }))).toEqual({
      status: 'error',
      code: 'invalid-received-level',
    });
    expect(await repository.save(entry({ bestObjectCount: 2 }))).toEqual({
      status: 'error',
      code: 'invalid-received-level',
    });
    expect(
      await repository.save(
        entry({
          document: { ...document, challenge: { elegantObjectCount: -1, minimalObjectCount: -2 } },
        }),
      ),
    ).toEqual({ status: 'error', code: 'invalid-received-level' });
    expect(await db.table('receivedLevels').count()).toBe(0);
  });

  it('secourt une entrée invalide avant remplacement', async () => {
    const db = open();
    const raw = { ...row(entry()), receivedAt: 'hier' };
    await db.table('receivedLevels').put(raw);
    const repository = createIndexedDBReceivedLevelRepository(db, clock);
    expect(await repository.save(entry())).toEqual({
      status: 'ok',
      warning: 'invalid-data-backed-up',
    });
    expect(await repository.load(id)).toEqual({ status: 'ok', level: entry() });
    expect(await db.table('backups').toArray()).toMatchObject([
      { table: 'receivedLevels', key: id, rawValue: raw },
    ]);
  });

  it('garde l’entrée invalide si son secours échoue avant remplacement', async () => {
    const db = open();
    const raw = { ...row(entry()), receivedAt: 'hier' };
    await db.table('receivedLevels').put(raw);
    db.table('backups').hook('creating', () => {
      throw quota();
    });
    expect(await createIndexedDBReceivedLevelRepository(db, clock).save(entry())).toEqual({
      status: 'error',
      code: 'quota-exceeded',
    });
    expect(await db.table('receivedLevels').get(id)).toEqual(raw);
  });

  it('secourt une entrée invalide avant suppression et conserve les autres reçus', async () => {
    const db = open();
    const raw = { ...row(entry()), receivedAt: 'hier' };
    const other = row(entry({ id: 'recu-fedcba9876543210' }));
    await db.table('receivedLevels').put(raw);
    await db.table('receivedLevels').put(other);
    expect(await createIndexedDBReceivedLevelRepository(db, clock).delete(id)).toEqual({
      status: 'ok',
      warning: 'invalid-data-backed-up',
    });
    expect(await db.table('receivedLevels').get(id)).toBeUndefined();
    expect(await db.table('receivedLevels').get(other.id)).toEqual(other);
    expect(await db.table('backups').toArray()).toMatchObject([
      { table: 'receivedLevels', key: id, rawValue: raw },
    ]);
  });
});
