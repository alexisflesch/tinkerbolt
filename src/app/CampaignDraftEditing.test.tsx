// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { creationFromLevel } from '../application/drafts/creation-from-level';
import { workshopFromPuzzle } from '../application/puzzle/puzzle-workshop';
import type { ProgressRepository } from '../application/progression/progress-repository';
import { embeddedLevels } from '../content/embedded-levels';
import type * as EmbeddedLevels from '../content/embedded-levels';

import {
  cardAction,
  testDraftRepository,
  renderStorageReady,
  storageAction,
} from './storage-test-fixture';
import type { CampaignProgress } from '../application/progression';
import { recordSuccess } from '../application/progression';
import { App } from './App';

/** Gesture fixtures stay stable when the published campaign changes (N2). */
vi.mock('../content/embedded-levels', async (importOriginal) => {
  const original = await importOriginal<typeof EmbeddedLevels>();
  const { sketchChapters, sketchLevels } = await import('../../test/fixtures/sketch-campaign');
  return {
    ...original,
    campaignChapters: sketchChapters,
    embeddedLevels: sketchLevels,
    nextCampaignLevel: (id: string, chapters = sketchChapters) =>
      original.nextCampaignLevel(id, chapters),
  };
});

const testClock = (): Date => new Date('2026-10-01T12:00:00.000Z');

const levelTwo = embeddedLevels.find(({ id }) => id === 'campaign-02-par-dessus-le-mur');
if (levelTwo === undefined) throw new Error('Niveau 2 embarqué introuvable.');
const pristineLevelTwo = structuredClone(levelTwo);

const boardCanvasRect: DOMRect = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: 800,
  bottom: 450,
  width: 800,
  height: 450,
  toJSON() {
    return this;
  },
};

const tapWorldPoint = async (x: number, y: number): Promise<void> => {
  const board = screen.getByRole('region', { name: 'Plateau de jeu' });
  const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
  const [originX, originY] = (canvas.getAttribute('data-camera-origin') ?? '')
    .split(',')
    .map(Number);
  const zoom = Number(canvas.getAttribute('data-camera-zoom'));
  if (originX === undefined || originY === undefined || !(zoom > 0)) {
    throw new Error('Cadrage caméra invalide dans le test.');
  }
  await tapBoard((x - originX) * zoom, (y - originY) * zoom);
};

const tapBoard = async (clientX: number, clientY: number): Promise<void> => {
  const board = screen.getByRole('region', { name: 'Plateau de jeu' });
  for (const type of ['pointerdown', 'pointerup'] as const) {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, {
      pointerId: { configurable: true, value: 1 },
      pointerType: { configurable: true, value: 'touch' },
      clientX: { configurable: true, value: clientX },
      clientY: { configurable: true, value: clientY },
    });
    fireEvent(board, event);
  }
  fireEvent.click(board, { detail: 1, clientX, clientY });
  await storageAction();
};

const dragWorldPoint = async (
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): Promise<void> => {
  const board = screen.getByRole('region', { name: 'Plateau de jeu' });
  const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
  const [originX, originY] = (canvas.getAttribute('data-camera-origin') ?? '')
    .split(',')
    .map(Number);
  const zoom = Number(canvas.getAttribute('data-camera-zoom'));
  if (originX === undefined || originY === undefined || !(zoom > 0)) {
    throw new Error('Cadrage caméra invalide dans le test.');
  }
  const sendPointer = (type: 'pointerdown' | 'pointermove' | 'pointerup', point: typeof from) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, {
      pointerId: { configurable: true, value: 1 },
      pointerType: { configurable: true, value: 'touch' },
      clientX: { configurable: true, value: (point.x - originX) * zoom },
      clientY: { configurable: true, value: (point.y - originY) * zoom },
    });
    fireEvent(board, event);
  };
  await storageAction(() => {
    sendPointer('pointerdown', from);
    sendPointer('pointermove', to);
    sendPointer('pointerup', to);
  });
};

const dragBeamSizeHandle = async (distanceX: number, distanceY: number): Promise<void> => {
  const handle = await screen.findByRole('button', { name: 'Redimensionner la poutre' });
  const initialTop = handle.style.top;
  const sendPointer = (
    type: 'pointerdown' | 'pointermove' | 'pointerup',
    clientX: number,
    clientY: number,
  ) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, {
      pointerId: { configurable: true, value: 1 },
      pointerType: { configurable: true, value: 'mouse' },
      button: { configurable: true, value: 0 },
      clientX: { configurable: true, value: clientX },
      clientY: { configurable: true, value: clientY },
    });
    fireEvent(handle, event);
  };
  await storageAction(() => {
    sendPointer('pointerdown', 200, 200);
  });
  await storageAction(() => {
    sendPointer('pointermove', 200 + distanceX, 200 + distanceY);
  });
  expect(handle.style.top).not.toBe(initialTop);
  await storageAction(() => {
    sendPointer('pointerup', 200 + distanceX, 200 + distanceY);
  });
};

/** M11: level 2 can only be modified once level 1 is resolved (ADR 0015, ADR 0010). */
const createProgressRepository = () => {
  const save = vi.fn((_progress: CampaignProgress) => {
    void _progress;
    return Promise.resolve({ status: 'ok' as const });
  });
  const repository: ProgressRepository = {
    recordVictory: async (id, count) => {
      const initial = await repository.load();
      const updated = recordSuccess(initial.status === 'ok' ? initial.progress : {}, id, count);
      await save(updated);
      return { status: 'ok', progress: updated };
    },
    load: () =>
      Promise.resolve({
        status: 'ok',
        progress: { 'campaign-01-la-bille-de-service': { resolved: true, bestObjectCount: 1 } },
      }),
    save,
    clear: () => Promise.resolve({ status: 'ok' }),
  };
  return { repository, save };
};

const levelTwoUnlocked = (): ProgressRepository => createProgressRepository().repository;

describe('éditer un niveau de la campagne (U17)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ouvre en développement un brouillon distinct, solution révélée et sans fiche de calibrage (V7b)', async () => {
    const { repository, save } = createProgressRepository();
    window.history.replaceState(null, '', '/levels');
    await renderStorageReady(<App progressRepository={repository} developmentMode />);

    const card = screen.getByRole('region', { name: 'Niveau 2' });
    await storageAction(() => fireEvent.click(cardAction(card, 'Modifier le niveau 2')));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor');
    });
    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('draft')).toBe(
        'campaign-02-par-dessus-le-mur-brouillon',
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('Éditeur · Par-dessus le mur (remix)')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Atelier')).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Fiche de calibrage' })).not.toBeInTheDocument();
    });
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Objets disponibles' })).toBeVisible(),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Ouvrir la fiche de calibrage' }),
      ).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Exporter le niveau' })).toBeVisible();
    });

    const stored = await testDraftRepository(testClock).load(
      'campaign-02-par-dessus-le-mur-brouillon',
    );
    await waitFor(() => {
      expect(stored.status === 'ok' ? stored.creation?.document.metadata.title : null).toBe(
        'Par-dessus le mur (remix)',
      );
    });
    await waitFor(() => {
      expect(stored.status === 'ok' ? stored.creation?.source : null).toEqual(pristineLevelTwo);
    });
    const revealed = workshopFromPuzzle(levelTwo);
    await waitFor(() => {
      expect(levelTwo.solution?.placements.length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(stored.status === 'ok' ? stored.creation?.document.objects : null).toEqual(
        revealed.objects,
      );
    });
    await waitFor(() => {
      expect(stored.status === 'ok' ? stored.creation?.document.wires : null).toEqual(
        revealed.wires,
      );
    });
    await waitFor(async () => {
      expect(await testDraftRepository(testClock).load('campaign-02-par-dessus-le-mur')).toEqual({
        status: 'ok',
        creation: null,
      });
    });
    await waitFor(() => {
      expect(save).not.toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(levelTwo).toEqual(pristineLevelTwo);
    });
  });

  it('affiche le catalogue auteur dans la création du niveau 1, qui n’a plus d’inventaire (U26, M6)', async () => {
    window.history.replaceState(null, '', '/levels');
    await renderStorageReady(<App />);

    await storageAction(() =>
      fireEvent.click(
        cardAction(screen.getByRole('region', { name: 'Niveau 1' }), 'Modifier le niveau 1'),
      ),
    );

    const stored = await testDraftRepository(testClock).load(
      'campaign-01-la-bille-de-service-brouillon',
    );
    await waitFor(() => {
      expect(stored.status === 'ok' ? stored.creation?.document.inventory : null).toEqual([]);
    });
    const drawer = screen.getByRole('region', { name: 'Objets disponibles' });
    await waitFor(() => {
      expect(drawer).toBeVisible();
    });
    await waitFor(() => expect(drawer).toBeVisible());
    await waitFor(() => {
      expect(within(drawer).getByRole('button', { name: 'Poutre moyenne' })).toBeVisible();
    });
    await waitFor(() => {
      expect(within(drawer).getByRole('button', { name: 'Convoyeur' })).toBeVisible();
    });
  });

  it('enregistre les ajustements de l’auteur dans le brouillon, jamais dans le niveau', async () => {
    window.history.replaceState(null, '', '/levels');
    await renderStorageReady(<App progressRepository={levelTwoUnlocked()} />);
    await storageAction(() =>
      fireEvent.click(
        cardAction(screen.getByRole('region', { name: 'Niveau 2' }), 'Modifier le niveau 2'),
      ),
    );

    // The shelf is locked for the player (`move: false`); the author context ignores it.
    await tapWorldPoint(5.0, 3.6);
    const properties = screen.getByRole('toolbar', { name: /^Réglages de/ });
    expect(properties).toBeVisible();
    await dragWorldPoint({ x: 5.0, y: 3.6 }, { x: 6.0, y: 3.6 });

    await waitFor(async () => {
      const stored = await testDraftRepository(testClock).load(
        'campaign-02-par-dessus-le-mur-brouillon',
      );
      const wall =
        stored.status === 'ok'
          ? stored.creation?.document.objects.find(({ id }) => id === 'wall')
          : undefined;
      expect(wall?.transform.position.x).toBeGreaterThan(5.0);
    });
    await waitFor(() => {
      expect(levelTwo).toEqual(pristineLevelTwo);
    });
  });

  it('redimensionne une poutre en la faisant glisser et annule le geste en une fois', async () => {
    const draftId = 'campaign-02-poutre-redimensionnee';
    await testDraftRepository(testClock).save(
      creationFromLevel(levelTwo, { createId: () => draftId }),
    );
    window.history.replaceState(null, '', `/editor?draft=${draftId}`);
    await renderStorageReady(<App progressRepository={levelTwoUnlocked()} />);
    await tapWorldPoint(5.0, 3.6);

    const zoom = Number(
      within(screen.getByRole('region', { name: 'Plateau de jeu' }))
        .getByRole('img', { name: 'Rendu du plateau' })
        .getAttribute('data-camera-zoom'),
    );
    await dragBeamSizeHandle(0, zoom);
    expect(screen.queryByRole('group', { name: 'Taille de la poutre' })).not.toBeInTheDocument();

    await waitFor(async () => {
      const stored = await testDraftRepository(testClock).load(draftId);
      expect(
        stored.status === 'ok'
          ? stored.creation?.document.objects.find(({ id }) => id === 'wall')?.props
          : undefined,
      ).toEqual({ size: 'long' });
    });
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));
    await waitFor(async () => {
      const stored = await testDraftRepository(testClock).load(draftId);
      expect(
        stored.status === 'ok'
          ? stored.creation?.document.objects.find(({ id }) => id === 'wall')?.props
          : undefined,
      ).toEqual({ size: 'medium' });
    });
    await storageAction(() =>
      fireEvent.keyDown(screen.getByRole('button', { name: 'Redimensionner la poutre' }), {
        key: 'ArrowRight',
      }),
    );
    await waitFor(async () => {
      const stored = await testDraftRepository(testClock).load(draftId);
      expect(
        stored.status === 'ok'
          ? stored.creation?.document.objects.find(({ id }) => id === 'wall')?.props
          : undefined,
      ).toEqual({ size: 'long' });
    });
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));
    await waitFor(async () => {
      const stored = await testDraftRepository(testClock).load(draftId);
      expect(
        stored.status === 'ok'
          ? stored.creation?.document.objects.find(({ id }) => id === 'wall')?.props
          : undefined,
      ).toEqual({ size: 'medium' });
    });
  });

  it('conserve la source d’une création quand l’auteur l’édite (M4, ADR 0015)', async () => {
    const draftId = 'campaign-02-par-dessus-le-mur-brouillon';
    await testDraftRepository(testClock).save(
      creationFromLevel(levelTwo, { createId: () => draftId }),
    );
    window.history.replaceState(null, '', `/editor?draft=${draftId}`);
    await renderStorageReady(<App progressRepository={levelTwoUnlocked()} />);

    await tapWorldPoint(5.0, 3.6);
    const properties = screen.getByRole('toolbar', { name: /^Réglages de/ });
    expect(properties).toBeVisible();
    await dragWorldPoint({ x: 5.0, y: 3.6 }, { x: 6.0, y: 3.6 });

    const stored = await testDraftRepository(testClock).load(draftId);
    if (stored.status !== 'ok' || stored.creation === null) {
      throw new Error('Création introuvable.');
    }
    await waitFor(async () => {
      const updated = await testDraftRepository(testClock).load(draftId);
      const wall =
        updated.status === 'ok' && updated.creation !== null
          ? updated.creation.document.objects.find(({ id }) => id === 'wall')
          : undefined;
      expect(wall?.transform.position.x).toBeGreaterThan(5.0);
      expect(updated.status === 'ok' ? updated.creation?.source : undefined).toEqual(
        pristineLevelTwo,
      );
    });
  });

  it('rouvre le brouillon existant plutôt que de l’écraser', async () => {
    const drafts = testDraftRepository(testClock);
    await drafts.save({
      document: {
        ...levelTwo,
        id: 'campaign-02-par-dessus-le-mur-brouillon',
        metadata: { title: 'Mon pont' },
      },
    });
    window.history.replaceState(null, '', '/levels');
    await renderStorageReady(<App progressRepository={levelTwoUnlocked()} />);

    await storageAction(() =>
      fireEvent.click(
        cardAction(screen.getByRole('region', { name: 'Niveau 2' }), 'Modifier le niveau 2'),
      ),
    );

    await waitFor(() => {
      expect(screen.queryByText('Éditeur · Mon pont')).not.toBeInTheDocument();
    });
  });

  it('explique qu’un brouillon introuvable ne peut pas être ouvert', async () => {
    window.history.replaceState(null, '', '/editor?draft=inconnu');
    await renderStorageReady(<App />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ce brouillon est introuvable');
    });
    await waitFor(() => {
      expect(
        within(screen.getByRole('navigation', { name: 'Navigation principale' })).getByRole(
          'link',
          { name: 'Campagne' },
        ),
      ).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Plateau de jeu' })).toBeNull();
    });
  });

  const storedDraft = async () => {
    const stored = await testDraftRepository(testClock).load(
      'campaign-02-par-dessus-le-mur-brouillon',
    );
    if (stored.status !== 'ok' || stored.creation == null) {
      throw new Error('Brouillon introuvable.');
    }
    return stored.creation.document;
  };

  const ballColours = (): { readonly red: string | null; readonly blue: string | null } => {
    const canvas = screen.getByRole('img', { name: 'Rendu du plateau' });
    return {
      red: canvas.getAttribute('data-red-balls'),
      blue: canvas.getAttribute('data-blue-balls'),
    };
  };

  const placeFromCatalogue = async (card: string, x: number, y: number): Promise<void> => {
    const toggle = screen.queryByRole('button', { name: 'Ouvrir le catalogue' });
    if (toggle !== null) await storageAction(() => fireEvent.click(toggle));
    const drawer = screen.getByRole('region', { name: 'Objets disponibles' });
    await storageAction(() => fireEvent.click(within(drawer).getByRole('button', { name: card })));
    await tapWorldPoint(x, y);
  };

  it('ajoute au brouillon un objet absent de l’inventaire du niveau (U20)', async () => {
    window.history.replaceState(null, '', '/levels');
    await renderStorageReady(<App progressRepository={levelTwoUnlocked()} />);
    await storageAction(() =>
      fireEvent.click(
        cardAction(screen.getByRole('region', { name: 'Niveau 2' }), 'Modifier le niveau 2'),
      ),
    );
    const before = await storedDraft();

    await placeFromCatalogue('Masse', 6.5, 1.0);

    const after = await storedDraft();
    await waitFor(() => {
      expect(after.objects).toHaveLength(before.objects.length + 1);
    });
    await waitFor(() => {
      expect(after.objects.at(-1)?.type).toBe('mass');
    });
    await waitFor(() => {
      expect(after.inventory).toEqual(before.inventory);
    });
    await waitFor(() => {
      expect(levelTwo).toEqual(pristineLevelTwo);
    });
  });

  it('ajoute une balle bleue sans jamais changer la balle de l’objectif (U20)', async () => {
    window.history.replaceState(null, '', '/levels');
    await renderStorageReady(<App progressRepository={levelTwoUnlocked()} />);
    await storageAction(() =>
      fireEvent.click(
        cardAction(screen.getByRole('region', { name: 'Niveau 2' }), 'Modifier le niveau 2'),
      ),
    );
    await waitFor(() => {
      expect(ballColours().red).toBe('ball-red');
    });
    await waitFor(() => {
      expect(ballColours().blue).toContain('ball-blue');
    });

    await placeFromCatalogue('Balle', 3.0, 0.8);
    const blueBallId = (await storedDraft()).objects.at(-1)?.id ?? '';
    await waitFor(async () => {
      expect((await storedDraft()).goal?.ballId).toBe('ball-red');
    });
    await waitFor(() => {
      expect(ballColours().red).toBe('ball-red');
    });
    await waitFor(() => {
      expect(ballColours().blue).toContain('ball-blue');
    });
    await waitFor(() => {
      expect(ballColours().blue).toContain(blueBallId);
    });

    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));
    await waitFor(async () => {
      expect((await storedDraft()).goal?.ballId).toBe('ball-red');
    });
    await waitFor(() => {
      expect(ballColours().red).toBe('ball-red');
    });
    await waitFor(() => {
      expect(ballColours().blue).toBe('ball-blue');
    });
  });
});
