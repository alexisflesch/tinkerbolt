import { describe, expect, it } from 'vitest';

import { sketchLevels as embeddedLevels } from '../../../test/fixtures/sketch-campaign';
import type { LevelDocument } from '../../domain/level-document';
import { createConstructionAttempt, movePlacement } from '../construction/construction-attempt';
import { executeCommand, createHistory } from '../history';
import { workshopFromPuzzle } from '../puzzle/puzzle-workshop';
import type { DraftCreationContent, DraftRepository } from './draft-repository';

import { campaignDraftId, openCampaignDraft } from './campaign-draft';
import { creationFromLevel } from './creation-from-level';

const levelTwo = embeddedLevels.find(({ id }) => id === 'campaign-02-par-dessus-le-mur');
if (levelTwo === undefined) throw new Error('Niveau 2 embarqué introuvable.');

const updatedAt = '2026-10-01T12:00:00.000Z';

const levelTwoCreation = (): DraftCreationContent =>
  creationFromLevel(levelTwo, { createId: () => campaignDraftId(levelTwo) });

const createMemoryDraftRepository = (initial: readonly LevelDocument[] = []) => {
  const drafts = new Map(initial.map((document) => [document.id, document]));
  const saved: DraftCreationContent[] = [];
  const repository: DraftRepository = {
    list: () => Promise.resolve({ status: 'ok', ids: [...drafts.keys()] }),
    load: async (id) => {
      await Promise.resolve();
      const document = drafts.get(id);
      return { status: 'ok', creation: document === undefined ? null : { document, updatedAt } };
    },
    save: async (creation) => {
      await Promise.resolve();
      const { document } = creation;
      saved.push(creation);
      drafts.set(document.id, document);
      return { status: 'ok' };
    },
    create: async (creation) => {
      await Promise.resolve();
      if (drafts.has(creation.document.id)) return { status: 'error', code: 'identity-collision' };
      saved.push(creation);
      drafts.set(creation.document.id, creation.document);
      return { status: 'ok' };
    },
    delete: async (id) => {
      await Promise.resolve();
      drafts.delete(id);
      return { status: 'ok' };
    },
  };
  return { repository, saved };
};

describe('brouillon d’un niveau de la campagne (U17)', () => {
  it('ouvre un niveau à solution sans la poser, le niveau gardé intact comme source (M6, ADR 0015)', async () => {
    const puzzle: LevelDocument = {
      ...levelTwo,
      solution: {
        placements: [
          {
            inventoryId: levelTwo.inventory[0]?.id ?? '',
            transform: { position: { x: 4, y: 2 }, rotation: 0 },
          },
        ],
      },
    };
    const { repository, saved } = createMemoryDraftRepository();

    await openCampaignDraft(repository, puzzle);

    expect(saved).toHaveLength(1);
    const [creation] = saved;
    expect(creation?.document.solution).toBeUndefined();
    expect(creation?.document.inventory).toEqual([]);
    expect(creation?.document.objects).toEqual(levelTwo.objects);
    expect(creation?.source).toEqual(puzzle);
  });

  it('enregistre la création sous un identifiant distinct et un titre « (remix) », sans toucher l’original (M6, ADR 0016)', async () => {
    const original = structuredClone(levelTwo);
    const { repository, saved } = createMemoryDraftRepository();

    expect(await openCampaignDraft(repository, levelTwo)).toEqual({
      status: 'ok',
      draftId: 'campaign-02-par-dessus-le-mur-brouillon',
    });
    expect(saved).toEqual([levelTwoCreation()]);
    expect(saved[0]?.document.id).toBe('campaign-02-par-dessus-le-mur-brouillon');
    expect(campaignDraftId(levelTwo)).toBe(saved[0]?.document.id);
    expect(saved[0]?.document.metadata.title).toBe('Par-dessus le mur (remix)');
    expect(levelTwo).toEqual(original);
  });

  it('garde la description du niveau d’origine dans la création (M14b)', async () => {
    const { repository, saved } = createMemoryDraftRepository();
    expect(levelTwo.metadata.description).toMatch(/^Esquisse non calibrée\./u);

    await openCampaignDraft(repository, levelTwo);

    expect(saved[0]?.document.metadata.description).toBe(levelTwo.metadata.description);
  });

  it('rouvre un brouillon existant sans écraser les ajustements de l’auteur', async () => {
    const edited = {
      ...levelTwoCreation().document,
      metadata: { title: 'Par-dessus le mur modifié' },
    };
    const { repository, saved } = createMemoryDraftRepository([edited]);

    expect(await openCampaignDraft(repository, levelTwo)).toEqual({
      status: 'ok',
      draftId: 'campaign-02-par-dessus-le-mur-brouillon',
    });
    expect(saved).toEqual([]);
  });

  it('pose la solution de l’auteur dans une nouvelle création quand elle est révélée d’office (M11, ADR 0015 § Révéler)', async () => {
    const { repository, saved } = createMemoryDraftRepository();
    const revealed = workshopFromPuzzle(levelTwo);
    expect(levelTwo.solution?.placements.length).toBeGreaterThan(0);

    await openCampaignDraft(repository, levelTwo, { revealSolution: true });

    expect(saved).toHaveLength(1);
    const [creation] = saved;
    expect(creation?.document.objects).toEqual(revealed.objects);
    expect(creation?.document.wires).toEqual(revealed.wires);
    expect(creation?.document.inventory).toEqual([]);
    expect(creation?.document.metadata.title).toBe('Par-dessus le mur (remix)');
    expect(creation?.source).toEqual(levelTwo);
  });

  it('rouvre telle quelle une création existante, même révélée d’office (M11)', async () => {
    const { repository, saved } = createMemoryDraftRepository([levelTwoCreation().document]);

    expect(await openCampaignDraft(repository, levelTwo, { revealSolution: true })).toEqual({
      status: 'ok',
      draftId: 'campaign-02-par-dessus-le-mur-brouillon',
    });
    expect(saved).toEqual([]);
  });

  it('signale un stockage indisponible sans lever d’exception', async () => {
    const { repository } = createMemoryDraftRepository();
    const unavailable: DraftRepository = {
      ...repository,
      load: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
      save: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
    };

    expect(await openCampaignDraft(unavailable, levelTwo)).toEqual({
      status: 'error',
      code: 'storage-unavailable',
    });
  });

  it('laisse l’auteur déplacer un objet de départ verrouillé pour le joueur', () => {
    const history = createHistory(createConstructionAttempt(levelTwoCreation().document));
    const locked = levelTwo.objects.find(({ id }) => id === 'shelf');
    expect(locked?.permissions.move).toBe(false);
    const position = { x: 5.2, y: 2.3 };

    const asPlayer = executeCommand(
      history,
      movePlacement({ context: 'player', placementId: 'shelf', position }),
    );
    const asAuthor = executeCommand(
      history,
      movePlacement({ context: 'author', placementId: 'shelf', position }),
    );

    expect(asPlayer.status).toBe('rejected');
    expect(asAuthor.status).toBe('accepted');
    expect(
      asAuthor.history.state.document.objects.find(({ id }) => id === 'shelf')?.transform.position,
    ).toEqual(position);
  });
});
