import { describe, expect, it } from 'vitest';

import { createConstructionAttempt, placeFromInventory } from '../construction';
import type { ConstructionAttempt } from '../construction';
import type { LevelDocument } from '../../domain/level-document';
import { recordReceivedVictory } from './record-received-victory';
import type {
  ReceivedLevel,
  ReceivedLevelRepository,
  ReceivedLevelWriteResult,
} from './received-level-repository';

const locked = { move: false, rotate: false, remove: false } as const;

const level: LevelDocument = {
  schemaVersion: 2,
  id: 'niveau-recu',
  metadata: { title: 'Niveau reçu', author: 'Lili' },
  objects: [
    {
      id: 'ball',
      type: 'ball',
      props: {},
      transform: { position: { x: 2, y: 1 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'basket',
      type: 'basket',
      props: {},
      transform: { position: { x: 6.5, y: 5 }, rotation: 0 },
      permissions: locked,
    },
  ],
  inventory: [
    {
      id: 'beams',
      type: 'beam',
      props: { size: 'medium' },
      quantity: 2,
      permissions: { move: true, rotate: true, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
  buildZones: [{ min: { x: 0, y: 0 }, max: { x: 8, y: 6 } }],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 6 } },
  wires: [],
};

const id = 'recu-0123456789abcdef';

const entry = (extra: Partial<ReceivedLevel> = {}): ReceivedLevel => ({
  id,
  document: level,
  origin: 'link',
  receivedAt: '2026-09-30T08:00:00.000Z',
  solved: false,
  ...extra,
});

/** The attempt as launched: one beam per given x, all from the inventory. */
const attemptWithBeams = (...xs: readonly number[]): ConstructionAttempt =>
  xs.reduce((attempt, x, index) => {
    const placed = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'beams',
      placementId: `poutre-${String(index)}`,
      transform: { position: { x, y: 3 }, rotation: 0.4 },
    }).execute(attempt);
    if (placed.status === 'rejected') throw new Error(`pose refusée : ${placed.reason}`);
    return placed.state;
  }, createConstructionAttempt(level));

const createMemoryRepository = (
  initial: readonly ReceivedLevel[],
  saveResult?: ReceivedLevelWriteResult,
) => {
  const entries = new Map(initial.map((received) => [received.id, received]));
  const saves: ReceivedLevel[] = [];
  const repository: ReceivedLevelRepository = {
    list: () => Promise.resolve({ status: 'ok', ids: [...entries.keys()] }),
    load: (loadedId) => Promise.resolve({ status: 'ok', level: entries.get(loadedId) ?? null }),
    save: async (received) => {
      await Promise.resolve();
      saves.push(received);
      if (saveResult !== undefined) return saveResult;
      entries.set(received.id, received);
      return { status: 'ok' };
    },
    receive: (received) => Promise.resolve({ status: 'ok', level: received, isNew: true }),
    recordVictory: async (victoryId, _source, objectsUsed, playerSolution) => {
      await Promise.resolve();
      const existing = entries.get(victoryId);
      if (existing === undefined) return { status: 'ok', level: null };
      if (saveResult?.status === 'error') return saveResult;
      const next: ReceivedLevel = {
        ...existing,
        solved: true,
        bestObjectCount:
          existing.bestObjectCount === undefined
            ? objectsUsed
            : Math.min(existing.bestObjectCount, objectsUsed),
        playerSolution,
      };
      saves.push(next);
      entries.set(victoryId, next);
      return { status: 'ok', level: next };
    },
    delete: async (deletedId) => {
      await Promise.resolve();
      entries.delete(deletedId);
      return { status: 'ok' };
    },
  };
  return { repository, entries, saves };
};

describe('victoire sur un niveau reçu (M10, ADR 0015 § Victoire sur un niveau reçu)', () => {
  it('marque l’entrée résolue avec le nombre d’objets et la solution du lancement', async () => {
    const { repository, entries } = createMemoryRepository([entry()]);

    const result = await recordReceivedVictory(repository, id, level, attemptWithBeams(3));

    const expected = entry({
      solved: true,
      bestObjectCount: 1,
      playerSolution: {
        placements: [
          { inventoryId: 'beams', transform: { position: { x: 3, y: 3 }, rotation: 0.4 } },
        ],
      },
    });
    expect(result).toEqual({ status: 'recorded', level: expected });
    expect(entries.get(id)).toEqual(expected);
  });

  it('garde le meilleur record mais remplace la solution par la dernière victoire', async () => {
    const { repository, entries } = createMemoryRepository([entry()]);

    await recordReceivedVictory(repository, id, level, attemptWithBeams(3));
    await recordReceivedVictory(repository, id, level, attemptWithBeams(2, 5));

    expect(entries.get(id)).toEqual(
      entry({
        solved: true,
        bestObjectCount: 1,
        playerSolution: {
          placements: [
            { inventoryId: 'beams', transform: { position: { x: 2, y: 3 }, rotation: 0.4 } },
            { inventoryId: 'beams', transform: { position: { x: 5, y: 3 }, rotation: 0.4 } },
          ],
        },
      }),
    );
  });

  it('abaisse le record quand la victoire utilise moins d’objets', async () => {
    const { repository, entries } = createMemoryRepository([
      entry({ solved: true, bestObjectCount: 2, playerSolution: { placements: [] } }),
    ]);

    await recordReceivedVictory(repository, id, level, attemptWithBeams(3));

    expect(entries.get(id)?.bestObjectCount).toBe(1);
  });

  it('ne garde que l’entrée : le niveau reçu et sa date ne changent pas', async () => {
    const { repository, entries } = createMemoryRepository([entry({ origin: 'file' })]);

    await recordReceivedVictory(repository, id, level, attemptWithBeams());

    expect(entries.get(id)).toMatchObject({
      document: level,
      origin: 'file',
      receivedAt: '2026-09-30T08:00:00.000Z',
      bestObjectCount: 0,
      playerSolution: { placements: [] },
    });
  });

  it('n’écrit rien pour une entrée absente', async () => {
    const { repository, saves } = createMemoryRepository([]);

    expect(await recordReceivedVictory(repository, id, level, attemptWithBeams(3))).toEqual({
      status: 'not-found',
    });
    expect(saves).toEqual([]);
  });

  it('rend une erreur de stockage comme un résultat, sans lever', async () => {
    const { repository } = createMemoryRepository([entry()], {
      status: 'error',
      code: 'quota-exceeded',
    });
    const unreadable: ReceivedLevelRepository = {
      ...repository,
      recordVictory: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
    };

    expect(await recordReceivedVictory(repository, id, level, attemptWithBeams(3))).toEqual({
      status: 'not-kept',
      code: 'quota-exceeded',
    });
    expect(await recordReceivedVictory(unreadable, id, level, attemptWithBeams(3))).toEqual({
      status: 'not-kept',
      code: 'storage-unavailable',
    });
  });
});
