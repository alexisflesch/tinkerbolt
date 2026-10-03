import { describe, expect, it } from 'vitest';

import { MAX_TITLE_LENGTH, type LevelDocument } from '../../domain/level-document';
import type { DraftCreation, DraftCreationContent, DraftRepository } from './draft-repository';
import { duplicateCreation } from './duplicate-creation';

const locked = { move: false, rotate: false, remove: false } as const;

const workshop = (id: string, title: string): LevelDocument => ({
  schemaVersion: 2,
  id,
  metadata: { title, basedOn: [{ title: 'Le niveau d’origine', author: 'Lili' }] },
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
      id: 'beam',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 4, y: 3 }, rotation: 0 },
      permissions: locked,
      toPlace: true,
    },
  ],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
  buildZones: [],
  scene: { min: { x: 0, y: 0 }, max: { x: 10, y: 6 } },
  wires: [],
});

const source: LevelDocument = { ...workshop('le-niveau', 'Le niveau d’origine'), objects: [] };

const createMemoryRepository = (initial: Readonly<Record<string, DraftCreation>>) => {
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
  return { repository, entries, saves };
};

describe('dupliquer une création (M9, ADR 0015 § Page « Mes niveaux »)', () => {
  it('enregistre une nouvelle création `creation-<aléa>` titrée « (copie) », avec la même source', async () => {
    const original: DraftCreation = {
      document: workshop('campaign-01-brouillon', 'Mon remix'),
      source,
      updatedAt: '2026-09-30T08:00:00.000Z',
    };
    const { repository, entries, saves } = createMemoryRepository({
      'campaign-01-brouillon': original,
    });

    const result = await duplicateCreation(repository, 'campaign-01-brouillon', () => 'abc123');

    expect(result).toEqual({ status: 'ok', draftId: 'creation-abc123' });
    expect(saves).toEqual([
      {
        document: {
          ...original.document,
          id: 'creation-abc123',
          metadata: { ...original.document.metadata, title: 'Mon remix (copie)' },
        },
        source,
      },
    ]);
    // The original stays as it was.
    expect(entries.get('campaign-01-brouillon')).toEqual(original);
  });

  it('garde la description et les autres métadonnées de l’original (M14b)', async () => {
    const base = workshop('creation-1', 'Mon remix');
    const { repository, saves } = createMemoryRepository({
      'creation-1': {
        document: {
          ...base,
          metadata: { ...base.metadata, description: 'Ma description', author: 'Lili' },
        },
        updatedAt: '2026-09-30T08:00:00.000Z',
      },
    });

    await duplicateCreation(repository, 'creation-1', () => 'f00d');

    expect(saves[0]?.document.metadata).toEqual({
      title: 'Mon remix (copie)',
      description: 'Ma description',
      author: 'Lili',
      basedOn: [{ title: 'Le niveau d’origine', author: 'Lili' }],
    });
  });

  it('duplique une création sans source sans lui en inventer une', async () => {
    const { repository, saves } = createMemoryRepository({
      'creation-1': {
        document: workshop('creation-1', 'De zéro'),
        updatedAt: '2026-09-30T08:00:00.000Z',
      },
    });

    await duplicateCreation(repository, 'creation-1', () => 'f00d');

    expect(saves).toHaveLength(1);
    expect(saves[0]).not.toHaveProperty('source');
  });

  it('tronque le titre d’origine pour garder « (copie) » entier', async () => {
    const { repository, saves } = createMemoryRepository({
      'creation-1': {
        document: workshop('creation-1', 'a'.repeat(MAX_TITLE_LENGTH)),
        updatedAt: '2026-09-30T08:00:00.000Z',
      },
    });

    await duplicateCreation(repository, 'creation-1', () => 'f00d');

    const title = saves[0]?.document.metadata.title ?? '';
    expect(title).toHaveLength(MAX_TITLE_LENGTH);
    expect(title).toBe(`${'a'.repeat(MAX_TITLE_LENGTH - ' (copie)'.length)} (copie)`);
  });

  it('tire un autre aléa quand l’identifiant est déjà pris', async () => {
    const { repository } = createMemoryRepository({
      'creation-1': {
        document: workshop('creation-1', 'Prise'),
        updatedAt: '2026-09-30T08:00:00.000Z',
      },
    });
    const draws = ['1', '2'];

    expect(await duplicateCreation(repository, 'creation-1', () => draws.shift() ?? 'x')).toEqual({
      status: 'ok',
      draftId: 'creation-2',
    });
  });

  it('rend une erreur sans rien écrire pour une création introuvable ou illisible', async () => {
    const { repository, saves } = createMemoryRepository({});
    const unavailable: DraftRepository = {
      ...repository,
      load: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
    };

    expect(await duplicateCreation(repository, 'absente', () => 'f00d')).toEqual({
      status: 'error',
      code: 'invalid-draft',
    });
    expect(await duplicateCreation(unavailable, 'absente', () => 'f00d')).toEqual({
      status: 'error',
      code: 'storage-unavailable',
    });
    expect(saves).toEqual([]);
  });

  it('rend une erreur de quota comme un résultat', async () => {
    const { repository } = createMemoryRepository({
      'creation-1': {
        document: workshop('creation-1', 'Pleine'),
        updatedAt: '2026-09-30T08:00:00.000Z',
      },
    });
    const full: DraftRepository = {
      ...repository,
      create: () => Promise.resolve({ status: 'error', code: 'quota-exceeded' }),
    };

    expect(await duplicateCreation(full, 'creation-1', () => 'f00d')).toEqual({
      status: 'error',
      code: 'quota-exceeded',
    });
  });
});
