// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { campaignDraftId } from '../application/drafts/campaign-draft';
import type {
  DraftRepository,
  DraftCreationContent,
  DraftLoadResult,
  DraftWriteResult,
} from '../application/drafts/draft-repository';
import type {
  PreferencesRepository,
  PreferencesLoadResult,
  PreferencesPatchResult,
} from '../application/preferences/preferences-repository';
import type {
  ProgressRepository,
  ProgressLoadResult,
  ProgressSaveResult,
} from '../application/progression/progress-repository';
import type {
  ReceivedLevel,
  ReceivedLevelRepository,
  ReceivedLevelLoadResult,
} from '../application/received/received-level-repository';
import { embeddedLevels, embeddedWorkshopDocument } from '../content/embedded-levels';
import { App } from './App';
import { orderDraftWrite } from './draft-writes';
import { mergeCampaignProgressForTest } from './storage-test-fixture';

const source = embeddedLevels[0];
const levelTwo = embeddedLevels[1];
if (source === undefined || levelTwo === undefined)
  throw new Error('Campagne de test indisponible');
const receivedIdA = 'recu-aaaaaaaaaaaaaaaa';
const receivedIdB = 'recu-bbbbbbbbbbbbbbbb';
const savedAt = '2026-10-03T12:00:00.000Z';

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {
    throw new Error('Promesse non initialisée');
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const draftRepository = (overrides: Partial<DraftRepository> = {}): DraftRepository => ({
  list: () => Promise.resolve({ status: 'ok', ids: [] }),
  load: () => Promise.resolve({ status: 'ok', creation: null }),
  save: () => Promise.resolve({ status: 'ok' }),
  create: () => Promise.resolve({ status: 'ok' }),
  delete: () => Promise.resolve({ status: 'ok' }),
  ...overrides,
});
const receivedRepository = (
  overrides: Partial<ReceivedLevelRepository> = {},
): ReceivedLevelRepository => ({
  list: () => Promise.resolve({ status: 'ok', ids: [] }),
  load: () => Promise.resolve({ status: 'ok', level: null }),
  save: () => Promise.resolve({ status: 'ok' }),
  receive: (level) => Promise.resolve({ status: 'ok', level, isNew: true }),
  recordVictory: () => Promise.resolve({ status: 'ok', level: null }),
  delete: () => Promise.resolve({ status: 'ok' }),
  ...overrides,
});
const progressRepository = (overrides: Partial<ProgressRepository> = {}): ProgressRepository => {
  let progress = {};
  return {
    load: () => Promise.resolve({ status: 'ok', progress }),
    save: () => Promise.resolve({ status: 'ok' }),
    recordVictory: () => Promise.resolve({ status: 'ok', progress }),
    merge: (imported) => {
      progress = mergeCampaignProgressForTest(progress, imported);
      return Promise.resolve({ status: 'ok', progress });
    },
    clear: () => Promise.resolve({ status: 'ok' }),
    ...overrides,
  };
};
const preferencesRepository = (
  overrides: Partial<PreferencesRepository> = {},
): PreferencesRepository => ({
  load: () => Promise.resolve({ status: 'ok', preferences: {} }),
  save: () => Promise.resolve({ status: 'ok' }),
  patch: (changes) =>
    Promise.resolve({
      status: 'ok',
      preferences:
        changes.author === null || changes.author === undefined ? {} : { author: changes.author },
    }),
  ...overrides,
});

const mount = (
  overrides: {
    drafts?: DraftRepository;
    received?: ReceivedLevelRepository;
    progress?: ProgressRepository;
    preferences?: PreferencesRepository;
  } = {},
) =>
  render(
    <App
      draftRepository={overrides.drafts ?? draftRepository()}
      receivedLevelRepository={overrides.received ?? receivedRepository()}
      progressRepository={overrides.progress ?? progressRepository()}
      preferencesRepository={overrides.preferences ?? preferencesRepository()}
    />,
  );

const received = (id: string, title: string): ReceivedLevel => ({
  id,
  document: { ...source, metadata: { ...source.metadata, title } },
  origin: 'file',
  receivedAt: savedAt,
  solved: false,
});
const pseudoField = (): HTMLInputElement => screen.getByRole('textbox', { name: 'Pseudo retenu' });
const solvedFirst = { [source.id]: { resolved: true, bestObjectCount: 2 } } as const;
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
  if (originX === undefined || originY === undefined || !(zoom > 0))
    throw new Error('Caméra invalide');
  for (const type of ['pointerdown', 'pointerup'] as const) {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, {
      pointerId: { value: 1 },
      pointerType: { value: 'touch' },
      clientX: { value: (x - originX) * zoom },
      clientY: { value: (y - originY) * zoom },
    });
    fireEvent(board, event);
  }
};
const placeBall = (x: number, y: number): void => {
  const toggle = screen.queryByRole('button', { name: 'Ouvrir le catalogue' });
  if (toggle !== null) fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: /^Balle$/u }));
  tapWorldPoint(x, y);
};

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('C2a — écrans et stockage asynchrone', () => {
  it('attend le brouillon avant de décider qu’il est introuvable et conserve sa source après lecture', async () => {
    const pending = deferred<DraftLoadResult>();
    const load = vi.fn(() => pending.promise);
    const save = vi.fn((creation: DraftCreationContent) => {
      void creation;
      return Promise.resolve({ status: 'ok' as const });
    });
    window.history.replaceState(null, '', '/editor?draft=creation-1');
    mount({ drafts: draftRepository({ load, save }) });
    expect(screen.getByRole('status')).toHaveTextContent(/Chargement/i);
    expect(screen.queryByText('Brouillon introuvable')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Plateau de jeu' })).toBeNull();
    await act(async () => {
      pending.resolve({
        status: 'ok',
        creation: {
          document: {
            ...embeddedWorkshopDocument,
            id: 'creation-1',
            metadata: { ...embeddedWorkshopDocument.metadata, title: 'Mon essai' },
          },
          source,
          updatedAt: savedAt,
        },
      });
      await pending.promise;
    });
    expect(await screen.findByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    expect(screen.getByText('Mon essai', { selector: '.toolbar-title' })).toBeVisible();
    expect(load).toHaveBeenCalledWith('creation-1');
    placeBall(8, 3);
    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });
    expect(save.mock.calls[0]?.[0]?.source).toEqual(source);
  });

  it('attend le reçu et ignore une ancienne réponse après navigation vers un autre id', async () => {
    const first = deferred<ReceivedLevelLoadResult>();
    const second = deferred<ReceivedLevelLoadResult>();
    const load = vi.fn((id: string) => (id === receivedIdA ? first.promise : second.promise));
    window.history.replaceState(null, '', `/my-levels/${receivedIdA}/play`);
    mount({ received: receivedRepository({ load }) });
    expect(screen.getByRole('status')).toHaveTextContent(/Chargement/i);
    expect(screen.queryByText('Niveau introuvable')).toBeNull();
    act(() => {
      window.history.pushState(null, '', `/my-levels/${receivedIdB}/play`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await act(async () => {
      second.resolve({ status: 'ok', level: received(receivedIdB, 'Deuxième reçu') });
      await second.promise;
    });
    expect(await screen.findByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    expect(screen.getByText(/Deuxième reçu/u, { selector: '.toolbar-title' })).toBeVisible();
    await act(async () => {
      first.resolve({ status: 'ok', level: received(receivedIdA, 'Ancien reçu') });
      await first.promise;
    });
    expect(screen.getByText(/Deuxième reçu/u, { selector: '.toolbar-title' })).toBeVisible();
    expect(screen.queryByText('Ancien reçu')).toBeNull();
  });

  it('attend la progression avant la décision de verrou du niveau 2', async () => {
    const pending = deferred<ProgressLoadResult>();
    window.history.replaceState(null, '', `/levels/${levelTwo.id}/play`);
    mount({ progress: progressRepository({ load: () => pending.promise }) });
    expect(screen.getByRole('status')).toHaveTextContent(/Chargement/i);
    expect(screen.queryByRole('region', { name: 'Plateau de jeu' })).toBeNull();
    expect(screen.queryByText(/Niveau verrouillé/i)).toBeNull();
    await act(async () => {
      pending.resolve({ status: 'ok', progress: solvedFirst });
      await pending.promise;
    });
    expect(await screen.findByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    expect(
      screen.getByText(`Niveau 2 · ${levelTwo.metadata.title}`, { selector: '.toolbar-title' }),
    ).toBeVisible();
  });

  it('attend la progression avant de présenter un brouillon de campagne dans Mes niveaux', async () => {
    const pending = deferred<ProgressLoadResult>();
    const id = campaignDraftId(levelTwo);
    window.history.replaceState(null, '', '/my-levels');
    mount({
      progress: progressRepository({ load: () => pending.promise }),
      drafts: draftRepository({
        list: () => Promise.resolve({ status: 'ok', ids: [id] }),
        load: () =>
          Promise.resolve({
            status: 'ok',
            creation: {
              document: {
                ...embeddedWorkshopDocument,
                id,
                metadata: { ...embeddedWorkshopDocument.metadata, title: 'Brouillon de campagne' },
              },
              source: levelTwo,
              updatedAt: savedAt,
            },
          }),
      }),
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent(/Chargement des créations/i);
    expect(screen.queryByText('Brouillon de campagne')).toBeNull();
    await act(async () => {
      pending.resolve({ status: 'ok', progress: solvedFirst });
      await pending.promise;
    });
    expect(await screen.findByText('Brouillon de campagne')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeEnabled();
  });

  it('attend une création engagée avant de présenter Mes niveaux après un Retour navigateur', async () => {
    const pendingSave = deferred<undefined>();
    const document = {
      ...embeddedWorkshopDocument,
      id: 'creation-retour',
      metadata: { ...embeddedWorkshopDocument.metadata, title: 'Création retrouvée' },
    };
    let saved = false;
    const drafts = draftRepository({
      list: () => Promise.resolve({ status: 'ok', ids: saved ? [document.id] : [] }),
      load: () =>
        Promise.resolve({
          status: 'ok',
          creation: saved ? { document, updatedAt: savedAt } : null,
        }),
      save: async () => {
        await pendingSave.promise;
        saved = true;
        return { status: 'ok' };
      },
    });
    const committedWrite = orderDraftWrite(drafts, document.id, () => drafts.save({ document }));

    // Returning with browser history mounts this route without calling the board's beforeLeave.
    window.history.replaceState(null, '', '/my-levels');
    mount({ drafts });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('Chargement des créations…')).toBeVisible();
    expect(screen.queryByText(/Tu n’as encore aucune création/u)).toBeNull();

    await act(async () => {
      pendingSave.resolve(undefined);
      await committedWrite;
    });
    expect(await screen.findByText('Création retrouvée')).toBeVisible();
  });

  it('avertit d’une lecture de progression impossible mais laisse jouer le niveau 1 en mémoire', async () => {
    window.history.replaceState(null, '', `/levels/${source.id}/play`);
    mount({
      progress: progressRepository({
        load: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
      }),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/stockage|enregistr/i);
    expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
  });

  it('attend les préférences avant de rendre le pseudo modifiable', async () => {
    const pending = deferred<PreferencesLoadResult>();
    window.history.replaceState(null, '', '/settings');
    mount({ preferences: preferencesRepository({ load: () => pending.promise }) });
    expect(screen.getByRole('status')).toHaveTextContent(/Chargement/i);
    expect(screen.queryByRole('textbox', { name: 'Pseudo retenu' })).toBeNull();
    await act(async () => {
      pending.resolve({ status: 'ok', preferences: { author: 'Lili', firstLevelHintDone: true } });
      await pending.promise;
    });
    expect(await screen.findByRole('textbox', { name: 'Pseudo retenu' })).toHaveValue('Lili');
  });

  it('confirme le pseudo seulement après patch réussi et signale le quota sans effacer la saisie', async () => {
    const first = deferred<PreferencesPatchResult>();
    const patch = vi.fn(() => first.promise);
    window.history.replaceState(null, '', '/settings');
    mount({
      preferences: preferencesRepository({
        load: () =>
          Promise.resolve({
            status: 'ok',
            preferences: { author: 'Lili', firstLevelHintDone: true },
          }),
        patch,
      }),
    });
    expect(await screen.findByRole('textbox', { name: 'Pseudo retenu' })).toHaveValue('Lili');
    fireEvent.change(pseudoField(), { target: { value: 'Noé' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le pseudo' }));
    expect(screen.queryByText('Pseudo enregistré.')).toBeNull();
    await act(async () => {
      first.resolve({ status: 'error', code: 'quota-exceeded' });
      await first.promise;
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/plein|enregistr/i);
    expect(pseudoField()).toHaveValue('Noé');
    expect(patch).toHaveBeenCalledWith({ author: 'Noé' });
    expect(screen.queryByText('Pseudo enregistré.')).toBeNull();
  });

  it('attend le résultat du reset, garde la progression sur quota et explique le périmètre de confirmation', async () => {
    const pending = deferred<ProgressSaveResult>();
    window.history.replaceState(null, '', '/settings');
    mount({
      progress: progressRepository({
        load: () => Promise.resolve({ status: 'ok', progress: solvedFirst }),
        clear: () => pending.promise,
      }),
    });
    expect(await screen.findByText('Niveaux résolus : 1 sur 7.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Remettre la progression à zéro' }));
    const dialog = screen.getByRole('dialog', { name: 'Remettre la progression à zéro ?' });
    expect(dialog).toHaveTextContent(/constructions/i);
    expect(dialog).toHaveTextContent(/solutions/i);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remettre à zéro' }));
    expect(screen.queryByText(/Progression remise à zéro :/i)).toBeNull();
    expect(screen.getByText('Niveaux résolus : 1 sur 7.')).toBeVisible();
    await act(async () => {
      pending.resolve({ status: 'error', code: 'quota-exceeded' });
      await pending.promise;
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/n’a pas été effacée/i);
    expect(screen.getByText('Niveaux résolus : 1 sur 7.')).toBeVisible();
  });

  it('attend l’insertion libre, sérialise le commit suivant et récupère après un échec de sauvegarde', async () => {
    const pending = deferred<DraftWriteResult>();
    const create = vi.fn((creation: DraftCreationContent) => {
      void creation;
      return pending.promise;
    });
    let saveCount = 0;
    const save = vi.fn((creation: DraftCreationContent) => {
      void creation;
      saveCount += 1;
      return Promise.resolve(
        saveCount === 1
          ? ({ status: 'error', code: 'quota-exceeded' } as const)
          : ({ status: 'ok' } as const),
      );
    });
    window.history.replaceState(null, '', '/editor?new');
    mount({ drafts: draftRepository({ create, save }) });
    placeBall(8, 3);
    expect(create).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('?new');
    placeBall(10, 3);
    expect(create).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe('?new');
    await act(async () => {
      pending.resolve({ status: 'ok' });
      await pending.promise;
    });
    await waitFor(() => {
      expect(window.location.search).toMatch(/^\?draft=creation-/u);
    });
    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });
    const firstCreated = create.mock.calls[0]?.[0];
    const firstSaved = save.mock.calls[0]?.[0];
    expect(firstCreated?.document.objects).toHaveLength(
      embeddedWorkshopDocument.objects.length + 1,
    );
    expect(firstSaved?.document.objects).toHaveLength(embeddedWorkshopDocument.objects.length + 2);
    expect(await screen.findByRole('status')).toHaveTextContent(/non enregistr/i);
    placeBall(12, 3);
    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(2);
    });
    const lastSaved = save.mock.calls[1]?.[0];
    expect(lastSaved?.document.objects).toHaveLength(embeddedWorkshopDocument.objects.length + 3);
    expect(new URLSearchParams(window.location.search).get('draft')).toBe(lastSaved?.document.id);
    await waitFor(() => {
      expect(screen.queryByText(/non enregistr/i)).toBeNull();
    });
  });
});
