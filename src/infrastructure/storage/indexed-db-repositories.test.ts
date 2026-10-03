import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';

import { embeddedLevels } from '../../content/embedded-levels';
import type { LevelDocument } from '../../domain/level-document';
import { encodeLevelFile } from '../level-file/level-file-codec';
import { createTinkerboltDatabase } from './tinkerbolt-database';
import { createIndexedDBDraftRepository } from './indexed-db-draft-repository';
import { createIndexedDBReceivedLevelRepository } from './indexed-db-received-level-repository';
import { createIndexedDBProgressRepository } from './indexed-db-progress-repository';
import { createIndexedDBPreferencesRepository } from './indexed-db-preferences-repository';

const source = embeddedLevels[0];
if (source === undefined) throw new Error('Niveau embarqué de test absent');
const clock = (): Date => new Date('2026-10-03T12:00:00.000Z');
const instant = clock().toISOString();
const receivedId = 'recu-0123456789abcdef';
const otherReceivedId = 'recu-fedcba9876543210';
const documentWithId = (id: string): LevelDocument => ({ ...source, id });
const storedDocument = (document: LevelDocument): unknown => JSON.parse(encodeLevelFile(document));
const receivedEnvelope = (id = receivedId, document = source): unknown => ({
  kind: 'received-level',
  version: 1,
  data: {
    id,
    document: storedDocument(document),
    origin: 'file',
    receivedAt: instant,
    solved: false,
  },
});
const constructionEnvelope = (scope: 'campaign' | 'received', levelId: string): unknown => ({
  kind: 'player-construction',
  version: 1,
  data: {
    scope,
    levelId,
    sourceFingerprint: 'a'.repeat(64),
    updatedAt: instant,
    attempt: { document: source, provenance: {} },
  },
});
const quota = (): DOMException => new DOMException('Quota exceeded', 'QuotaExceededError');

let sequence = 0;
const databases: ReturnType<typeof createTinkerboltDatabase>[] = [];
const openDatabase = (
  factory = new IDBFactory(),
  name = `tinkerbolt-test-${String(sequence++)}`,
) => {
  const db = createTinkerboltDatabase({ name, indexedDB: factory, IDBKeyRange });
  databases.push(db);
  return db;
};
afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

const draftRow = (id: string, data: Record<string, unknown> = {}) => ({
  id,
  updatedAt: instant,
  envelope: {
    kind: 'draft',
    version: 2,
    data: { document: storedDocument(documentWithId(id)), updatedAt: instant, ...data },
  },
});

/** Dexie hooks throw inside the real IndexedDB transaction, so rollback is observable. */
const failNextMutation = (
  db: ReturnType<typeof createTinkerboltDatabase>,
  table: string,
  action: 'creating' | 'deleting',
  error: Error,
): void => {
  if (action === 'creating') {
    db.table(table).hook('creating', () => {
      throw error;
    });
  } else {
    db.table(table).hook('deleting', () => {
      throw error;
    });
  }
};

describe('base IndexedDB C2a', () => {
  it('ouvre une base neuve avec les six tables prévues', async () => {
    const db = openDatabase();
    await db.open();
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      'backups',
      'creations',
      'playerConstructions',
      'preferences',
      'progress',
      'receivedLevels',
    ]);
    expect(await db.table('creations').count()).toBe(0);
    expect(await db.table('backups').count()).toBe(0);
  });

  it('signale une version de base future sans ouvrir une base vide', async () => {
    const factory = new IDBFactory();
    const name = `future-${String(sequence++)}`;
    const request = factory.open(name, 20);
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB open failed'));
      };
    });
    const repository = createIndexedDBProgressRepository(openDatabase(factory, name), clock);
    await expect(repository.load()).resolves.toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
  });
});

describe('créations', () => {
  it('lit une liste vide et crée une ligne datée avec sa source, retrouvée après réouverture', async () => {
    const factory = new IDBFactory();
    const name = `draft-reopen-${String(sequence++)}`;
    const db = openDatabase(factory, name);
    const repository = createIndexedDBDraftRepository(db, clock);
    expect(await repository.list()).toEqual({ status: 'ok', ids: [] });
    const document = documentWithId('creation-1');
    expect(await repository.create({ document, source })).toEqual({ status: 'ok' });
    expect(await db.table('creations').get('creation-1')).toEqual(
      draftRow('creation-1', { source: storedDocument(source) }),
    );
    db.close();
    const reopened = createIndexedDBDraftRepository(openDatabase(factory, name), clock);
    expect(await reopened.load('creation-1')).toEqual({
      status: 'ok',
      creation: { document, source, updatedAt: instant },
    });
    expect(await reopened.delete('creation-1')).toEqual({ status: 'ok' });
    expect(await reopened.list()).toEqual({ status: 'ok', ids: [] });
  });

  it('refuse une collision de création et préserve la première', async () => {
    const repository = createIndexedDBDraftRepository(openDatabase(), clock);
    const document = documentWithId('creation-1');
    expect(await repository.create({ document })).toEqual({ status: 'ok' });
    expect(await repository.create({ document, source })).toEqual({
      status: 'error',
      code: 'identity-collision',
    });
    expect(await repository.load(document.id)).toEqual({
      status: 'ok',
      creation: { document, updatedAt: instant },
    });
  });

  it('refuse les documents et sources que le codec ne peut pas écrire', async () => {
    const repository = createIndexedDBDraftRepository(openDatabase(), clock);
    expect(await repository.save({ document: documentWithId('../bad') })).toEqual({
      status: 'error',
      code: 'invalid-draft',
    });
    expect(
      await repository.save({
        document: documentWithId('creation-1'),
        source: { ...source, challenge: { elegantObjectCount: -1, minimalObjectCount: -2 } },
      }),
    ).toEqual({ status: 'error', code: 'invalid-draft' });
  });

  it('met une ligne invalide en secours et la retire atomiquement à la lecture', async () => {
    const db = openDatabase();
    const raw = { id: 'creation-1', updatedAt: 'hier', envelope: draftRow('creation-1').envelope };
    await db.table('creations').put(raw);
    const repository = createIndexedDBDraftRepository(db, clock);
    expect(await repository.load('creation-1')).toEqual({
      status: 'ok',
      creation: null,
      warning: 'invalid-data-backed-up',
    });
    expect(await db.table('creations').get('creation-1')).toBeUndefined();
    expect(await db.table('backups').toArray()).toMatchObject([
      { table: 'creations', key: 'creation-1', rawValue: raw },
    ]);
  });

  it('garde la ligne invalide lorsque le secours échoue sur quota', async () => {
    const db = openDatabase();
    const raw = { id: 'creation-1', updatedAt: 'hier', envelope: draftRow('creation-1').envelope };
    await db.table('creations').put(raw);
    failNextMutation(db, 'backups', 'creating', quota());
    expect(await createIndexedDBDraftRepository(db, clock).load('creation-1')).toEqual({
      status: 'error',
      code: 'quota-exceeded',
    });
    expect(await db.table('creations').get('creation-1')).toEqual(raw);
  });

  it('protège une enveloppe future lors de load, save et delete', async () => {
    const db = openDatabase();
    const future = { ...draftRow('creation-1'), envelope: { kind: 'draft', version: 3, data: {} } };
    await db.table('creations').put(future);
    const repository = createIndexedDBDraftRepository(db, clock);
    expect(await repository.load('creation-1')).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await repository.save({ document: documentWithId('creation-1') })).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await repository.delete('creation-1')).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await db.table('creations').get('creation-1')).toEqual(future);
    expect(await db.table('backups').count()).toBe(0);
  });
});

describe('niveaux reçus', () => {
  it('reçoit, date et rouvre un niveau sans altérer son origine', async () => {
    const factory = new IDBFactory();
    const name = `received-reopen-${String(sequence++)}`;
    const repository = createIndexedDBReceivedLevelRepository(openDatabase(factory, name), clock);
    expect(
      await repository.receive({
        id: receivedId,
        document: source,
        origin: 'file',
        receivedAt: instant,
        solved: false,
      }),
    ).toMatchObject({
      status: 'ok',
      isNew: true,
      level: { id: receivedId, origin: 'file', receivedAt: instant, document: source },
    });
    const reopened = createIndexedDBReceivedLevelRepository(openDatabase(factory, name), clock);
    expect(await reopened.list()).toEqual({ status: 'ok', ids: [receivedId] });
    expect(await reopened.load(receivedId)).toMatchObject({
      status: 'ok',
      level: { id: receivedId, origin: 'file', document: source },
    });
  });

  it('rafraîchit un doublon en gardant origine, record et dernière solution', async () => {
    const db = openDatabase();
    const repository = createIndexedDBReceivedLevelRepository(db, clock);
    await repository.receive({
      id: receivedId,
      document: source,
      origin: 'file',
      receivedAt: instant,
      solved: false,
    });
    const solution = { placements: [] };
    expect(await repository.recordVictory(receivedId, source, 4, solution)).toMatchObject({
      status: 'ok',
      level: { solved: true, bestObjectCount: 4 },
    });
    expect(
      await repository.receive({
        id: receivedId,
        document: source,
        origin: 'link',
        receivedAt: instant,
        solved: false,
      }),
    ).toMatchObject({
      status: 'ok',
      isNew: false,
      level: { origin: 'file', solved: true, bestObjectCount: 4, playerSolution: solution },
    });
    expect(await db.table('receivedLevels').count()).toBe(1);
  });

  it('refuse une collision canonique et une source attendue différente sans écraser le parent', async () => {
    const db = openDatabase();
    const repository = createIndexedDBReceivedLevelRepository(db, clock);
    await repository.receive({
      id: receivedId,
      document: source,
      origin: 'file',
      receivedAt: instant,
      solved: false,
    });
    const altered = {
      ...source,
      metadata: { ...source.metadata, title: `${source.metadata.title} bis` },
    };
    expect(
      await repository.receive({
        id: receivedId,
        document: altered,
        origin: 'link',
        receivedAt: instant,
        solved: false,
      }),
    ).toEqual({
      status: 'error',
      code: 'identity-collision',
    });
    expect(await repository.recordVictory(receivedId, altered, 2, { placements: [] })).toEqual({
      status: 'error',
      code: 'source-changed',
    });
    expect(await repository.load(receivedId)).toMatchObject({
      status: 'ok',
      level: { document: source, solved: false },
    });
  });

  it('fusionne des victoires concurrentes et garde le meilleur compte et la dernière solution', async () => {
    const repository = createIndexedDBReceivedLevelRepository(openDatabase(), clock);
    await repository.receive({
      id: receivedId,
      document: source,
      origin: 'file',
      receivedAt: instant,
      solved: false,
    });
    const first = { placements: [] };
    const second = { placements: [], wires: [] };
    const results = await Promise.all([
      repository.recordVictory(receivedId, source, 5, first),
      repository.recordVictory(receivedId, source, 2, second),
    ]);
    expect(results.every((result) => result.status === 'ok')).toBe(true);
    expect(await repository.load(receivedId)).toMatchObject({
      status: 'ok',
      level: { solved: true, bestObjectCount: 2, playerSolution: second },
    });
  });

  it('ne recrée pas un parent supprimé lors d’une victoire tardive', async () => {
    const repository = createIndexedDBReceivedLevelRepository(openDatabase(), clock);
    expect(await repository.recordVictory(receivedId, source, 2, { placements: [] })).toEqual({
      status: 'ok',
      level: null,
    });
    expect(await repository.load(receivedId)).toEqual({ status: 'ok', level: null });
  });

  it('supprime le reçu et sa construction liée, mais pas les autres constructions', async () => {
    const db = openDatabase();
    await db
      .table('receivedLevels')
      .put({ id: receivedId, receivedAt: instant, envelope: receivedEnvelope() });
    await db.table('playerConstructions').put({
      scope: 'received',
      levelId: receivedId,
      envelope: constructionEnvelope('received', receivedId),
    });
    await db.table('playerConstructions').put({
      scope: 'received',
      levelId: otherReceivedId,
      envelope: constructionEnvelope('received', otherReceivedId),
    });
    expect(await createIndexedDBReceivedLevelRepository(db, clock).delete(receivedId)).toEqual({
      status: 'ok',
    });
    expect(await db.table('receivedLevels').get(receivedId)).toBeUndefined();
    expect(await db.table('playerConstructions').get(['received', receivedId])).toBeUndefined();
    expect(await db.table('playerConstructions').get(['received', otherReceivedId])).toBeDefined();
  });

  it('annule les deux suppressions si le retrait de construction échoue', async () => {
    const db = openDatabase();
    await db
      .table('receivedLevels')
      .put({ id: receivedId, receivedAt: instant, envelope: receivedEnvelope() });
    await db.table('playerConstructions').put({
      scope: 'received',
      levelId: receivedId,
      envelope: constructionEnvelope('received', receivedId),
    });
    failNextMutation(db, 'playerConstructions', 'deleting', new Error('delete failed'));
    expect(await createIndexedDBReceivedLevelRepository(db, clock).delete(receivedId)).toEqual({
      status: 'error',
      code: 'storage-unavailable',
    });
    expect(await db.table('receivedLevels').get(receivedId)).toBeDefined();
    expect(await db.table('playerConstructions').get(['received', receivedId])).toBeDefined();
  });

  it('protège une enveloppe reçue future lors de load, receive et delete', async () => {
    const db = openDatabase();
    const future = {
      id: receivedId,
      receivedAt: instant,
      envelope: { kind: 'received-level', version: 2, data: {} },
    };
    await db.table('receivedLevels').put(future);
    const repository = createIndexedDBReceivedLevelRepository(db, clock);
    expect(await repository.load(receivedId)).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(
      await repository.receive({
        id: receivedId,
        document: source,
        origin: 'file',
        receivedAt: instant,
        solved: false,
      }),
    ).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await repository.delete(receivedId)).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await db.table('receivedLevels').get(receivedId)).toEqual(future);
  });

  it('sauvegarde une row reçue dont le codec rejette le document', async () => {
    const db = openDatabase();
    const raw = {
      id: receivedId,
      receivedAt: instant,
      envelope: {
        kind: 'received-level',
        version: 1,
        data: {
          id: receivedId,
          document: { schemaVersion: 999 },
          origin: 'file',
          receivedAt: instant,
          solved: false,
        },
      },
    };
    await db.table('receivedLevels').put(raw);
    expect(await createIndexedDBReceivedLevelRepository(db, clock).load(receivedId)).toEqual({
      status: 'ok',
      level: null,
      warning: 'invalid-data-backed-up',
    });
    expect(await db.table('backups').toArray()).toMatchObject([
      { table: 'receivedLevels', key: receivedId, rawValue: raw },
    ]);
  });
});

describe('progression', () => {
  it('fusionne des records concurrents sans perdre un autre niveau', async () => {
    const repository = createIndexedDBProgressRepository(openDatabase(), clock);
    expect(await repository.load()).toEqual({ status: 'ok', progress: {} });
    const results = await Promise.all([
      repository.recordVictory('level-1', 4),
      repository.recordVictory('level-1', 2),
      repository.recordVictory('level-2', 3),
    ]);
    expect(results.every((result) => result.status === 'ok')).toBe(true);
    expect(await repository.load()).toEqual({
      status: 'ok',
      progress: {
        'level-1': { resolved: true, bestObjectCount: 2 },
        'level-2': { resolved: true, bestObjectCount: 3 },
      },
    });
  });

  it('efface progression et constructions de campagne seulement', async () => {
    const db = openDatabase();
    const repository = createIndexedDBProgressRepository(db, clock);
    await repository.save({ 'level-1': { resolved: true, bestObjectCount: 2 } });
    await db.table('playerConstructions').put({
      scope: 'campaign',
      levelId: 'level-1',
      envelope: constructionEnvelope('campaign', 'level-1'),
    });
    await db.table('playerConstructions').put({
      scope: 'received',
      levelId: receivedId,
      envelope: constructionEnvelope('received', receivedId),
    });
    await db.table('creations').put(draftRow('creation-1'));
    await db
      .table('receivedLevels')
      .put({ id: receivedId, receivedAt: instant, envelope: receivedEnvelope() });
    await db.table('preferences').put({
      id: 'player',
      envelope: { kind: 'preferences', version: 1, data: { author: 'Lili' } },
    });
    expect(await repository.clear()).toEqual({ status: 'ok' });
    expect(await repository.load()).toEqual({ status: 'ok', progress: {} });
    expect(await db.table('playerConstructions').get(['campaign', 'level-1'])).toBeUndefined();
    expect(await db.table('playerConstructions').get(['received', receivedId])).toBeDefined();
    expect(await db.table('creations').count()).toBe(1);
    expect(await db.table('receivedLevels').count()).toBe(1);
    expect(await db.table('preferences').count()).toBe(1);
  });

  it('annule le reset entier si la suppression d’une construction échoue', async () => {
    const db = openDatabase();
    const repository = createIndexedDBProgressRepository(db, clock);
    await repository.save({ 'level-1': { resolved: true, bestObjectCount: 2 } });
    await db.table('playerConstructions').put({
      scope: 'campaign',
      levelId: 'level-1',
      envelope: constructionEnvelope('campaign', 'level-1'),
    });
    failNextMutation(db, 'playerConstructions', 'deleting', quota());
    expect(await repository.clear()).toEqual({ status: 'error', code: 'quota-exceeded' });
    expect(await repository.load()).toMatchObject({
      status: 'ok',
      progress: { 'level-1': { bestObjectCount: 2 } },
    });
    expect(await db.table('playerConstructions').get(['campaign', 'level-1'])).toBeDefined();
  });

  it('protège la progression d’une version future pour load, save, clear', async () => {
    const db = openDatabase();
    const future = { id: 'campaign', envelope: { kind: 'progress', version: 2, data: {} } };
    await db.table('progress').put(future);
    const repository = createIndexedDBProgressRepository(db, clock);
    expect(await repository.load()).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await repository.save({})).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await repository.clear()).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await db.table('progress').get('campaign')).toEqual(future);
  });

  it('refuse les records invalides et met une donnée stockée invalide en secours', async () => {
    const db = openDatabase();
    const repository = createIndexedDBProgressRepository(db, clock);
    expect(await repository.recordVictory('level-1', -1)).toEqual({
      status: 'error',
      code: 'invalid-progress',
    });
    const raw = {
      id: 'campaign',
      envelope: { kind: 'progress', version: 1, data: { 'level-1': { resolved: true } } },
    };
    await db.table('progress').put(raw);
    expect(await repository.load()).toEqual({
      status: 'ok',
      progress: {},
      warning: 'invalid-data-backed-up',
    });
    expect(await db.table('backups').toArray()).toMatchObject([
      { table: 'progress', key: 'campaign', rawValue: raw },
    ]);
  });
});

describe('préférences', () => {
  it('fait un aller-retour après réouverture et applique des patchs concurrents sans perdre de champ', async () => {
    const factory = new IDBFactory();
    const name = `preferences-reopen-${String(sequence++)}`;
    const repository = createIndexedDBPreferencesRepository(openDatabase(factory, name), clock);
    expect(await repository.load()).toEqual({ status: 'ok', preferences: {} });
    expect(await repository.save({ author: 'Lili' })).toEqual({ status: 'ok' });
    const results = await Promise.all([
      repository.patch({ firstLevelHintDone: true }),
      repository.patch({ installInvitationDeclined: true }),
    ]);
    expect(results.every((result) => result.status === 'ok')).toBe(true);
    const reopened = createIndexedDBPreferencesRepository(openDatabase(factory, name), clock);
    expect(await reopened.load()).toEqual({
      status: 'ok',
      preferences: { author: 'Lili', firstLevelHintDone: true, installInvitationDeclined: true },
    });
    expect(await reopened.patch({ author: null })).toEqual({
      status: 'ok',
      preferences: { firstLevelHintDone: true, installInvitationDeclined: true },
    });
  });

  it('refuse un pseudo invalide sans toucher la valeur enregistrée', async () => {
    const repository = createIndexedDBPreferencesRepository(openDatabase(), clock);
    await repository.save({ author: 'Lili' });
    expect(await repository.patch({ author: '   ' })).toEqual({
      status: 'error',
      code: 'invalid-preferences',
    });
    expect(await repository.load()).toEqual({ status: 'ok', preferences: { author: 'Lili' } });
  });

  it('déplace une préférence invalide en secours avant de renvoyer la valeur vide', async () => {
    const db = openDatabase();
    const raw = {
      id: 'player',
      envelope: { kind: 'preferences', version: 1, data: { firstLevelHintDone: false } },
    };
    await db.table('preferences').put(raw);
    expect(await createIndexedDBPreferencesRepository(db, clock).load()).toEqual({
      status: 'ok',
      preferences: {},
      warning: 'invalid-data-backed-up',
    });
    expect(await db.table('preferences').get('player')).toBeUndefined();
    expect(await db.table('backups').toArray()).toMatchObject([
      { table: 'preferences', key: 'player', rawValue: raw },
    ]);
  });

  it('déplace une préférence invalide en secours, avec rollback si ce secours échoue', async () => {
    const db = openDatabase();
    const raw = {
      id: 'player',
      envelope: { kind: 'preferences', version: 1, data: { author: 'Li\nli' } },
    };
    await db.table('preferences').put(raw);
    failNextMutation(db, 'backups', 'creating', quota());
    const repository = createIndexedDBPreferencesRepository(db, clock);
    expect(await repository.load()).toEqual({ status: 'error', code: 'quota-exceeded' });
    expect(await db.table('preferences').get('player')).toEqual(raw);
  });

  it('protège une version future lors de load, save et patch', async () => {
    const db = openDatabase();
    const future = { id: 'player', envelope: { kind: 'preferences', version: 2, data: {} } };
    await db.table('preferences').put(future);
    const repository = createIndexedDBPreferencesRepository(db, clock);
    expect(await repository.load()).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await repository.save({ author: 'Lili' })).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await repository.patch({ author: null })).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await db.table('preferences').get('player')).toEqual(future);
  });

  it('convertit un quota et une base fermée en résultats, sans rejet de promesse', async () => {
    const db = openDatabase();
    failNextMutation(db, 'preferences', 'creating', quota());
    const repository = createIndexedDBPreferencesRepository(db, clock);
    await expect(repository.save({ author: 'Lili' })).resolves.toEqual({
      status: 'error',
      code: 'quota-exceeded',
    });
    db.close();
    await expect(repository.load()).resolves.toEqual({
      status: 'error',
      code: 'storage-unavailable',
    });
  });
});

describe('régressions de validation des clés et constructions liées', () => {
  it.each(['creations', 'receivedLevels'] as const)(
    'met la clé primaire numérique de %s en secours et poursuit la liste',
    async (table) => {
      const db = openDatabase();
      const raw = { id: 17, envelope: { kind: 'unknown', version: 1, data: {} } };
      await db.table(table).put(raw);
      const listed =
        table === 'creations'
          ? await createIndexedDBDraftRepository(db, clock).list()
          : await createIndexedDBReceivedLevelRepository(db, clock).list();
      expect(listed).toEqual({ status: 'ok', ids: [], warning: 'invalid-data-backed-up' });
      expect(await db.table(table).get(17)).toBeUndefined();
      expect(await db.table('backups').toArray()).toMatchObject([
        { table, key: 17, rawValue: raw },
      ]);
    },
  );

  it('conserve la clé numérique si le secours échoue sur quota', async () => {
    const db = openDatabase();
    const raw = { id: 17, envelope: { kind: 'unknown', version: 1, data: {} } };
    await db.table('receivedLevels').put(raw);
    failNextMutation(db, 'backups', 'creating', quota());
    expect(await createIndexedDBReceivedLevelRepository(db, clock).list()).toEqual({
      status: 'error',
      code: 'quota-exceeded',
    });
    expect(await db.table('receivedLevels').get(17)).toEqual(raw);
  });

  it('refuse de supprimer un reçu si sa construction porte une version future', async () => {
    const db = openDatabase();
    const parent = { id: receivedId, receivedAt: instant, envelope: receivedEnvelope() };
    const future = {
      scope: 'received',
      levelId: receivedId,
      envelope: { kind: 'player-construction', version: 2, data: {} },
    };
    await db.table('receivedLevels').put(parent);
    await db.table('playerConstructions').put(future);
    expect(await createIndexedDBReceivedLevelRepository(db, clock).delete(receivedId)).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await db.table('receivedLevels').get(receivedId)).toEqual(parent);
    expect(await db.table('playerConstructions').get(['received', receivedId])).toEqual(future);
  });

  it('refuse le reset si une construction de campagne porte une version future', async () => {
    const db = openDatabase();
    const repository = createIndexedDBProgressRepository(db, clock);
    await repository.save({ 'level-1': { resolved: true, bestObjectCount: 2 } });
    const before: unknown = await db.table<unknown>('progress').get('campaign');
    const future = {
      scope: 'campaign',
      levelId: 'level-1',
      envelope: { kind: 'player-construction', version: 2, data: {} },
    };
    await db.table('playerConstructions').put(future);
    expect(await repository.clear()).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await db.table('progress').get('campaign')).toEqual(before);
    expect(await db.table('playerConstructions').get(['campaign', 'level-1'])).toEqual(future);
  });
});
