// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProgressRepository } from '../application/progression/progress-repository';
import { levelDocumentSchema, type LevelDocument } from '../domain/level-document';

import type * as EmbeddedLevels from '../content/embedded-levels';

import {
  mergeCampaignProgressForTest,
  testDraftRepository,
  renderStorageReady,
  storageAction,
} from './storage-test-fixture';
import type { CampaignProgress } from '../application/progression';
import { recordSuccess } from '../application/progression';
import { App } from './App';

/**
 * A small deterministic fixture wins without construction, isolating the remix
 * workflow from the geometry and reference solution of the published campaign.
 * Hoisted with `vi.mock`, hence raw data parsed where it is used.
 */
const { levelOneId, winnableLevelOneData } = vi.hoisted(() => {
  const locked = { move: false, rotate: false, remove: false } as const;
  const levelOneId = 'tuto-1';
  return {
    levelOneId,
    winnableLevelOneData: {
      schemaVersion: 3,
      id: levelOneId,
      metadata: { title: 'La bille de service' },
      objects: [
        {
          id: 'ball-1',
          type: 'ball',
          props: {},
          transform: { position: { x: 7, y: 1 }, rotation: 0 },
          permissions: locked,
        },
        {
          id: 'basket-1',
          type: 'basket',
          props: {},
          transform: { position: { x: 7, y: 4.5 }, rotation: 0 },
          permissions: locked,
        },
      ],
      inventory: [
        {
          id: 'inventory-beam',
          type: 'beam',
          props: { size: 'short' },
          quantity: 1,
          permissions: { move: true, rotate: true, remove: true },
        },
      ],
      goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
      buildZones: [{ min: { x: 0, y: 0 }, max: { x: 4, y: 5.5 } }],
      scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
    },
  };
});

const winnableLevelOne: LevelDocument = levelDocumentSchema.parse(winnableLevelOneData);

vi.mock('../content/embedded-levels', async (importOriginal) => {
  const original = await importOriginal<typeof EmbeddedLevels>();
  const { levelDocumentSchema: schema } = await import('../domain/level-document');
  const winnable = schema.parse(winnableLevelOneData);
  const campaignChapters = original.campaignChapters.map((chapter, index) =>
    index === 0
      ? {
          ...chapter,
          levels: chapter.levels.map((level) => (level.id === levelOneId ? winnable : level)),
        }
      : chapter,
  );
  return {
    ...original,
    campaignChapters,
    embeddedLevels: original.flattenCampaignLevels(campaignChapters),
  };
});

type AnimationFrameCallback = (timestamp: number) => void;

const createAnimationFrameHarness = () => {
  let nextFrameId = 0;
  const pendingFrames = new Map<number, AnimationFrameCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: AnimationFrameCallback): number => {
    nextFrameId += 1;
    pendingFrames.set(nextFrameId, callback);
    return nextFrameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (frameId: number): void => {
    pendingFrames.delete(frameId);
  });
  return (timestamp: number): void => {
    const callbacks = [...pendingFrames.values()];
    pendingFrames.clear();
    for (const callback of callbacks) callback(timestamp);
  };
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
  for (const type of ['pointerdown', 'pointerup'] as const) {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, {
      pointerId: { configurable: true, value: 1 },
      pointerType: { configurable: true, value: 'touch' },
      clientX: { configurable: true, value: (x - originX) * zoom },
      clientY: { configurable: true, value: (y - originY) * zoom },
    });
    fireEvent(board, event);
  }
  await storageAction();
};

describe('remixer un niveau de campagne gagné (M11, ADR 0015 § Points d’entrée)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('pose la tentative gagnante dans une nouvelle création, la victoire comptée', async () => {
    const flush = createAnimationFrameHarness();
    let stored: CampaignProgress = {};
    const save = vi.fn((_progress: CampaignProgress) => {
      void _progress;
      return Promise.resolve({ status: 'ok' as const });
    });
    const progress: ProgressRepository = {
      recordVictory: async (id, count) => {
        const initial = await progress.load();
        const updated = recordSuccess(initial.status === 'ok' ? initial.progress : {}, id, count);
        await save(updated);
        return { status: 'ok', progress: updated };
      },
      load: () => Promise.resolve({ status: 'ok', progress: stored }),
      save,
      merge: (imported) => {
        stored = mergeCampaignProgressForTest(stored, imported);
        return Promise.resolve({ status: 'ok', progress: stored });
      },
      clear: () => Promise.resolve({ status: 'ok' }),
    };
    window.history.replaceState(null, '', `/levels/${levelOneId}/play`);
    await renderStorageReady(<App progressRepository={progress} />);

    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Objets disponibles' })).toBeVisible(),
    );
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Poutre courte, quantité : 1' })),
    );
    await tapWorldPoint(2, 3);
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Lancer' })));
    act(() => {
      flush(0);
      for (let frame = 1; frame <= 240; frame += 1) flush(frame * 1000);
    });
    const result = screen.getByRole('toolbar', { name: 'Actions de simulation' });
    const automaticDialog = await screen.findByRole('dialog', { name: 'Bravo !' });
    await storageAction(() =>
      fireEvent.click(within(automaticDialog).getByRole('button', { name: 'Voir la scène' })),
    );
    await storageAction(() =>
      fireEvent.click(within(result).getByRole('button', { name: 'Voir le résultat' })),
    );
    await storageAction(() =>
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Bravo !' })).getByRole('button', {
          name: 'Remixer',
        }),
      ),
    );

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor');
    });
    const draftId = new URLSearchParams(window.location.search).get('draft') ?? '';
    await waitFor(() => {
      expect(draftId).toMatch(/^creation-[0-9a-f]+$/u);
    });
    await waitFor(() => {
      expect(screen.getByText('Atelier')).toBeVisible();
    });
    const loaded = await testDraftRepository(() => new Date()).load(draftId);
    const creation = loaded.status === 'ok' ? loaded.creation : null;
    await waitFor(() => {
      expect(creation?.source).toEqual(winnableLevelOne);
    });
    await waitFor(() => {
      expect(creation?.document.metadata.title).toBe('La bille de service (remix)');
    });
    const posed = creation?.document.objects.filter(({ toPlace }) => toPlace === true) ?? [];
    await waitFor(() => {
      expect(posed.map(({ type }) => type)).toEqual(['beam']);
    });
    await waitFor(() => {
      expect(posed[0]?.transform.position.x).toBeCloseTo(2, 1);
    });
    await waitFor(() => {
      expect(posed[0]?.transform.position.y).toBeCloseTo(3, 1);
    });
  }, 15_000);
});
