// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  Preferences,
  PreferencesRepository,
} from '../application/preferences/preferences-repository';
import type { CampaignProgress } from '../application/progression';
import type { ProgressRepository } from '../application/progression/progress-repository';
import { embeddedLevels } from '../content/embedded-levels';
import type * as EmbeddedLevels from '../content/embedded-levels';
import { levelDocumentSchema } from '../domain/level-document';
import tuto3 from '../content/levels/tuto-3.json';
import type {
  ReceivedLevel,
  ReceivedLevelRepository,
  ReceivedLevelWriteResult,
} from '../application/received/received-level-repository';
import { levelFingerprint } from '../infrastructure/level-file/level-fingerprint';
import { encodeShareFragment } from '../infrastructure/level-share/level-share-codec';
import { createLocalStorageReceivedLevelRepository } from '../infrastructure/storage/local-storage-received-level-repository';
import { selfSolvingLevel } from '../../test/fixtures/self-solving-level';
import { fitCameraToScene } from '../presentation/board-camera';
import {
  ROTATION_HANDLE_GAP_CSS_PIXELS,
  ROTATION_HANDLE_KNOB_RADIUS_CSS_PIXELS,
} from '../presentation/rotation-handle-metrics';
import styles from '../ui/styles.css?raw';

import { App } from './App';
import type { RegisterServiceWorker } from './PwaUpdateProvider';
import { screenPointToWorld } from './screen-point-to-world';
import { useVictoryDialog } from './use-victory-dialog';

const VictoryDialogTimerProbe = ({ hasVictory }: { readonly hasVictory: boolean }) => {
  const victoryDialog = useVictoryDialog(hasVictory);
  return victoryDialog.isOpen ? <div role="dialog" aria-label="Bravo !" /> : null;
};

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

type PointerEventType = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';

interface TestPointerEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly clientX: number;
  readonly clientY: number;
}

const firePointerEvent = (
  element: HTMLElement,
  type: PointerEventType,
  properties: TestPointerEvent,
): void => {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    pointerId: { configurable: true, value: properties.pointerId },
    pointerType: { configurable: true, value: properties.pointerType },
    clientX: { configurable: true, value: properties.clientX },
    clientY: { configurable: true, value: properties.clientY },
  });
  fireEvent(element, event);
};

type AnimationFrameCallback = (timestamp: number) => void;

const createAnimationFrameHarness = () => {
  let nextFrameId = 0;
  const pendingFrames = new Map<number, AnimationFrameCallback>();
  const requestAnimationFrame = vi.fn((callback: AnimationFrameCallback): number => {
    const frameId = nextFrameId;
    nextFrameId += 1;
    pendingFrames.set(frameId, callback);
    return frameId;
  });
  const cancelAnimationFrame = vi.fn((frameId: number): void => {
    pendingFrames.delete(frameId);
  });

  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);

  return {
    requestAnimationFrame,
    flush(timestamp: number): void {
      const callbacks = [...pendingFrames.values()];
      pendingFrames.clear();
      for (const callback of callbacks) callback(timestamp);
    },
  };
};

const openEmbeddedLevelOne = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Campagne' }));
  fireEvent.click(screen.getByRole('button', { name: 'Jouer le niveau 1' }));
};

const createProgressRepository = (progress: CampaignProgress = {}) => {
  const save = vi.fn(() => ({ status: 'ok' as const }));
  const repository: ProgressRepository = {
    load: () => ({ status: 'ok', progress }),
    save,
    clear: () => ({ status: 'ok' }),
  };
  return { repository, save };
};

/** U8: an in-memory preferences port that keeps what it is asked to save. */
const createPreferencesRepository = (initial: Preferences = {}) => {
  let stored = initial;
  const saved: Preferences[] = [];
  const repository: PreferencesRepository = {
    load: () => ({ status: 'ok', preferences: stored }),
    save: (preferences) => {
      saved.push(preferences);
      stored = preferences;
      return { status: 'ok' };
    },
  };
  return { repository, saved };
};

const firstLevelHint = (): HTMLElement | null =>
  screen.queryByRole('region', { name: 'Aide du niveau 1' });

/** U10: a service worker port whose new version is already waiting. */
const waitingPwaUpdate = () => {
  const applyUpdate = vi.fn(() => Promise.resolve());
  const register: RegisterServiceWorker = (onNeedRefresh) => {
    onNeedRefresh();
    return Promise.resolve(applyUpdate);
  };
  return { applyUpdate, register };
};

/** U10: a fake `beforeinstallprompt`, as Chrome on Android fires it. */
const installPromptEvent = (outcome: 'accepted' | 'dismissed') => {
  const prompt = vi.fn(() => Promise.resolve());
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  return { event, prompt };
};

const pwaUpdateInvitation = (): HTMLElement | null =>
  screen.queryByRole('region', { name: 'Mise à jour de TinkerBolt' });

const installInvitation = (): HTMLElement | null =>
  screen.queryByRole('region', { name: 'Installer TinkerBolt' });

/** M8: an in-memory received-level port whose writes all answer `saveResult`. */
const createReceivedLevelRepository = (saveResult: ReceivedLevelWriteResult = { status: 'ok' }) => {
  const saves: ReceivedLevel[] = [];
  const repository: ReceivedLevelRepository = {
    list: () => ({ status: 'ok', ids: [] }),
    load: () => ({ status: 'ok', level: null }),
    save: (level) => {
      saves.push(level);
      return saveResult;
    },
    delete: () => ({ status: 'ok' }),
  };
  return { repository, saves };
};

/**
 * A non-campaign level that wins on its own (V2a): the stored received level
 * `selfSolvingLevel`, played on `/my-levels/<id>/play`, stands in for what the
 * removed `/demo` route offered to the tests below.
 */
const SELF_SOLVING_ENTRY_ID = 'recu-0123456789abcdef';
const openSelfSolvingReceivedLevel = (progressRepository?: ProgressRepository): void => {
  const level: ReceivedLevel = {
    id: SELF_SOLVING_ENTRY_ID,
    document: selfSolvingLevel,
    origin: 'file',
    receivedAt: '2026-10-02T12:00:00.000Z',
    solved: false,
  };
  const repository: ReceivedLevelRepository = {
    list: () => ({ status: 'ok', ids: [level.id] }),
    load: () => ({ status: 'ok', level }),
    save: () => ({ status: 'ok' }),
    delete: () => ({ status: 'ok' }),
  };
  window.history.replaceState(null, '', `/my-levels/${SELF_SOLVING_ENTRY_ID}/play`);
  render(
    <App
      receivedLevelRepository={repository}
      {...(progressRepository === undefined ? {} : { progressRepository })}
    />,
  );
};

const sharedLevelNotKeptMessage = 'Ce niveau n’a pas été gardé sur cet appareil.';

const sharedM8Level = levelDocumentSchema.parse({
  schemaVersion: 2,
  id: 'niveau-recu-m8',
  metadata: { title: 'Niveau reçu M8' },
  objects: [
    {
      id: 'ball-1',
      type: 'ball',
      props: {},
      transform: { position: { x: 1, y: 1 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
    {
      id: 'basket-1',
      type: 'basket',
      props: {},
      transform: { position: { x: 7, y: 4.5 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
  ],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
});

const tapWorldPoint = (x: number, y: number): void => {
  const board = screen.getByRole('region', { name: 'Plateau de jeu' });
  const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
  const rawOrigin = canvas.getAttribute('data-camera-origin');
  if (rawOrigin === null) throw new Error('Origine caméra absente du canvas.');
  const [originX, originY] = rawOrigin.split(',').map(Number);
  const zoom = Number(canvas.getAttribute('data-camera-zoom'));
  if (originX === undefined || originY === undefined || !Number.isFinite(zoom) || zoom <= 0) {
    throw new Error('Cadrage caméra invalide dans le test.');
  }

  const canvasBounds = canvas.getBoundingClientRect();
  tapBoard(
    board,
    canvasBounds.left + (x - originX) * zoom,
    canvasBounds.top + (y - originY) * zoom,
  );
};

const placeCampaignBeam = (x: number, y: number): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
  fireEvent.click(screen.getByRole('button', { name: /^Poutre courte/ }));
  tapWorldPoint(x, y);
};

/** B5: the declared scene of the level the app boots into, for cross-checking `fitCameraToScene`. */
const levelOneScene = (() => {
  const levelOne = embeddedLevels[0];
  if (levelOne === undefined)
    throw new Error('Le niveau 1 embarqué est indisponible dans les tests.');
  return levelOne.scene;
})();

/**
 * B1 (plan-remise-en-jeu.md § 4) moved the free-creation workshop off the
 * home screen: it is reachable only through ☰ → « Atelier ».
 * Every test below that exercises editor/catalogue behaviour starts here.
 */
const openEmbeddedWorkshop = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Atelier' }));
};

const tapBoard = (board: HTMLElement, clientX: number, clientY: number): void => {
  firePointerEvent(board, 'pointerdown', { pointerId: 1, pointerType: 'touch', clientX, clientY });
  firePointerEvent(board, 'pointerup', { pointerId: 1, pointerType: 'touch', clientX, clientY });
};

/** Places an object from the open workshop's catalogue with a tap at (x, y). */
const placeFromCatalogue = (catalogueCard: string, clientX = 400, clientY = 225): HTMLElement => {
  const toggle = screen.queryByRole('button', { name: 'Ouvrir le catalogue' });
  if (toggle !== null) fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: catalogueCard }));

  const board = screen.getByRole('region', { name: 'Plateau de jeu' });
  tapBoard(board, clientX, clientY);
  return board;
};

/** Picks the author's "Fil" card (U15). */
const selectWireCard = (): void => {
  const toggle = screen.queryByRole('button', { name: 'Ouvrir le catalogue' });
  if (toggle !== null) fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: 'Fil de commande' }));
};

const placeWorkshopObject = (catalogueCard: string): HTMLElement => {
  openEmbeddedWorkshop();
  return placeFromCatalogue(catalogueCard);
};

const placeWorkshopBeam = (): HTMLElement => placeWorkshopObject('Poutre moyenne');

const advanceSimulationToResult = (
  animationFrames: ReturnType<typeof createAnimationFrameHarness>,
  frameCount = 180,
): void => {
  const fixedStepMilliseconds = 1000 / 60;

  act(() => {
    animationFrames.flush(0);
    for (let frame = 1; frame <= frameCount; frame += 1) {
      animationFrames.flush(frame * fixedStepMilliseconds);
    }
  });
};

/**
 * B2 (plan-remise-en-jeu.md § 4) : le budget d'une tentative vaut vingt
 * secondes simulées, soit 1200 pas fixes à 60 Hz, et le plafond de rattrapage
 * n'accorde que cinq pas par frame. Il faut donc 240 frames suffisamment
 * espacées pour atteindre le temps écoulé. Les frames suivantes sont sans
 * effet : la boucle cesse de se replanifier dès l'issue connue.
 */
const advanceSimulationToTimeout = (
  animationFrames: ReturnType<typeof createAnimationFrameHarness>,
): void => {
  act(() => {
    animationFrames.flush(0);
    for (let frame = 1; frame <= 240; frame += 1) {
      animationFrames.flush(frame * 1000);
    }
  });
};

/**
 * jsdom does no layout, so every element's `getBoundingClientRect()` is a
 * zero rect by default. That degenerate size is a real edge case the pure
 * camera module handles safely (ADR 0007's absolute zoom floor), but it does
 * not exercise the actual fit/conversion math a browser would run, and it
 * silently changes what a hardcoded click coordinate means in world units.
 * Stubbing the canvas's rect to a plausible, non-zero size — chosen at the
 * workshop scene's own 16:9 aspect ratio, which also happens to reproduce
 * the historical default zoom of 48 px/unit — keeps every click coordinate
 * in this file meaningful without hand-tuning each one.
 */
const BOARD_CANVAS_WIDTH_IN_CSS_PIXELS = 800;
const BOARD_CANVAS_HEIGHT_IN_CSS_PIXELS = 450;

const boardCanvasRect: DOMRect = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: BOARD_CANVAS_WIDTH_IN_CSS_PIXELS,
  bottom: BOARD_CANVAS_HEIGHT_IN_CSS_PIXELS,
  width: BOARD_CANVAS_WIDTH_IN_CSS_PIXELS,
  height: BOARD_CANVAS_HEIGHT_IN_CSS_PIXELS,
  toJSON() {
    return this;
  },
};

describe('coque TinkerBolt', () => {
  beforeEach(() => {
    // `BrowserRouter` (ADR 0008) reads the real `window.location`, which
    // jsdom keeps across tests in this file — without this reset, a test
    // that navigates away (e.g. `openEmbeddedWorkshop`) leaks its route into
    // whichever test renders `<App />` next.
    // Board scenarios address the first level directly; the landing has
    // its own root-route coverage in HomePage.test.tsx.
    window.history.replaceState(null, '', '/levels/campaign-01-la-bille-de-service/play');
    window.localStorage.clear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('ouvre l’objectif dans une boîte de dialogue modale et rend le focus en la fermant', () => {
    render(<App />);

    const trigger = screen.getByRole('button', { name: 'Voir l’objectif' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Objectif du niveau' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('Faire entrer la balle dans le panier');
    const close = within(dialog).getByRole('button', { name: 'Fermer l’objectif' });
    expect(close).toHaveFocus();

    // Tab reste dans la boîte de dialogue.
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.click(close);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('ferme la boîte de dialogue de l’objectif par Échap ou par un toucher sur le fond', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Voir l’objectif' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voir l’objectif' }));
    const backdrop = container.ownerDocument.querySelector('.dialog-scrim');
    expect(backdrop).not.toBeNull();
    if (backdrop !== null) fireEvent.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lance depuis l’accueil, par la campagne, le niveau 1, avec sa poutre et sans édition libre', () => {
    window.history.replaceState(null, '', '/');
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Jouer' }));
    expect(window.location.pathname).toBe('/levels');
    fireEvent.click(screen.getByRole('button', { name: 'Jouer le niveau 1' }));

    expect(screen.getByRole('heading', { name: 'TinkerBolt' })).toBeVisible();
    expect(screen.getByText('Niveau 1 · La bille de service')).toBeVisible();
    expect(screen.getByText('Campagne')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    // L'objectif n'occupe plus d'espace permanent : il est accessible par un
    // bouton explicite (`mobile-editor-interactions.md` § Organisation de
    // l'écran : « un accès à l'objectif »).
    expect(screen.queryByText('Faire entrer la balle dans le panier')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voir l’objectif' })).toBeVisible();

    expect(screen.getByRole('region', { name: 'Objets disponibles' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ouvrir le catalogue' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rétablir' })).toBeDisabled();

    for (const actionName of ['Lancer', 'Zoom arrière', 'Ajuster à la scène', 'Zoom avant']) {
      expect(screen.getByRole('button', { name: actionName })).toBeVisible();
    }
  });

  it('limite le catalogue du mode joueur aux objets de l’inventaire du niveau', () => {
    // Ce niveau est verrouillé sans progression (U5b) ; `unlockAllLevels`
    // ouvre son URL directement, comme en mode développement, sans que le
    // test ait à rejouer toute la campagne pour ce qui ne concerne que le
    // catalogue.
    window.history.replaceState(null, '', '/levels/campaign-03-la-balancoire/play');
    render(<App unlockAllLevels />);

    const drawer = screen.getByRole('region', { name: 'Objets disponibles' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Ouvrir le catalogue' }));

    expect(within(drawer).getByText('3 entrées')).toBeVisible();
    expect(drawer.querySelectorAll('.object-card')).toHaveLength(3);
    const beamCard = within(drawer).getByRole('button', {
      name: 'Poutre courte, quantité : 1',
    });
    expect(beamCard).toBeEnabled();
    expect(within(drawer).queryByRole('button', { name: 'Balle' })).not.toBeInTheDocument();

    fireEvent.click(beamCard);
    tapWorldPoint(3.2, 2.5);
    fireEvent.click(within(drawer).getByRole('button', { name: 'Ouvrir le catalogue' }));

    expect(
      within(drawer).getByRole('button', { name: 'Poutre courte, quantité : 0' }),
    ).toBeDisabled();
  });

  it('ouvre l’atelier depuis le menu et expose le plateau et les familles du catalogue', () => {
    // Réécrit depuis « présente le plateau et les quatre familles du
    // catalogue » : ce test décrivait l'atelier comme écran d'accueil, un
    // comportement que B1 supprime explicitement. L'atelier reste
    // entièrement fonctionnel, mais désormais uniquement depuis ☰.
    render(<App />);
    openEmbeddedWorkshop();

    expect(screen.queryByText('Éditeur de niveaux')).not.toBeInTheDocument();
    expect(screen.getByText('Atelier')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Objets disponibles' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));

    expect(screen.queryByRole('button', { name: /Balle rouge/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Balle' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Panier/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Poutre/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Bascule/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Masse/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Levier/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Convoyeur/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Bouton/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Ventilateur/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Barrière/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Tremplin/ })).toBeVisible();
  });

  it('rend un canvas accessible superposé au plateau et conserve son aide tactile', () => {
    render(<App />);

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });

    expect(canvas.tagName).toBe('CANVAS');
    expect(within(board).queryByText('Préparez votre machine')).not.toBeInTheDocument();
    expect(
      within(board).queryByText('Le plateau est prêt pour votre prochaine construction.'),
    ).not.toBeInTheDocument();
    expect(board.querySelector('.scene-ground')).not.toBeInTheDocument();
    // U2: the background belongs to the renderer so it follows the camera.
    expect(styles).not.toContain('board-generic-v0.png');

    for (const controlName of ['Zoom arrière', 'Ajuster à la scène', 'Zoom avant']) {
      expect(screen.getByRole('button', { name: controlName })).toBeVisible();
    }
  });

  it('dessine le fantôme de placement dans le canvas, qui suit la souris puis le geste tactile (U1)', () => {
    render(<App />);
    openEmbeddedWorkshop();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: /Masse/ }));

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
    expect(canvas).not.toHaveAttribute('data-placement-ghost');

    firePointerEvent(board, 'pointermove', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 120,
      clientY: 100,
    });

    // The ghost is drawn by the renderer: no DOM overlay sits on the board.
    expect(board.querySelector('.placement-preview')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Aperçu de placement/ })).not.toBeInTheDocument();
    expect(canvas).toHaveAttribute('data-placement-ghost', 'valid');
    const initialPosition = canvas.getAttribute('data-placement-ghost-position');
    expect(initialPosition).not.toBeNull();

    firePointerEvent(board, 'pointermove', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 260,
      clientY: 180,
    });

    const mousePosition = canvas.getAttribute('data-placement-ghost-position');
    expect(mousePosition).not.toBeNull();
    expect(mousePosition).not.toBe(initialPosition);

    firePointerEvent(board, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 120,
      clientY: 100,
    });
    firePointerEvent(board, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 200,
      clientY: 140,
    });

    expect(canvas.getAttribute('data-placement-ghost-position')).not.toBe(mousePosition);
    expect(board.querySelector('.placement-preview')).not.toBeInTheDocument();

    firePointerEvent(board, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 200,
      clientY: 140,
    });

    // Committed: the object is solid, the ghost is gone.
    expect(canvas).not.toHaveAttribute('data-placement-ghost');
    expect(canvas).not.toHaveAttribute('data-placement-ghost-position');
  });

  it('replie le catalogue sans superposer de texte dans la zone de construction', () => {
    render(<App />);
    openEmbeddedWorkshop();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: /Masse/ }));

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    expect(within(board).queryByText(/Placement actif\s*:\s*Masse/i)).not.toBeInTheDocument();
    expect(
      within(board).queryByRole('button', { name: 'Annuler le placement' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir le catalogue' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('permet de replier puis de rouvrir le catalogue avec un contenu accessible', () => {
    render(<App />);
    openEmbeddedWorkshop();

    const openButton = screen.getByRole('button', { name: 'Ouvrir le catalogue' });
    expect(openButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Balle' })).not.toBeInTheDocument();

    fireEvent.click(openButton);

    const collapseButton = screen.getByRole('button', { name: 'Replier le catalogue' });
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Balle' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fermer le catalogue' })).toBeVisible();

    fireEvent.click(collapseButton);

    const reopenedButton = screen.getByRole('button', { name: 'Ouvrir le catalogue' });
    expect(reopenedButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Balle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fermer le catalogue' })).not.toBeInTheDocument();

    fireEvent.click(reopenedButton);

    expect(screen.getByRole('button', { name: 'Replier le catalogue' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Balle' })).toBeVisible();
  });

  it('ferme le tiroir lorsqu’on touche le scrim', () => {
    render(<App />);
    openEmbeddedWorkshop();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le catalogue' }));

    expect(screen.getByRole('button', { name: 'Ouvrir le catalogue' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('button', { name: 'Fermer le catalogue' })).not.toBeInTheDocument();
  });

  it('conserve la même géométrie de workspace pendant l’ouverture', () => {
    render(<App />);
    openEmbeddedWorkshop();

    const workspace = screen.getByRole('region', { name: 'Espace de construction' });
    const boundsBefore = workspace.getBoundingClientRect();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));

    expect(workspace.getBoundingClientRect()).toEqual(boundsBefore);
  });

  it('laisse les actions essentielles visibles lorsque le tiroir est replié', () => {
    render(<App />);
    openEmbeddedWorkshop();

    expect(screen.getByRole('button', { name: 'Ouvrir le catalogue' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    for (const actionName of [
      'Ouvrir le menu',
      'Annuler',
      'Rétablir',
      'Lancer',
      'Zoom arrière',
      'Ajuster à la scène',
      'Zoom avant',
    ]) {
      expect(screen.getByRole('button', { name: actionName })).toBeVisible();
    }
  });

  it('lance la simulation depuis l’atelier puis propose de revenir à l’édition', () => {
    render(<App />);
    openEmbeddedWorkshop();

    const testButton = screen.getByRole('button', { name: 'Lancer' });
    expect(testButton).toBeEnabled();

    fireEvent.click(testButton);

    expect(screen.getByText('Simulation en cours')).toBeVisible();
    const resetButton = screen.getByRole('button', { name: 'Recommencer' });
    expect(resetButton).toBeVisible();
    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    expect(
      within(board).queryByRole('button', { name: 'Mettre en pause' }),
    ).not.toBeInTheDocument();
    expect(within(board).queryByRole('button', { name: 'Recommencer' })).not.toBeInTheDocument();

    fireEvent.click(resetButton);

    expect(screen.queryByText('Simulation en cours')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeEnabled();
  });

  it('conserve la construction après une victoire obtenue dans l’éditeur', () => {
    const animationFrames = createAnimationFrameHarness();
    render(<App />);
    openEmbeddedWorkshop();

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    // Déplacer le panier auteur sur la balle rend la victoire immédiate, tout
    // en laissant une modification réelle de l’atelier à vérifier après le
    // retour à l’édition.
    firePointerEvent(board, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 600,
      clientY: 350,
    });
    firePointerEvent(board, 'pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 400,
      clientY: 50,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 400,
      clientY: 50,
    });

    expect(screen.getByRole('region', { name: 'Propriétés de Panier' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    advanceSimulationToResult(animationFrames, 40);

    const result = screen.getByRole('region', { name: 'Résultat du niveau' });
    expect(within(result).getByText('Victoire')).toBeVisible();
    expect(within(result).getByRole('button', { name: 'Retour à l’édition' })).toBeVisible();
    expect(within(result).queryByRole('button', { name: 'Recommencer' })).toBeNull();
    expect(within(result).queryByRole('button', { name: 'Retour aux niveaux' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Bravo !' })).not.toBeInTheDocument();

    fireEvent.click(within(result).getByRole('button', { name: 'Retour à l’édition' }));

    expect(screen.queryByRole('region', { name: 'Résultat du niveau' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Propriétés de Panier' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeEnabled();
  });

  it('avance la physique par RAF contrôlé et permet de la mettre en pause puis de reprendre', () => {
    const animationFrames = createAnimationFrameHarness();
    render(<App />);

    const testButton = screen.getByRole('button', { name: 'Lancer' });
    expect(testButton).toBeEnabled();
    fireEvent.click(testButton);

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
    expect(screen.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();
    expect(canvas).toHaveAttribute('data-simulation-step', '0');
    const initialBallPosition = canvas.getAttribute('data-simulation-ball-position');
    expect(initialBallPosition).not.toBeNull();
    expect(animationFrames.requestAnimationFrame).toHaveBeenCalled();

    const fixedStepMilliseconds = 1000 / 60;
    act(() => {
      animationFrames.flush(0);
    });
    act(() => {
      animationFrames.flush(fixedStepMilliseconds);
    });

    expect(canvas).toHaveAttribute('data-simulation-step', '1');
    expect(canvas.getAttribute('data-simulation-ball-position')).not.toBe(initialBallPosition);

    fireEvent.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeVisible();
    const pausedStep = canvas.getAttribute('data-simulation-step');
    const pausedBallPosition = canvas.getAttribute('data-simulation-ball-position');

    act(() => {
      animationFrames.flush(fixedStepMilliseconds * 2);
    });

    expect(canvas).toHaveAttribute('data-simulation-step', pausedStep);
    expect(canvas).toHaveAttribute('data-simulation-ball-position', pausedBallPosition);

    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }));
    expect(screen.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();
    act(() => {
      animationFrames.flush(fixedStepMilliseconds * 3);
    });
    act(() => {
      animationFrames.flush(fixedStepMilliseconds * 4);
    });

    expect(Number(canvas.getAttribute('data-simulation-step'))).toBeGreaterThan(Number(pausedStep));
    expect(canvas.getAttribute('data-simulation-ball-position')).not.toBe(pausedBallPosition);
  });

  it('plafonne le rattrapage RAF à 5 pas fixes après un long écart entre deux frames', () => {
    // Un retour d'onglet suspend requestAnimationFrame ; l'écart entre deux
    // frames peut alors valoir plusieurs secondes. Sans plafond, la boucle
    // tenterait des centaines de pas fixes d'un coup (5000 ms / (1000/60 ms)
    // = 300 pas) et gèlerait la page. Le plafond limite le rattrapage à 5 pas
    // fixes par frame ; le reste de la durée accumulée est abandonné.
    const animationFrames = createAnimationFrameHarness();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
    expect(canvas).toHaveAttribute('data-simulation-step', '0');

    act(() => {
      animationFrames.flush(0);
    });
    act(() => {
      animationFrames.flush(5000);
    });

    expect(canvas).toHaveAttribute('data-simulation-step', '5');
  });

  it('ouvre depuis le menu la liste des niveaux, regroupée par chapitres (U5)', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Campagne' }));

    const levelList = screen.getByRole('region', { name: 'Campagne' });
    expect(levelList).toBeVisible();
    // V6: the « carnet de l'atelier » banner and its counters are gone (V4 mock-up).
    expect(
      within(levelList).queryByRole('heading', { name: 'Choisis ton prochain défi' }),
    ).toBeNull();
    expect(within(levelList).queryByText('Le carnet de l’atelier')).toBeNull();
    expect(within(levelList).queryByRole('term')).toBeNull();
    expect(
      within(
        within(levelList).getByRole('region', { name: 'Chapitre 1 · Les billes de service' }),
      ).getByText('0 / 3 résolus'),
    ).toBeVisible();
    for (const chapter of [
      'Chapitre 1 · Les billes de service',
      'Chapitre 2 · Commandes à distance',
      'Chapitre 3 · Le vent',
      "Chapitre 4 · L'ordre et le temps",
      'Chapitre 5 · Grandes machines',
    ]) {
      expect(within(levelList).getByRole('region', { name: chapter })).toBeVisible();
    }
    for (const title of [
      'La bille de service',
      'Par-dessus le mur',
      'La balançoire',
      'Retour à l’expéditeur',
      'L’électricien',
      'La porte de trop',
      'Service à l’étage',
      'Le courant d’air',
      'Lever le rideau',
      'Le paravent de balles',
      'Après vous',
      'Treize secondes',
      'Une seule main',
      'L’aiguillage',
      'Le sonneur',
      'Deux souffles',
      'La grande machine',
    ]) {
      expect(within(levelList).getByRole('heading', { name: title })).toBeVisible();
    }

    expect(within(levelList).getByRole('button', { name: 'Jouer le niveau 1' })).toBeEnabled();
    for (let level = 2; level <= 17; level += 1) {
      expect(
        within(levelList).getByRole('button', { name: 'Jouer le niveau ' + String(level) }),
      ).toBeDisabled();
    }
    expect(within(levelList).getAllByText(/Verrouillé/)).toHaveLength(16);
  });
  it('affiche les niveaux résolus et ouvre le niveau qui suit (U5)', () => {
    const { repository } = createProgressRepository({
      'campaign-01-la-bille-de-service': { resolved: true, bestObjectCount: 1 },
      'campaign-02-par-dessus-le-mur': { resolved: true, bestObjectCount: 1 },
      'campaign-03-la-balancoire': { resolved: true, bestObjectCount: 1 },
      'campaign-04-retour-a-l-expediteur': { resolved: true, bestObjectCount: 2 },
    });
    window.history.replaceState(null, '', '/levels');
    render(<App progressRepository={repository} />);

    const levelList = screen.getByRole('region', { name: 'Campagne' });
    const cardOf = (level: number): HTMLElement =>
      within(levelList).getByRole('region', { name: 'Niveau ' + String(level) });

    const chapterCount = (name: string, count: string): void => {
      expect(
        within(within(levelList).getByRole('region', { name })).getByText(count),
      ).toBeVisible();
    };
    chapterCount('Chapitre 1 · Les billes de service', '3 / 3 résolus');
    chapterCount('Chapitre 2 · Commandes à distance', '1 / 3 résolus');
    chapterCount('Chapitre 3 · Le vent', '0 / 4 résolus');

    expect(cardOf(1)).toHaveAttribute('data-level-tier', 'resolved');
    expect(within(cardOf(1)).getByText(/Résolu/)).toBeVisible();
    expect(cardOf(4)).toHaveAttribute('data-level-tier', 'resolved');
    expect(within(cardOf(5)).queryByText(/Résolu|Élégant|Minimal/)).toBeNull();
    expect(within(cardOf(5)).getByRole('button', { name: 'Jouer le niveau 5' })).toBeEnabled();
    expect(within(cardOf(6)).getByRole('button', { name: 'Jouer le niveau 6' })).toBeDisabled();

    fireEvent.click(within(cardOf(5)).getByRole('button', { name: 'Jouer le niveau 5' }));
    expect(window.location.pathname).toBe('/levels/campaign-05-l-electricien/play');
  });
  it('place le Ràz atelier avant Lancer et demande confirmation avant d’effacer', () => {
    render(<App />);
    openEmbeddedWorkshop();

    const resetButton = screen.getByRole('button', { name: 'Remettre l’atelier à zéro' });
    const testButton = screen.getByRole('button', { name: 'Lancer' });
    expect(
      resetButton.compareDocumentPosition(testButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Poutre moyenne' }));
    tapWorldPoint(5.0, 2.15);
    expect(screen.getByRole('region', { name: 'Propriétés de Poutre' })).toBeVisible();

    fireEvent.click(resetButton);

    const dialog = screen.getByRole('dialog', { name: 'Remise à zéro de l’atelier' });
    expect(dialog).toHaveTextContent('efface');
    const cancelButton = within(dialog).getByRole('button', { name: 'Annuler' });
    expect(document.activeElement).toBe(cancelButton);

    fireEvent.click(cancelButton);
    expect(screen.queryByRole('dialog', { name: 'Remise à zéro de l’atelier' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Propriétés de Poutre' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Remettre l’atelier à zéro' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Remise à zéro de l’atelier' })).getByRole(
        'button',
        { name: 'Remettre l’atelier à zéro' },
      ),
    );

    expect(screen.queryByRole('dialog', { name: 'Remise à zéro de l’atelier' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Propriétés de Poutre' })).toBeNull();
  });

  it('propose de recommencer le puzzle depuis le document initial', () => {
    render(<App />);
    openEmbeddedLevelOne();

    const resetButton = screen.getByRole('button', { name: 'Recommencer le niveau' });
    const testButton = screen.getByRole('button', { name: 'Lancer' });
    expect(
      resetButton.compareDocumentPosition(testButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(resetButton);

    const dialog = screen.getByRole('dialog', { name: 'Recommencer le niveau' });
    expect(dialog).toHaveTextContent('efface tous les objets ajoutés');
    const cancelButton = within(dialog).getByRole('button', { name: 'Annuler' });
    expect(document.activeElement).toBe(cancelButton);
    fireEvent.click(cancelButton);
    expect(screen.queryByRole('dialog', { name: 'Recommencer le niveau' })).toBeNull();

    placeCampaignBeam(5.0, 2.15);
    expect(screen.getByRole('region', { name: 'Propriétés de Poutre' })).toBeVisible();

    fireEvent.click(resetButton);
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Recommencer le niveau' })).getByRole('button', {
        name: 'Recommencer le niveau',
      }),
    );

    expect(screen.queryByRole('dialog', { name: 'Recommencer le niveau' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Propriétés de Poutre' })).toBeNull();
  });

  it('navigue vers une page de réglages dédiée depuis le menu (ADR 0008)', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Paramètres' }));

    expect(window.location.pathname).toBe('/settings');
    // U11: the placeholder panel « Paramètres » gave way to the two real settings.
    expect(screen.getByRole('region', { name: 'Pseudo' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Progression de la campagne' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Plateau de jeu' })).not.toBeInTheDocument();
  });

  it('adresse chaque écran par sa propre URL et ouvre directement dessus au chargement (ADR 0008)', () => {
    window.history.replaceState(null, '', '/editor');
    render(<App />);

    expect(screen.queryByText('Éditeur de niveaux')).not.toBeInTheDocument();
    expect(screen.getByText('Atelier')).toBeVisible();
  });

  it('redirige /demo, route supprimée, vers la liste des niveaux (V2a)', () => {
    window.history.replaceState(null, '', '/demo');
    render(<App />);

    expect(window.location.pathname).toBe('/levels');
    expect(screen.getByRole('region', { name: 'Campagne' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    expect(screen.queryByRole('button', { name: 'Démonstration' })).not.toBeInTheDocument();
  });

  it('redirige une route inconnue vers la liste des niveaux (ADR 0008)', () => {
    window.history.replaceState(null, '', '/une-route-qui-nexiste-pas');
    render(<App />);

    expect(window.location.pathname).toBe('/levels');
    expect(screen.getByRole('region', { name: 'Campagne' })).toBeVisible();
  });

  it('n’affiche ni palier de défi ni niveau suivant sur un niveau hors campagne (U4, U4b)', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const animationFrames = createAnimationFrameHarness();
    openSelfSolvingReceivedLevel();

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    advanceSimulationToResult(animationFrames, 600);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    // Un niveau reçu n'a que le palier « Résolu » (pas de défi), jamais de suite.
    const result = screen.getByRole('region', { name: 'Résultat du niveau' });
    expect(result).toHaveTextContent('Victoire');
    expect(result).toHaveAttribute('data-level-tier', 'resolved');
    expect(within(result).queryByRole('button', { name: 'Niveau suivant' })).toBeNull();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /Niveau suivant/u })).toBeNull();
  });

  it('C5 synchronise les actions du résultat reçu et la modale après 600 ms', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const animationFrames = createAnimationFrameHarness();
    openSelfSolvingReceivedLevel();

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    advanceSimulationToResult(animationFrames, 600);

    const result = screen.getByRole('region', { name: 'Résultat du niveau' });
    expect(within(result).getByText('Victoire')).toBeVisible();
    expect(
      within(result).queryByRole('button', { name: 'Voir le résultat' }),
    ).not.toBeInTheDocument();
    expect(within(result).queryByRole('button', { name: 'Recommencer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Bravo !' })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(
      within(result).queryByRole('button', { name: 'Voir le résultat' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Bravo !' })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(within(result).getByRole('button', { name: 'Voir le résultat' })).toBeVisible();
    expect(within(result).getByRole('button', { name: 'Recommencer' })).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Bravo !' })).toBeVisible();
  });

  it('C5 garde les actions disponibles après fermeture de la modale', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const animationFrames = createAnimationFrameHarness();
    openSelfSolvingReceivedLevel();

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    advanceSimulationToResult(animationFrames, 600);
    act(() => {
      vi.advanceTimersByTime(600);
    });

    const result = screen.getByRole('region', { name: 'Résultat du niveau' });
    const dialog = screen.getByRole('dialog', { name: 'Bravo !' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Voir la scène' }));

    expect(screen.queryByRole('dialog', { name: 'Bravo !' })).not.toBeInTheDocument();
    expect(within(result).getByRole('button', { name: 'Voir le résultat' })).toBeVisible();
    expect(within(result).getByRole('button', { name: 'Recommencer' })).toBeVisible();
  });

  it('C5 affiche ensemble les actions et la modale sans délai si les animations sont réduites', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    }));
    const animationFrames = createAnimationFrameHarness();
    openSelfSolvingReceivedLevel();

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    advanceSimulationToResult(animationFrames, 600);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    const result = screen.getByRole('region', { name: 'Résultat du niveau' });
    expect(within(result).getByRole('button', { name: 'Voir le résultat' })).toBeVisible();
    expect(within(result).getByRole('button', { name: 'Recommencer' })).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Bravo !' })).toBeVisible();
  });

  it('C5 annule l’ancien délai quand la victoire disparaît puis redémarre le délai', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { rerender } = render(<VictoryDialogTimerProbe hasVictory />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<VictoryDialogTimerProbe hasVictory={false} />);
    rerender(<VictoryDialogTimerProbe hasVictory />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole('dialog', { name: 'Bravo !' })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('dialog', { name: 'Bravo !' })).toBeVisible();
  });

  it('C5 annule l’apparition différée lorsqu’on navigue vers la campagne', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const animationFrames = createAnimationFrameHarness();
    openSelfSolvingReceivedLevel();

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    advanceSimulationToResult(animationFrames, 600);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Campagne' }));

    expect(screen.getByRole('region', { name: 'Campagne' })).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.queryByRole('dialog', { name: 'Bravo !' })).not.toBeInTheDocument();
  });

  it('bloque l’accès direct à un niveau verrouillé et propose la liste des niveaux (U5b)', () => {
    const { repository } = createProgressRepository();
    window.history.replaceState(null, '', '/levels/campaign-17-la-grande-machine/play');
    render(<App progressRepository={repository} />);

    expect(screen.getByText('Ce niveau est encore verrouillé.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Lancer' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Campagne' }));
    expect(window.location.pathname).toBe('/levels');
  });

  it('en mode développement, débloque tous les niveaux dans la liste et par URL (U5b)', () => {
    const { repository } = createProgressRepository();
    window.history.replaceState(null, '', '/levels/campaign-17-la-grande-machine/play');
    render(<App progressRepository={repository} unlockAllLevels />);

    expect(screen.getByText('Niveau 17 · La grande machine')).toBeVisible();
    expect(screen.getByText('Campagne')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Campagne' }));

    expect(screen.getByText('Mode développement : niveaux débloqués')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Jouer le niveau 17' })).toBeEnabled();
  });

  it('ne persiste pas les victoires hors campagne', () => {
    const animationFrames = createAnimationFrameHarness();
    const { repository, save } = createProgressRepository();
    openSelfSolvingReceivedLevel(repository);

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    advanceSimulationToResult(animationFrames, 600);

    expect(screen.getByRole('region', { name: 'Résultat du niveau' })).toHaveTextContent(
      'Victoire',
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('affiche le bandeau de victoire après le plateau dans le flux normal, jamais en overlay', () => {
    // B1 (plan-remise-en-jeu.md § 4) : le bandeau de victoire recouvrait le
    // bas du plateau (position absolue par-dessus le canvas), ce qui pouvait
    // cacher la balle et le panier. Il s'affiche désormais après le plateau
    // dans le DOM, dans le flux normal du document.
    const animationFrames = createAnimationFrameHarness();
    openSelfSolvingReceivedLevel();

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    advanceSimulationToResult(animationFrames, 600);

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const result = screen.getByRole('region', { name: 'Résultat du niveau' });

    expect(board.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(styles).not.toMatch(/\.level-result\s*\{[^}]*position:\s*absolute/s);
  });

  it('annonce l’échec sans recouvrir le plateau quand le temps de la tentative est écoulé', () => {
    // B2 (plan-remise-en-jeu.md § 4) : la balle de l'atelier se pose sur la
    // poutre du sol et n'atteindra jamais le panier. Sans issue d'échec, la
    // tentative ne se terminait pas.
    const animationFrames = createAnimationFrameHarness();
    render(<App />);

    openEmbeddedWorkshop();
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    advanceSimulationToTimeout(animationFrames);

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const result = screen.getByRole('region', { name: 'Résultat du niveau' });

    expect(within(result).getByText('Échec')).toBeVisible();
    expect(within(result).queryByText('Victoire')).not.toBeInTheDocument();
    expect(within(result).getByText(/temps écoulé/i)).toBeVisible();
    expect(within(result).getByRole('button', { name: 'Recommencer' })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(board.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('recommence depuis le bandeau d’échec et restitue le document d’avant lancement', () => {
    const animationFrames = createAnimationFrameHarness();
    render(<App />);

    openEmbeddedWorkshop();
    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    const ballPositionAtLaunch = canvas.getAttribute('data-simulation-ball-position');
    expect(ballPositionAtLaunch).not.toBeNull();

    advanceSimulationToTimeout(animationFrames);
    expect(canvas.getAttribute('data-simulation-ball-position')).not.toBe(ballPositionAtLaunch);

    const result = screen.getByRole('region', { name: 'Résultat du niveau' });
    fireEvent.click(within(result).getByRole('button', { name: 'Recommencer' }));

    expect(screen.queryByRole('region', { name: 'Résultat du niveau' })).not.toBeInTheDocument();
    expect(canvas).not.toHaveAttribute('data-simulation-step');
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeEnabled();

    // Relancer depuis le document restitué repart exactement du même état.
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    expect(canvas.getAttribute('data-simulation-ball-position')).toBe(ballPositionAtLaunch);
  });

  it('retourne à la liste depuis un résultat de simulation', () => {
    const animationFrames = createAnimationFrameHarness();
    render(<App />);

    openEmbeddedLevelOne();
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    advanceSimulationToTimeout(animationFrames);

    fireEvent.click(screen.getByRole('button', { name: 'Retour aux niveaux' }));

    const levelList = screen.getByRole('region', { name: 'Campagne' });
    expect(levelList).toBeVisible();
    for (const [number, title] of [
      [1, 'La bille de service'],
      [2, 'Par-dessus le mur'],
      [3, 'La balançoire'],
    ] as const) {
      const levelCard = within(levelList).getByRole('region', {
        name: `Niveau ${String(number)}`,
      });
      expect(within(levelCard).getByRole('heading', { name: title })).toBeVisible();
    }
  });

  it('permet de recommencer la simulation sans dialogue bloquant', () => {
    const animationFrames = createAnimationFrameHarness();
    render(<App />);

    placeCampaignBeam(5.0, 2.15);
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    expect(screen.getByText('Simulation en cours')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Recommencer' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Campagne')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeEnabled();
    expect(screen.queryByText('Simulation en cours')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Résultat du niveau' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    expect(screen.getByText('Simulation en cours')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Recommencer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    expect(screen.getByText('Simulation en cours')).toBeVisible();

    advanceSimulationToResult(animationFrames, 320);
    fireEvent.click(screen.getByRole('button', { name: 'Recommencer' }));
    expect(screen.getByText('Campagne')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Résultat du niveau' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeEnabled();
  });

  it('identifie l’atelier, une fois ouvert depuis le menu, comme éditeur de niveaux', () => {
    // Réécrit depuis « identifie explicitement le contexte de travail comme
    // éditeur de niveaux », qui vérifiait ces libellés dès le premier rendu :
    // B1 fait démarrer l'application sur le niveau 1, pas sur l'atelier.
    render(<App />);
    openEmbeddedWorkshop();

    expect(screen.queryByText('Éditeur de niveaux')).not.toBeInTheDocument();
    expect(screen.getByText('Atelier')).toBeVisible();
  });

  it('présente le catalogue comme un panneau latéral ouvert sur une tablette ou un poste de bureau en paysage', () => {
    // Réécrit depuis « … ouvert en paysage », qui stubbait 844 × 390 (un
    // téléphone en paysage) : D4 (plan-remise-en-jeu.md § 6, écart constaté)
    // a resserré `use-side-layout.ts` pour exiger aussi une hauteur réelle
    // (`innerHeight >= 480`), pas seulement la largeur et l'orientation — un
    // essai en navigateur réel à 844 × 390 a montré la mise en page à trois
    // colonnes (catalogue + plateau + panneau) trop à l'étroit : la barre
    // d'actions se repliait sur trois lignes et le plateau devenait minuscule.
    // Un téléphone en paysage garde donc le tiroir en bas ; ce test vérifie
    // désormais le format qui a réellement la place pour un panneau latéral.
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('innerWidth', 1180);
    vi.stubGlobal('innerHeight', 820);

    render(<App />);
    openEmbeddedWorkshop();

    expect(screen.getByRole('region', { name: 'Objets disponibles' })).not.toHaveClass(
      'object-drawer-collapsed',
    );
    expect(screen.getByRole('button', { name: 'Balle' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Fermer le catalogue' })).not.toBeInTheDocument();
  });

  it('garde le catalogue en tiroir repliable sur un téléphone en paysage, trop court pour un panneau latéral', () => {
    // Nouveau test compagnon du précédent (D4, plan-remise-en-jeu.md § 6) :
    // verrouille explicitement le cas qui a motivé le resserrement du seuil,
    // pour qu'il ne régresse pas silencieusement si le seuil bouge à nouveau.
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('innerWidth', 844);
    vi.stubGlobal('innerHeight', 390);

    render(<App />);
    openEmbeddedWorkshop();

    expect(screen.getByRole('region', { name: 'Objets disponibles' })).toHaveClass(
      'object-drawer-collapsed',
    );
    expect(screen.getByRole('button', { name: 'Ouvrir le catalogue' })).toBeVisible();
  });

  it('active le parcours de placement par toucher d’une carte, séparément du plateau', () => {
    render(<App />);
    openEmbeddedWorkshop();

    const drawer = screen.getByRole('region', { name: 'Objets disponibles' });
    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));

    const ballCard = within(drawer).getByRole('button', { name: 'Balle' });
    fireEvent.click(ballCard);

    expect(board).toBeVisible();
    expect(within(board).queryByText(/placement actif.*Balle/i)).not.toBeInTheDocument();
    const cancelButton = screen.getByRole('button', { name: 'Annuler le placement' });
    expect(cancelButton).toBeVisible();
    expect(board).not.toContainElement(cancelButton);
  });

  it('annule le placement en touchant à nouveau la carte active, ou avec Échap', () => {
    render(<App />);
    openEmbeddedWorkshop();

    const drawer = screen.getByRole('region', { name: 'Objets disponibles' });
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Balle' }));
    expect(screen.getByRole('button', { name: 'Annuler le placement' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Balle' }));
    expect(screen.queryByRole('button', { name: 'Annuler le placement' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Balle' }));
    expect(screen.getByRole('button', { name: 'Annuler le placement' })).toBeVisible();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Annuler le placement' })).toBeNull();
  });

  it('expose les états disponibles d’annuler et de rétablir après un placement', () => {
    render(<App />);
    openEmbeddedWorkshop();

    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    const redoButton = screen.getByRole('button', { name: 'Rétablir' });
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Balle' }));

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    firePointerEvent(board, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 320,
      clientY: 240,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 320,
      clientY: 240,
    });

    expect(undoButton).toBeEnabled();
    expect(redoButton).toBeDisabled();

    fireEvent.click(undoButton);
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeEnabled();

    fireEvent.click(redoButton);
    expect(undoButton).toBeEnabled();
    expect(redoButton).toBeDisabled();
  });

  it('suit le doigt pendant le placement sans créer d’historique avant le relâchement', () => {
    render(<App />);
    openEmbeddedWorkshop();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Balle' }));

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    firePointerEvent(board, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 120,
      clientY: 100,
    });
    firePointerEvent(board, 'pointermove', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: Number.NaN,
      clientY: Number.POSITIVE_INFINITY,
    });

    expect(undoButton).toBeDisabled();
    expect(screen.getByText(/position tactile est indisponible/i)).toBeVisible();

    firePointerEvent(board, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: Number.NaN,
      clientY: Number.POSITIVE_INFINITY,
    });

    expect(undoButton).toBeDisabled();
  });

  it('place dans l’atelier libre avec le contexte auteur en bordure de la scène', () => {
    // ADR 0007 supprime le document d'atelier en pixels : la scène de
    // l'atelier (16 × 9) déclare désormais une zone de construction qui la
    // couvre entièrement, et tout placement (auteur ou joueur) doit en plus
    // rester contenu dans le rectangle de scène (validation de schéma
    // inconditionnelle). Il n'existe donc plus de position à la fois valide
    // au sens du schéma et hors de la zone de construction : le comportement
    // observable qui reste à garantir est qu'un placement auteur près du
    // bord de la scène/zone de construction est accepté sans refus
    // parasite — la garantie « le contexte auteur ignore la zone de
    // construction » continue d'être couverte au niveau unitaire par
    // src/application/construction/construction-attempt.test.ts.
    render(<App />);
    openEmbeddedWorkshop();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Balle' }));

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    // Avec le canvas simulé 800 × 450 et la scène 16 × 9 de l'atelier, ce
    // point correspond à un point monde proche du coin (16, 9) de la scène,
    // donc de la zone de construction — mais toujours strictement à
    // l'intérieur des deux.
    firePointerEvent(board, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 700,
      clientY: 380,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 700,
      clientY: 380,
    });

    expect(screen.queryByText(/placement refusé/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Annuler le placement' })).not.toBeInTheDocument();
  });

  it('ferme réellement le tiroir après activation tout en gardant le placement annulable', () => {
    render(<App />);
    openEmbeddedWorkshop();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Balle' }));

    const drawer = screen.getByRole('region', { name: 'Objets disponibles' });
    expect(drawer).toBeVisible();
    expect(drawer).toHaveClass('object-drawer-collapsed');
    expect(screen.getByRole('button', { name: 'Ouvrir le catalogue' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('button', { name: 'Balle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fermer le catalogue' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler le placement' })).toBeVisible();
  });

  it('définit la conversion d’un point viewport en unités monde avec un plateau décalé et un zoom', () => {
    expect(screenPointToWorld({ x: 250, y: 170 }, { left: 100, top: 50 }, 2)).toEqual({
      x: 75,
      y: 60,
    });
  });

  it('annule une prévisualisation sur pointercancel sans projection ni entrée d’historique', () => {
    render(<App />);
    openEmbeddedWorkshop();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Balle' }));

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    firePointerEvent(board, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 120,
      clientY: 100,
    });
    firePointerEvent(board, 'pointercancel', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 120,
      clientY: 100,
    });

    expect(undoButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annuler le placement' })).toBeVisible();

    firePointerEvent(board, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 120,
      clientY: 100,
    });
    expect(undoButton).toBeDisabled();
  });

  it('annule le placement lorsqu’un second pointeur arrive sans créer de commande', () => {
    render(<App />);
    openEmbeddedWorkshop();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Balle' }));

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    firePointerEvent(board, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 120,
      clientY: 100,
    });
    firePointerEvent(board, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 180,
      clientY: 140,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 180,
      clientY: 140,
    });

    expect(undoButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annuler le placement' })).toBeVisible();
  });

  it('refuse des coordonnées absentes avant prévisualisation ou commit et conserve l’outil annulable', () => {
    render(<App />);
    openEmbeddedWorkshop();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Balle' }));

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    const pointerDown = new Event('pointerdown', { bubbles: true });
    fireEvent(board, pointerDown);

    const feedback = screen.getByText(/position tactile est indisponible/i);
    expect(feedback).toBeVisible();
    expect(feedback).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByRole('button', { name: 'Annuler le placement' })).toBeEnabled();
    expect(undoButton).toBeDisabled();

    fireEvent(board, new Event('pointerup', { bubbles: true }));
    expect(undoButton).toBeDisabled();
  });

  it('refuse les coordonnées non finies avant prévisualisation ou commit', () => {
    render(<App />);
    openEmbeddedWorkshop();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Balle' }));

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    const pointerDown = new Event('pointerdown', { bubbles: true });
    Object.defineProperties(pointerDown, {
      clientX: { configurable: true, value: Number.NaN },
      clientY: { configurable: true, value: Number.POSITIVE_INFINITY },
    });
    fireEvent(board, pointerDown);

    const feedback = screen.getByText(/position tactile est indisponible/i);
    expect(feedback).toBeVisible();
    expect(feedback).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByRole('button', { name: 'Annuler le placement' })).toBeEnabled();
    expect(undoButton).toBeDisabled();
  });

  it('réserve une cible tactile de 44 CSS px pour l’annulation du placement', () => {
    render(<App />);
    openEmbeddedWorkshop();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Balle' }));

    const cancelButton = screen.getByRole('button', { name: 'Annuler le placement' });
    expect(cancelButton).toHaveClass('placement-cancel');
    expect(styles).toMatch(/\.placement-cancel\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
  });

  it('pilote le cadrage avec les boutons tactiles, le borne aux nouvelles limites, et restaure la scène', () => {
    // Remplace l'ancien test du même nom, qui ne détectait plus rien : avec
    // l'amorce (fitCameraToScene bornée à un canvas de taille nulle sous
    // jsdom), « Ajuster à la scène » ne recalculait rien et l'assertion
    // finale passait par coïncidence sur la dernière valeur de zoom laissée
    // par les clics précédents. Ce test vérifie désormais que les boutons
    // changent réellement le zoom, que les bornes de l'ADR 0007 § Caméra
    // s'appliquent ([0,6×, 4×] le zoom ajusté), et que « Ajuster à la scène »
    // recalcule bien un cadrage identique au cadrage initial. Il s'exécute
    // dans l'atelier (scène 16 × 9) : les valeurs attendues en dépendent.
    render(<App />);
    openEmbeddedWorkshop();

    const canvas = within(screen.getByRole('region', { name: 'Plateau de jeu' })).getByRole('img', {
      name: 'Rendu du plateau',
    });
    const readZoom = (): number => {
      const value = canvas.getAttribute('data-camera-zoom');
      if (value === null) throw new Error('Le canvas doit exposer le zoom courant.');
      return Number(value);
    };

    // Avec le canvas simulé 800 × 450 (16 × 9, comme la scène de l'atelier)
    // et la marge de 4 % de l'ADR 0007, le cadrage initial vaut 48 px/unité ;
    // les bornes de zoom valent donc [0,6 × 48, 4 × 48] = [28,8, 192].
    const initialZoom = readZoom();
    expect(initialZoom).toBe(48);
    const expectedMinZoom = 28.8;
    const expectedMaxZoom = 192;

    fireEvent.click(screen.getByRole('button', { name: 'Zoom avant' }));
    expect(readZoom()).toBeGreaterThan(initialZoom);

    for (let clicks = 0; clicks < 20; clicks += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom avant' }));
    }
    expect(readZoom()).toBeCloseTo(expectedMaxZoom, 6);

    for (let clicks = 0; clicks < 30; clicks += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom arrière' }));
    }
    expect(readZoom()).toBeCloseTo(expectedMinZoom, 6);

    fireEvent.click(screen.getByRole('button', { name: 'Ajuster à la scène' }));
    expect(readZoom()).toBe(initialZoom);
  });

  it('zoome à la molette autour du pointeur, sans faire défiler la page', () => {
    render(<App />);
    openEmbeddedWorkshop();

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
    const readCamera = () => {
      const [x = Number.NaN, y = Number.NaN] = (canvas.getAttribute('data-camera-origin') ?? '')
        .split(',')
        .map(Number);
      return { x, y, zoom: Number(canvas.getAttribute('data-camera-zoom')) };
    };
    const worldUnder = (clientX: number, clientY: number) => {
      const camera = readCamera();
      return { x: camera.x + clientX / camera.zoom, y: camera.y + clientY / camera.zoom };
    };

    const before = readCamera();
    const anchorBefore = worldUnder(200, 150);
    const zoomIn = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
      clientX: 200,
      clientY: 150,
    });
    act(() => {
      board.dispatchEvent(zoomIn);
    });

    expect(zoomIn.defaultPrevented).toBe(true);
    expect(readCamera().zoom).toBeGreaterThan(before.zoom);
    expect(worldUnder(200, 150).x).toBeCloseTo(anchorBefore.x, 6);
    expect(worldUnder(200, 150).y).toBeCloseTo(anchorBefore.y, 6);

    act(() => {
      board.dispatchEvent(
        new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 300 }),
      );
    });
    expect(readCamera().zoom).toBeLessThan(before.zoom);
  });

  it('réajuste la caméra quand le canvas lui-même change de taille, pas seulement la fenêtre', () => {
    // Bug trouvé pendant le passage manuel de B1 : mettre le bandeau de
    // victoire dans le flux normal (plutôt qu'en overlay) réduit la hauteur
    // de `.scene-frame` quand il apparaît, mais aucun `resize` de `window`
    // ne se déclenche pour ce type de reflow — seul un sibling flex a
    // changé. Sans un observateur sur le canvas lui-même, la caméra reste
    // calée sur l'ancienne taille et les objets se dessinent hors du
    // nouveau tampon : le plateau paraît vide. `use-board-camera.ts`
    // observe désormais aussi le canvas.
    interface FakeResizeObserverInstance {
      readonly callback: ResizeObserverCallback;
    }
    const instances: FakeResizeObserverInstance[] = [];
    class FakeResizeObserver {
      readonly callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        instances.push(this);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    render(<App />);

    const canvas = within(screen.getByRole('region', { name: 'Plateau de jeu' })).getByRole('img', {
      name: 'Rendu du plateau',
    });
    const initialZoom = Number(canvas.getAttribute('data-camera-zoom'));
    expect(instances.length).toBeGreaterThan(0);

    // Simulate a much shorter canvas — the same reflow a flex sibling (the
    // victory banner, a selection's context panel) can cause without ever
    // firing a `window` resize event.
    const shrunkCanvasRect: DOMRect = {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: BOARD_CANVAS_WIDTH_IN_CSS_PIXELS,
      bottom: 150,
      width: BOARD_CANVAS_WIDTH_IN_CSS_PIXELS,
      height: 150,
      toJSON() {
        return this;
      },
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
      shrunkCanvasRect,
    );

    act(() => {
      for (const instance of instances) {
        instance.callback([], instance as unknown as ResizeObserver);
      }
    });

    const resizedZoom = Number(canvas.getAttribute('data-camera-zoom'));
    expect(resizedZoom).not.toBe(initialZoom);
  });

  it('réserve en permanence un unique emplacement partagé pour le résultat, dès le tout premier rendu, pour qu’aucune phase ne redimensionne le plateau', () => {
    // B5 (plan-remise-en-jeu.md § 4 bis): the ResizeObserver B1 added (see
    // the test above) refits the camera on *any* CSS size change of the
    // canvas — including the reflow the victory/failure banner used to cause
    // by mounting as a brand new flex sibling under `.scene-frame` right when
    // the outcome became known.
    //
    // A first version of this fix only reserved a slot outside
    // `'construction'` (i.e. from the moment "Lancer" is pressed). Playing it
    // manually showed that this still moved the resize — just to an earlier
    // moment, from "Lancer" onward — rather than removing it. A second
    // version reserved unconditionally, but gave `ContextPanel` its *own*
    // separate reservation alongside this one: since the two never have
    // content at the same time (this one only in `'result'`, `ContextPanel`
    // only in `'construction'`), that meant permanent, simultaneous, unfilled
    // space for both — 392px measured on a wide viewport, of which 200px
    // never fills at all on a level with nothing to select. `App.tsx` now
    // mounts both inside one shared `.status-slot`, unconditionally, so the
    // exact same DOM node exists for the whole lifetime of the app, and only
    // one reservation exists, sized to the larger of the two contents.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const animationFrames = createAnimationFrameHarness();
    openSelfSolvingReceivedLevel();

    const workspace = screen.getByRole('region', { name: 'Espace de construction' });
    const canvas = within(screen.getByRole('region', { name: 'Plateau de jeu' })).getByRole('img', {
      name: 'Rendu du plateau',
    });
    const zoomAtMount = canvas.getAttribute('data-camera-zoom');

    // Reserved from the very first render, before "Lancer" is even pressed —
    // and it is the *only* reserved slot: no leftover per-component wrapper.
    const slotAtMount = workspace.querySelector('.status-slot');
    expect(slotAtMount).not.toBeNull();
    expect(workspace.querySelectorAll('.status-slot')).toHaveLength(1);
    expect(styles).not.toMatch(/\.level-result-slot\s*\{/);
    expect(styles).not.toMatch(/\.context-panel-slot\s*\{/);
    expect(screen.queryByRole('region', { name: 'Résultat du niveau' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));

    // The moment a first, incomplete fix still got wrong: clicking "Lancer"
    // must not touch the slot or the camera either.
    expect(workspace.querySelector('.status-slot')).toBe(slotAtMount);
    expect(canvas.getAttribute('data-camera-zoom')).toBe(zoomAtMount);

    advanceSimulationToResult(animationFrames, 600);

    // The banner appears — the reflow-sensitive moment the original bug
    // report described — but the reserved slot is still the very same DOM
    // node: no flex sibling was ever added or removed under `.scene-frame`.
    expect(workspace.querySelector('.status-slot')).toBe(slotAtMount);
    const result = screen.getByRole('region', { name: 'Résultat du niveau' });
    expect(within(result).getByText('Victoire')).toBeVisible();
    expect(canvas.getAttribute('data-camera-zoom')).toBe(zoomAtMount);

    // The slot's CSS reserves height regardless of content — this is what
    // makes the DOM-identity guarantee above actually prevent a resize in a
    // real browser (verified manually; jsdom does no layout).
    expect(styles).toMatch(/\.status-slot\s*\{[^}]*min-height:\s*\d/s);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    const victoryDialog = screen.getByRole('dialog', { name: 'Bravo !' });
    fireEvent.click(within(victoryDialog).getByRole('button', { name: 'Voir la scène' }));

    // Disparition: replaying returns to construction. The slot stays
    // mounted (same node) with its content cleared, and the camera — fit to
    // the same scene and the same canvas size throughout — never changed.
    fireEvent.click(within(result).getByRole('button', { name: 'Recommencer' }));

    expect(workspace.querySelector('.status-slot')).toBe(slotAtMount);
    expect(screen.queryByRole('region', { name: 'Résultat du niveau' })).not.toBeInTheDocument();
    expect(canvas.getAttribute('data-camera-zoom')).toBe(zoomAtMount);
  });

  it('après un vrai redimensionnement du canvas signalé par le ResizeObserver, la caméra garde toute la scène visible (non-régression B1)', () => {
    // B5 must not weaken what B1 fixed: a genuine size change of the canvas
    // (the ResizeObserver's actual purpose) still has to produce a complete
    // `fitCameraToScene`, which is what guarantees the whole scene rectangle
    // stays contained in the canvas (tested on its own in
    // `board-camera.test.ts`). Cross-checking the DOM-observed zoom against a
    // direct call to that same pure function is a stronger assertion than
    // "the zoom changed": it pins down *which* framing was produced, not just
    // that some recomputation happened.
    interface FakeResizeObserverInstance {
      readonly callback: ResizeObserverCallback;
    }
    const instances: FakeResizeObserverInstance[] = [];
    class FakeResizeObserver {
      readonly callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        instances.push(this);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    render(<App />);

    const canvas = within(screen.getByRole('region', { name: 'Plateau de jeu' })).getByRole('img', {
      name: 'Rendu du plateau',
    });
    const initialZoom = Number(canvas.getAttribute('data-camera-zoom'));
    expect(instances.length).toBeGreaterThan(0);

    const shrunkCanvasSize = { width: BOARD_CANVAS_WIDTH_IN_CSS_PIXELS, height: 150 };
    const shrunkCanvasRect: DOMRect = {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: shrunkCanvasSize.width,
      bottom: shrunkCanvasSize.height,
      width: shrunkCanvasSize.width,
      height: shrunkCanvasSize.height,
      toJSON() {
        return this;
      },
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
      shrunkCanvasRect,
    );

    act(() => {
      for (const instance of instances) {
        instance.callback([], instance as unknown as ResizeObserver);
      }
    });

    const resizedZoom = Number(canvas.getAttribute('data-camera-zoom'));
    // The app starts on the embedded level 1 (B1); its declared scene is the
    // ground truth for what "fully visible" means.
    const expectedZoom = fitCameraToScene(levelOneScene, shrunkCanvasSize).pixelsPerWorldUnit;

    expect(resizedZoom).not.toBe(initialZoom);
    expect(resizedZoom).toBeCloseTo(expectedZoom, 6);
  });

  it('après un vrai redimensionnement de la fenêtre (rotation d’écran), la caméra garde toute la scène visible (non-régression B1)', () => {
    // Same guarantee as above, through the other trigger use-board-camera.ts
    // listens to: `window`'s own `resize` event (e.g. an orientation change),
    // which predates B1 and must keep working exactly as it did.
    render(<App />);

    const canvas = within(screen.getByRole('region', { name: 'Plateau de jeu' })).getByRole('img', {
      name: 'Rendu du plateau',
    });
    const initialZoom = Number(canvas.getAttribute('data-camera-zoom'));

    // A portrait/landscape flip of the stubbed 800 × 450 canvas.
    const rotatedCanvasSize = { width: 450, height: 800 };
    const rotatedCanvasRect: DOMRect = {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: rotatedCanvasSize.width,
      bottom: rotatedCanvasSize.height,
      width: rotatedCanvasSize.width,
      height: rotatedCanvasSize.height,
      toJSON() {
        return this;
      },
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
      rotatedCanvasRect,
    );

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    const resizedZoom = Number(canvas.getAttribute('data-camera-zoom'));
    const expectedZoom = fitCameraToScene(levelOneScene, rotatedCanvasSize).pixelsPerWorldUnit;

    expect(resizedZoom).not.toBe(initialZoom);
    expect(resizedZoom).toBeCloseTo(expectedZoom, 6);
  });

  it('affiche le panneau contextuel dans le même emplacement partagé que le résultat, sans en ajouter un second', () => {
    // Signalé par l'utilisateur en jouant, après B5 : le panneau contextuel
    // (« Objet sélectionné : … », affiché dès qu'un placement existe, car
    // c'est le seul objet qu'un placement peut sélectionner aujourd'hui — le
    // clic de sélection sur le plateau est C3, pas encore livré) avait reçu
    // sa propre réservation indépendante de celle du résultat — donc deux
    // blocs d'espace mort simultanés et permanents sous le plateau, alors
    // qu'aucun niveau ne peut jamais afficher les deux à la fois. Il partage
    // désormais `.status-slot` avec `LevelResult` (voir le test précédent) :
    // ce test vérifie que la sélection apparaît bien dans cet unique
    // emplacement partagé, sans en créer un second.
    render(<App />);
    openEmbeddedWorkshop();

    const workspace = screen.getByRole('region', { name: 'Espace de construction' });
    const canvas = within(screen.getByRole('region', { name: 'Plateau de jeu' })).getByRole('img', {
      name: 'Rendu du plateau',
    });
    const zoomAtMount = canvas.getAttribute('data-camera-zoom');

    // Réservé dès le premier rendu, avant tout placement — et c'est le seul.
    const slotAtMount = workspace.querySelector('.status-slot');
    expect(slotAtMount).not.toBeNull();
    expect(workspace.querySelectorAll('.status-slot')).toHaveLength(1);
    expect(screen.queryByText(/Objet sélectionné/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le catalogue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Poutre moyenne' }));

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    firePointerEvent(board, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 400,
      clientY: 225,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 400,
      clientY: 225,
    });

    // Le placement se sélectionne automatiquement : le panneau apparaît dans
    // le même nœud DOM réservé, toujours unique, sans jamais en créer un
    // second à côté.
    expect(workspace.querySelector('.status-slot')).toBe(slotAtMount);
    expect(workspace.querySelectorAll('.status-slot')).toHaveLength(1);
    const propertiesPanel = screen.getByRole('region', { name: 'Propriétés de Poutre' });
    expect(within(propertiesPanel).getByText('Propriétés')).toBeVisible();
    expect(within(propertiesPanel).getByText('Poutre')).toBeVisible();
    expect(canvas.getAttribute('data-camera-zoom')).toBe(zoomAtMount);

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    // Annuler retire le placement, donc sa sélection : le panneau disparaît,
    // le nœud réservé reste, le cadrage n'a pas bougé.
    expect(workspace.querySelector('.status-slot')).toBe(slotAtMount);
    expect(screen.queryByText(/Objet sélectionné/)).not.toBeInTheDocument();
    expect(canvas.getAttribute('data-camera-zoom')).toBe(zoomAtMount);
  });

  it('sélectionne un objet existant au toucher puis désélectionne au toucher du vide', () => {
    render(<App />);

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    // Use the canvas camera so this follows the embedded placement if the
    // scene geometry changes again.
    tapWorldPoint(6.8, 4.9);

    const lockedPanel = screen.getByRole('region', { name: 'Propriétés de Panier' });
    expect(lockedPanel).toBeVisible();
    expect(lockedPanel).toHaveTextContent(/verrouill|indisponible/i);
    expect(
      within(lockedPanel).queryByRole('button', {
        name: /Supprimer|Rotation|gauche|droite|haut|bas/i,
      }),
    ).not.toBeInTheDocument();

    firePointerEvent(board, 'pointerdown', {
      pointerId: 2,
      pointerType: 'mouse',
      clientX: 120,
      clientY: 400,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 2,
      pointerType: 'mouse',
      clientX: 120,
      clientY: 400,
    });

    expect(screen.queryByRole('region', { name: 'Propriétés de Panier' })).not.toBeInTheDocument();
  });

  it('place une masse depuis l’inventaire de l’atelier', () => {
    render(<App />);
    placeWorkshopObject('Masse');

    const panel = screen.getByRole('region', { name: 'Propriétés de Masse' });
    expect(within(panel).getByRole('button', { name: /Supprimer la masse/i })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Rotation positive' })).toHaveTextContent(
      '15°',
    );
  });

  it('pose un fil levier → convoyeur depuis la carte Fil, l’annule, le rétablit et le délie (U15)', () => {
    render(<App />);
    openEmbeddedWorkshop();
    // Atelier 16 × 9 ajusté au canvas 800 × 450 : 50 px par unité monde.
    const board = placeFromCatalogue('Convoyeur', 600, 225);
    placeFromCatalogue('Levier', 200, 225);
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
    const leverPanel = screen.getByRole('region', { name: 'Propriétés de Levier' });
    // Le fil ne se pose plus depuis le panneau : la carte Fil le remplace.
    expect(within(leverPanel).queryByRole('button', { name: /Relier/ })).toBeNull();
    expect(canvas).toHaveAttribute('data-wires', '');

    selectWireCard();
    expect(screen.getByText('Choisis une commande ou l’appareil à relier')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Annuler le fil' })).toBeVisible();
    // La carte ne pose rien et ferme le panneau : le plateau reste dégagé.
    expect(screen.queryByRole('region', { name: 'Propriétés de Levier' })).toBeNull();

    // Toucher le vide ne sort pas du geste : il reste libre pour déplacer la vue.
    tapBoard(board, 100, 50);
    expect(screen.getByText('Choisis une commande ou l’appareil à relier')).toBeVisible();

    // L’appareil d’abord, la commande ensuite : l’ordre est libre.
    tapBoard(board, 600, 225);
    expect(screen.getByText('Choisis le levier ou le bouton qui le commande')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Propriétés de Convoyeur' })).toBeInTheDocument();
    tapBoard(board, 200, 225);

    const [wired] = (canvas.getAttribute('data-wires') ?? '').split(' ');
    expect(wired).toMatch(/^placement-\d+>placement-\d+$/u);
    // Le fil posé termine le geste, sans bouton à presser.
    expect(screen.getByText('Fil posé.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Annuler le fil' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(canvas).toHaveAttribute('data-wires', '');
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir' }));
    expect(canvas).toHaveAttribute('data-wires', wired);

    tapBoard(board, 200, 225);
    const wiredPanel = screen.getByRole('region', { name: 'Propriétés de Levier' });
    expect(within(wiredPanel).getByText(/^Fil du circuit A/)).toBeVisible();
    const wireRole = within(wiredPanel).getByRole('group', { name: /Pour le joueur · fil/ });
    expect(within(wireRole).getByRole('button', { name: 'À placer' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(within(wireRole).getByRole('button', { name: 'À placer' }));
    expect(within(wireRole).getByRole('button', { name: 'À placer' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(within(wiredPanel).getByRole('button', { name: 'Délier le circuit A' }));
    expect(canvas).toHaveAttribute('data-wires', '');
  });

  it('enchaîne les fils d’un bouton, jamais vers un convoyeur, et un seul contrôleur par appareil (U15)', () => {
    render(<App />);
    openEmbeddedWorkshop();
    const board = placeFromCatalogue('Ventilateur', 600, 225);
    placeFromCatalogue('Convoyeur', 400, 100);
    placeFromCatalogue('Barrière', 600, 350);
    placeFromCatalogue('Bouton', 200, 225);
    placeFromCatalogue('Levier', 200, 350);
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
    const wires = (): string[] =>
      (canvas.getAttribute('data-wires') ?? '').split(' ').filter((wire) => wire !== '');

    selectWireCard();
    tapBoard(board, 200, 225);
    tapBoard(board, 400, 100);
    expect(
      screen.getByText('Un bouton ne commande pas de convoyeur : seul un levier en donne le sens.'),
    ).toBeVisible();
    expect(screen.getByText('Choisis l’appareil à commander')).toBeVisible();
    expect(wires()).toHaveLength(0);

    // Un fil par geste : le bouton commande le ventilateur, puis la barrière.
    tapBoard(board, 600, 225);
    selectWireCard();
    tapBoard(board, 600, 350);
    tapBoard(board, 200, 225);
    expect(wires()).toHaveLength(2);
    const [first, second] = wires();
    expect(first?.split('>')[0]).toBe(second?.split('>')[0]);

    selectWireCard();
    tapBoard(board, 200, 350);
    tapBoard(board, 600, 225);
    expect(
      screen.getByText(
        'Cet appareil a déjà un contrôleur : il n’obéit qu’à un seul levier ou bouton.',
      ),
    ).toBeVisible();
    expect(wires()).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Annuler le fil' }));
    expect(screen.queryByRole('group', { name: 'Pose d’un fil' })).toBeNull();
    expect(wires()).toHaveLength(2);
    tapBoard(board, 600, 225);
    const fanPanel = screen.getByRole('region', { name: 'Propriétés de Ventilateur' });
    expect(within(fanPanel).getByText(/^Fil du circuit A/)).toBeVisible();
    // Relié, il garde son état de départ : la commande le fait basculer.
    fireEvent.change(within(fanPanel).getByRole('combobox', { name: 'État de départ' }), {
      target: { value: 'off' },
    });
    expect(within(fanPanel).getByRole('combobox', { name: 'État de départ' })).toHaveValue('off');
  });

  it('tourne chaque objet par pas de 15°, retourne ventilateur et barrière, et règle leur état de départ', () => {
    render(<App />);
    placeWorkshopObject('Ventilateur');
    const fanPanel = screen.getByRole('region', { name: 'Propriétés de Ventilateur' });
    expect(within(fanPanel).queryByRole('combobox', { name: 'Sens du souffle' })).toBeNull();
    expect(within(fanPanel).getByRole('button', { name: 'Rotation positive' })).toHaveTextContent(
      '15°',
    );
    fireEvent.click(within(fanPanel).getByRole('button', { name: 'Retourner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('button', { name: 'Rétablir' })).toBeEnabled();
    expect(screen.getByRole('region', { name: 'Propriétés de Ventilateur' })).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'État de départ' }), {
      target: { value: 'off' },
    });
    expect(screen.getByRole('combobox', { name: 'État de départ' })).toHaveValue('off');

    placeFromCatalogue('Barrière', 200, 225);
    const barrierPanel = screen.getByRole('region', { name: 'Propriétés de Barrière' });
    expect(within(barrierPanel).queryByRole('combobox', { name: 'Côté de la barre' })).toBeNull();
    expect(
      within(barrierPanel).getByRole('button', { name: 'Rotation négative' }),
    ).toHaveTextContent('15°');
    expect(within(barrierPanel).getByRole('button', { name: 'Retourner' })).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'État de départ' }), {
      target: { value: 'open' },
    });
    expect(screen.getByRole('combobox', { name: 'État de départ' })).toHaveValue('open');

    for (const [card, name, x, y] of [
      ['Tremplin', 'Tremplin', 600, 100],
      ['Bouton', 'Bouton', 600, 350],
      ['Convoyeur', 'Convoyeur', 150, 380],
    ] as const) {
      placeFromCatalogue(card, x, y);
      const panel = screen.getByRole('region', { name: `Propriétés de ${name}` });
      expect(within(panel).getByRole('button', { name: 'Rotation positive' })).toHaveTextContent(
        '15°',
      );
      expect(within(panel).queryByRole('button', { name: 'Retourner' })).toBeNull();
    }
  });

  it('ne propose de tourner ni la balle ni le panier', () => {
    render(<App />);
    placeWorkshopObject('Balle');
    const panel = screen.getByRole('region', { name: 'Propriétés de Balle' });
    expect(within(panel).queryByRole('button', { name: /Rotation/ })).toBeNull();
  });

  it('règle la position de départ d’un levier et le sens d’un convoyeur', () => {
    render(<App />);
    placeWorkshopObject('Levier');
    fireEvent.change(screen.getByRole('combobox', { name: 'Position de départ' }), {
      target: { value: 'left' },
    });
    expect(screen.getByRole('combobox', { name: 'Position de départ' })).toHaveValue('left');

    placeFromCatalogue('Convoyeur', 600, 225);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sens du tapis' }), {
      target: { value: 'right' },
    });
    expect(screen.getByRole('combobox', { name: 'Sens du tapis' })).toHaveValue('right');
  });

  it('affiche les propriétés accessibles d’une poutre sans action Déplacer', () => {
    render(<App />);
    placeWorkshopBeam();

    const panel = screen.getByRole('region', { name: 'Propriétés de Poutre' });
    expect(panel).toBeVisible();
    expect(within(panel).queryByRole('button', { name: /Déplacer/i })).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /Supprimer la poutre/i })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Rotation négative' })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Rotation positive' })).toBeVisible();
    for (const direction of ['gauche', 'droite', 'haut', 'bas']) {
      expect(within(panel).getByRole('button', { name: new RegExp(direction, 'i') })).toBeVisible();
    }
  });

  it('déplace directement une poutre en une seule entrée d’historique sans déplacer la caméra', () => {
    render(<App />);
    const board = placeWorkshopBeam();
    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
    const zoomBeforeDrag = canvas.getAttribute('data-camera-zoom');

    firePointerEvent(board, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 400,
      clientY: 225,
    });
    firePointerEvent(board, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 500,
      clientY: 265,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 500,
      clientY: 265,
    });

    expect(undoButton).toBeEnabled();
    expect(canvas.getAttribute('data-camera-zoom')).toBe(zoomBeforeDrag);

    // One direct drag is one command: the first undo restores the original
    // placement, while the second undo removes the placement itself.
    fireEvent.click(undoButton);
    expect(screen.getByRole('region', { name: 'Propriétés de Poutre' })).toBeVisible();
    fireEvent.click(undoButton);
    expect(screen.queryByRole('region', { name: 'Propriétés de Poutre' })).not.toBeInTheDocument();

    // A camera pan would move this fixed workshop object away from its known
    // screen position. It must remain selectable after the object drag.
    firePointerEvent(board, 'pointerdown', {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 400,
      clientY: 48,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 400,
      clientY: 48,
    });
    expect(screen.getByRole('region', { name: 'Propriétés de Balle' })).toBeVisible();
  });

  it('annule un déplacement direct sur pointercancel sans entrée d’historique', () => {
    render(<App />);
    const board = placeWorkshopBeam();
    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    expect(screen.getByRole('region', { name: 'Propriétés de Poutre' })).toBeVisible();

    firePointerEvent(board, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 400,
      clientY: 225,
    });
    firePointerEvent(board, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 500,
      clientY: 265,
    });
    firePointerEvent(board, 'pointercancel', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 500,
      clientY: 265,
    });

    expect(undoButton).toBeEnabled();
    fireEvent.click(undoButton);
    expect(screen.queryByRole('region', { name: 'Propriétés de Poutre' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Placement refusé/i })).not.toBeInTheDocument();
  });

  it('expose la taille d’une poutre et annule le changement Longue en une commande', () => {
    render(<App />);
    placeWorkshopBeam();

    const panel = screen.getByRole('region', { name: 'Propriétés de Poutre' });
    const sizeControl = within(panel).getByRole('combobox', { name: /longueur|taille/i });
    const undoButton = screen.getByRole('button', { name: 'Annuler' });

    expect(within(sizeControl).getByRole('option', { name: 'Courte' })).toBeInTheDocument();
    expect(within(sizeControl).getByRole('option', { name: 'Moyenne' })).toBeInTheDocument();
    expect(within(sizeControl).getByRole('option', { name: 'Longue' })).toBeInTheDocument();
    expect(sizeControl).toHaveValue('medium');

    fireEvent.change(sizeControl, { target: { value: 'long' } });
    expect(sizeControl).toHaveValue('long');

    // The size edit is atomic: undo restores the initially placed medium beam,
    // and a second undo is still required to remove the placement itself.
    fireEvent.click(undoButton);
    expect(within(panel).getByRole('combobox', { name: /longueur|taille/i })).toHaveValue('medium');
    fireEvent.click(undoButton);
    expect(screen.queryByRole('region', { name: 'Propriétés de Poutre' })).not.toBeInTheDocument();
  });

  it('en mode auteur permet de sélectionner et déplacer le sol verrouillé du futur joueur', () => {
    render(<App />);
    openEmbeddedWorkshop();

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    // workshop-floor is at (8, 8). The workshop scene is fitted at 48 px/unit
    // in this 800 × 450 fixture, hence the centre is (384, 384) CSS px.
    firePointerEvent(board, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 384,
      clientY: 384,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 384,
      clientY: 384,
    });

    const panel = screen.getByRole('region', { name: 'Propriétés de Poutre' });
    expect(panel).not.toHaveTextContent(/verrouill/i);
    expect(within(panel).getByRole('button', { name: 'Rotation négative' })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Rotation positive' })).toBeVisible();
    expect(within(panel).getByRole('button', { name: /Supprimer la poutre/i })).toBeVisible();

    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    firePointerEvent(board, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 384,
      clientY: 384,
    });
    firePointerEvent(board, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 430,
      clientY: 350,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 430,
      clientY: 350,
    });
    expect(undoButton).toBeEnabled();
  });

  it('en mode auteur rend interactive la poignée de rotation du sol malgré rotate=false', () => {
    render(<App />);
    openEmbeddedWorkshop();

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    firePointerEvent(board, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 384,
      clientY: 384,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 384,
      clientY: 384,
    });

    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    // The knob sits a stem above the floor's top edge (y = 8 − 0.125 in the world).
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
    const originY = Number((canvas.getAttribute('data-camera-origin') ?? '').split(',')[1]);
    const zoom = Number(canvas.getAttribute('data-camera-zoom'));
    const handleY =
      (8 - 0.125 - originY) * zoom -
      ROTATION_HANDLE_GAP_CSS_PIXELS -
      ROTATION_HANDLE_KNOB_RADIUS_CSS_PIXELS;
    firePointerEvent(board, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 384,
      clientY: handleY,
    });
    firePointerEvent(board, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 400,
      clientY: handleY,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 400,
      clientY: handleY,
    });

    expect(undoButton).toBeEnabled();
    fireEvent.click(undoButton);
    expect(screen.getByRole('region', { name: 'Propriétés de Poutre' })).toBeVisible();
  });

  it('ne réagit qu’à la poignée de l’objet sélectionné : une masse posée dessus reste saisissable', () => {
    render(<App />);
    // Atelier 16 × 9 ajusté au canvas 800 × 450 : 50 px par unité monde.
    const board = placeWorkshopBeam();
    // La masse se pose là où serait la poignée de la poutre, juste au-dessus d’elle.
    placeFromCatalogue('Masse', 400, 190);
    // Rien n’est plus sélectionné.
    tapBoard(board, 700, 60);
    expect(screen.queryByRole('region', { name: /Propriétés de/ })).toBeNull();

    tapBoard(board, 400, 190);

    expect(screen.getByRole('region', { name: 'Propriétés de Masse' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Propriétés de Poutre' })).toBeNull();
  });

  it('annule atomiquement un drag lorsqu’un second pointeur arrive sur l’objet', () => {
    render(<App />);
    const board = placeWorkshopBeam();
    const undoButton = screen.getByRole('button', { name: 'Annuler' });

    firePointerEvent(board, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 400,
      clientY: 225,
    });
    firePointerEvent(board, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 500,
      clientY: 265,
    });
    // The first pointer's temporary projection is now at (500, 265); a
    // second touch there must cancel the move before camera pinch handling.
    firePointerEvent(board, 'pointerdown', {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 500,
      clientY: 265,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 500,
      clientY: 265,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 500,
      clientY: 265,
    });

    // Only the original placement remains in history: undo removes it rather
    // than first undoing a committed move.
    fireEvent.click(undoButton);
    expect(screen.queryByRole('region', { name: 'Propriétés de Poutre' })).not.toBeInTheDocument();
  });

  it('tourne un levier sur un tour complet aux boutons, sans butée', () => {
    render(<App />);
    placeWorkshopObject('Levier');
    const panel = screen.getByRole('region', { name: 'Propriétés de Levier' });

    for (let step = 0; step < 24; step += 1) {
      fireEvent.click(within(panel).getByRole('button', { name: 'Rotation positive' }));
    }
    expect(within(panel).getByRole('button', { name: 'Rotation positive' })).toBeEnabled();
    expect(within(panel).getByRole('button', { name: 'Rotation négative' })).toBeEnabled();
    expect(panel).not.toHaveTextContent('Rotation limitée');
  });

  it('tourne un levier par sa poignée en une seule entrée d’historique', () => {
    render(<App />);
    const board = placeWorkshopObject('Levier');
    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    const leverPanel = screen.getByRole('region', { name: 'Propriétés de Levier' });
    expect(leverPanel).toBeVisible();
    expect(within(leverPanel).getByRole('button', { name: 'Rotation positive' })).toHaveTextContent(
      '15°',
    );

    // Start outside the lever sprite but inside the rendered rotation handle,
    // so this gesture cannot be mistaken for a direct object move.
    firePointerEvent(board, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 380,
      clientY: 193,
    });
    firePointerEvent(board, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 400,
      clientY: 193,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 400,
      clientY: 193,
    });

    fireEvent.click(undoButton);
    expect(screen.getByRole('region', { name: 'Propriétés de Levier' })).toBeVisible();
    fireEvent.click(undoButton);
    expect(screen.queryByRole('region', { name: 'Propriétés de Levier' })).not.toBeInTheDocument();
    expect(undoButton).toBeDisabled();
  });

  it('relie un levier à un convoyeur avec le fil de l’inventaire, puis le délie ; un fil du niveau reste (U21)', async () => {
    const locked = { move: false, rotate: false, remove: false } as const;
    const placed = (id: string, type: string, x: number, y: number, props: object = {}) => ({
      id,
      type,
      props,
      transform: { position: { x, y }, rotation: 0 },
      permissions: locked,
    });
    const wiredLevel = levelDocumentSchema.parse({
      schemaVersion: 2,
      id: 'u21-fil-joueur',
      metadata: { title: 'Fil du joueur' },
      objects: [
        placed('ball-1', 'ball', 0.5, 0.5),
        placed('basket-1', 'basket', 7.2, 4.8),
        placed('lever-1', 'lever', 2, 3, { position: 'center' }),
        placed('conveyor-1', 'conveyor', 5.5, 3, { direction: 'stopped' }),
        placed('button-1', 'button', 2, 1.2),
        placed('fan-1', 'fan', 5.5, 1.2, { state: 'off' }),
      ],
      inventory: [
        {
          id: 'inventory-wire',
          type: 'wire',
          props: {},
          quantity: 1,
          permissions: { move: false, rotate: false, remove: true },
        },
      ],
      goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
      buildZones: [],
      scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
      wires: [{ id: 'level-wire', sourceId: 'button-1', targetId: 'fan-1' }],
    });
    window.history.replaceState(null, '', `/shared${await encodeShareFragment(wiredLevel)}`);
    render(<App />);
    expect(await screen.findByText('Partage · Fil du joueur')).toBeVisible();
    const canvas = within(screen.getByRole('region', { name: 'Plateau de jeu' })).getByRole('img', {
      name: 'Rendu du plateau',
    });
    const openCatalogue = (): void => {
      const toggle = screen.queryByRole('button', { name: 'Ouvrir le catalogue' });
      if (toggle !== null) fireEvent.click(toggle);
    };
    expect(canvas).toHaveAttribute('data-wires', 'button-1>fan-1');

    openCatalogue();
    fireEvent.click(screen.getByRole('button', { name: 'Fil de commande, quantité : 1' }));
    expect(screen.getByText('Choisis une commande ou l’appareil à relier')).toBeVisible();
    tapWorldPoint(2, 3);
    expect(screen.getByText('Choisis l’appareil à commander')).toBeVisible();
    // Mêmes règles que l’auteur : l’appareil du niveau a déjà son contrôleur.
    tapWorldPoint(5.5, 1.2);
    expect(
      screen.getByText(
        'Cet appareil a déjà un contrôleur : il n’obéit qu’à un seul levier ou bouton.',
      ),
    ).toBeVisible();
    tapWorldPoint(5.5, 3);

    expect(canvas).toHaveAttribute('data-wires', 'button-1>fan-1 lever-1>conveyor-1');
    // Le fil posé termine le geste ; plus de fil, la carte est désactivée.
    expect(screen.queryByRole('group', { name: 'Pose d’un fil' })).toBeNull();
    openCatalogue();
    expect(screen.getByRole('button', { name: 'Fil de commande, quantité : 0' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le catalogue' }));

    // Le fil du niveau ne se délie pas.
    tapWorldPoint(2, 1.2);
    const buttonPanel = screen.getByRole('region', { name: 'Propriétés de Bouton' });
    expect(within(buttonPanel).getByText(/^Fil du circuit A/)).toBeVisible();
    expect(within(buttonPanel).queryByRole('button', { name: /Délier/ })).toBeNull();

    // Le joueur délie le sien et le retrouve dans l’inventaire.
    tapWorldPoint(2, 3);
    const leverPanel = screen.getByRole('region', { name: 'Propriétés de Levier' });
    fireEvent.click(within(leverPanel).getByRole('button', { name: 'Délier le circuit B' }));
    expect(canvas).toHaveAttribute('data-wires', 'button-1>fan-1');
    openCatalogue();
    expect(screen.getByRole('button', { name: 'Fil de commande, quantité : 1' })).toBeEnabled();
  });

  it('ne réutilise pas pour la masse l’identifiant que la solution donne au ventilateur (tuto-3)', async () => {
    const level = levelDocumentSchema.parse(tuto3);
    window.history.replaceState(null, '', `/shared${await encodeShareFragment(level)}`);
    render(<App />);
    expect(await screen.findByText('Partage · Un peu de vent')).toBeVisible();
    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
    const openCatalogue = (): void => {
      const toggle = screen.queryByRole('button', { name: 'Ouvrir le catalogue' });
      if (toggle !== null) fireEvent.click(toggle);
    };
    const hoverWorldPoint = (x: number, y: number): void => {
      const rawOrigin = canvas.getAttribute('data-camera-origin') ?? '0,0';
      const [originX = 0, originY = 0] = rawOrigin.split(',').map(Number);
      const zoom = Number(canvas.getAttribute('data-camera-zoom'));
      const bounds = canvas.getBoundingClientRect();
      firePointerEvent(board, 'pointermove', {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: bounds.left + (x - originX) * zoom,
        clientY: bounds.top + (y - originY) * zoom,
      });
    };

    openCatalogue();
    fireEvent.click(screen.getByRole('button', { name: 'Ventilateur, quantité : 1' }));
    tapWorldPoint(8, 2);

    openCatalogue();
    fireEvent.click(screen.getByRole('button', { name: 'Fil de commande, quantité : 1' }));
    tapWorldPoint(1.2, 1.9);
    tapWorldPoint(8, 2);
    expect(canvas).toHaveAttribute('data-wires', 'placement-2>placement-1');

    openCatalogue();
    fireEvent.click(screen.getByRole('button', { name: 'Masse, quantité : 1' }));
    hoverWorldPoint(4, 2);
    expect(canvas).toHaveAttribute('data-placement-ghost', 'valid');

    tapWorldPoint(4, 2);
    expect(screen.queryByText('Cette action est indisponible.')).toBeNull();
    openCatalogue();
    expect(screen.getByRole('button', { name: 'Masse, quantité : 0' })).toBeDisabled();
  });

  it('enregistre comme niveau reçu le niveau d’un lien valide, hors progression, avant de le jouer (M8)', async () => {
    const sharedLevel = embeddedLevels.find(
      (level) => level.id === 'campaign-01-la-bille-de-service',
    );
    if (sharedLevel === undefined) throw new Error('Le niveau partagé embarqué est indisponible.');
    const fragment = await encodeShareFragment(sharedLevel);
    window.history.replaceState(null, '', '/shared' + fragment);
    const { repository, save } = createProgressRepository();

    render(<App progressRepository={repository} />);

    expect(await screen.findByText('Partage · La bille de service')).toBeVisible();
    expect(screen.getByText('Mes niveaux')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    const received = createLocalStorageReceivedLevelRepository(window.localStorage);
    const id = `recu-${await levelFingerprint(sharedLevel)}`;
    expect(received.list()).toEqual({ status: 'ok', ids: [id] });
    const stored = received.load(id);
    expect(stored.status === 'ok' && stored.level).toMatchObject({
      id,
      document: sharedLevel,
      origin: 'link',
      solved: false,
    });
    expect(screen.queryByText(sharedLevelNotKeptMessage)).toBeNull();
  });

  it('joue le niveau d’un lien et dit discrètement qu’il n’a pas été gardé quand le stockage échoue (M8)', async () => {
    window.history.replaceState(null, '', '/shared' + (await encodeShareFragment(sharedM8Level)));
    const { repository, saves } = createReceivedLevelRepository({
      status: 'error',
      code: 'quota-exceeded',
    });

    render(<App receivedLevelRepository={repository} />);

    expect(await screen.findByText('Partage · Niveau reçu M8')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    expect(screen.getByText(sharedLevelNotKeptMessage)).toHaveAttribute('role', 'status');
    expect(saves).toHaveLength(1);
  });

  it('joue le niveau d’un lien sans le garder quand l’empreinte ne peut pas être calculée (M8)', async () => {
    window.history.replaceState(null, '', '/shared' + (await encodeShareFragment(sharedM8Level)));
    // Hors contexte sécurisé (HTTP sur une IP locale), `crypto.subtle` n’existe pas.
    const secureCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => {
        secureCrypto.getRandomValues(array);
        return array;
      },
    });
    const { repository, saves } = createReceivedLevelRepository();

    render(<App receivedLevelRepository={repository} />);

    expect(await screen.findByText('Partage · Niveau reçu M8')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    expect(screen.getByText(sharedLevelNotKeptMessage)).toHaveAttribute('role', 'status');
    expect(saves).toHaveLength(0);
  });

  it('refuse un lien qui porte un atelier, sans le jouer ni l’enregistrer (M8)', async () => {
    const workshop = levelDocumentSchema.parse({
      ...sharedM8Level,
      objects: [
        ...sharedM8Level.objects,
        {
          id: 'beam-a-placer',
          type: 'beam',
          props: { size: 'short' },
          transform: { position: { x: 4, y: 3 }, rotation: 0 },
          permissions: { move: false, rotate: false, remove: false },
          toPlace: true,
        },
      ],
    });
    window.history.replaceState(null, '', '/shared' + (await encodeShareFragment(workshop)));
    const { repository, saves } = createReceivedLevelRepository();

    render(<App receivedLevelRepository={repository} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce lien est un atelier, pas un niveau à jouer.',
    );
    expect(screen.queryByRole('region', { name: 'Plateau de jeu' })).not.toBeInTheDocument();
    expect(saves).toHaveLength(0);
  });

  it('affiche une erreur de partage invalide sans modifier la progression', async () => {
    window.history.replaceState(null, '', '/shared#level=bad');
    const { repository, save } = createProgressRepository();

    const received = createReceivedLevelRepository();

    render(<App progressRepository={repository} receivedLevelRepository={received.repository} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ce lien de partage est invalide ou ne peut plus être ouvert.',
    );
    expect(received.saves).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Campagne' })).toHaveAttribute('href', '/levels');
    expect(screen.queryByRole('region', { name: 'Plateau de jeu' })).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });

  it('déplace une poutre par sa poignée de rotation en une commande et annule la projection', () => {
    render(<App />);
    const board = placeWorkshopBeam();
    const undoButton = screen.getByRole('button', { name: 'Annuler' });

    // The handle is 32 CSS px above the beam centre (400, 225), as defined by
    // the renderer's fixed-distance handle contract.
    firePointerEvent(board, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 400,
      clientY: 193,
    });
    firePointerEvent(board, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 420,
      clientY: 193,
    });
    firePointerEvent(board, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 420,
      clientY: 193,
    });

    // One rotation command: undo leaves the placed beam selected, and the
    // following undo removes the placement itself.
    fireEvent.click(undoButton);
    expect(screen.getByRole('region', { name: 'Propriétés de Poutre' })).toBeVisible();

    firePointerEvent(board, 'pointerdown', {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 400,
      clientY: 193,
    });
    firePointerEvent(board, 'pointermove', {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 420,
      clientY: 193,
    });
    firePointerEvent(board, 'pointercancel', {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 420,
      clientY: 193,
    });

    fireEvent.click(undoButton);
    expect(screen.queryByRole('region', { name: 'Propriétés de Poutre' })).not.toBeInTheDocument();
  });

  it('montre la zone, fait suivre le doigt hors zone en fantôme invalide et refuse le geste une seule fois (U13)', async () => {
    const zoneLevel = levelDocumentSchema.parse({
      ...sharedM8Level,
      id: 'u13-zones',
      metadata: { title: 'Zones U13' },
      objects: [
        ...sharedM8Level.objects,
        {
          id: 'movable-beam',
          type: 'beam',
          props: { size: 'short' },
          transform: { position: { x: 2, y: 3 }, rotation: 0 },
          permissions: { move: true, rotate: true, remove: false },
        },
      ],
      // An inventory gives the player the undo and redo buttons.
      inventory: [
        {
          id: 'inventory-mass',
          type: 'mass',
          props: { weight: '10kg' },
          quantity: 1,
          permissions: { move: true, rotate: false, remove: true },
        },
      ],
      buildZones: [{ min: { x: 0, y: 1.5 }, max: { x: 5, y: 5.5 } }],
    });
    window.history.replaceState(null, '', '/shared' + (await encodeShareFragment(zoneLevel)));
    const { repository } = createReceivedLevelRepository();
    render(<App receivedLevelRepository={repository} />);
    expect(await screen.findByText('Partage · Zones U13')).toBeVisible();

    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    const canvas = within(board).getByRole('img', { name: 'Rendu du plateau' });
    expect(canvas).toHaveAttribute('data-build-zones', '1');
    // The camera frames the scene once the board has measured its canvas.
    const fittedZoom = fitCameraToScene(zoneLevel.scene, {
      width: BOARD_CANVAS_WIDTH_IN_CSS_PIXELS,
      height: BOARD_CANVAS_HEIGHT_IN_CSS_PIXELS,
    }).pixelsPerWorldUnit;
    await waitFor(() => {
      expect(Number(canvas.getAttribute('data-camera-zoom'))).toBe(fittedZoom);
    });
    const undoButton = screen.getByRole('button', { name: 'Annuler' });
    const client = (x: number, y: number) => {
      const [originX, originY] = (canvas.getAttribute('data-camera-origin') ?? '')
        .split(',')
        .map(Number);
      const zoom = Number(canvas.getAttribute('data-camera-zoom'));
      if (originX === undefined || originY === undefined || !(zoom > 0)) {
        throw new Error('Cadrage caméra invalide dans le test.');
      }
      return { clientX: (x - originX) * zoom, clientY: (y - originY) * zoom };
    };
    const touch = (type: PointerEventType, x: number, y: number): void => {
      firePointerEvent(board, type, { pointerId: 7, pointerType: 'touch', ...client(x, y) });
    };
    const refusals = () => screen.queryAllByText(/Action refusée/);
    const ghostPosition = () =>
      (canvas.getAttribute('data-placement-ghost-position') ?? '')
        .split(',')
        .map((value) => Math.round(Number(value) * 1000) / 1000);

    // Out of the zone, the beam keeps following the finger, as an invalid ghost.
    touch('pointerdown', 2, 3);
    touch('pointermove', 4, 3);
    touch('pointermove', 6.5, 3);
    expect(canvas).toHaveAttribute('data-placement-ghost', 'invalid');
    expect(ghostPosition()).toEqual([6.5, 3]);
    touch('pointermove', 7, 2.5);
    expect(ghostPosition()).toEqual([7, 2.5]);
    expect(refusals()).toHaveLength(0);

    // Lifted there: one refusal for the whole gesture, nothing committed.
    touch('pointerup', 7, 2.5);
    expect(refusals()).toHaveLength(1);
    expect(canvas).not.toHaveAttribute('data-placement-ghost');
    expect(undoButton).toBeDisabled();

    // A drag inside the zone is accepted and clears the previous refusal.
    touch('pointerdown', 2, 3);
    touch('pointermove', 3, 3.5);
    expect(canvas).not.toHaveAttribute('data-placement-ghost');
    touch('pointerup', 3, 3.5);
    expect(undoButton).toBeEnabled();
    expect(refusals()).toHaveLength(0);
  });

  it('désigne la balle rouge dans l’objectif sans marqueur permanent sur le plateau (R1)', () => {
    render(<App />);

    const canvas = within(screen.getByRole('region', { name: 'Plateau de jeu' })).getByRole('img', {
      name: 'Rendu du plateau',
    });
    expect(canvas).not.toHaveAttribute('data-goal-ball-marker');
    expect(canvas).toHaveAttribute('data-blue-balls', 'ball-blue');

    fireEvent.click(screen.getByRole('button', { name: 'Voir l’objectif' }));
    const dialog = screen.getByRole('dialog', { name: 'Objectif du niveau' });
    expect(dialog).toHaveTextContent('Faire entrer la balle dans le panier');
    expect(dialog).toHaveTextContent('Seule la balle rouge compte.');
    expect(dialog).not.toHaveTextContent(/anneau/);
  });

  it('ne signale rien quand la balle de l’objectif est seule (U7)', async () => {
    window.history.replaceState(null, '', '/shared' + (await encodeShareFragment(sharedM8Level)));
    const { repository } = createReceivedLevelRepository();
    render(<App receivedLevelRepository={repository} />);
    await screen.findByRole('button', { name: 'Voir l’objectif' });

    const canvas = within(screen.getByRole('region', { name: 'Plateau de jeu' })).getByRole('img', {
      name: 'Rendu du plateau',
    });
    expect(canvas).not.toHaveAttribute('data-goal-ball-marker');

    fireEvent.click(screen.getByRole('button', { name: 'Voir l’objectif' }));
    const dialog = screen.getByRole('dialog', { name: 'Objectif du niveau' });
    expect(dialog).toHaveTextContent('Faire entrer la balle dans le panier');
    expect(dialog).not.toHaveTextContent(/anneau/);
  });

  it('montre sur le niveau 1 neuf une aide brève vers « Lancer », hors du plateau (U8)', () => {
    const { repository } = createPreferencesRepository();
    render(<App preferencesRepository={repository} />);

    const hint = firstLevelHint();
    expect(hint).not.toBeNull();
    if (hint === null) return;
    expect(hint).toHaveTextContent('Lance la machine avec « Lancer » pour la voir tourner.');
    expect(within(hint).getByRole('button', { name: 'Masquer l’aide' })).toBeVisible();
    // Ni sur le plateau, ni dans la barre d'actions : dans l'emplacement réservé.
    const board = screen.getByRole('region', { name: 'Plateau de jeu' });
    expect(board).not.toContainElement(hint);
    expect(screen.getByRole('button', { name: 'Lancer' })).not.toContainElement(hint);
    expect(hint.closest('.status-slot')).not.toBeNull();
  });

  it('oriente vers le tiroir après un premier lancer, puis disparaît pour toujours à la première pose (U8)', () => {
    const preferences = createPreferencesRepository({ author: 'Lili' });
    render(<App preferencesRepository={preferences.repository} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    expect(firstLevelHint()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Recommencer' }));

    const hint = firstLevelHint();
    expect(hint).toHaveTextContent(
      'Prends un objet dans le catalogue, pose-le sur le plateau, puis lance la machine avec « Lancer ».',
    );
    expect(preferences.saved).toEqual([]);

    placeCampaignBeam(5.0, 2.15);
    expect(firstLevelHint()).toBeNull();
    expect(preferences.saved).toEqual([{ author: 'Lili', firstLevelHintDone: true }]);

    cleanup();
    window.history.replaceState(null, '', '/levels/campaign-01-la-bille-de-service/play');
    render(<App preferencesRepository={preferences.repository} />);
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeVisible();
    expect(firstLevelHint()).toBeNull();
  });

  it('se ferme d’un toucher et ne revient pas (U8)', () => {
    const preferences = createPreferencesRepository();
    render(<App preferencesRepository={preferences.repository} />);

    const hint = firstLevelHint();
    if (hint === null) throw new Error('Aide du niveau 1 absente.');
    fireEvent.click(within(hint).getByRole('button', { name: 'Masquer l’aide' }));

    expect(firstLevelHint()).toBeNull();
    expect(preferences.saved).toEqual([{ firstLevelHintDone: true }]);
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recommencer' }));
    expect(firstLevelHint()).toBeNull();

    cleanup();
    window.history.replaceState(null, '', '/levels/campaign-01-la-bille-de-service/play');
    render(<App preferencesRepository={preferences.repository} />);
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeVisible();
    expect(firstLevelHint()).toBeNull();
  });

  it('ne montre l’aide ni sur un autre niveau ni sur le niveau 1 déjà résolu (U8)', () => {
    const { repository: progress } = createProgressRepository({
      'campaign-01-la-bille-de-service': { resolved: true, bestObjectCount: 2 },
    });
    const preferences = createPreferencesRepository();
    render(<App progressRepository={progress} preferencesRepository={preferences.repository} />);
    expect(screen.getByText('Niveau 1 · La bille de service')).toBeVisible();
    expect(firstLevelHint()).toBeNull();

    cleanup();
    window.history.replaceState(null, '', '/levels/campaign-02-par-dessus-le-mur/play');
    render(<App progressRepository={progress} preferencesRepository={preferences.repository} />);
    expect(screen.getByText('Niveau 2 · Par-dessus le mur')).toBeVisible();
    expect(firstLevelHint()).toBeNull();
    expect(preferences.saved).toEqual([]);
  });

  it('propose la mise à jour à l’accueil et ne l’applique que sur demande (U10)', async () => {
    window.history.replaceState(null, '', '/');
    const update = waitingPwaUpdate();
    render(<App registerServiceWorker={update.register} />);

    const invitation = await screen.findByRole('region', { name: 'Mise à jour de TinkerBolt' });
    expect(invitation).toHaveTextContent('Nouvelle version disponible.');
    expect(update.applyUpdate).not.toHaveBeenCalled();

    fireEvent.click(within(invitation).getByRole('button', { name: 'Mettre à jour' }));
    expect(update.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('propose la mise à jour hors du plateau, la tait pendant la simulation et la remet à plus tard (U10)', async () => {
    const update = waitingPwaUpdate();
    const preferences = createPreferencesRepository({ firstLevelHintDone: true });
    render(
      <App
        registerServiceWorker={update.register}
        preferencesRepository={preferences.repository}
      />,
    );

    const invitation = await screen.findByRole('region', { name: 'Mise à jour de TinkerBolt' });
    expect(screen.getByRole('region', { name: 'Plateau de jeu' })).not.toContainElement(invitation);
    expect(invitation.closest('.status-slot')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    expect(pwaUpdateInvitation()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Recommencer' }));
    const again = pwaUpdateInvitation();
    if (again === null) throw new Error('Invitation de mise à jour absente après la simulation.');

    fireEvent.click(within(again).getByRole('button', { name: 'Plus tard' }));
    expect(pwaUpdateInvitation()).toBeNull();
    expect(update.applyUpdate).not.toHaveBeenCalled();
    expect(preferences.saved).toEqual([]);
  });

  it('ne propose pas sur le plateau une mise à jour qui ferait perdre la construction (U10)', async () => {
    const update = waitingPwaUpdate();
    const preferences = createPreferencesRepository({ firstLevelHintDone: true });
    render(
      <App
        registerServiceWorker={update.register}
        preferencesRepository={preferences.repository}
      />,
    );
    await screen.findByRole('region', { name: 'Mise à jour de TinkerBolt' });

    placeCampaignBeam(5.0, 2.15);
    expect(pwaUpdateInvitation()).toBeNull();
    expect(update.applyUpdate).not.toHaveBeenCalled();
  });

  it('ne propose l’installation qu’à l’accueil, quand le navigateur l’a émise, et l’ouvre sur demande (U10)', async () => {
    window.history.replaceState(null, '', '/');
    const preferences = createPreferencesRepository();
    render(<App preferencesRepository={preferences.repository} />);
    expect(screen.getByRole('heading', { name: 'Amène la balle jusqu’au panier.' })).toBeVisible();
    expect(installInvitation()).toBeNull();

    const install = installPromptEvent('accepted');
    act(() => {
      window.dispatchEvent(install.event);
    });
    const invitation = installInvitation();
    if (invitation === null) throw new Error('Invitation d’installation absente.');
    expect(invitation).toHaveTextContent(
      'Installe TinkerBolt pour le retrouver comme une application, même hors ligne.',
    );

    await act(async () => {
      fireEvent.click(within(invitation).getByRole('button', { name: 'Installer' }));
      await Promise.resolve();
    });
    expect(install.prompt).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(installInvitation()).toBeNull();
    });
    expect(preferences.saved).toEqual([]);
  });

  it('retient le refus de l’installation, même après rechargement (U10)', () => {
    window.history.replaceState(null, '', '/');
    const preferences = createPreferencesRepository({ author: 'Lili' });
    render(<App preferencesRepository={preferences.repository} />);
    act(() => {
      window.dispatchEvent(installPromptEvent('accepted').event);
    });
    const invitation = installInvitation();
    if (invitation === null) throw new Error('Invitation d’installation absente.');

    fireEvent.click(within(invitation).getByRole('button', { name: 'Ne pas installer' }));
    expect(installInvitation()).toBeNull();
    expect(preferences.saved).toEqual([{ author: 'Lili', installInvitationDeclined: true }]);

    cleanup();
    window.history.replaceState(null, '', '/');
    render(<App preferencesRepository={preferences.repository} />);
    act(() => {
      window.dispatchEvent(installPromptEvent('accepted').event);
    });
    expect(installInvitation()).toBeNull();
  });

  it('retient aussi le refus donné dans la demande du navigateur (U10)', async () => {
    window.history.replaceState(null, '', '/');
    const preferences = createPreferencesRepository();
    render(<App preferencesRepository={preferences.repository} />);
    act(() => {
      window.dispatchEvent(installPromptEvent('dismissed').event);
    });
    const invitation = installInvitation();
    if (invitation === null) throw new Error('Invitation d’installation absente.');

    fireEvent.click(within(invitation).getByRole('button', { name: 'Installer' }));
    await waitFor(() => {
      expect(preferences.saved).toEqual([{ installInvitationDeclined: true }]);
    });
    expect(installInvitation()).toBeNull();
  });
});
