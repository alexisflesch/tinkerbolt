import { describe, expect, it } from 'vitest';

import type { LevelDocument } from '../../domain/level-document';
import { receiveLevel, type LevelFingerprintResult } from './receive-level';
import type {
  ReceivedLevel,
  ReceivedLevelRepository,
  ReceivedLevelWriteResult,
} from './received-level-repository';

const locked = { move: false, rotate: false, remove: false } as const;

const puzzle: LevelDocument = {
  schemaVersion: 3,
  id: 'niveau-recu',
  metadata: { title: 'Niveau reçu', author: 'Lili' },
  objects: [
    {
      id: 'ball',
      type: 'ball',
      props: {},
      transform: { position: { x: 1, y: 1 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'basket',
      type: 'basket',
      props: {},
      transform: { position: { x: 8, y: 5 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'lever',
      type: 'lever',
      props: { position: 'left' },
      transform: { position: { x: 3, y: 5 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'fan',
      type: 'fan',
      props: { state: 'off' },
      transform: { position: { x: 5, y: 5 }, rotation: 0 },
      permissions: locked,
    },
  ],
  inventory: [
    {
      id: 'beams',
      type: 'beam',
      props: { size: 'short' },
      quantity: 1,
      permissions: { move: true, rotate: true, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
  buildZones: [],
  scene: { min: { x: 0, y: 0 }, max: { x: 10, y: 6 } },
  wires: [],
};

const fingerprint: LevelFingerprintResult = { status: 'ok', fingerprint: '0123456789abcdef' };
const clock = (): Date => new Date('2026-10-01T12:00:00.000Z');

const createMemoryRepository = (
  initial: readonly ReceivedLevel[] = [],
  saveResult?: ReceivedLevelWriteResult,
) => {
  const entries = new Map(initial.map((level) => [level.id, level]));
  const saves: ReceivedLevel[] = [];
  const repository: ReceivedLevelRepository = {
    list: () => Promise.resolve({ status: 'ok', ids: [...entries.keys()] }),
    load: (id) => Promise.resolve({ status: 'ok', level: entries.get(id) ?? null }),
    save: async (level) => {
      await Promise.resolve();
      saves.push(level);
      if (saveResult !== undefined) return saveResult;
      entries.set(level.id, level);
      return { status: 'ok' };
    },
    receive: async (incoming) => {
      await Promise.resolve();
      const existing = entries.get(incoming.id);
      const next =
        existing === undefined ? incoming : { ...existing, receivedAt: incoming.receivedAt };
      if (saveResult?.status === 'error') return saveResult;
      saves.push(next);
      entries.set(next.id, next);
      return { status: 'ok', level: next, isNew: existing === undefined };
    },
    recordVictory: () => Promise.resolve({ status: 'ok', level: null }),
    delete: async (id) => {
      await Promise.resolve();
      entries.delete(id);
      return { status: 'ok' };
    },
  };
  return { repository, entries, saves };
};

describe('recevoir un niveau (M8, ADR 0015 § Réception)', () => {
  it('enregistre un nouveau document sous `recu-<empreinte>`, non résolu, daté par l’horloge', async () => {
    const { repository, entries } = createMemoryRepository();

    const result = await receiveLevel(repository, puzzle, 'link', fingerprint, clock);

    const expected: ReceivedLevel = {
      id: 'recu-0123456789abcdef',
      document: puzzle,
      origin: 'link',
      receivedAt: '2026-10-01T12:00:00.000Z',
      solved: false,
    };
    expect(result).toEqual({ status: 'received', level: expected, isNew: true });
    expect([...entries.values()]).toEqual([expected]);
  });

  it('ne crée qu’une entrée pour le même document reçu deux fois, sans rien réinitialiser', async () => {
    const solved: ReceivedLevel = {
      id: 'recu-0123456789abcdef',
      document: puzzle,
      origin: 'link',
      receivedAt: '2026-09-30T08:00:00.000Z',
      solved: true,
      bestObjectCount: 2,
      playerSolution: {
        placements: [
          { inventoryId: 'beams', transform: { position: { x: 4, y: 3 }, rotation: 0 } },
        ],
      },
    };
    const { repository, entries } = createMemoryRepository([solved]);

    const first = await receiveLevel(repository, puzzle, 'file', fingerprint, clock);
    const second = await receiveLevel(repository, puzzle, 'link', fingerprint, clock);

    // M9: receiving it again only brings it back to the top (`receivedAt`).
    const refreshed: ReceivedLevel = { ...solved, receivedAt: '2026-10-01T12:00:00.000Z' };
    expect(first).toEqual({ status: 'received', level: refreshed, isNew: false });
    expect(second).toEqual({ status: 'received', level: refreshed, isNew: false });
    expect([...entries.values()]).toEqual([refreshed]);
  });

  it('remet en tête un niveau déjà gardé en ne changeant que `receivedAt` (M9)', async () => {
    const kept: ReceivedLevel = {
      id: 'recu-0123456789abcdef',
      document: puzzle,
      origin: 'link',
      receivedAt: '2026-09-30T08:00:00.000Z',
      solved: false,
    };
    const { repository, saves } = createMemoryRepository([kept]);

    const result = await receiveLevel(repository, puzzle, 'file', fingerprint, clock);

    const refreshed: ReceivedLevel = { ...kept, receivedAt: '2026-10-01T12:00:00.000Z' };
    expect(result).toEqual({ status: 'received', level: refreshed, isNew: false });
    // The origin stays the first one: the level was received by link.
    expect(saves).toEqual([refreshed]);
  });

  it('garde l’entrée telle quelle quand la remise en tête ne peut pas être écrite (M9)', async () => {
    const kept: ReceivedLevel = {
      id: 'recu-0123456789abcdef',
      document: puzzle,
      origin: 'file',
      receivedAt: '2026-09-30T08:00:00.000Z',
      solved: false,
    };
    const { repository, entries } = createMemoryRepository([kept], {
      status: 'error',
      code: 'quota-exceeded',
    });

    expect(await receiveLevel(repository, puzzle, 'link', fingerprint, clock)).toEqual({
      status: 'received',
      level: kept,
      isNew: false,
    });
    expect([...entries.values()]).toEqual([kept]);
  });

  it('refuse un document qui porte un objet ou un fil « à placer », avec un code stable', async () => {
    const { repository, saves } = createMemoryRepository();
    const withObjectToPlace: LevelDocument = {
      ...puzzle,
      objects: [
        ...puzzle.objects,
        {
          id: 'beam-a-placer',
          type: 'beam',
          props: { size: 'short' },
          transform: { position: { x: 4, y: 3 }, rotation: 0 },
          permissions: locked,
          toPlace: true,
        },
      ],
    };
    const withWireToPlace: LevelDocument = {
      ...puzzle,
      wires: [{ id: 'fil', sourceId: 'lever', targetId: 'fan', toPlace: true }],
    };

    expect(await receiveLevel(repository, withObjectToPlace, 'file', fingerprint, clock)).toEqual({
      status: 'refused',
      code: 'workshop-document',
    });
    expect(await receiveLevel(repository, withWireToPlace, 'link', fingerprint, clock)).toEqual({
      status: 'refused',
      code: 'workshop-document',
    });
    expect(saves).toEqual([]);
  });

  it('rend une erreur de quota comme un résultat', async () => {
    const { repository } = createMemoryRepository([], {
      status: 'error',
      code: 'quota-exceeded',
    });

    expect(await receiveLevel(repository, puzzle, 'link', fingerprint, clock)).toEqual({
      status: 'not-kept',
      code: 'quota-exceeded',
    });
  });

  it('rend une lecture impossible du dépôt comme un résultat, sans écrire', async () => {
    const { repository, saves } = createMemoryRepository();
    const unavailable: ReceivedLevelRepository = {
      ...repository,
      receive: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
    };

    expect(await receiveLevel(unavailable, puzzle, 'link', fingerprint, clock)).toEqual({
      status: 'not-kept',
      code: 'storage-unavailable',
    });
    expect(saves).toEqual([]);
  });

  it('ne garde rien quand l’empreinte n’a pas pu être calculée', async () => {
    const { repository, saves } = createMemoryRepository();

    expect(
      await receiveLevel(repository, puzzle, 'link', { status: 'unavailable' }, clock),
    ).toEqual({
      status: 'not-kept',
      code: 'fingerprint-unavailable',
    });
    expect(saves).toEqual([]);
  });
});
