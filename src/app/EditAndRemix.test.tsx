// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { creationFromLevel } from '../application/drafts/creation-from-level';
import type { DraftCreation } from '../application/drafts/draft-repository';
import type { CampaignProgress } from '../application/progression';
import type { ProgressRepository } from '../application/progression/progress-repository';
import type {
  ReceivedLevel,
  ReceivedLevelRepository,
} from '../application/received/received-level-repository';
import { embeddedLevels } from '../content/embedded-levels';
import type * as EmbeddedLevels from '../content/embedded-levels';
import { levelDocumentSchema, type LevelDocument } from '../domain/level-document';
import { createLocalStorageDraftRepository } from '../infrastructure/storage/local-storage-draft-repository';
import { createLocalStorageReceivedLevelRepository } from '../infrastructure/storage/local-storage-received-level-repository';

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
const locked = { move: false, rotate: false, remove: false } as const;

/**
 * A received level the ball wins alone, from right above the basket; a
 * short beam to place, harmless far on the left (checked headless).
 */
const receivedDocument: LevelDocument = levelDocumentSchema.parse({
  schemaVersion: 2,
  id: 'niveau-recu-m11',
  metadata: { title: 'Le saut', author: 'Lili' },
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
});

const entryId = `recu-${'b'.repeat(16)}`;

const entry = (extra: Partial<ReceivedLevel> = {}): ReceivedLevel => ({
  id: entryId,
  document: receivedDocument,
  origin: 'file',
  receivedAt: '2026-09-01T08:00:00.000Z',
  solved: false,
  ...extra,
});

const playerPose = { position: { x: 2, y: 3 }, rotation: 0 };

const levelTwo = embeddedLevels.find(({ id }) => id === 'campaign-02-par-dessus-le-mur');
if (levelTwo === undefined) throw new Error('Niveau 2 embarqué introuvable.');
const levelTwoDraftId = 'campaign-02-par-dessus-le-mur-brouillon';

const receivedStorage = () => createLocalStorageReceivedLevelRepository(window.localStorage);
const draftStorage = () => createLocalStorageDraftRepository(window.localStorage, testClock);

const storedCreation = (id: string | null): DraftCreation => {
  if (id === null) throw new Error('Aucune création dans l’URL.');
  const loaded = draftStorage().load(id);
  if (loaded.status !== 'ok' || loaded.creation === null) throw new Error('Création introuvable.');
  return loaded.creation;
};

const openedDraftId = (): string | null => new URLSearchParams(window.location.search).get('draft');

const toPlaceObjects = (document: LevelDocument) =>
  document.objects.filter(({ toPlace }) => toPlace === true);

const createProgressRepository = (progress: CampaignProgress = {}) => {
  const save = vi.fn(() => ({ status: 'ok' as const }));
  const repository: ProgressRepository = {
    load: () => ({ status: 'ok', progress }),
    save,
    clear: () => ({ status: 'ok' }),
  };
  return { repository, save };
};

const levelOneResolved: CampaignProgress = {
  'campaign-01-la-bille-de-service': { resolved: true, bestObjectCount: 1 },
};

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

const launchToOutcome = (flush: (timestamp: number) => void): HTMLElement => {
  fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
  act(() => {
    flush(0);
    for (let frame = 1; frame <= 240; frame += 1) flush(frame * 1000);
  });
  return screen.getByRole('region', { name: 'Résultat du niveau' });
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
};

/** Places the received level's short beam at `playerPose`, as a player. */
const placeBeam = (): void => {
  const toggle = screen.queryByRole('button', { name: 'Ouvrir le catalogue' });
  if (toggle !== null) fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: 'Poutre courte, quantité : 1' }));
  tapWorldPoint(playerPose.position.x, playerPose.position.y);
};

describe('modifier et remixer (M11, ADR 0015 § Points d’entrée)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const receivedCard = (): HTMLElement =>
    within(screen.getByRole('region', { name: 'Niveaux reçus' })).getByRole('region', {
      name: 'Le saut',
    });

  it('« Modifier » un niveau reçu non résolu ouvre une création sans objet à placer', () => {
    expect(receivedStorage().save(entry()).status).toBe('ok');
    window.history.replaceState(null, '', '/my-levels');
    render(<App />);

    fireEvent.click(within(receivedCard()).getByRole('button', { name: 'Modifier' }));

    expect(window.location.pathname).toBe('/editor');
    expect(openedDraftId()).toMatch(/^creation-[0-9a-f]+$/u);
    expect(screen.getByText('Atelier')).toBeVisible();
    const creation = storedCreation(openedDraftId());
    expect(toPlaceObjects(creation.document)).toEqual([]);
    expect(creation.document.metadata.title).toBe('Le saut (remix)');
    expect(creation.source).toEqual(receivedDocument);
    expect(receivedStorage().load(entryId)).toEqual({ status: 'ok', level: entry() });
  });

  it('« Modifier » un niveau reçu résolu pose la solution du joueur', () => {
    const solved = entry({
      solved: true,
      bestObjectCount: 1,
      playerSolution: { placements: [{ inventoryId: 'inventory-beam', transform: playerPose }] },
    });
    expect(receivedStorage().save(solved).status).toBe('ok');
    window.history.replaceState(null, '', '/my-levels');
    render(<App />);

    fireEvent.click(within(receivedCard()).getByRole('button', { name: 'Modifier' }));

    const creation = storedCreation(openedDraftId());
    expect(
      toPlaceObjects(creation.document).map(({ type, transform }) => ({ type, transform })),
    ).toEqual([{ type: 'beam', transform: playerPose }]);
    expect(receivedStorage().load(entryId)).toEqual({ status: 'ok', level: solved });
  });

  it('« Remixer » après la victoire d’un niveau reçu pose la tentative gagnante, sans changer le niveau', () => {
    const flush = createAnimationFrameHarness();
    expect(receivedStorage().save(entry()).status).toBe('ok');
    window.history.replaceState(null, '', `/my-levels/${entryId}/play`);
    render(<App />);

    placeBeam();
    const result = launchToOutcome(flush);
    expect(within(result).getByText('Victoire')).toBeVisible();
    fireEvent.click(within(result).getByRole('button', { name: 'Voir le résultat' }));
    const dialog = screen.getByRole('dialog', { name: 'Bravo !' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remixer' }));

    expect(window.location.pathname).toBe('/editor');
    expect(screen.getByText('Atelier')).toBeVisible();
    const creation = storedCreation(openedDraftId());
    const posed = toPlaceObjects(creation.document);
    expect(posed.map(({ type }) => type)).toEqual(['beam']);
    expect(posed[0]?.transform.position.x).toBeCloseTo(playerPose.position.x, 1);
    expect(posed[0]?.transform.position.y).toBeCloseTo(playerPose.position.y, 1);
    expect(creation.source).toEqual(receivedDocument);
    const stored = receivedStorage().load(entryId);
    expect(stored.status === 'ok' ? stored.level?.document : null).toEqual(receivedDocument);
    expect(stored.status === 'ok' ? stored.level?.solved : null).toBe(true);
  });

  it('dit discrètement qu’une victoire sur un niveau reçu n’a pas pu être enregistrée', () => {
    const flush = createAnimationFrameHarness();
    const repository: ReceivedLevelRepository = {
      list: () => ({ status: 'ok', ids: [entryId] }),
      load: () => ({ status: 'ok', level: entry() }),
      save: () => ({ status: 'error', code: 'quota-exceeded' }),
      delete: () => ({ status: 'ok' }),
    };
    window.history.replaceState(null, '', `/my-levels/${entryId}/play`);
    render(<App receivedLevelRepository={repository} />);
    expect(screen.queryByRole('status')).toBeNull();

    launchToOutcome(flush);

    expect(
      screen.getByText('Ta victoire n’a pas pu être enregistrée sur cet appareil.'),
    ).toHaveAttribute('role', 'status');
  });

  it('ouvre hors développement la création d’un niveau de campagne déverrouillé sans solution ni fiche', () => {
    const { repository } = createProgressRepository(levelOneResolved);
    window.history.replaceState(null, '', '/levels');
    render(<App progressRepository={repository} />);

    fireEvent.click(screen.getByRole('button', { name: 'Modifier le niveau 2' }));

    expect(openedDraftId()).toBe(levelTwoDraftId);
    expect(screen.getByText('Atelier')).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Fiche de calibrage' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ouvrir la fiche de calibrage' })).toBeNull();
    expect(toPlaceObjects(storedCreation(levelTwoDraftId).document)).toEqual([]);
  });

  it('en développement, ouvre une nouvelle création de campagne avec la solution révélée, sans fiche de calibrage (V7b)', () => {
    const { repository } = createProgressRepository(levelOneResolved);
    window.history.replaceState(null, '', '/levels');
    render(<App progressRepository={repository} developmentMode />);

    fireEvent.click(screen.getByRole('button', { name: 'Modifier le niveau 2' }));

    expect(screen.queryByRole('dialog', { name: 'Fiche de calibrage' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ouvrir la fiche de calibrage' })).toBeNull();
    expect(toPlaceObjects(storedCreation(levelTwoDraftId).document)).toHaveLength(
      levelTwo.solution?.placements.length ?? -1,
    );
  });

  it('en développement, rouvre une création de campagne existante sans y révéler la solution', () => {
    expect(
      draftStorage().save(creationFromLevel(levelTwo, { createId: () => levelTwoDraftId })).status,
    ).toBe('ok');
    const { repository } = createProgressRepository(levelOneResolved);
    window.history.replaceState(null, '', '/levels');
    render(<App progressRepository={repository} developmentMode />);

    fireEvent.click(screen.getByRole('button', { name: 'Modifier le niveau 2' }));

    expect(screen.getByText('Atelier')).toBeVisible();
    expect(toPlaceObjects(storedCreation(levelTwoDraftId).document)).toEqual([]);
  });

  it('désactive « Modifier » d’un niveau verrouillé', () => {
    const { repository } = createProgressRepository();
    window.history.replaceState(null, '', '/levels');
    render(<App progressRepository={repository} />);

    expect(screen.getByRole('button', { name: 'Modifier le niveau 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Modifier le niveau 2' })).toBeDisabled();
  });

  it('refuse l’URL directe de la création d’un niveau verrouillé, même enregistrée, sans la modifier', () => {
    expect(
      draftStorage().save(creationFromLevel(levelTwo, { createId: () => levelTwoDraftId })).status,
    ).toBe('ok');
    const before = window.localStorage.getItem(`tinkerbolt:draft:${levelTwoDraftId}`);
    const { repository } = createProgressRepository();
    window.history.replaceState(null, '', `/editor?draft=${levelTwoDraftId}`);
    render(<App progressRepository={repository} />);

    expect(screen.getByText('Ce niveau est encore verrouillé.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Campagne' })).toHaveAttribute('href', '/levels');
    expect(screen.queryByRole('region', { name: 'Plateau de jeu' })).toBeNull();
    expect(window.localStorage.getItem(`tinkerbolt:draft:${levelTwoDraftId}`)).toBe(before);
  });

  it('ouvre la création d’un niveau verrouillé sous `unlockAllLevels`', () => {
    const { repository } = createProgressRepository();
    window.history.replaceState(null, '', '/levels');
    render(<App progressRepository={repository} unlockAllLevels />);

    fireEvent.click(screen.getByRole('button', { name: 'Modifier le niveau 2' }));

    expect(openedDraftId()).toBe(levelTwoDraftId);
    expect(screen.getByText('Atelier')).toBeVisible();
    expect(screen.queryByText('Ce niveau est encore verrouillé.')).toBeNull();
  });
});
