import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { createIndexedDBProgressRepository } from './indexed-db-progress-repository';
import { createTinkerboltDatabase } from './tinkerbolt-database';

const instant = '2026-10-03T12:00:00.000Z';
const clock = (): Date => new Date(instant);
const open = () =>
  createTinkerboltDatabase({
    name: 'progress-contracts',
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
const progress = {
  'level-1': { resolved: true, bestObjectCount: 2 },
  'level-2': { resolved: false, bestObjectCount: null },
} as const;
const row = (data: unknown) => ({
  id: 'campaign',
  envelope: { kind: 'progress', version: 1, data },
});
const quota = (): DOMException => new DOMException('Quota exceeded', 'QuotaExceededError');

describe('contrats historiques de progression sur IndexedDB', () => {
  it('fait un aller-retour de progression résolue et non résolue dans une enveloppe versionnée', async () => {
    const db = open();
    const repository = createIndexedDBProgressRepository(db, clock);
    expect(await repository.save(progress)).toEqual({ status: 'ok' });
    expect(await db.table('progress').get('campaign')).toEqual(row(progress));
    expect(await repository.load()).toEqual({ status: 'ok', progress });
  });

  it('refuse la progression invalide avant toute écriture', async () => {
    const db = open();
    const repository = createIndexedDBProgressRepository(db, clock);
    expect(await repository.save({ 'level-1': { resolved: true, bestObjectCount: null } })).toEqual(
      { status: 'error', code: 'invalid-progress' },
    );
    expect(await repository.save({ '../bad': { resolved: true, bestObjectCount: 1 } })).toEqual({
      status: 'error',
      code: 'invalid-progress',
    });
    expect(await db.table('progress').count()).toBe(0);
  });

  it('secourt une valeur invalide avant remplacement', async () => {
    const db = open();
    const raw = row({ 'level-1': { resolved: true } });
    await db.table('progress').put(raw);
    const repository = createIndexedDBProgressRepository(db, clock);
    expect(await repository.save(progress)).toEqual({
      status: 'ok',
      warning: 'invalid-data-backed-up',
    });
    expect(await repository.load()).toEqual({ status: 'ok', progress });
    expect(await db.table('backups').toArray()).toMatchObject([
      { table: 'progress', key: 'campaign', rawValue: raw },
    ]);
  });

  it('secourt une valeur invalide avant effacement et annule si le secours échoue', async () => {
    const db = open();
    const raw = row({ 'level-1': { resolved: true } });
    await db.table('progress').put(raw);
    db.table('backups').hook('creating', () => {
      throw quota();
    });
    const repository = createIndexedDBProgressRepository(db, clock);
    expect(await repository.clear()).toEqual({ status: 'error', code: 'quota-exceeded' });
    expect(await db.table('progress').get('campaign')).toEqual(raw);
  });

  it('réussit sans écrire quand aucune progression n’existe', async () => {
    const db = open();
    const repository = createIndexedDBProgressRepository(db, clock);
    expect(await repository.clear()).toEqual({ status: 'ok' });
    expect(await db.table('progress').count()).toBe(0);
  });
});

describe('import atomique de progression', () => {
  it('fusionne les réussites sans perdre les meilleurs records ni toucher les autres tables', async () => {
    const db = open();
    const repository = createIndexedDBProgressRepository(db, clock);
    await repository.save(progress);
    await db.table('preferences').put({ id: 'player', marker: 'intact' });
    await db
      .table('playerConstructions')
      .put({ scope: 'campaign', levelId: 'level-1', marker: 'intact' });
    const merged = {
      'level-1': { resolved: true, bestObjectCount: 2 },
      'level-2': { resolved: true, bestObjectCount: 0 },
      'level-3': { resolved: true, bestObjectCount: 4 },
    };
    expect(
      await repository.merge({
        'level-1': { resolved: true, bestObjectCount: 5 },
        'level-2': { resolved: true, bestObjectCount: 0 },
        'level-3': { resolved: true, bestObjectCount: 4 },
      }),
    ).toEqual({ status: 'ok', progress: merged });
    expect(await repository.load()).toEqual({ status: 'ok', progress: merged });
    expect(await db.table('preferences').get('player')).toEqual({ id: 'player', marker: 'intact' });
    expect(await db.table('playerConstructions').count()).toBe(1);
    expect(await repository.merge({ 'level-1': { resolved: true, bestObjectCount: 1 } })).toEqual({
      status: 'ok',
      progress: { ...merged, 'level-1': { resolved: true, bestObjectCount: 1 } },
    });
  });
  it('refuse un succès dont l’identifiant est un nom réservé et ne crée pas de progression', async () => {
    const db = open();
    const repository = createIndexedDBProgressRepository(db, clock);
    expect(await repository.merge({ constructor: { resolved: true, bestObjectCount: 2 } })).toEqual(
      { status: 'error', code: 'invalid-progress' },
    );
    expect(await db.table('progress').count()).toBe(0);
  });
  it('refuse une entrée non résolue à identifiant réservé sans écrire', async () => {
    const db = open();
    const repository = createIndexedDBProgressRepository(db, clock);
    expect(
      await repository.merge({ constructor: { resolved: false, bestObjectCount: null } }),
    ).toEqual({ status: 'error', code: 'invalid-progress' });
    expect(await db.table('progress').count()).toBe(0);
  });
  it('préserve une version future et annule toute fusion si le quota refuse', async () => {
    const db = open();
    const repository = createIndexedDBProgressRepository(db, clock);
    const future = { id: 'campaign', envelope: { kind: 'progress', version: 2, data: progress } };
    await db.table('progress').put(future);
    expect(await repository.merge({})).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await db.table('progress').get('campaign')).toEqual(future);
    await db.table('progress').put(row(progress));
    db.table('progress').hook('updating', () => {
      throw quota();
    });
    expect(await repository.merge({ 'level-3': { resolved: true, bestObjectCount: 1 } })).toEqual({
      status: 'error',
      code: 'quota-exceeded',
    });
    expect(await db.table('progress').get('campaign')).toEqual(row(progress));
  });
  it('refuse un import incohérent sans écrire', async () => {
    const db = open();
    const repository = createIndexedDBProgressRepository(db, clock);
    await repository.save(progress);
    expect(await repository.merge({ bad: { resolved: true, bestObjectCount: null } })).toEqual({
      status: 'error',
      code: 'invalid-progress',
    });
    expect(await repository.load()).toEqual({ status: 'ok', progress });
  });
});
