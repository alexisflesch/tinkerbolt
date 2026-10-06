// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DraftCreation } from '../application/drafts/draft-repository';
import { embeddedWorkshopDocument } from '../content/embedded-levels';

import { testDraftRepository, renderStorageReady, storageAction } from './storage-test-fixture';
import { App } from './App';

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
  await storageAction(() => fireEvent.click(screen.getByRole('button', { name: /^Balle$/u })));
  await tapWorldPoint(8, 3);
};

const blueBalls = (): string | null =>
  screen.getByRole('img', { name: 'Rendu du plateau' }).getAttribute('data-blue-balls');

const draftIdInUrl = (): string | null => new URLSearchParams(window.location.search).get('draft');

const storedCreation = async (id: string | null): Promise<DraftCreation> => {
  const loaded = await testDraftRepository().load(id ?? '');
  if (loaded.status !== 'ok' || loaded.creation === null) throw new Error('Création introuvable.');
  return loaded.creation;
};

const storedIds = async (): Promise<readonly string[]> => {
  const listed = await testDraftRepository().list();
  if (listed.status !== 'ok') throw new Error('Dépôt illisible.');
  return listed.ids;
};

const storeCreation = async (id: string, title: string, savedAt: string): Promise<void> => {
  const saved = await testDraftRepository(() => new Date(savedAt)).save({
    document: { ...embeddedWorkshopDocument, id, metadata: { title } },
  });
  if (saved.status !== 'ok') throw new Error('Création non enregistrée.');
};

const toolbarTitle = (title: string): HTMLElement =>
  screen.getByText(title, { selector: '.toolbar-title' });

const click = (element: HTMLElement): Promise<void> =>
  storageAction(() => fireEvent.click(element));

describe('reprise de l’Atelier et infos du niveau (ADR 0015, amendement du 6 octobre 2026)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/editor');
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('« /editor » rouvre la dernière création modifiée et met son identifiant dans l’URL', async () => {
    await storeCreation('creation-ancienne', 'Ancienne', '2026-10-01T12:00:00.000Z');
    await storeCreation('creation-recente', 'Récente', '2026-10-03T12:00:00.000Z');
    await storeCreation('creation-milieu', 'Milieu', '2026-10-02T12:00:00.000Z');
    const entriesBefore = window.history.length;

    await renderStorageReady(<App />);

    await waitFor(() => {
      expect(toolbarTitle('Récente')).toBeVisible();
    });
    expect(draftIdInUrl()).toBe('creation-recente');
    expect(window.history.length).toBe(entriesBefore);
  });

  it('« /editor?new » ouvre un atelier vierge même quand des créations existent', async () => {
    await storeCreation('creation-recente', 'Récente', '2026-10-03T12:00:00.000Z');
    window.history.replaceState(null, '', '/editor?new');

    await renderStorageReady(<App />);

    await waitFor(() => {
      expect(toolbarTitle('Sans titre')).toBeVisible();
    });
    expect(draftIdInUrl()).toBeNull();
    expect(await storedIds()).toEqual(['creation-recente']);
  });

  it('le menu « Atelier » rouvre la création en cours au lieu d’en commencer une autre', async () => {
    await renderStorageReady(<App />);
    await placeBall();
    const id = draftIdInUrl();
    const posed = blueBalls();

    await click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    await click(
      within(screen.getByRole('navigation', { name: 'Menu principal' })).getByRole('button', {
        name: 'Atelier',
      }),
    );

    await waitFor(() => {
      expect(draftIdInUrl()).toBe(id);
    });
    await waitFor(() => {
      expect(blueBalls()).toBe(posed);
    });
    expect(await storedIds()).toEqual([id]);
  });

  it('le crayon ouvre « Infos du niveau » : le nom et la description deviennent ceux de la création', async () => {
    await renderStorageReady(<App />);

    await click(screen.getByRole('button', { name: 'Nom et description du niveau' }));
    const dialog = screen.getByRole('dialog', { name: 'Infos du niveau' });
    expect(within(dialog).getByLabelText('Nom du niveau')).toHaveValue('');
    expect(dialog).toHaveTextContent('enregistré automatiquement');
    fireEvent.change(within(dialog).getByLabelText('Nom du niveau'), {
      target: { value: '  La bascule infernale ' },
    });
    fireEvent.change(within(dialog).getByLabelText('Description (facultatif)'), {
      target: { value: 'Fais tomber la balle.' },
    });
    await click(within(dialog).getByRole('button', { name: 'Valider' }));

    await waitFor(() => {
      expect(toolbarTitle('La bascule infernale')).toBeVisible();
    });
    expect(screen.queryByRole('dialog', { name: 'Infos du niveau' })).toBeNull();
    await waitFor(() => {
      expect(draftIdInUrl()).toMatch(/^creation-/u);
    });
    expect((await storedCreation(draftIdInUrl())).document.metadata).toEqual({
      title: 'La bascule infernale',
      description: 'Fais tomber la balle.',
    });

    // Reopened, the dialog shows what was stored; a blank name gives the default title back.
    await click(screen.getByRole('button', { name: 'Nom et description du niveau' }));
    const reopened = screen.getByRole('dialog', { name: 'Infos du niveau' });
    expect(within(reopened).getByLabelText('Nom du niveau')).toHaveValue('La bascule infernale');
    fireEvent.change(within(reopened).getByLabelText('Nom du niveau'), { target: { value: ' ' } });
    fireEvent.change(within(reopened).getByLabelText('Description (facultatif)'), {
      target: { value: '' },
    });
    await click(within(reopened).getByRole('button', { name: 'Valider' }));

    await waitFor(() => {
      expect(toolbarTitle('Sans titre')).toBeVisible();
    });
    expect((await storedCreation(draftIdInUrl())).document.metadata).toEqual({
      title: 'Sans titre',
    });
  });

  it('« Nouveau niveau » est inactif tant que l’atelier vierge n’a rien à garder', async () => {
    await renderStorageReady(<App />);

    expect(screen.getByRole('button', { name: 'Nouveau niveau' })).toBeDisabled();

    await placeBall();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Nouveau niveau' })).toBeEnabled();
    });
  });

  it('« Nouveau niveau » propose de nommer le niveau sans titre, le garde, puis ouvre un atelier vierge', async () => {
    await renderStorageReady(<App />);
    await placeBall();
    const id = draftIdInUrl();

    await click(screen.getByRole('button', { name: 'Nouveau niveau' }));
    const dialog = screen.getByRole('dialog', { name: 'Nouveau niveau ?' });
    expect(dialog).toHaveTextContent('Tu ne perds rien');
    fireEvent.change(within(dialog).getByLabelText('Nom du niveau'), {
      target: { value: 'Premier essai' },
    });
    await click(within(dialog).getByRole('button', { name: 'Nouveau niveau' }));

    await waitFor(() => {
      expect(window.location.search).toBe('?new');
    });
    await waitFor(() => {
      expect(blueBalls()).toBe('');
    });
    expect(toolbarTitle('Sans titre')).toBeVisible();
    expect(await storedIds()).toEqual([id]);
    const kept = (await storedCreation(id)).document;
    expect(kept.metadata).toEqual({ title: 'Premier essai' });
    expect(kept.objects.filter(({ type }) => type === 'ball')).toHaveLength(2);

    await placeBall();

    await waitFor(() => {
      expect(draftIdInUrl()).not.toBeNull();
    });
    expect(draftIdInUrl()).not.toBe(id);
    expect(await storedIds()).toHaveLength(2);
  });

  it('« Nouveau niveau » cite le nom d’un niveau déjà nommé, sans redemander de nom', async () => {
    await storeCreation('creation-nommee', 'Ma machine', '2026-10-03T12:00:00.000Z');
    await renderStorageReady(<App />);
    await waitFor(() => {
      expect(toolbarTitle('Ma machine')).toBeVisible();
    });

    await click(screen.getByRole('button', { name: 'Nouveau niveau' }));
    const dialog = screen.getByRole('dialog', { name: 'Nouveau niveau ?' });

    expect(dialog).toHaveTextContent('Ma machine');
    expect(within(dialog).queryByLabelText('Nom du niveau')).toBeNull();

    await click(within(dialog).getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByRole('dialog', { name: 'Nouveau niveau ?' })).toBeNull();
    expect(draftIdInUrl()).toBe('creation-nommee');
  });
});
