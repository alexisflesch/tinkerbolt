// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { embeddedLevels } from '../content/embedded-levels';
import type * as EmbeddedLevels from '../content/embedded-levels';
import type { LevelDocument } from '../domain/level-document';

import { testDraftRepository, renderStorageReady, storageAction } from './storage-test-fixture';
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

const levelOne = embeddedLevels.find(({ id }) => id === 'campaign-01-la-bille-de-service');
if (levelOne === undefined) throw new Error('Niveau 1 embarqué introuvable.');
const { solution: ignoredSolution, ...levelOneWithoutSolution } = levelOne;
void ignoredSolution;

/** Level 1 with its reference beam in place, still fixed: the author's complete machine. */
const machine: LevelDocument = {
  ...levelOneWithoutSolution,
  id: 'machine-u22',
  metadata: { title: 'Machine U22' },
  objects: [
    ...levelOneWithoutSolution.objects,
    {
      id: 'placement-1',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 5, y: 2.15 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
  ],
};

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
  await storageAction();
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

const storedDraft = async (): Promise<LevelDocument | null> => {
  const result = await testDraftRepository(testClock).load('machine-u22');
  return result.status === 'ok' ? (result.creation?.document ?? null) : null;
};

const openMachine = async (document: LevelDocument = machine): Promise<void> => {
  await testDraftRepository(testClock).save({ document });
  window.history.replaceState(null, '', '/editor?draft=machine-u22');
  await renderStorageReady(<App />);
};

const selectBeam = async (): Promise<void> => {
  await tapWorldPoint(5, 2.15);
  const openProperties = screen.queryByRole('button', { name: 'Ouvrir les propriétés' });
  if (openProperties !== null) await storageAction(() => fireEvent.click(openProperties));
};

describe('atelier créateur de puzzles (U22)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('règle un objet « À placer » dans l’inspecteur, au toucher, et l’annule', async () => {
    await openMachine();
    await selectBeam();

    const fixed = screen.getByRole('button', { name: 'Fixe' });
    const toPlace = screen.getByRole('button', { name: 'À placer' });
    await waitFor(() => {
      expect(fixed).toHaveAttribute('aria-pressed', 'true');
    });
    await waitFor(() => {
      expect(toPlace).toHaveAttribute('aria-pressed', 'false');
    });

    await storageAction(() => fireEvent.click(toPlace));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'À placer' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    await waitFor(async () => {
      expect((await storedDraft())?.objects.find(({ id }) => id === 'placement-1')?.toPlace).toBe(
        true,
      );
    });

    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));

    await waitFor(async () => {
      expect(
        (await storedDraft())?.objects.find(({ id }) => id === 'placement-1')?.toPlace,
      ).toBeUndefined();
    });
  });

  it('ne propose pas le réglage pour la balle et le panier de l’objectif', async () => {
    await openMachine();
    await tapWorldPoint(6.9, 4.9);
    const openProperties = screen.queryByRole('button', { name: 'Ouvrir les propriétés' });
    if (openProperties !== null) await storageAction(() => fireEvent.click(openProperties));

    const panel = screen.getByRole('region', { name: 'Propriétés de Panier' });
    await waitFor(() => {
      expect(within(panel).getByText('Panier')).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'À placer' })).toBeNull();
    });
  });

  it('ne propose pas de supprimer la balle rouge ni le panier de l’objectif', async () => {
    // The red ball rests on the barrier: moved aside so a tap selects it alone.
    await openMachine({
      ...machine,
      objects: machine.objects.map((object) =>
        object.id === 'ball-red'
          ? { ...object, transform: { ...object.transform, position: { x: 4, y: 3 } } }
          : object,
      ),
    });
    for (const [x, y, name] of [
      [6.8, 4.9, 'Panier'],
      [4, 3, 'Balle'],
    ] as const) {
      await tapWorldPoint(x, y);
      const openProperties = screen.queryByRole('button', { name: 'Ouvrir les propriétés' });
      if (openProperties !== null) await storageAction(() => fireEvent.click(openProperties));

      const panel = screen.getByRole('region', { name: `Propriétés de ${name}` });
      await waitFor(() => {
        expect(within(panel).queryByRole('button', { name: /Supprimer/ })).toBeNull();
      });
    }
  });

  it('teste comme un joueur, objets à placer dans le tiroir, puis revient à l’atelier', async () => {
    await openMachine();
    await selectBeam();
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'À placer' })));

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Essayer en joueur' })),
    );

    await waitFor(() => {
      expect(screen.getByText('Atelier', { selector: '.level-mode' })).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Exporter le niveau' })).toBeNull();
    });
    const drawerToggle = screen.queryByRole('button', { name: 'Ouvrir le catalogue' });
    if (drawerToggle !== null) await storageAction(() => fireEvent.click(drawerToggle));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Poutre courte/ })).toHaveTextContent('1');
    });

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Retour à l’atelier' })),
    );

    await waitFor(() => {
      expect(screen.getByText('Atelier')).toBeVisible();
    });
    await waitFor(async () => {
      expect((await storedDraft())?.objects.find(({ id }) => id === 'placement-1')?.toPlace).toBe(
        true,
      );
    });
    await selectBeam();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'À placer' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  it('explique au lieu de tester quand aucun objet n’est à placer', async () => {
    await openMachine();

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Essayer en joueur' })),
    );

    await waitFor(() => {
      expect(screen.getByText('Atelier')).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByText(/Aucun objet n’est à placer/u)).toBeVisible();
    });
  });

  it('explique que l’esquisse doit être calibrée avant son export', async () => {
    await openMachine();
    await selectBeam();
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'À placer' })));

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Exporter le niveau' })),
    );

    const dialog = screen.getByRole('dialog', { name: 'Exporter le niveau' });
    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toBeVisible();
    });
  });
});
