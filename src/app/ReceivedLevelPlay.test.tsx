// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProgressRepository } from '../application/progression/progress-repository';
import type {
  ReceivedLevel,
  ReceivedLevelRepository,
  ReceivedLevelWriteResult,
} from '../application/received/received-level-repository';
import { levelDocumentSchema, type LevelDocument } from '../domain/level-document';
import { encodeLevelFile } from '../infrastructure/level-file/level-file-codec';
import { levelFingerprint } from '../infrastructure/level-file/level-fingerprint';
import { encodeShareFragment } from '../infrastructure/level-share/level-share-codec';
import { createLocalStorageReceivedLevelRepository } from '../infrastructure/storage/local-storage-received-level-repository';

import { App } from './App';

const locked = { move: false, rotate: false, remove: false } as const;

/**
 * A received level the ball wins alone, from right above the basket, or
 * loses when `ballX` puts it beside (checked headless, `runLevelOutcome`).
 */
const receivedDocument = (metadata: LevelDocument['metadata'], ballX = 7): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 2,
    id: 'niveau-recu-m10',
    metadata,
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        props: {},
        transform: { position: { x: ballX, y: 1 }, rotation: 0 },
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
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  });

const attributed = receivedDocument({
  title: 'Le saut',
  author: '<i>Lili</i>',
  basedOn: [
    { title: '<b>La chute</b>', author: 'Max' },
    { title: 'Plus ancien', author: 'Zoé' },
  ],
});

const entryId = `recu-${'a'.repeat(16)}`;

const entry = (document: LevelDocument, extra: Partial<ReceivedLevel> = {}): ReceivedLevel => ({
  id: entryId,
  document,
  origin: 'link',
  receivedAt: '2026-09-01T08:00:00.000Z',
  solved: false,
  ...extra,
});

const storage = () => createLocalStorageReceivedLevelRepository(window.localStorage);

const storedEntry = (id: string): ReceivedLevel | null => {
  const loaded = storage().load(id);
  return loaded.status === 'ok' ? loaded.level : null;
};

const createProgressRepository = () => {
  const save = vi.fn(() => ({ status: 'ok' as const }));
  const repository: ProgressRepository = {
    load: () => ({ status: 'ok', progress: {} }),
    save,
    clear: () => ({ status: 'ok' }),
  };
  return { repository, save };
};

/** Every write answers `saveResult`; reads answer `initial` by id. */
const createReceivedLevelRepository = (
  saveResult: ReceivedLevelWriteResult,
  initial: readonly ReceivedLevel[] = [],
) => {
  const saves: ReceivedLevel[] = [];
  const repository: ReceivedLevelRepository = {
    list: () => ({ status: 'ok', ids: initial.map(({ id }) => id) }),
    load: (id) => ({ status: 'ok', level: initial.find((level) => level.id === id) ?? null }),
    save: (level) => {
      saves.push(level);
      return saveResult;
    },
    delete: () => ({ status: 'ok' }),
  };
  return { repository, saves };
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

/** Launches and runs the simulation until its outcome (B2: 240 spaced frames reach the timeout). */
const launchToOutcome = (flush: (timestamp: number) => void): HTMLElement => {
  fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
  act(() => {
    flush(0);
    for (let frame = 1; frame <= 240; frame += 1) flush(frame * 1000);
  });
  return screen.getByRole('region', { name: 'Résultat du niveau' });
};

/** U24: a received level only ever shows the Resolved tier. */
const expectResolvedOnly = async (result: HTMLElement): Promise<void> => {
  expect(within(result).getByText('Victoire')).toBeVisible();
  expect(result).toHaveAttribute('data-level-tier', 'resolved');
  const automaticDialog = await screen.findByRole('dialog', { name: 'Bravo !' });
  fireEvent.click(within(automaticDialog).getByRole('button', { name: 'Voir la scène' }));
  fireEvent.click(within(result).getByRole('button', { name: 'Voir le résultat' }));
  const dialog = screen.getByRole('dialog', { name: 'Bravo !' });
  const tiers = within(within(dialog).getByRole('list', { name: 'Paliers' })).getAllByRole(
    'listitem',
  );
  expect(tiers.map((tier) => tier.textContent)).toEqual(['Résolu obtenu']);
  expect(within(dialog).queryByRole('button', { name: /Niveau suivant/u })).toBeNull();
};

const chooseFile = (name: string, contents: string): void => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('Sélecteur de fichier introuvable.');
  const file = new File([contents], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) });
  fireEvent.change(input, { target: { files: [file] } });
};

/** Outside a secure context (HTTP on a local IP), `crypto.subtle` does not exist. */
const removeSubtleCrypto = (): void => {
  const secureCrypto = globalThis.crypto;
  vi.stubGlobal('crypto', {
    getRandomValues: (array: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => {
      secureCrypto.getRandomValues(array);
      return array;
    },
  });
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

describe('jouer un niveau reçu (M10, ADR 0015 § Victoire sur un niveau reçu)', () => {
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

  it('montre l’auteur et la première source dans l’en-tête, en texte brut', () => {
    expect(storage().save(entry(attributed)).status).toBe('ok');
    window.history.replaceState(null, '', `/my-levels/${entryId}/play`);

    render(<App />);

    const header = screen.getByRole('banner');
    expect(within(header).getByText('Le saut')).toBeVisible();
    expect(
      within(header).getByText('par <i>Lili</i> · d’après <b>La chute</b> (par Max)'),
    ).toBeVisible();
    expect(within(header).queryByText(/Plus ancien/u)).toBeNull();
    expect(header.querySelector('i, b')).toBeNull();
  });

  it('met l’entrée à jour à la victoire, n’affiche que ✅ et ne touche pas la campagne', async () => {
    const flush = createAnimationFrameHarness();
    expect(storage().save(entry(attributed)).status).toBe('ok');
    const { repository: progress, save: saveProgress } = createProgressRepository();
    window.history.replaceState(null, '', `/my-levels/${entryId}/play`);
    render(<App progressRepository={progress} />);

    const result = launchToOutcome(flush);

    expect(storedEntry(entryId)).toEqual(
      entry(attributed, { solved: true, bestObjectCount: 0, playerSolution: { placements: [] } }),
    );
    await expectResolvedOnly(result);
    expect(saveProgress).not.toHaveBeenCalled();
  });

  it('ne change rien à l’entrée après un échec', () => {
    const flush = createAnimationFrameHarness();
    const losing = receivedDocument({ title: 'Raté' }, 1);
    const before = entry(losing, {
      solved: true,
      bestObjectCount: 2,
      playerSolution: { placements: [] },
    });
    expect(storage().save(before).status).toBe('ok');
    window.history.replaceState(null, '', `/my-levels/${entryId}/play`);
    render(<App />);

    const result = launchToOutcome(flush);

    expect(within(result).getByText('Échec')).toBeVisible();
    expect(storedEntry(entryId)).toEqual(before);
  });

  it('continue la partie quand la victoire ne peut pas être enregistrée', async () => {
    const flush = createAnimationFrameHarness();
    const { repository, saves } = createReceivedLevelRepository(
      { status: 'error', code: 'quota-exceeded' },
      [entry(attributed)],
    );
    window.history.replaceState(null, '', `/my-levels/${entryId}/play`);
    render(<App receivedLevelRepository={repository} />);

    const result = launchToOutcome(flush);

    expect(saves).toHaveLength(1);
    await expectResolvedOnly(result);
  });

  it('enregistre la victoire d’un lien partagé gardé, avec l’attribution dans l’en-tête', async () => {
    const flush = createAnimationFrameHarness();
    window.history.replaceState(null, '', '/shared' + (await encodeShareFragment(attributed)));
    const { repository: progress, save: saveProgress } = createProgressRepository();
    render(<App progressRepository={progress} />);
    expect(await screen.findByText('Partage · Le saut')).toBeVisible();
    expect(
      within(screen.getByRole('banner')).getByText(
        'par <i>Lili</i> · d’après <b>La chute</b> (par Max)',
      ),
    ).toBeVisible();

    const result = launchToOutcome(flush);

    const id = `recu-${await levelFingerprint(attributed)}`;
    expect(storedEntry(id)).toMatchObject({
      solved: true,
      bestObjectCount: 0,
      playerSolution: { placements: [] },
    });
    await expectResolvedOnly(result);
    expect(saveProgress).not.toHaveBeenCalled();
  });

  it('n’enregistre rien, victoire comprise, sur un lien partagé non gardé', async () => {
    const flush = createAnimationFrameHarness();
    window.history.replaceState(null, '', '/shared' + (await encodeShareFragment(attributed)));
    const { repository, saves } = createReceivedLevelRepository({
      status: 'error',
      code: 'quota-exceeded',
    });
    render(<App receivedLevelRepository={repository} />);
    expect(await screen.findByText('Partage · Le saut')).toBeVisible();
    expect(saves).toHaveLength(1);

    const result = launchToOutcome(flush);

    await expectResolvedOnly(result);
    expect(saves).toHaveLength(1);
  });

  it('propose de jouer quand même un fichier importé qui n’a pas pu être gardé, sans rien enregistrer', async () => {
    const flush = createAnimationFrameHarness();
    const { repository, saves } = createReceivedLevelRepository({
      status: 'error',
      code: 'quota-exceeded',
    });
    window.history.replaceState(null, '', '/my-levels');
    render(<App receivedLevelRepository={repository} />);

    chooseFile('le-saut.json', encodeLevelFile(attributed));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ce niveau n’a pas été gardé.');
    fireEvent.click(screen.getByRole('button', { name: 'Jouer quand même' }));

    expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    const header = screen.getByRole('banner');
    expect(within(header).getByText('Le saut')).toBeVisible();
    expect(
      within(header).getByText('par <i>Lili</i> · d’après <b>La chute</b> (par Max)'),
    ).toBeVisible();
    expect(screen.getByText('Ce niveau n’a pas été gardé sur cet appareil.')).toHaveAttribute(
      'role',
      'status',
    );
    expect(saves).toHaveLength(1);

    const result = launchToOutcome(flush);
    await expectResolvedOnly(result);
    expect(saves).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Fermer le résultat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retour à Mes niveaux' }));
    expect(screen.getByRole('region', { name: 'Niveaux reçus' })).toBeVisible();
    expect(window.location.pathname).toBe('/my-levels');
  });

  it('propose de jouer quand même un fichier importé sans `crypto.subtle`', async () => {
    removeSubtleCrypto();
    window.history.replaceState(null, '', '/my-levels');
    render(<App />);

    chooseFile('le-saut.json', encodeLevelFile(attributed));
    expect(await screen.findByRole('alert')).toHaveTextContent('hors connexion sécurisée');
    fireEvent.click(screen.getByRole('button', { name: 'Jouer quand même' }));

    expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    expect(within(screen.getByRole('banner')).getByText('Le saut')).toBeVisible();
    expect(window.localStorage.length).toBe(0);
  });
});
