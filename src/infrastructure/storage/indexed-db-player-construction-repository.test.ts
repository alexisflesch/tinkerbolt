import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { embeddedLevels } from '../../content/embedded-levels';
import { createConstructionAttempt, placeFromInventory } from '../../application/construction';
import { createIndexedDBReceivedLevelRepository } from './indexed-db-received-level-repository';
import { createIndexedDBProgressRepository } from './indexed-db-progress-repository';
import { createTinkerboltDatabase } from './tinkerbolt-database';
import { createIndexedDBPlayerConstructionRepository } from './indexed-db-player-construction-repository';
import { preparePlayerConstructionSource } from '../player-construction/player-construction-codec';
import { encodeLevelFile } from '../level-file/level-file-codec';

const level = embeddedLevels[0];
if (level === undefined) throw new Error('Missing test level');
const document = level;
const instant = '2026-10-04T12:00:00.000Z';
const clock = () => new Date(instant);
const receivedId = 'recu-0123456789abcdef';
const quota = () => new DOMException('Quota', 'QuotaExceededError');
const databases: ReturnType<typeof createTinkerboltDatabase>[] = [];
const open = (factory = new IDBFactory(), name = 'construction-tests') => {
  const db = createTinkerboltDatabase({ name, indexedDB: factory, IDBKeyRange });
  databases.push(db);
  return db;
};
afterEach(() => {
  databases.splice(0).forEach((db) => {
    db.close();
  });
  vi.restoreAllMocks();
});
const prepared = async (scope: 'campaign' | 'received' = 'campaign', sourceDocument = document) => {
  const result = await preparePlayerConstructionSource(
    scope,
    scope === 'received' ? receivedId : sourceDocument.id,
    sourceDocument,
  );
  if (result.status !== 'ok') throw new Error(result.code);
  return result.source;
};
const attempt = () => {
  const placed = placeFromInventory({
    context: 'player',
    inventoryEntryId: 'beam-a-placer',
    placementId: 'player-beam',
    transform: { position: { x: 7, y: 4 }, rotation: 0.3 },
  }).execute(createConstructionAttempt(document));
  if (placed.status !== 'accepted') throw new Error(placed.reason);
  return placed.state;
};

describe('persistance des constructions de joueur', () => {
  it.each([
    ['campaign', false],
    ['campaign', true],
    ['received', false],
    ['received', true],
  ] as const)(
    'migre une construction v2 seulement si sa source est identique (%s, modifiée : %s)',
    async (scope, changed) => {
      const db = open();
      const levelId = scope === 'campaign' ? document.id : receivedId;
      if (scope === 'received')
        await createIndexedDBReceivedLevelRepository(db, clock).save({
          id: receivedId,
          document,
          origin: 'file',
          receivedAt: instant,
          solved: false,
        });
      const oldSource = { ...document, schemaVersion: 2 };
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`${JSON.stringify(oldSource, null, 2)}\n`),
      );
      const fingerprint = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      const state = attempt();
      await db.table('playerConstructions').put({
        scope,
        levelId,
        envelope: {
          kind: 'player-construction',
          version: 1,
          data: {
            scope,
            levelId,
            sourceFingerprint: fingerprint,
            updatedAt: instant,
            attempt: { ...state, document: { ...state.document, schemaVersion: 2 } },
          },
        },
      });
      const source = await prepared(
        scope,
        changed
          ? { ...document, metadata: { ...document.metadata, title: 'Source modifiée' } }
          : document,
      );
      if (scope === 'received' && changed)
        await createIndexedDBReceivedLevelRepository(db, clock).save({
          id: receivedId,
          document: source.document,
          origin: 'file',
          receivedAt: instant,
          solved: false,
        });
      const result = await createIndexedDBPlayerConstructionRepository(db, clock).load(source);
      expect(result).toEqual(
        changed
          ? { status: 'ok', attempt: null, warning: 'source-changed' }
          : { status: 'ok', attempt: state },
      );
      const row: unknown = await db.table('playerConstructions').get([scope, levelId]);
      if (changed) expect(row).toBeUndefined();
      else
        expect(row).toMatchObject({
          envelope: {
            data: {
              sourceFingerprint: source.sourceFingerprint,
              attempt: { document: { schemaVersion: 3 } },
            },
          },
        });
      expect(await db.table('backups').count()).toBe(0);
    },
  );

  it('préserve un document de tentative futur dans une enveloppe courante', async () => {
    const db = open();
    const source = await prepared();
    const state = attempt();
    const raw = {
      scope: 'campaign',
      levelId: document.id,
      envelope: {
        kind: 'player-construction',
        version: 1,
        data: {
          scope: 'campaign',
          levelId: document.id,
          sourceFingerprint: source.sourceFingerprint,
          updatedAt: instant,
          attempt: { ...state, document: { ...state.document, schemaVersion: 4 } },
        },
      },
    };
    await db.table('playerConstructions').put(raw);
    const repo = createIndexedDBPlayerConstructionRepository(db, clock);
    expect(await repo.load(source)).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await repo.save(source, state)).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await repo.delete(source)).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await db.table('playerConstructions').get(['campaign', document.id])).toEqual(raw);
    expect(await db.table('backups').count()).toBe(0);
  });

  it('sauvegarde une enveloppe datée puis retrouve la tentative après réouverture', async () => {
    const factory = new IDBFactory();
    const db = open(factory);
    const source = await prepared();
    const state = attempt();
    expect(
      await createIndexedDBPlayerConstructionRepository(db, clock).save(source, state),
    ).toEqual({ status: 'ok' });
    expect(await db.table('playerConstructions').get(['campaign', document.id])).toEqual({
      scope: 'campaign',
      levelId: document.id,
      envelope: {
        kind: 'player-construction',
        version: 1,
        data: {
          scope: 'campaign',
          levelId: document.id,
          sourceFingerprint: source.sourceFingerprint,
          updatedAt: instant,
          attempt: state,
        },
      },
    });
    db.close();
    expect(
      await createIndexedDBPlayerConstructionRepository(open(factory), clock).load(source),
    ).toEqual({ status: 'ok', attempt: state });
    expect(source.document).toEqual(document);
  });

  it('calcule le SHA-256 complet des octets canoniques et conserve une source immuable', async () => {
    const source = await prepared();
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(encodeLevelFile(document)),
    );
    expect(source.sourceFingerprint).toBe(
      Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(''),
    );
    expect(Object.isFrozen(source.document.metadata)).toBe(true);
    expect(
      (
        await prepared('campaign', {
          ...document,
          metadata: { ...document.metadata, title: 'Titre corrigé' },
        })
      ).sourceFingerprint,
    ).not.toBe(source.sourceFingerprint);
  });

  it('refuse une identité source invalide et signale une empreinte indisponible', async () => {
    expect(
      await preparePlayerConstructionSource('received', 'not-a-received-id', document),
    ).toEqual({ status: 'error', code: 'invalid-construction' });
    expect(await preparePlayerConstructionSource('campaign', 'another-level', document)).toEqual({
      status: 'error',
      code: 'invalid-construction',
    });
    vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('Unavailable'));
    expect(await preparePlayerConstructionSource('campaign', document.id, document)).toEqual({
      status: 'error',
      code: 'fingerprint-unavailable',
    });
  });

  it('ne remplace jamais la dernière construction avec une tentative invalide', async () => {
    const db = open();
    const source = await prepared();
    const repo = createIndexedDBPlayerConstructionRepository(db, clock);
    const state = attempt();
    await repo.save(source, state);
    expect(await repo.save(source, { ...state, provenance: {} })).toEqual({
      status: 'error',
      code: 'invalid-construction',
    });
    expect(await repo.load(source)).toEqual({ status: 'ok', attempt: state });
    expect(await db.table('backups').count()).toBe(0);
  });

  it.each(['provenance', 'key', 'index', 'date', 'unknown-field'])(
    'secourt atomiquement la corruption %s',
    async (corruption) => {
      const db = open();
      const source = await prepared();
      const repo = createIndexedDBPlayerConstructionRepository(db, clock);
      await repo.save(source, attempt());
      const raw: unknown = await db.table('playerConstructions').get(['campaign', document.id]);
      const state = attempt();
      const row = {
        scope: 'campaign',
        levelId: document.id,
        envelope: {
          kind: 'player-construction',
          version: 1,
          data: {
            scope: 'campaign',
            levelId: document.id,
            sourceFingerprint: source.sourceFingerprint,
            updatedAt: instant,
            attempt: state,
          },
        },
      };
      const broken =
        corruption === 'provenance'
          ? {
              ...row,
              envelope: {
                ...row.envelope,
                data: { ...row.envelope.data, attempt: { ...state, provenance: {} } },
              },
            }
          : corruption === 'key'
            ? {
                ...row,
                envelope: {
                  ...row.envelope,
                  data: { ...row.envelope.data, levelId: 'other-level' },
                },
              }
            : corruption === 'index'
              ? { ...row, scope: 'received' }
              : corruption === 'date'
                ? {
                    ...row,
                    envelope: {
                      ...row.envelope,
                      data: { ...row.envelope.data, updatedAt: 'bad-date' },
                    },
                  }
                : { ...row, extra: true };
      if (corruption === 'index') {
        // Keep the actual primary key while injecting a disagreeing indexed envelope.
        await db.table('playerConstructions').put({
          ...row,
          envelope: { ...row.envelope, data: { ...row.envelope.data, scope: 'received' } },
        });
      } else await db.table('playerConstructions').put(broken);
      expect(raw).toBeDefined();
      expect(await repo.load(source)).toEqual({
        status: 'ok',
        attempt: null,
        warning: 'invalid-data-backed-up',
      });
      expect(await db.table('playerConstructions').count()).toBe(0);
      expect(await db.table('backups').toArray()).toMatchObject([
        { table: 'playerConstructions', key: ['campaign', document.id], reason: 'invalid-data' },
      ]);
    },
  );

  it('garde la corruption originale si le secours échoue', async () => {
    const db = open();
    const source = await prepared();
    const raw = { scope: 'campaign', levelId: document.id, envelope: null };
    await db.table('playerConstructions').put(raw);
    db.table('backups').hook('creating', () => {
      throw quota();
    });
    const repo = createIndexedDBPlayerConstructionRepository(db, clock);
    expect(await repo.load(source)).toEqual({ status: 'error', code: 'quota-exceeded' });
    expect(await repo.save(source, attempt())).toEqual({ status: 'error', code: 'quota-exceeded' });
    expect(await repo.delete(source)).toEqual({ status: 'error', code: 'quota-exceeded' });
    expect(await db.table('playerConstructions').get(['campaign', document.id])).toEqual(raw);
  });

  it('secourt avant remplacement et annule le secours si l’écriture finale échoue', async () => {
    const db = open();
    const source = await prepared();
    const raw = { scope: 'campaign', levelId: document.id, envelope: null };
    await db.table('playerConstructions').put(raw);
    const fail = () => {
      throw quota();
    };
    db.table('playerConstructions').hook('creating', fail);
    const repo = createIndexedDBPlayerConstructionRepository(db, clock);
    expect(await repo.save(source, attempt())).toEqual({ status: 'error', code: 'quota-exceeded' });
    expect(await db.table('playerConstructions').get(['campaign', document.id])).toEqual(raw);
    expect(await db.table('backups').count()).toBe(0);
    db.table('playerConstructions').hook('creating').unsubscribe(fail);
    expect(await repo.save(source, attempt())).toEqual({
      status: 'ok',
      warning: 'invalid-data-backed-up',
    });
  });

  it('préserve une enveloppe future lors de lecture, écriture et suppression', async () => {
    const db = open();
    const source = await prepared();
    const raw = {
      scope: 'campaign',
      levelId: document.id,
      envelope: { kind: 'player-construction', version: 2 },
    };
    await db.table('playerConstructions').put(raw);
    const repo = createIndexedDBPlayerConstructionRepository(db, clock);
    expect(await repo.load(source)).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await repo.save(source, attempt())).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    expect(await repo.delete(source)).toEqual({ status: 'error', code: 'unsupported-version' });
    expect(await db.table('playerConstructions').get(['campaign', document.id])).toEqual(raw);
    expect(await db.table('backups').count()).toBe(0);
  });

  it('supprime une construction incompatible sans secours et avertit', async () => {
    const db = open();
    const source = await prepared();
    const repo = createIndexedDBPlayerConstructionRepository(db, clock);
    await repo.save(source, attempt());
    const current = await prepared('campaign', {
      ...document,
      metadata: { ...document.metadata, title: 'Titre corrigé' },
    });
    expect(await repo.load(current)).toEqual({
      status: 'ok',
      attempt: null,
      warning: 'source-changed',
    });
    expect(await db.table('playerConstructions').count()).toBe(0);
    expect(await db.table('backups').count()).toBe(0);
  });

  it('ne confirme aucune reprise incohérente si la suppression incompatible échoue', async () => {
    const db = open();
    const source = await prepared();
    const repo = createIndexedDBPlayerConstructionRepository(db, clock);
    await repo.save(source, attempt());
    db.table('playerConstructions').hook('deleting', () => {
      throw quota();
    });
    const current = await prepared('campaign', {
      ...document,
      metadata: { ...document.metadata, title: 'Titre corrigé' },
    });
    expect(await repo.load(current)).toEqual({
      status: 'error',
      code: 'quota-exceeded',
      operation: 'delete-incompatible',
    });
    expect(await repo.delete(source)).toEqual({ status: 'error', code: 'quota-exceeded' });
    expect(await db.table('playerConstructions').count()).toBe(1);
  });

  it('vérifie dans la transaction la présence et la source du parent reçu', async () => {
    const db = open();
    const source = await prepared('received');
    const repo = createIndexedDBPlayerConstructionRepository(db, clock);
    expect(await repo.save(source, attempt())).toEqual({
      status: 'error',
      code: 'source-not-found',
    });
    const received = createIndexedDBReceivedLevelRepository(db, clock);
    await received.receive({
      id: receivedId,
      document,
      origin: 'file',
      receivedAt: instant,
      solved: false,
    });
    expect(await repo.save(source, attempt())).toEqual({ status: 'ok' });
    expect(await repo.load(source)).toEqual({ status: 'ok', attempt: attempt() });
    const changed = await prepared('received', { ...document, metadata: { title: 'Autre reçu' } });
    expect(await repo.save(changed, createConstructionAttempt(changed.document))).toEqual({
      status: 'error',
      code: 'source-changed',
    });
    await received.delete(receivedId);
    expect(await repo.save(source, attempt())).toEqual({
      status: 'error',
      code: 'source-not-found',
    });
    expect(await db.table('playerConstructions').count()).toBe(0);
  });

  it('supprime reçu et construction ensemble avec rollback', async () => {
    const db = open();
    const source = await prepared('received');
    const received = createIndexedDBReceivedLevelRepository(db, clock);
    await received.receive({
      id: receivedId,
      document,
      origin: 'file',
      receivedAt: instant,
      solved: false,
    });
    await createIndexedDBPlayerConstructionRepository(db, clock).save(source, attempt());
    const fail = () => {
      throw quota();
    };
    db.table('playerConstructions').hook('deleting', fail);
    expect(await received.delete(receivedId)).toEqual({ status: 'error', code: 'quota-exceeded' });
    expect(await db.table('receivedLevels').count()).toBe(1);
    expect(await db.table('playerConstructions').count()).toBe(1);
    db.table('playerConstructions').hook('deleting').unsubscribe(fail);
    expect(await received.delete(receivedId)).toEqual({ status: 'ok' });
    expect(await db.table('receivedLevels').count()).toBe(0);
    expect(await db.table('playerConstructions').count()).toBe(0);
  });

  it('efface progression et constructions campagne atomiquement en conservant les reçus', async () => {
    const db = open();
    const campaign = await prepared();
    const receivedSource = await prepared('received');
    const received = createIndexedDBReceivedLevelRepository(db, clock);
    await received.receive({
      id: receivedId,
      document,
      origin: 'file',
      receivedAt: instant,
      solved: false,
    });
    const repo = createIndexedDBPlayerConstructionRepository(db, clock);
    await repo.save(campaign, attempt());
    await repo.save(receivedSource, attempt());
    const progress = createIndexedDBProgressRepository(db, clock);
    await progress.recordVictory(document.id, 1);
    const fail = () => {
      throw quota();
    };
    db.table('playerConstructions').hook('deleting', fail);
    expect(await progress.clear()).toEqual({ status: 'error', code: 'quota-exceeded' });
    expect(await db.table('progress').count()).toBe(1);
    expect(await db.table('playerConstructions').count()).toBe(2);
    db.table('playerConstructions').hook('deleting').unsubscribe(fail);
    expect(await progress.clear()).toEqual({ status: 'ok' });
    expect(await db.table('progress').count()).toBe(0);
    expect(await repo.load(campaign)).toEqual({ status: 'ok', attempt: null });
    expect(await repo.load(receivedSource)).toEqual({ status: 'ok', attempt: attempt() });
  });

  it.each(['campaign', 'received'] as const)(
    'secourt une construction corrompue lors de la suppression liée %s',
    async (scope) => {
      const db = open();
      const source = await prepared(scope);
      const received = createIndexedDBReceivedLevelRepository(db, clock);
      if (scope === 'received')
        await received.receive({
          id: receivedId,
          document,
          origin: 'file',
          receivedAt: instant,
          solved: false,
        });
      const raw = { scope, levelId: source.levelId, envelope: null };
      await db.table('playerConstructions').put(raw);
      const result =
        scope === 'campaign'
          ? await createIndexedDBProgressRepository(db, clock).clear()
          : await received.delete(receivedId);
      expect(result).toEqual({ status: 'ok', warning: 'invalid-data-backed-up' });
      expect(await db.table('backups').toArray()).toMatchObject([
        { table: 'playerConstructions', rawValue: raw },
      ]);
      expect(await db.table('playerConstructions').count()).toBe(0);
    },
  );

  it.each(['campaign', 'received'] as const)(
    'annule la suppression liée %s si le secours construction échoue',
    async (scope) => {
      const db = open();
      const source = await prepared(scope);
      const received = createIndexedDBReceivedLevelRepository(db, clock);
      const progress = createIndexedDBProgressRepository(db, clock);
      if (scope === 'received')
        await received.receive({
          id: receivedId,
          document,
          origin: 'file',
          receivedAt: instant,
          solved: false,
        });
      else await progress.recordVictory(document.id, 1);
      const raw = { scope, levelId: source.levelId, envelope: null };
      await db.table('playerConstructions').put(raw);
      db.table('backups').hook('creating', () => {
        throw quota();
      });
      expect(
        scope === 'campaign' ? await progress.clear() : await received.delete(receivedId),
      ).toEqual({ status: 'error', code: 'quota-exceeded' });
      expect(await db.table('playerConstructions').get([scope, source.levelId])).toEqual(raw);
      expect(await db.table(scope === 'campaign' ? 'progress' : 'receivedLevels').count()).toBe(1);
    },
  );

  it('retourne des résultats maîtrisés pour quota, horloge invalide et base indisponible', async () => {
    const db = open();
    const source = await prepared();
    const repo = createIndexedDBPlayerConstructionRepository(db, clock);
    db.table('playerConstructions').hook('creating', () => {
      throw quota();
    });
    expect(await repo.save(source, attempt())).toEqual({ status: 'error', code: 'quota-exceeded' });
    expect(
      await createIndexedDBPlayerConstructionRepository(db, () => new Date(NaN)).save(
        source,
        attempt(),
      ),
    ).toEqual({ status: 'error', code: 'invalid-construction' });
    db.close({ disableAutoOpen: true });
    expect(await repo.load(source)).toEqual({ status: 'error', code: 'storage-unavailable' });
    expect(await repo.save(source, attempt())).toEqual({
      status: 'error',
      code: 'storage-unavailable',
    });
    expect(await repo.delete(source)).toEqual({ status: 'error', code: 'storage-unavailable' });
  });
});
