import { describe, expect, it } from 'vitest';

import { embeddedWorkshopDocument } from '../../content/embedded-levels';
import type { LevelDocument } from '../../domain/level-document';
import type { DraftCreation, DraftCreationContent, DraftRepository } from './draft-repository';
import { saveFreeCreation, startFreeCreation } from './save-free-creation';

const workshop: LevelDocument = {
  schemaVersion: 2,
  id: 'free-workshop',
  metadata: { title: 'Atelier de niveau' },
  objects: [],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
  buildZones: [],
  scene: { min: { x: 0, y: 0 }, max: { x: 16, y: 9 } },
  wires: [],
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
    delete: () => Promise.resolve({ status: 'ok' }),
  };
  return { repository, entries, saves };
};

describe('atelier libre enregistré (M13, ADR 0015 § Atelier libre)', () => {
  it('enregistre le document sous `creation-<aléa>`, sans source, l’identifiant de l’atelier remplacé', async () => {
    const { repository, saves } = createMemoryRepository();

    const result = await startFreeCreation(repository, workshop, () => 'abc123');

    expect(result).toEqual({ status: 'ok', draftId: 'creation-abc123' });
    expect(saves).toEqual([{ document: { ...workshop, id: 'creation-abc123' } }]);
  });

  it('enregistre l’atelier embarqué sans description (M14b)', async () => {
    const { repository, saves } = createMemoryRepository();

    await startFreeCreation(repository, embeddedWorkshopDocument, () => 'abc123');

    expect(saves).toHaveLength(1);
    const metadata = saves[0]?.document.metadata;
    expect(metadata).toEqual({ title: 'Nouveau niveau' });
    expect(metadata !== undefined && 'description' in metadata).toBe(false);
  });

  it('tire un nouvel aléa quand l’identifiant est déjà pris', async () => {
    const taken: DraftCreation = {
      document: { ...workshop, id: 'creation-pris' },
      updatedAt: '2026-09-30T08:00:00.000Z',
    };
    const { repository, saves } = createMemoryRepository({ 'creation-pris': taken });
    const draws = ['pris', 'libre'];

    const result = await startFreeCreation(repository, workshop, () => draws.shift() ?? 'epuise');

    expect(result).toEqual({ status: 'ok', draftId: 'creation-libre' });
    expect(saves.map(({ document }) => document.id)).toEqual(['creation-libre']);
  });

  it('rend l’erreur du dépôt sans rien enregistrer quand il ne se lit pas', async () => {
    const { repository, saves } = createMemoryRepository();
    const unreadable: DraftRepository = {
      ...repository,
      create: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
    };

    expect(await startFreeCreation(unreadable, workshop, () => 'abc')).toEqual({
      status: 'error',
      code: 'storage-unavailable',
    });
    expect(saves).toEqual([]);
  });

  it('rend un quota dépassé en résultat', async () => {
    const { repository } = createMemoryRepository();
    const full: DraftRepository = {
      ...repository,
      create: () => Promise.resolve({ status: 'error', code: 'quota-exceeded' }),
    };

    expect(await startFreeCreation(full, workshop, () => 'abc')).toEqual({
      status: 'error',
      code: 'quota-exceeded',
    });
  });

  it('enregistre les modifications suivantes sous le même identifiant, sans source', async () => {
    const { repository, saves } = createMemoryRepository();
    const edited: LevelDocument = { ...workshop, metadata: { title: 'Mon niveau' } };

    expect(await saveFreeCreation(repository, 'creation-abc123', edited)).toEqual({ status: 'ok' });

    expect(saves).toEqual([{ document: { ...edited, id: 'creation-abc123' } }]);
  });
});
