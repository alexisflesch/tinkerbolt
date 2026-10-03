// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DraftCreation, DraftRepository } from '../application/drafts/draft-repository';

import {
  testDraftRepository,
  renderStorageReady,
  storageAction,
  activeStoredRowCount,
} from './storage-test-fixture';
import { App } from './App';

const testClock = (): Date => new Date('2026-10-01T12:00:00.000Z');
const draftStorage = (): DraftRepository => testDraftRepository(testClock);

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

/** The workshop's one blue ball, posed from the catalogue: a committed change. */
const placeBall = async (): Promise<void> => {
  const toggle = screen.queryByRole('button', { name: 'Ouvrir le catalogue' });
  if (toggle !== null) await storageAction(() => fireEvent.click(toggle));
  await storageAction(() => fireEvent.click(screen.getByRole('button', { name: /^Balle/u })));
  await tapWorldPoint(8, 3);
};

const blueBalls = (): string | null =>
  screen.getByRole('img', { name: 'Rendu du plateau' }).getAttribute('data-blue-balls');

const draftIdInUrl = (): string => {
  const id = new URLSearchParams(window.location.search).get('draft');
  if (id === null) throw new Error('Aucune création dans l’URL.');
  return id;
};

const storedCreation = async (id: string): Promise<DraftCreation> => {
  const loaded = await draftStorage().load(id);
  if (loaded.status !== 'ok' || loaded.creation === null) throw new Error('Création introuvable.');
  return loaded.creation;
};

const storedIds = async (): Promise<readonly string[]> => {
  const listed = await draftStorage().list();
  if (listed.status !== 'ok') throw new Error('Dépôt illisible.');
  return listed.ids;
};

describe('atelier libre enregistré (M13, ADR 0015 § Atelier libre)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/editor');
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ouvrir l’atelier sans rien faire ne crée aucune création et laisse l’URL', async () => {
    await renderStorageReady(<App />);

    await waitFor(() => {
      expect(screen.getByText('Atelier')).toBeVisible();
    });
    await waitFor(async () => {
      expect(await storedIds()).toEqual([]);
    });
    await waitFor(async () => {
      expect(await activeStoredRowCount()).toBe(0);
    });
    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor');
    });
    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
  });

  it('affiche dans l’en-tête « Nouveau niveau · Atelier » pour un atelier neuf (V3, V7)', async () => {
    await renderStorageReady(<App draftRepository={draftStorage()} />);

    const header = screen.getByRole('banner');
    await waitFor(() => {
      expect(within(header).getByText('Nouveau niveau')).toBeVisible();
    });
    await waitFor(() => {
      expect(within(header).getByText('Atelier')).toBeVisible();
    });
    await waitFor(() => {
      expect(header).not.toHaveTextContent('Atelier de niveau');
    });
    await waitFor(() => {
      expect(header).not.toHaveTextContent('Mode éditeur');
    });
  });

  it('garde à une création enregistrée le titre de son document, même l’ancien titre de l’atelier (V7)', async () => {
    await renderStorageReady(<App draftRepository={draftStorage()} />);
    await placeBall();
    const id = draftIdInUrl();
    const creation = await storedCreation(id);
    // Un brouillon enregistré avant V7 porte l'ancien titre de `workshop.json`.
    const saved = await draftStorage().save({
      document: { ...creation.document, metadata: { title: 'Atelier de niveau' } },
    });
    await waitFor(() => {
      expect(saved.status).toBe('ok');
    });
    cleanup();

    window.history.replaceState(null, '', `/editor?draft=${id}`);
    await renderStorageReady(<App draftRepository={draftStorage()} />);

    const header = screen.getByRole('banner');
    await waitFor(() => {
      expect(within(header).getByText('Atelier de niveau')).toBeVisible();
    });
    await waitFor(() => {
      expect(header).not.toHaveTextContent('Nouveau niveau');
    });
    await waitFor(async () => {
      expect((await storedCreation(id)).document.metadata.title).toBe('Atelier de niveau');
    });
  });

  it('poser un objet enregistre une création `creation-<aléa>` et met son identifiant dans l’URL', async () => {
    await renderStorageReady(<App draftRepository={draftStorage()} />);

    await placeBall();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor');
    });
    await waitFor(() => {
      expect(draftIdInUrl()).toMatch(/^creation-[0-9a-f]{32}$/u);
    });
    await waitFor(async () => {
      expect(await storedIds()).toEqual([draftIdInUrl()]);
    });
    const creation = await storedCreation(draftIdInUrl());
    await waitFor(() => {
      expect(creation.document.id).toBe(draftIdInUrl());
    });
    await waitFor(() => {
      expect(creation.document.objects.filter(({ type }) => type === 'ball')).toHaveLength(2);
    });
    await waitFor(() => {
      expect(creation.source).toBeUndefined();
    });
    await waitFor(() => {
      expect(creation.updatedAt).toBe(testClock().toISOString());
    });
  });

  it('une création partie de zéro n’a pas de description (M14b)', async () => {
    await renderStorageReady(<App draftRepository={draftStorage()} />);

    await placeBall();

    const { metadata } = (await storedCreation(draftIdInUrl())).document;
    await waitFor(() => {
      expect(metadata).toEqual({ title: 'Nouveau niveau' });
    });
    await waitFor(() => {
      expect('description' in metadata).toBe(false);
    });
  });

  it('remplace l’entrée d’historique du navigateur au lieu d’en ajouter une', async () => {
    await renderStorageReady(<App />);
    const entriesBefore = window.history.length;

    await placeBall();

    await waitFor(() => {
      expect(draftIdInUrl()).toMatch(/^creation-/u);
    });
    await waitFor(() => {
      expect(window.history.length).toBe(entriesBefore);
    });
  });

  it('recharger l’adresse retrouve l’objet posé', async () => {
    await renderStorageReady(<App />);
    await placeBall();
    const posed = blueBalls();
    await waitFor(() => {
      expect(posed).not.toBe('');
    });
    cleanup();

    await renderStorageReady(<App />);

    await waitFor(() => {
      expect(screen.getByText('Atelier')).toBeVisible();
    });
    await waitFor(() => {
      expect(blueBalls()).toBe(posed);
    });
  });

  it('garde l’historique et le même enregistrement après le changement d’URL : « Annuler » retire l’objet', async () => {
    await renderStorageReady(<App />);
    await placeBall();
    const id = draftIdInUrl();
    await waitFor(() => {
      expect(blueBalls()).not.toBe('');
    });

    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));

    await waitFor(() => {
      expect(blueBalls()).toBe('');
    });
    await waitFor(() => {
      expect(draftIdInUrl()).toBe(id);
    });
    await waitFor(async () => {
      expect(await storedIds()).toEqual([id]);
    });
    await waitFor(async () => {
      expect(
        (await storedCreation(id)).document.objects.filter(({ type }) => type === 'ball'),
      ).toHaveLength(1);
    });
  });

  it('enregistre les modifications suivantes dans la même création', async () => {
    await renderStorageReady(<App />);
    await placeBall();
    const id = draftIdInUrl();

    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Rétablir' })));

    await waitFor(() => {
      expect(draftIdInUrl()).toBe(id);
    });
    await waitFor(async () => {
      expect(await storedIds()).toEqual([id]);
    });
    await waitFor(async () => {
      expect(
        (await storedCreation(id)).document.objects.filter(({ type }) => type === 'ball'),
      ).toHaveLength(2);
    });
  });

  it('« Atelier de construction » depuis une création enregistrée ouvre un atelier neuf, sans la modifier', async () => {
    await renderStorageReady(<App />);
    await placeBall();
    const id = draftIdInUrl();

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' })),
    );
    await storageAction(() =>
      fireEvent.click(
        within(screen.getByRole('navigation', { name: 'Menu principal' })).getByRole('button', {
          name: 'Atelier',
        }),
      ),
    );

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    await waitFor(() => {
      expect(blueBalls()).toBe('');
    });
    await waitFor(async () => {
      expect(await storedIds()).toEqual([id]);
    });

    await placeBall();

    await waitFor(() => {
      expect(draftIdInUrl()).not.toBe(id);
    });
    await waitFor(async () => {
      expect(await storedIds()).toHaveLength(2);
    });
    await waitFor(async () => {
      expect(
        (await storedCreation(id)).document.objects.filter(({ type }) => type === 'ball'),
      ).toHaveLength(2);
    });
  });

  it('continue sans changer d’URL quand l’enregistrement échoue, et réessaie à la modification suivante', async () => {
    const real = draftStorage();
    let failing = true;
    const repository: DraftRepository = {
      ...real,
      create: (creation) =>
        Promise.resolve(
          failing ? { status: 'error', code: 'quota-exceeded' } : real.create(creation),
        ),
    };
    await renderStorageReady(<App draftRepository={repository} />);

    await placeBall();

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    await waitFor(() => {
      expect(blueBalls()).not.toBe('');
    });
    await waitFor(async () => {
      expect(await storedIds()).toEqual([]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });

    failing = false;
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));

    await waitFor(() => {
      expect(draftIdInUrl()).toMatch(/^creation-/u);
    });
    await waitFor(async () => {
      expect(await storedIds()).toEqual([draftIdInUrl()]);
    });
    await waitFor(() => {
      expect(blueBalls()).toBe('');
    });
  });

  it('ne crée rien quand le stockage est indisponible, sans quitter l’atelier', async () => {
    const repository: DraftRepository = {
      create: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
      list: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
      load: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
      save: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
      delete: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
    };
    await renderStorageReady(<App draftRepository={repository} />);

    await placeBall();

    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    await waitFor(() => {
      expect(blueBalls()).not.toBe('');
    });
  });
});
