// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { creationFromLevel } from '../application/drafts/creation-from-level';
import { workshopFromPuzzle } from '../application/puzzle/puzzle-workshop';
import type { ProgressRepository } from '../application/progression/progress-repository';
import { embeddedLevels } from '../content/embedded-levels';
import type * as EmbeddedLevels from '../content/embedded-levels';
import { createLocalStorageDraftRepository } from '../infrastructure/storage/local-storage-draft-repository';

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

const tapWorldPoint = (x: number, y: number): void => {
  const board = screen.getByRole('region', { name: 'Plateau de jeu' });
  const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
  const [originX, originY] = (canvas.getAttribute('data-camera-origin') ?? '')
    .split(',')
    .map(Number);
  const zoom = Number(canvas.getAttribute('data-camera-zoom'));
  if (originX === undefined || originY === undefined || !(zoom > 0)) {
    throw new Error('Cadrage caméra invalide dans le test.');
  }
  tapBoard((x - originX) * zoom, (y - originY) * zoom);
};

const tapBoard = (clientX: number, clientY: number): void => {
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
};

/** M11: level 2 can only be modified once level 1 is resolved (ADR 0015, ADR 0010). */
const createProgressRepository = () => {
  const save = vi.fn(() => ({ status: 'ok' as const }));
  const repository: ProgressRepository = {
    load: () => ({
      status: 'ok',
      progress: { 'campaign-01-la-bille-de-service': { resolved: true, bestObjectCount: 1 } },
    }),
    save,
    clear: () => ({ status: 'ok' }),
  };
  return { repository, save };
};

const levelTwoUnlocked = (): ProgressRepository => createProgressRepository().repository;

describe('éditer un niveau de la campagne (U17)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ouvre en développement un brouillon distinct, solution révélée et sans fiche de calibrage (V7b)', () => {
    const { repository, save } = createProgressRepository();
    window.history.replaceState(null, '', '/levels');
    render(<App progressRepository={repository} developmentMode />);

    const card = screen.getByRole('region', { name: 'Niveau 2' });
    fireEvent.click(within(card).getByRole('button', { name: 'Modifier le niveau 2' }));

    expect(window.location.pathname).toBe('/editor');
    expect(new URLSearchParams(window.location.search).get('draft')).toBe(
      'campaign-02-par-dessus-le-mur-brouillon',
    );
    expect(screen.queryByText('Éditeur · Par-dessus le mur (remix)')).not.toBeInTheDocument();
    expect(screen.getByText('Atelier')).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Fiche de calibrage' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    expect(
      screen.queryByRole('button', { name: 'Ouvrir la fiche de calibrage' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le catalogue' }));
    expect(screen.getByRole('button', { name: 'Exporter le niveau' })).toBeVisible();

    const stored = createLocalStorageDraftRepository(window.localStorage, testClock).load(
      'campaign-02-par-dessus-le-mur-brouillon',
    );
    expect(stored.status === 'ok' ? stored.creation?.document.metadata.title : null).toBe(
      'Par-dessus le mur (remix)',
    );
    expect(stored.status === 'ok' ? stored.creation?.source : null).toEqual(pristineLevelTwo);
    const revealed = workshopFromPuzzle(levelTwo);
    expect(levelTwo.solution?.placements.length).toBeGreaterThan(0);
    expect(stored.status === 'ok' ? stored.creation?.document.objects : null).toEqual(
      revealed.objects,
    );
    expect(stored.status === 'ok' ? stored.creation?.document.wires : null).toEqual(revealed.wires);
    expect(
      window.localStorage.getItem('tinkerbolt:draft:campaign-02-par-dessus-le-mur'),
    ).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(levelTwo).toEqual(pristineLevelTwo);
  });

  it('affiche le catalogue auteur dans la création du niveau 1, qui n’a plus d’inventaire (U26, M6)', () => {
    window.history.replaceState(null, '', '/levels');
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Modifier le niveau 1' }));

    const stored = createLocalStorageDraftRepository(window.localStorage, testClock).load(
      'campaign-01-la-bille-de-service-brouillon',
    );
    expect(stored.status === 'ok' ? stored.creation?.document.inventory : null).toEqual([]);
    const drawer = screen.getByRole('region', { name: 'Objets disponibles' });
    expect(drawer).toBeVisible();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Ouvrir le catalogue' }));
    expect(within(drawer).getByRole('button', { name: 'Poutre moyenne' })).toBeVisible();
    expect(within(drawer).getByRole('button', { name: 'Convoyeur' })).toBeVisible();
  });

  it('enregistre les ajustements de l’auteur dans le brouillon, jamais dans le niveau', () => {
    window.history.replaceState(null, '', '/levels');
    render(<App progressRepository={levelTwoUnlocked()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le niveau 2' }));

    // The shelf is locked for the player (`move: false`); the author context ignores it.
    tapWorldPoint(5.0, 3.6);
    const properties = screen.getByRole('region', { name: /^Propriétés de/ });
    fireEvent.click(within(properties).getByRole('button', { name: 'Vers la droite' }));

    const stored = createLocalStorageDraftRepository(window.localStorage, testClock).load(
      'campaign-02-par-dessus-le-mur-brouillon',
    );
    const storedWall =
      stored.status === 'ok'
        ? stored.creation?.document.objects.find(({ id }) => id === 'wall')
        : undefined;
    expect(storedWall?.transform.position.x).toBeGreaterThan(5.0);
    expect(levelTwo).toEqual(pristineLevelTwo);
  });

  it('conserve la source d’une création quand l’auteur l’édite (M4, ADR 0015)', () => {
    const draftId = 'campaign-02-par-dessus-le-mur-brouillon';
    createLocalStorageDraftRepository(window.localStorage, testClock).save(
      creationFromLevel(levelTwo, { createId: () => draftId }),
    );
    window.history.replaceState(null, '', `/editor?draft=${draftId}`);
    render(<App progressRepository={levelTwoUnlocked()} />);

    tapWorldPoint(5.0, 3.6);
    const properties = screen.getByRole('region', { name: /^Propriétés de/ });
    fireEvent.click(within(properties).getByRole('button', { name: 'Vers la droite' }));

    const stored = createLocalStorageDraftRepository(window.localStorage, testClock).load(draftId);
    if (stored.status !== 'ok' || stored.creation === null) {
      throw new Error('Création introuvable.');
    }
    expect(
      stored.creation.document.objects.find(({ id }) => id === 'wall')?.transform.position.x,
    ).toBeGreaterThan(5.0);
    expect(stored.creation.source).toEqual(pristineLevelTwo);
  });

  it('rouvre le brouillon existant plutôt que de l’écraser', () => {
    const drafts = createLocalStorageDraftRepository(window.localStorage, testClock);
    drafts.save({
      document: {
        ...levelTwo,
        id: 'campaign-02-par-dessus-le-mur-brouillon',
        metadata: { title: 'Mon pont' },
      },
    });
    window.history.replaceState(null, '', '/levels');
    render(<App progressRepository={levelTwoUnlocked()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Modifier le niveau 2' }));

    expect(screen.queryByText('Éditeur · Mon pont')).not.toBeInTheDocument();
  });

  it('explique qu’un brouillon introuvable ne peut pas être ouvert', () => {
    window.history.replaceState(null, '', '/editor?draft=inconnu');
    render(<App />);

    expect(screen.getByRole('alert')).toHaveTextContent('Ce brouillon est introuvable');
    expect(screen.getByRole('link', { name: 'Campagne' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Plateau de jeu' })).toBeNull();
  });

  const storedDraft = () => {
    const stored = createLocalStorageDraftRepository(window.localStorage, testClock).load(
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

  const placeFromCatalogue = (card: string, x: number, y: number): void => {
    const toggle = screen.queryByRole('button', { name: 'Ouvrir le catalogue' });
    if (toggle !== null) fireEvent.click(toggle);
    const drawer = screen.getByRole('region', { name: 'Objets disponibles' });
    fireEvent.click(within(drawer).getByRole('button', { name: card }));
    tapWorldPoint(x, y);
  };

  it('ajoute au brouillon un objet absent de l’inventaire du niveau (U20)', () => {
    window.history.replaceState(null, '', '/levels');
    render(<App progressRepository={levelTwoUnlocked()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le niveau 2' }));
    const before = storedDraft();

    placeFromCatalogue('Masse', 6.5, 1.0);

    const after = storedDraft();
    expect(after.objects).toHaveLength(before.objects.length + 1);
    expect(after.objects.at(-1)?.type).toBe('mass');
    expect(after.inventory).toEqual(before.inventory);
    expect(levelTwo).toEqual(pristineLevelTwo);
  });

  it('ajoute une balle bleue sans jamais changer la balle de l’objectif (U20)', () => {
    window.history.replaceState(null, '', '/levels');
    render(<App progressRepository={levelTwoUnlocked()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le niveau 2' }));
    expect(ballColours().red).toBe('ball-red');
    expect(ballColours().blue).toContain('ball-blue');

    placeFromCatalogue('Balle', 3.0, 0.8);
    const blueBallId = storedDraft().objects.at(-1)?.id ?? '';
    expect(storedDraft().goal.ballId).toBe('ball-red');
    expect(ballColours().red).toBe('ball-red');
    expect(ballColours().blue).toContain('ball-blue');
    expect(ballColours().blue).toContain(blueBallId);

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(storedDraft().goal.ballId).toBe('ball-red');
    expect(ballColours().red).toBe('ball-red');
    expect(ballColours().blue).toBe('ball-blue');
  });
});
