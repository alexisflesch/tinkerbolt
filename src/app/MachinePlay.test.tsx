// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReceivedLevel } from '../application/received/received-level-repository';
import { levelDocumentSchema, type LevelDocument } from '../domain/level-document';

import {
  renderStorageReady,
  storageAction,
  testDraftRepository,
  testReceivedRepository,
} from './storage-test-fixture';
import { App } from './App';

const locked = { move: false, rotate: false, remove: false } as const;

/** ADR 0020: nothing to place; with `goal`, the ball falls straight into the basket and wins. */
const machine = (withGoal: boolean): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'machine-recue',
    metadata: { title: 'Machine reçue', author: 'Lili' },
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
    inventory: [],
    ...(withGoal ? { goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' } } : {}),
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  });

const entryId = `recu-${'b'.repeat(16)}`;

const saveEntry = async (document: LevelDocument): Promise<void> => {
  const level: ReceivedLevel = {
    id: entryId,
    document,
    origin: 'link',
    receivedAt: '2026-09-01T08:00:00.000Z',
    solved: false,
  };
  await waitFor(async () => {
    expect((await testReceivedRepository().save(level)).status).toBe('ok');
  });
};

const createAnimationFrameHarness = () => {
  let nextFrameId = 0;
  const pendingFrames = new Map<number, (timestamp: number) => void>();
  vi.stubGlobal('requestAnimationFrame', (callback: (timestamp: number) => void): number => {
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

const openPlay = async (): Promise<void> => {
  window.history.replaceState(null, '', `/my-levels/${entryId}/play`);
  await renderStorageReady(<App />);
  await screen.findByRole('button', { name: 'Lancer' });
};

/** Launches, then spaces enough frames to pass the 20 s limit (240 frames reach it, as in `ReceivedLevelPlay`). */
const runFor = (flush: (timestamp: number) => void, frames: number): void => {
  act(() => {
    flush(0);
    for (let frame = 1; frame <= frames; frame += 1) flush(frame * 1000);
  });
};

describe('jouer une machine reçue (ADR 0020)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('s’ouvre sans catalogue, inventaire ni objectif, avec « Lancer » et « Remixer »', async () => {
    await saveEntry(machine(false));
    await openPlay();

    expect(screen.queryByRole('region', { name: 'Objets disponibles' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Voir l’objectif' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remixer' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retour à Mes niveaux' })).toBeVisible();
  });

  it('tourne jusqu’à la durée maximale puis revient à l’arrêt, sans bannière ni résultat, jamais résolue', async () => {
    const flush = createAnimationFrameHarness();
    await saveEntry(machine(false));
    await openPlay();

    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Lancer' })));
    const toolbar = screen.getByRole('toolbar', { name: 'Actions de simulation' });
    await waitFor(() => {
      expect(within(toolbar).getByRole('button', { name: 'Mettre en pause' })).toBeVisible();
    });

    // Still running well before the limit, and nothing is announced.
    runFor(flush, 100);
    expect(within(toolbar).getByRole('button', { name: 'Mettre en pause' })).toBeVisible();
    expect(within(toolbar).queryByText(/^(Gagné !|Raté :)/u)).toBeNull();

    runFor(flush, 200);

    await waitFor(() => {
      expect(within(toolbar).getByRole('button', { name: 'Lancer' })).toBeVisible();
    });
    expect(within(toolbar).queryByText(/^(Gagné !|Raté :)/u)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    const stored = await testReceivedRepository().load(entryId);
    expect(stored.status === 'ok' && stored.level?.solved).toBe(false);
  });

  it('se remixe depuis la barre : une création ordinaire, sans objectif, ouverte dans l’atelier', async () => {
    await saveEntry(machine(false));
    await openPlay();

    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Remixer' })));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor');
    });
    const draftId = new URLSearchParams(window.location.search).get('draft') ?? '';
    const stored = await testDraftRepository(() => new Date()).load(draftId);
    if (stored.status !== 'ok' || stored.creation === null) throw new Error('Création absente.');
    expect(stored.creation.document.goal).toBeUndefined();
    expect(stored.creation.document.metadata.title).toBe('Machine reçue (remix)');
    expect(stored.creation.document.metadata.basedOn).toEqual([
      { title: 'Machine reçue', author: 'Lili' },
    ]);
  });

  it('garde le jeu d’aujourd’hui avec un objectif complet : « Objectif », victoire, résolu', async () => {
    const flush = createAnimationFrameHarness();
    await saveEntry(machine(true));
    await openPlay();

    expect(screen.getByRole('button', { name: 'Voir l’objectif' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remixer' })).toBeVisible();
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Lancer' })));
    runFor(flush, 240);

    const toolbar = screen.getByRole('toolbar', { name: 'Actions de simulation' });
    await waitFor(() => {
      expect(within(toolbar).getByText('Gagné !')).toBeVisible();
    });
    await waitFor(async () => {
      const stored = await testReceivedRepository().load(entryId);
      expect(stored.status === 'ok' && stored.level?.solved).toBe(true);
    });
  });
});
