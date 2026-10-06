import { describe, expect, it } from 'vitest';

import type { LevelDocument } from '../../domain/level-document';
import type { DraftCreation, DraftRepository } from './draft-repository';
import { lastEditableCreationId } from './last-editable-creation';

const document = (id: string): LevelDocument => ({
  schemaVersion: 3,
  id,
  metadata: { title: id },
  objects: [],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
  buildZones: [],
  scene: { min: { x: 0, y: 0 }, max: { x: 16, y: 9 } },
  wires: [],
});

const repositoryOf = (updatedAtById: Readonly<Record<string, string>>): DraftRepository => {
  const entries = new Map<string, DraftCreation>(
    Object.entries(updatedAtById).map(([id, updatedAt]) => [
      id,
      { document: document(id), updatedAt },
    ]),
  );
  return {
    list: () => Promise.resolve({ status: 'ok', ids: [...entries.keys()] }),
    load: (id) => Promise.resolve({ status: 'ok', creation: entries.get(id) ?? null }),
    save: () => Promise.resolve({ status: 'ok' }),
    create: () => Promise.resolve({ status: 'ok' }),
    delete: () => Promise.resolve({ status: 'ok' }),
  };
};

const neverLocked = (): boolean => false;

describe('dernière création modifiée (ADR 0015, amendement du 6 octobre 2026)', () => {
  it('rend la création enregistrée le plus récemment', async () => {
    const repository = repositoryOf({
      'creation-a': '2026-10-01T12:00:00.000Z',
      'creation-b': '2026-10-03T12:00:00.000Z',
      'creation-c': '2026-10-02T12:00:00.000Z',
    });

    expect(await lastEditableCreationId(repository, neverLocked)).toBe('creation-b');
  });

  it('ignore la création d’un niveau de campagne verrouillé', async () => {
    const repository = repositoryOf({
      'creation-a': '2026-10-01T12:00:00.000Z',
      'niveau-2-brouillon': '2026-10-03T12:00:00.000Z',
    });

    expect(await lastEditableCreationId(repository, (id) => id === 'niveau-2-brouillon')).toBe(
      'creation-a',
    );
  });

  it('ne rend rien sans création ouvrable', async () => {
    expect(await lastEditableCreationId(repositoryOf({}), neverLocked)).toBeNull();
    expect(
      await lastEditableCreationId(
        repositoryOf({ 'niveau-2-brouillon': '2026-10-03T12:00:00.000Z' }),
        () => true,
      ),
    ).toBeNull();
  });

  it('ne rend rien quand le dépôt est illisible', async () => {
    const repository: DraftRepository = {
      ...repositoryOf({ 'creation-a': '2026-10-01T12:00:00.000Z' }),
      list: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
    };

    expect(await lastEditableCreationId(repository, neverLocked)).toBeNull();
  });
});
