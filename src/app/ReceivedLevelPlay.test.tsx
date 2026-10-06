// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
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

import {
  testReceivedRepository,
  mergeCampaignProgressForTest,
  renderStorageReady,
  storageAction,
  activeStoredRowCount,
} from './storage-test-fixture';
import type { CampaignProgress } from '../application/progression';
import { recordSuccess } from '../application/progression';
import { App } from './App';

const locked = { move: false, rotate: false, remove: false } as const;

/**
 * A received level the ball wins alone, from right above the basket, or
 * loses when `ballX` puts it beside (checked headless, `runLevelOutcome`).
 */
const receivedDocument = (metadata: LevelDocument['metadata'], ballX = 7): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
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

const storage = () => testReceivedRepository();

const storedEntry = async (id: string): Promise<ReceivedLevel | null> => {
  const loaded = await storage().load(id);
  return loaded.status === 'ok' ? loaded.level : null;
};

const createProgressRepository = () => {
  let stored: CampaignProgress = {};
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
    load: () => Promise.resolve({ status: 'ok', progress: stored }),
    save,
    merge: (imported) => {
      stored = mergeCampaignProgressForTest(stored, imported);
      return Promise.resolve({ status: 'ok', progress: stored });
    },
    clear: () => Promise.resolve({ status: 'ok' }),
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
    receive: async (level) => {
      const result = await repository.save(level);
      return result.status === 'error' ? result : { status: 'ok', level, isNew: true };
    },
    recordVictory: async (id, _source, count, solution) => {
      const loaded = await repository.load(id);
      if (loaded.status === 'error') return loaded;
      if (loaded.level === null) return { status: 'ok', level: null };
      const level = {
        ...loaded.level,
        solved: true,
        bestObjectCount: Math.min(loaded.level.bestObjectCount ?? count, count),
        playerSolution: solution,
      };
      const result = await repository.save(level);
      return result.status === 'error' ? result : { status: 'ok', level };
    },
    list: () => Promise.resolve({ status: 'ok', ids: initial.map(({ id }) => id) }),
    load: (id) =>
      Promise.resolve({ status: 'ok', level: initial.find((level) => level.id === id) ?? null }),
    save: (level) => {
      saves.push(level);
      return Promise.resolve(saveResult);
    },
    delete: () => Promise.resolve({ status: 'ok' }),
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
const launchToOutcome = async (flush: (timestamp: number) => void): Promise<HTMLElement> => {
  await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Lancer' })));
  act(() => {
    flush(0);
    for (let frame = 1; frame <= 240; frame += 1) flush(frame * 1000);
  });
  const toolbar = screen.getByRole('toolbar', { name: 'Actions de simulation' });
  await waitFor(() => {
    expect(within(toolbar).getByText(/^(Gagné !|Raté :)/u)).toBeVisible();
  });
  return toolbar;
};

/** U24: a received level only ever shows the Resolved tier. */
const expectResolvedOnly = async (result: HTMLElement): Promise<void> => {
  await waitFor(() => {
    expect(within(result).getByText('Gagné !')).toBeVisible();
  });
  const automaticDialog = await screen.findByRole('dialog', { name: 'Bravo !' });
  expect(automaticDialog).toHaveAttribute('data-level-tier', 'resolved');
  const automaticTiers = within(within(automaticDialog).getByRole('list', { name: 'Paliers' }))
    .getAllByRole('listitem')
    .map((tier) => tier.textContent);
  expect(automaticTiers).toEqual(['Résolu obtenu']);
  await storageAction(() =>
    fireEvent.click(within(automaticDialog).getByRole('button', { name: 'Voir la scène' })),
  );
  await storageAction(() =>
    fireEvent.click(within(result).getByRole('button', { name: 'Voir le résultat' })),
  );
  const dialog = screen.getByRole('dialog', { name: 'Bravo !' });
  const tiers = within(within(dialog).getByRole('list', { name: 'Paliers' })).getAllByRole(
    'listitem',
  );
  await waitFor(() => {
    expect(tiers.map((tier) => tier.textContent)).toEqual(['Résolu obtenu']);
  });
  await waitFor(() => {
    expect(within(dialog).queryByRole('button', { name: /Niveau suivant/u })).toBeNull();
  });
};

const chooseFile = async (name: string, contents: string): Promise<void> => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('Sélecteur de fichier introuvable.');
  const file = new File([contents], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) });
  await storageAction(() => fireEvent.change(input, { target: { files: [file] } }));
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
    window.history.replaceState(null, '', '/');
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('montre l’auteur et la première source dans le titre de la barre, en texte brut', async () => {
    await waitFor(async () => {
      expect((await storage().save(entry(attributed))).status).toBe('ok');
    });
    window.history.replaceState(null, '', `/my-levels/${entryId}/play`);

    await renderStorageReady(<App />);

    await waitFor(() => {
      expect(screen.getByText(/^Le saut · /u, { selector: '.toolbar-title' })).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByText(/Le saut · /u, { selector: '.toolbar-title' })).toHaveTextContent(
        'par <i>Lili</i> · d’après <b>La chute</b> (par Max)',
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('banner')).not.toHaveTextContent(/Plus ancien/u);
    });
    await waitFor(() => {
      expect(document.querySelector('.toolbar-title')?.querySelector('i, b')).toBeNull();
    });
  });

  it('met l’entrée à jour à la victoire, n’affiche que ✅ et ne touche pas la campagne', async () => {
    const flush = createAnimationFrameHarness();
    await waitFor(async () => {
      expect((await storage().save(entry(attributed))).status).toBe('ok');
    });
    const { repository: progress, save: saveProgress } = createProgressRepository();
    window.history.replaceState(null, '', `/my-levels/${entryId}/play`);
    await renderStorageReady(<App progressRepository={progress} />);

    const result = await launchToOutcome(flush);

    await waitFor(async () => {
      expect(await storedEntry(entryId)).toEqual(
        entry(attributed, { solved: true, bestObjectCount: 0, playerSolution: { placements: [] } }),
      );
    });
    await expectResolvedOnly(result);
    await waitFor(() => {
      expect(saveProgress).not.toHaveBeenCalled();
    });
  });

  it('ne change rien à l’entrée après un échec', async () => {
    const flush = createAnimationFrameHarness();
    const losing = receivedDocument({ title: 'Raté' }, 1);
    const before = entry(losing, {
      solved: true,
      bestObjectCount: 2,
      playerSolution: { placements: [] },
    });
    await waitFor(async () => {
      expect((await storage().save(before)).status).toBe('ok');
    });
    window.history.replaceState(null, '', `/my-levels/${entryId}/play`);
    await renderStorageReady(<App />);

    const result = await launchToOutcome(flush);

    await waitFor(() => {
      expect(within(result).getByText(/Raté :/u)).toBeVisible();
    });
    await waitFor(async () => {
      expect(await storedEntry(entryId)).toEqual(before);
    });
  });

  it('continue la partie quand la victoire ne peut pas être enregistrée', async () => {
    const flush = createAnimationFrameHarness();
    const { repository, saves } = createReceivedLevelRepository(
      { status: 'error', code: 'quota-exceeded' },
      [entry(attributed)],
    );
    window.history.replaceState(null, '', `/my-levels/${entryId}/play`);
    await renderStorageReady(<App receivedLevelRepository={repository} />);

    const result = await launchToOutcome(flush);

    await waitFor(() => {
      expect(saves).toHaveLength(1);
    });
    await expectResolvedOnly(result);
  });

  it('enregistre la victoire d’un lien partagé gardé, avec l’attribution dans la barre du plateau', async () => {
    const flush = createAnimationFrameHarness();
    window.history.replaceState(null, '', '/shared' + (await encodeShareFragment(attributed)));
    const { repository: progress, save: saveProgress } = createProgressRepository();
    await renderStorageReady(<App progressRepository={progress} />);
    expect(
      await screen.findByText(/Partage · Le saut/u, { selector: '.toolbar-title' }),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByText(/Le saut · /u, { selector: '.toolbar-title' })).toHaveTextContent(
        'par <i>Lili</i> · d’après <b>La chute</b> (par Max)',
      );
    });

    const result = await launchToOutcome(flush);

    const id = `recu-${await levelFingerprint(attributed)}`;
    await waitFor(async () => {
      expect(await storedEntry(id)).toMatchObject({
        solved: true,
        bestObjectCount: 0,
        playerSolution: { placements: [] },
      });
    });
    await expectResolvedOnly(result);
    await waitFor(() => {
      expect(saveProgress).not.toHaveBeenCalled();
    });
  });

  it('n’enregistre rien, victoire comprise, sur un lien partagé non gardé', async () => {
    const flush = createAnimationFrameHarness();
    window.history.replaceState(null, '', '/shared' + (await encodeShareFragment(attributed)));
    const { repository, saves } = createReceivedLevelRepository({
      status: 'error',
      code: 'quota-exceeded',
    });
    await renderStorageReady(<App receivedLevelRepository={repository} />);
    expect(
      await screen.findByText(/Partage · Le saut/u, { selector: '.toolbar-title' }),
    ).toBeVisible();
    await waitFor(() => {
      expect(saves).toHaveLength(1);
    });

    const result = await launchToOutcome(flush);

    await expectResolvedOnly(result);
    await waitFor(() => {
      expect(saves).toHaveLength(1);
    });
  });

  it('propose de jouer quand même un fichier importé qui n’a pas pu être gardé, sans rien enregistrer', async () => {
    const flush = createAnimationFrameHarness();
    const { repository, saves } = createReceivedLevelRepository({
      status: 'error',
      code: 'quota-exceeded',
    });
    window.history.replaceState(null, '', '/my-levels');
    await renderStorageReady(<App receivedLevelRepository={repository} />);

    await chooseFile('le-saut.json', encodeLevelFile(attributed));
    const alert = await screen.findByRole('alert');
    await waitFor(() => {
      expect(alert).toHaveTextContent('Ce niveau n’a pas été gardé.');
    });
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Jouer quand même' })),
    );

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByText(/^Le saut · /u, { selector: '.toolbar-title' })).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByText(/Le saut · /u, { selector: '.toolbar-title' })).toHaveTextContent(
        'par <i>Lili</i> · d’après <b>La chute</b> (par Max)',
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Ce niveau n’a pas été gardé sur cet appareil.')).toHaveAttribute(
        'role',
        'status',
      );
    });
    await waitFor(() => {
      expect(saves).toHaveLength(1);
    });

    const result = await launchToOutcome(flush);
    await expectResolvedOnly(result);
    await waitFor(() => {
      expect(saves).toHaveLength(1);
    });

    await storageAction(() =>
      fireEvent.click(
        within(screen.getByRole('navigation', { name: 'Navigation principale' })).getByRole(
          'link',
          { name: 'Campagne' },
        ),
      ),
    );
    await waitFor(() => {
      expect(window.location.pathname).toBe('/levels');
    });
    await storageAction(() =>
      fireEvent.click(
        within(screen.getByRole('navigation', { name: 'Navigation principale' })).getByRole(
          'link',
          { name: 'Mes niveaux' },
        ),
      ),
    );
    await waitFor(() => {
      expect(window.location.pathname).toBe('/my-levels');
    });
    expect(await screen.findByRole('region', { name: 'Niveaux reçus' })).toBeVisible();
  });

  it('propose de jouer quand même un fichier importé sans `crypto.subtle`', async () => {
    removeSubtleCrypto();
    window.history.replaceState(null, '', '/my-levels');
    await renderStorageReady(<App />);

    await chooseFile('le-saut.json', encodeLevelFile(attributed));
    await waitFor(async () => {
      expect(await screen.findByRole('alert')).toHaveTextContent('hors connexion sécurisée');
    });
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Jouer quand même' })),
    );

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByText(/^Le saut · /u, { selector: '.toolbar-title' })).toBeVisible();
    });
    await waitFor(async () => {
      expect(await activeStoredRowCount()).toBe(0);
    });
  });
});
