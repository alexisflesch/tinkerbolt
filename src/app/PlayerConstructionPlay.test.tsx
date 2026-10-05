// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { embeddedLevels } from '../content/embedded-levels';
import { createConstructionAttempt, placeFromInventory } from '../application/construction';
import type { PlayerConstructionRepository } from '../application/construction/player-construction-repository';
import { preparePlayerConstructionSource } from '../infrastructure/player-construction/player-construction-codec';
import { createIndexedDBPlayerConstructionRepository } from '../infrastructure/storage/indexed-db-player-construction-repository';
import { App } from './App';
import {
  renderStorageReady,
  storageAction,
  testDatabase,
  testProgressRepository,
} from './storage-test-fixture';

const document = embeddedLevels[0];
if (document === undefined) throw new Error('Missing level');
const level = document;
const repository = () =>
  createIndexedDBPlayerConstructionRepository(
    testDatabase(),
    () => new Date('2026-10-04T12:00:00.000Z'),
  );
const source = async () => {
  const result = await preparePlayerConstructionSource('campaign', level.id, level);
  if (result.status !== 'ok') throw new Error(result.code);
  return result.source;
};
const state = () => {
  const result = placeFromInventory({
    context: 'player',
    inventoryEntryId: 'beam-a-placer',
    placementId: 'saved-beam',
    transform: { position: { x: 7, y: 4 }, rotation: 0.3 },
  }).execute(createConstructionAttempt(level));
  if (result.status !== 'accepted') throw new Error(result.reason);
  return result.state;
};
const unavailable = (
  code: 'storage-unavailable' | 'quota-exceeded',
  operation?: 'delete-incompatible',
) => ({
  load: () =>
    Promise.resolve({
      status: 'error' as const,
      code,
      ...(operation === undefined ? {} : { operation }),
    }),
  save: vi.fn<PlayerConstructionRepository['save']>().mockResolvedValue({ status: 'error', code }),
  delete: vi
    .fn<PlayerConstructionRepository['delete']>()
    .mockResolvedValue({ status: 'error', code }),
});
const canvas = () => screen.getByRole('img', { name: 'Rendu du plateau' });
const openCatalogue = async () => {
  const toggle = screen.queryByRole('button', { name: 'Ouvrir le catalogue' });
  if (toggle !== null) await storageAction(() => fireEvent.click(toggle));
};
const worldEvent = (type: string, x: number, y: number) => {
  const [originX, originY] = (canvas().getAttribute('data-camera-origin') ?? '')
    .split(',')
    .map(Number);
  const zoom = Number(canvas().getAttribute('data-camera-zoom'));
  if (originX === undefined || originY === undefined || !(zoom > 0))
    throw new Error('Missing camera');
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    clientX: { value: (x - originX) * zoom },
    clientY: { value: (y - originY) * zoom },
  });
  fireEvent(screen.getByRole('region', { name: 'Plateau de jeu' }), event);
};
const tapWorld = async (x: number, y: number) => {
  const [originX, originY] = (canvas().getAttribute('data-camera-origin') ?? '')
    .split(',')
    .map(Number);
  const zoom = Number(canvas().getAttribute('data-camera-zoom'));
  if (originX === undefined || originY === undefined || !(zoom > 0))
    throw new Error('Missing camera');
  const clientX = (x - originX) * zoom;
  const clientY = (y - originY) * zoom;
  const board = screen.getByRole('region', { name: 'Plateau de jeu' });
  await storageAction(() => {
    worldEvent('pointerdown', x, y);
    worldEvent('pointerup', x, y);
    fireEvent.click(board, { detail: 1, clientX, clientY });
  });
};
const placedState = async (repo: PlayerConstructionRepository) => {
  const loaded = await repo.load(await source());
  if (loaded.status !== 'ok' || loaded.attempt === null) throw new Error('Construction not saved');
  return loaded.attempt;
};

describe('reprise de construction dans le jeu', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', `/levels/${level.id}/play`);
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
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
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('reprend automatiquement une construction sans historique, sélection ni simulation', async () => {
    const repo = repository();
    await repo.save(await source(), state());
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    expect(canvas()).not.toHaveAttribute('data-simulation-step');
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();
    await openCatalogue();
    expect(screen.getByRole('button', { name: 'Poutre courte, quantité : 0' })).toBeDisabled();
    expect(screen.queryByRole('region', { name: /^Propriétés/u })).not.toBeInTheDocument();
    const initial = await repo.load(await source());
    expect(initial).toEqual({ status: 'ok' as const, attempt: state() });
  });

  it('la lecture indisponible permet de jouer en mémoire sans écraser une construction inconnue', async () => {
    const repo = unavailable('storage-unavailable');
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    expect(canvas()).toBeVisible();
    expect(screen.getByText(/construction.*stockage.*indisponible/iu)).toBeVisible();
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Lancer' })));
    await waitFor(() => expect(canvas()).toHaveAttribute('data-simulation-step'));
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('un échec de suppression incompatible bloque le nouveau plateau et permet de retenter', async () => {
    const repo = unavailable('quota-exceeded', 'delete-incompatible');
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    expect(screen.queryByRole('region', { name: 'Plateau de jeu' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/construction.*effac/iu);
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  });

  it('attend la sauvegarde finale avant simulation et ne lance qu’une fois', async () => {
    let finish!: (result: { status: 'ok' }) => void;
    const pending = new Promise<{ status: 'ok' }>((resolve) => {
      finish = resolve;
    });
    const repo = {
      load: () => Promise.resolve({ status: 'ok' as const, attempt: null }),
      save: vi.fn<PlayerConstructionRepository['save']>(() => pending),
      delete: () => Promise.resolve({ status: 'ok' as const }),
    };
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lancer' }));
    expect(screen.getByText('Chargement de la simulation…')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeDisabled();
    expect(canvas()).not.toHaveAttribute('data-simulation-step');
    await act(async () => {
      finish({ status: 'ok' });
      await pending;
    });
    await waitFor(() => expect(canvas()).toHaveAttribute('data-simulation-step'));
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it('ne lance aucune lecture de construction après abandon de la route pendant son empreinte', async () => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('unused'));
    let finish!: (value: ArrayBuffer) => void;
    const pending = new Promise<ArrayBuffer>((resolve) => {
      finish = resolve;
    });
    const digest = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(() => pending);
    const repo = {
      load: vi
        .fn<PlayerConstructionRepository['load']>()
        .mockResolvedValue({ status: 'ok', attempt: null }),
      save: vi.fn<PlayerConstructionRepository['save']>().mockResolvedValue({ status: 'ok' }),
      delete: () => Promise.resolve({ status: 'ok' as const }),
    };
    render(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    await waitFor(() => {
      expect(digest).toHaveBeenCalledOnce();
    });
    cleanup();
    await act(async () => {
      finish(hash);
      await pending;
    });
    expect(repo.load).not.toHaveBeenCalled();
  });

  it('Recommencer efface la construction puis repart du stock source', async () => {
    const repo = repository();
    await repo.save(await source(), state());
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    const originalCanvas = canvas();
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Recommencer le niveau' })),
    );
    await storageAction(() =>
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Recommencer le niveau' })).getByRole('button', {
          name: 'Recommencer le niveau',
        }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Recommencer le niveau' }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(async () => {
      expect(await repo.load(await source())).toEqual({ status: 'ok' as const, attempt: null });
    });
    expect(canvas()).toBe(originalCanvas);
    await openCatalogue();
    expect(screen.getByRole('button', { name: 'Poutre courte, quantité : 1' })).toBeEnabled();
  });

  it('conserve pose, déplacement et undo/redo après rechargement', async () => {
    const repo = repository();
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    await openCatalogue();
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Poutre courte, quantité : 1' })),
    );
    await tapWorld(7, 4);
    await waitFor(async () => {
      expect((await placedState(repo)).document.inventory[0]?.quantity).toBe(0);
    });
    await tapWorld(7, 4);
    await storageAction(() => {
      worldEvent('pointerdown', 7, 4);
      worldEvent('pointermove', 8, 4);
      worldEvent('pointerup', 8, 4);
    });
    await waitFor(async () => {
      expect(
        (await placedState(repo)).document.objects.at(-1)?.transform.position.x,
      ).toBeGreaterThan(7);
    });
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));
    await waitFor(async () => {
      expect((await placedState(repo)).document.objects.at(-1)?.transform.position.x).toBe(7);
    });
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Rétablir' })));
    await waitFor(async () => {
      expect(
        (await placedState(repo)).document.objects.at(-1)?.transform.position.x,
      ).toBeGreaterThan(7);
    });
    const saved = await placedState(repo);
    expect(Object.keys(saved.provenance)).toHaveLength(1);
    expect(saved.document.objects.at(-1)?.transform.position.x).toBeGreaterThan(7);
    cleanup();
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    await openCatalogue();
    expect(screen.getByRole('button', { name: 'Poutre courte, quantité : 0' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();
    expect(await placedState(repo)).toEqual(saved);
    const point = saved.document.objects.at(-1)?.transform.position;
    if (point === undefined) throw new Error('Missing placement');
    await tapWorld(point.x, point.y);
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer la poutre' })),
    );
    await waitFor(async () => {
      expect((await placedState(repo)).document.inventory[0]?.quantity).toBe(1);
    });
  });

  it('un geste aperçu puis annulé ne remplace pas la construction conservée', async () => {
    const repo = repository();
    await repo.save(await source(), state());
    const saves = vi.spyOn(repo, 'save');
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    await storageAction(() => {
      worldEvent('pointerdown', 7, 4);
      worldEvent('pointermove', 8, 5);
      worldEvent('pointercancel', 8, 5);
    });
    expect(saves).not.toHaveBeenCalled();
    expect(await placedState(repo)).toEqual(state());
  });

  it('source modifiée : repart de la source courante avec avertissement sans secours', async () => {
    const repo = repository();
    const oldDocument = { ...level, metadata: { ...level.metadata, title: 'Ancien titre' } };
    const oldSource = await preparePlayerConstructionSource('campaign', level.id, oldDocument);
    if (oldSource.status !== 'ok') throw new Error(oldSource.code);
    await repo.save(oldSource.source, createConstructionAttempt(oldDocument));
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    expect(screen.getByText(/Le niveau a changé/)).toBeVisible();
    expect(await repo.load(await source())).toEqual({ status: 'ok', attempt: null });
    expect(await testDatabase().table('backups').count()).toBe(0);
  });

  it('une construction corrompue est mise en secours et annoncée avant de repartir', async () => {
    const repo = repository();
    await repo.save(await source(), state());
    await testDatabase()
      .table('playerConstructions')
      .update(['campaign', level.id], {
        envelope: { kind: 'player-construction', version: 1, data: 'illisible' },
      });
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    expect(screen.getByText(/construction était illisible.*copie de secours/)).toBeVisible();
    expect(await repo.load(await source())).toEqual({ status: 'ok', attempt: null });
    expect(await testDatabase().table('backups').count()).toBe(1);
  });

  it('un recommencement refusé conserve le plateau et la construction sauvegardée', async () => {
    const actual = repository();
    await actual.save(await source(), state());
    const repo: PlayerConstructionRepository = {
      ...actual,
      delete: () => Promise.resolve({ status: 'error', code: 'quota-exceeded' }),
    };
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Recommencer le niveau' })),
    );
    await storageAction(() =>
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Recommencer le niveau' })).getByRole('button', {
          name: 'Recommencer le niveau',
        }),
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Recommencer le niveau' })).toBeVisible();
    await waitFor(() => expect(screen.getByText(/Le niveau n’a pas été recommencé/)).toBeVisible());
    expect(await placedState(actual)).toEqual(state());
  });

  it('une sauvegarde refusée laisse jouer et un succès ultérieur retire l’avertissement', async () => {
    const actual = repository();
    const repo: PlayerConstructionRepository = {
      ...actual,
      save: vi
        .fn<PlayerConstructionRepository['save']>()
        .mockResolvedValueOnce({ status: 'error', code: 'quota-exceeded' })
        .mockImplementation((source, attempt) => actual.save(source, attempt)),
    };
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    await openCatalogue();
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Poutre courte, quantité : 1' })),
    );
    await tapWorld(7, 4);
    await waitFor(() =>
      expect(screen.getByText(/construction non enregistrées.*plein/)).toBeVisible(),
    );
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));
    await waitFor(() =>
      expect(screen.queryByText(/construction non enregistrées/)).not.toBeInTheDocument(),
    );
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Rétablir' })));
    await waitFor(async () => {
      expect((await placedState(actual)).document.inventory[0]?.quantity).toBe(0);
    });
    const saved = await placedState(actual);
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Lancer' })));
    expect(canvas()).toHaveAttribute('data-simulation-step');
    expect(await placedState(actual)).toEqual(saved);
  });

  it('redimensionne une poutre par glissement sans ouvrir de sélecteur ni créer de stock', async () => {
    const repo = repository();
    await renderStorageReady(
      <App playerConstructionRepository={repo} progressRepository={testProgressRepository()} />,
    );
    await openCatalogue();
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Poutre courte, quantité : 1' })),
    );
    await tapWorld(7, 4);

    const beforeResize = await placedState(repo);
    const handle = await screen.findByRole('button', { name: 'Redimensionner la poutre' });
    const sendPointer = (type: 'pointerdown' | 'pointermove' | 'pointerup', clientX: number) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        pointerId: { configurable: true, value: 1 },
        pointerType: { configurable: true, value: 'mouse' },
        button: { configurable: true, value: 0 },
        clientX: { configurable: true, value: clientX },
        clientY: { configurable: true, value: 200 },
      });
      fireEvent(handle, event);
    };
    await storageAction(() => {
      sendPointer('pointerdown', 200);
      sendPointer('pointerup', 200);
    });
    expect(screen.queryByRole('group', { name: 'Taille de la poutre' })).not.toBeInTheDocument();
    await storageAction(() => {
      sendPointer('pointerdown', 200);
      sendPointer('pointermove', 1200);
      sendPointer('pointerup', 1200);
    });
    expect(await placedState(repo)).toEqual(beforeResize);
  });
});
