import { describe, expect, it } from 'vitest';

import { levelDocumentSchema, type LevelDocument } from '../../domain/level-document';
import { creationFromLevel } from './creation-from-level';
import type { DraftCreation, DraftCreationContent, DraftRepository } from './draft-repository';
import { saveCreationFromLevel } from './save-creation-from-level';

const locked = { move: false, rotate: false, remove: false } as const;

/** A received level: decor, one beam to place, the author's solution. */
const level: LevelDocument = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'recu-0123456789abcdef',
  metadata: { title: 'Le saut', author: 'Lili' },
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
  solution: {
    placements: [{ inventoryId: 'beams', transform: { position: { x: 3, y: 3 }, rotation: 0 } }],
  },
});

const playerSolution = {
  placements: [{ inventoryId: 'beams', transform: { position: { x: 6, y: 4 }, rotation: 0.5 } }],
};

const createMemoryRepository = (initial: Readonly<Record<string, DraftCreation>> = {}) => {
  const entries = new Map(Object.entries(initial));
  const saves: DraftCreationContent[] = [];
  const repository: DraftRepository = {
    list: () => Promise.resolve({ status: 'ok', ids: [...entries.keys()] }),
    load: (id) => Promise.resolve({ status: 'ok', creation: entries.get(id) ?? null }),
    save: async (creation) => {
      await Promise.resolve();
      saves.push(creation);
      entries.set(creation.document.id, { ...creation, updatedAt: '2026-10-01T12:00:00.000Z' });
      return { status: 'ok' };
    },
    create: async (creation) => {
      await Promise.resolve();
      if (entries.has(creation.document.id)) return { status: 'error', code: 'identity-collision' };
      saves.push(creation);
      entries.set(creation.document.id, { ...creation, updatedAt: '2026-10-01T12:00:00.000Z' });
      return { status: 'ok' };
    },
    delete: async (id) => {
      await Promise.resolve();
      entries.delete(id);
      return { status: 'ok' };
    },
  };
  return { repository, saves };
};

describe('enregistrer une création depuis un niveau (M11, ADR 0015 § Points d’entrée)', () => {
  it('enregistre sous `creation-<aléa>` la création du niveau avec la solution du joueur', async () => {
    const { repository, saves } = createMemoryRepository();
    const pristine = structuredClone(level);

    const result = await saveCreationFromLevel(repository, level, {
      playerSolution,
      createId: () => 'abc',
    });

    expect(result).toEqual({ status: 'ok', draftId: 'creation-abc' });
    expect(saves).toEqual([
      creationFromLevel(level, { playerSolution, createId: () => 'creation-abc' }),
    ]);
    const posed = saves[0]?.document.objects.filter(({ toPlace }) => toPlace === true);
    expect(posed?.map(({ transform }) => transform)).toEqual([
      playerSolution.placements[0]?.transform,
    ]);
    expect(level).toEqual(pristine);
  });

  it('ne pose aucun objet sans solution du joueur', async () => {
    const { repository, saves } = createMemoryRepository();

    await saveCreationFromLevel(repository, level, { createId: () => 'abc' });

    expect(saves[0]?.document.objects.some(({ toPlace }) => toPlace === true)).toBe(false);
    expect(saves[0]?.source).toEqual(level);
  });

  it('tire un nouvel aléa quand l’identifiant est déjà pris', async () => {
    const taken = creationFromLevel(level, { createId: () => 'creation-pris' });
    const { repository, saves } = createMemoryRepository({
      'creation-pris': { ...taken, updatedAt: '2026-09-01T00:00:00.000Z' },
    });
    const parts = ['pris', 'libre'];

    const result = await saveCreationFromLevel(repository, level, {
      createId: () => parts.shift() ?? 'fin',
    });

    expect(result).toEqual({ status: 'ok', draftId: 'creation-libre' });
    expect(saves.map(({ document }) => document.id)).toEqual(['creation-libre']);
  });

  it('rend une erreur du dépôt en résultat, sans exception', async () => {
    const { repository } = createMemoryRepository();
    const full: DraftRepository = {
      ...repository,
      create: () => Promise.resolve({ status: 'error', code: 'quota-exceeded' }),
    };
    const unreadable: DraftRepository = {
      ...repository,
      create: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
    };

    expect(await saveCreationFromLevel(full, level, { createId: () => 'abc' })).toEqual({
      status: 'error',
      code: 'quota-exceeded',
    });
    expect(await saveCreationFromLevel(unreadable, level, { createId: () => 'abc' })).toEqual({
      status: 'error',
      code: 'storage-unavailable',
    });
  });
});
