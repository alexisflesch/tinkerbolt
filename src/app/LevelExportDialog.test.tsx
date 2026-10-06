// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createConstructionAttempt, type ConstructionAttempt } from '../application/construction';
import type { Command } from '../application/history';
import type {
  Preferences,
  PreferencesRepository,
} from '../application/preferences/preferences-repository';
import { sketchLevels as embeddedLevels } from '../../test/fixtures/sketch-campaign';
import type { LevelDocument } from '../domain/level-document';
import { decodeLevelFile } from '../infrastructure/level-file/level-file-codec';
import { decodeShareFragment } from '../infrastructure/level-share/level-share-codec';

import { renderStorageReady, storageAction } from './storage-test-fixture';
import { App } from './App';
import { LevelExportDialog } from './LevelExportDialog';
import { nameExportedLevel, prepareLevelExport } from './level-export';
import { PreferencesRepositoryContext } from './preferences-repository-context';

const levelFour = embeddedLevels.find(({ id }) => id === 'campaign-04-retour-a-l-expediteur');
if (levelFour === undefined) throw new Error('Niveau 4 embarqué introuvable.');
const levelOne = embeddedLevels.find(({ id }) => id === 'campaign-01-la-bille-de-service');
if (levelOne === undefined) throw new Error('Niveau 1 embarqué introuvable.');

/** Level 1 as its author would build it: the reference beam in place, marked to place. */
const { solution: ignoredSolution, ...levelOneWithoutSolution } = levelOne;
void ignoredSolution;

const levelOneWorkshop: LevelDocument = {
  ...levelOneWithoutSolution,
  objects: [
    ...levelOneWithoutSolution.objects,
    {
      id: 'placement-1',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 5, y: 2.15 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
      toPlace: true,
    },
  ],
};

const successfulExportRun = (document: LevelDocument): 'won' | 'lost' =>
  document.objects.length > levelOne.objects.length ? 'won' : 'lost';

/** The verified puzzle, named as the dialog proposes by default: after its title. */
const levelOnePuzzle = (name = 'La bille de service'): LevelDocument => {
  const preparation = prepareLevelExport(levelOneWorkshop, successfulExportRun);
  if (preparation.status !== 'ready') throw new Error('Le puzzle du niveau 1 est refusé.');
  const named = nameExportedLevel(preparation.puzzle, name);
  if (named === null) throw new Error('Nom d’export refusé.');
  return named.puzzle;
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

/** An in-memory `PreferencesRepository` that records what it is asked to keep. */
const memoryPreferences = (initial: Preferences = {}) => {
  let stored = initial;
  const saved: Preferences[] = [];
  const repository: PreferencesRepository = {
    patch: (changes) => {
      const { author: previousAuthor, ...rest } = stored;
      stored = {
        ...rest,
        ...(changes.author === undefined
          ? previousAuthor === undefined
            ? {}
            : { author: previousAuthor }
          : changes.author === null
            ? {}
            : { author: changes.author }),
        ...(changes.firstLevelHintDone === undefined ? {} : { firstLevelHintDone: true }),
        ...(changes.installInvitationDeclined === undefined
          ? {}
          : { installInvitationDeclined: true }),
      };
      saved.push(stored);
      return Promise.resolve({ status: 'ok', preferences: stored });
    },
    load: () => Promise.resolve({ status: 'ok', preferences: stored }),
    save: (preferences) => {
      saved.push(preferences);
      stored = preferences;
      return Promise.resolve({ status: 'ok' });
    },
  };
  return { repository, saved };
};

const renderDialog = async (
  document: LevelDocument,
  overrides: Partial<Parameters<typeof LevelExportDialog>[0]> = {},
  preferences: PreferencesRepository = memoryPreferences().repository,
) => {
  const onClose = vi.fn();
  const downloadFile = vi.fn<(fileName: string, mimeType: string, fileText: string) => void>();
  const writeClipboard = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
  await renderStorageReady(
    <PreferencesRepositoryContext value={preferences}>
      <LevelExportDialog
        document={document}
        run={successfulExportRun}
        onClose={onClose}
        origin="https://exemple.test"
        basePath="/"
        downloadFile={downloadFile}
        writeClipboard={writeClipboard}
        {...overrides}
      />
    </PreferencesRepositoryContext>,
  );
  return { onClose, downloadFile, writeClipboard };
};

const downloadedDocument = (
  downloadFile: Awaited<ReturnType<typeof renderDialog>>['downloadFile'],
): LevelDocument => {
  const fileText = downloadFile.mock.calls.at(-1)?.[2];
  const decoded = decodeLevelFile(String(fileText));
  if (decoded.status !== 'ok') throw new Error('Fichier exporté illisible.');
  return decoded.document;
};

const licenceNotice =
  'En partageant ce niveau, tu le places sous licence CC BY 4.0 : d’autres pourront le modifier et le republier en te citant.';

describe('boîte « Exporter » de l’atelier (U16, U22)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('explique qu’un niveau invalide ne peut pas être exporté, sans proposer d’export', async () => {
    await renderDialog({
      ...levelFour,
      inventory: levelFour.inventory.map((entry) => ({ ...entry, quantity: 0 })),
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Ce niveau ne peut pas encore être exporté',
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'La solution pose plus d’objets « inventory-short-beam » que l’inventaire n’en contient.',
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Télécharger le fichier' })).toBeNull();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Copier le lien de partage' })).toBeNull();
    });
  });

  it('télécharge le fichier du codec L22 et le confirme', async () => {
    const { downloadFile } = await renderDialog(levelOneWorkshop);

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );

    await waitFor(() => {
      expect(downloadFile).toHaveBeenCalledTimes(1);
    });
    const [fileName, mimeType, fileText] = downloadFile.mock.calls[0] ?? [];
    await waitFor(() => {
      expect(fileName).toBe('la-bille-de-service.json');
    });
    await waitFor(() => {
      expect(mimeType).toBe('application/json');
    });
    await waitFor(() => {
      expect(decodeLevelFile(String(fileText))).toEqual({
        status: 'ok',
        document: levelOnePuzzle(),
      });
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Fichier la-bille-de-service.json téléchargé.',
      );
    });
  });

  it('s’adresse au joueur au tutoiement (V7)', async () => {
    await renderDialog(levelOneWorkshop);

    await waitFor(() => {
      expect(screen.getByText('Puzzle vérifié : envoie le fichier ou le lien.')).toBeVisible();
    });
  });

  it('nomme le niveau avant de télécharger, et refuse un nom vide', async () => {
    const { downloadFile } = await renderDialog(levelOneWorkshop);
    const name = screen.getByRole('textbox', { name: 'Nom du niveau' });
    await waitFor(() => {
      expect(name).toHaveValue('La bille de service');
    });

    await storageAction(() => fireEvent.change(name, { target: { value: '   ' } }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Télécharger le fichier' })).toBeDisabled();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copier le lien de partage' })).toBeDisabled();
    });

    await storageAction(() => fireEvent.change(name, { target: { value: 'Ma machine' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );

    const [fileName, , fileText] = downloadFile.mock.calls[0] ?? [];
    await waitFor(() => {
      expect(fileName).toBe('ma-machine.json');
    });
    await waitFor(() => {
      expect(decodeLevelFile(String(fileText))).toEqual({
        status: 'ok',
        document: levelOnePuzzle('Ma machine'),
      });
    });
  });

  it('copie le lien de partage et affiche « Lien copié »', async () => {
    const { writeClipboard } = await renderDialog(levelOneWorkshop);

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Copier le lien de partage' })),
    );

    await waitFor(async () => {
      expect(await screen.findByText('Lien copié')).toBeVisible();
    });
    await waitFor(() => {
      expect(writeClipboard).toHaveBeenCalledTimes(1);
    });
    const link = String(writeClipboard.mock.calls[0]?.[0]);
    await waitFor(() => {
      expect(link.startsWith('https://exemple.test/shared#level=1.')).toBe(true);
    });
    await expect(decodeShareFragment(new URL(link).hash)).resolves.toEqual({
      status: 'ok',
      document: levelOnePuzzle(),
    });
  });

  it('affiche le lien sélectionnable quand le presse-papiers refuse la copie', async () => {
    await renderDialog(levelOneWorkshop, {
      writeClipboard: () => Promise.reject(new Error('refusé')),
    });

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Copier le lien de partage' })),
    );

    const field = await screen.findByRole('textbox', { name: 'Lien de partage' });
    await waitFor(() => {
      expect(field).toHaveAttribute('readonly');
    });
    await waitFor(() => {
      expect(field).toHaveDisplayValue(/^https:\/\/exemple\.test\/shared#level=1\./);
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Copie impossible : sélectionne le lien ci-dessous pour le copier.',
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('Lien copié')).toBeNull();
    });
  });

  it('se replie sur le lien affiché quand le presse-papiers est indisponible', async () => {
    // jsdom, like an insecure context, exposes no asynchronous clipboard.
    await waitFor(() => {
      expect('clipboard' in navigator).toBe(false);
    });
    await renderDialog(levelOneWorkshop, { writeClipboard: undefined });

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Copier le lien de partage' })),
    );

    await waitFor(async () => {
      expect(await screen.findByRole('textbox', { name: 'Lien de partage' })).toBeVisible();
    });
  });

  it('offre « Exporter » dans l’atelier seulement, et ne propose que « Machine » sans objet à placer', async () => {
    // Le niveau 2 est verrouillé sans progression (U5b) ; `unlockAllLevels`
    // ouvre son mode joueur directement pour ce test, qui ne porte pas sur le
    // déblocage mais sur la présence d’« Exporter » selon le mode.
    window.history.replaceState(null, '', '/levels/campaign-02-par-dessus-le-mur/play');
    const { unmount } = await renderStorageReady(<App unlockAllLevels />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Exporter le niveau' })).toBeNull();
    });
    unmount();

    window.history.replaceState(null, '', '/editor');
    await renderStorageReady(<App />);
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Exporter le niveau' })),
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Exporter le niveau' })).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Défi' })).toBeDisabled();
    });
    expect(screen.getByRole('radio', { name: 'Machine' })).toBeChecked();
    expect(screen.getByText(/Aucun objet n’est à placer/u)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Télécharger le fichier' })).toBeEnabled();
  });
});

describe('types « Défi » et « Machine » de la boîte d’export (ADR 0020)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const exportHelp =
    'Pour obtenir un défi : pose la balle rouge et le panier, marque des objets « À placer », puis vérifie que la balle atteint le panier.';

  it('propose les deux types quand le défi est vérifié, « Défi » choisi d’abord', async () => {
    await renderDialog(levelOneWorkshop);

    const challenge = screen.getByRole('radio', { name: 'Défi' });
    const machine = screen.getByRole('radio', { name: 'Machine' });
    expect(challenge).toBeEnabled();
    expect(challenge).toBeChecked();
    expect(machine).toBeEnabled();
    expect(machine).not.toBeChecked();
    expect(screen.getByRole('radiogroup', { name: 'Type de niveau' })).toBeVisible();
    expect(screen.queryByText(exportHelp)).toBeNull();
  });

  it('exporte la machine : plus d’objet à placer, objectif conservé, mêmes nom et licence', async () => {
    const { downloadFile } = await renderDialog(levelOneWorkshop);

    fireEvent.click(screen.getByRole('radio', { name: 'Machine' }));
    expect(screen.getByRole('radio', { name: 'Machine' })).toBeChecked();
    expect(screen.getByText(/se regarde/u)).toBeVisible();
    expect(screen.getByText(licenceNotice)).toBeVisible();
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );

    await waitFor(() => {
      expect(downloadFile).toHaveBeenCalledTimes(1);
    });
    const exported = downloadedDocument(downloadFile);
    expect(exported.inventory).toEqual([]);
    expect(exported.solution).toBeUndefined();
    expect(exported.objects.some(({ toPlace }) => toPlace === true)).toBe(false);
    expect(exported.objects).toHaveLength(levelOneWorkshop.objects.length);
    expect(exported.goal).toEqual(levelOneWorkshop.goal);
    expect(exported.metadata.title).toBe(levelOneWorkshop.metadata.title);
  });

  it('copie le lien de la machine, relisible par le codec de lien', async () => {
    const { writeClipboard } = await renderDialog(levelOneWorkshop);

    fireEvent.click(screen.getByRole('radio', { name: 'Machine' }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Copier le lien de partage' })),
    );

    await waitFor(() => {
      expect(writeClipboard).toHaveBeenCalledTimes(1);
    });
    const link = String(writeClipboard.mock.calls[0]?.[0]);
    const decoded = await decodeShareFragment(new URL(link).hash);
    if (decoded.status !== 'ok') throw new Error('Lien illisible.');
    expect(decoded.document.inventory).toEqual([]);
    expect(decoded.document.solution).toBeUndefined();
  });

  it('désactive « Défi » sans objet à placer, dit pourquoi et comment l’obtenir, et choisit « Machine »', async () => {
    const { downloadFile } = await renderDialog({
      ...levelOneWorkshop,
      objects: levelOneWorkshop.objects.filter(({ toPlace }) => toPlace !== true),
    });

    expect(screen.getByRole('radio', { name: 'Défi' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Machine' })).toBeChecked();
    expect(screen.getByText(/Aucun objet n’est à placer/u)).toBeVisible();
    expect(screen.getByText(exportHelp)).toBeVisible();
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );
    await waitFor(() => {
      expect(downloadFile).toHaveBeenCalledTimes(1);
    });
    expect(downloadedDocument(downloadFile).inventory).toEqual([]);
  });

  it('dit que l’objectif manque, avec une raison dédiée, et exporte la machine sans objectif', async () => {
    const { goal: ignoredGoal, ...withoutGoal } = levelOneWorkshop;
    void ignoredGoal;
    const { downloadFile } = await renderDialog({ ...withoutGoal, inventory: [] });

    expect(screen.getByRole('radio', { name: 'Défi' })).toBeDisabled();
    expect(screen.getByText(/L’objectif est incomplet/u)).toBeVisible();
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );
    await waitFor(() => {
      expect(downloadFile).toHaveBeenCalledTimes(1);
    });
    expect(downloadedDocument(downloadFile).goal).toBeUndefined();
  });
});

describe('titre, pseudo et licence dans la boîte d’export (M14, ADR 0016)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('propose un pseudo facultatif avec son aide, et rappelle la licence CC BY 4.0', async () => {
    await renderDialog(levelOneWorkshop);

    const pseudo = screen.getByRole('textbox', { name: 'Pseudo (facultatif)' });
    await waitFor(() => {
      expect(pseudo).toHaveValue('');
    });
    await waitFor(() => {
      expect(pseudo).toHaveAccessibleDescription('Un pseudo, pas ton vrai nom');
    });
    await waitFor(() => {
      expect(screen.getByText(licenceNotice)).toBeVisible();
    });
  });

  it('met le pseudo saisi, sans ses espaces de bord, dans le fichier et dans le lien', async () => {
    const { downloadFile, writeClipboard } = await renderDialog(levelOneWorkshop);

    await storageAction(() =>
      fireEvent.change(screen.getByRole('textbox', { name: 'Pseudo (facultatif)' }), {
        target: { value: '  Lili  ' },
      }),
    );
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );
    await waitFor(() => {
      expect(downloadedDocument(downloadFile).metadata.author).toBe('Lili');
    });

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Copier le lien de partage' })),
    );
    await waitFor(async () => {
      expect(await screen.findByText('Lien copié')).toBeVisible();
    });
    const link = new URL(String(writeClipboard.mock.calls[0]?.[0]));
    const decoded = await decodeShareFragment(link.hash);
    await waitFor(() => {
      expect(decoded.status === 'ok' && decoded.document.metadata.author).toBe('Lili');
    });
  });

  it('refuse un pseudo invalide avec un message, sans rien exporter', async () => {
    const { downloadFile } = await renderDialog(levelOneWorkshop);
    const pseudo = screen.getByRole('textbox', { name: 'Pseudo (facultatif)' });

    await storageAction(() => fireEvent.change(pseudo, { target: { value: 'Li\tli' } }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Le pseudo ne doit contenir ni saut de ligne ni caractère de contrôle.',
      );
    });
    await waitFor(() => {
      expect(pseudo).toHaveAttribute('aria-invalid', 'true');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Télécharger le fichier' })).toBeDisabled();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copier le lien de partage' })).toBeDisabled();
    });
    await waitFor(() => {
      expect(downloadFile).not.toHaveBeenCalled();
    });

    await storageAction(() => fireEvent.change(pseudo, { target: { value: 'Lili' } }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Télécharger le fichier' })).toBeEnabled();
    });
  });

  it('garde le pseudo du niveau plutôt que celui retenu, et un champ vidé retire l’auteur', async () => {
    const { downloadFile } = await renderDialog(
      { ...levelOneWorkshop, metadata: { ...levelOneWorkshop.metadata, author: 'Max' } },
      {},
      memoryPreferences({ author: 'Lili' }).repository,
    );
    const pseudo = screen.getByRole('textbox', { name: 'Pseudo (facultatif)' });
    await waitFor(() => {
      expect(pseudo).toHaveValue('Max');
    });

    await storageAction(() => fireEvent.change(pseudo, { target: { value: '   ' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );

    await waitFor(() => {
      expect(downloadedDocument(downloadFile).metadata).not.toHaveProperty('author');
    });
  });

  it('préremplit le dernier pseudo retenu quand le niveau n’a pas d’auteur, et retient celui exporté', async () => {
    const preferences = memoryPreferences({ author: 'Lili' });
    const { downloadFile } = await renderDialog(levelOneWorkshop, {}, preferences.repository);
    const pseudo = screen.getByRole('textbox', { name: 'Pseudo (facultatif)' });
    await waitFor(() => {
      expect(pseudo).toHaveValue('Lili');
    });

    await storageAction(() => fireEvent.change(pseudo, { target: { value: ' Noé ' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );
    await waitFor(() => {
      expect(downloadedDocument(downloadFile).metadata.author).toBe('Noé');
    });
    await waitFor(() => {
      expect(preferences.saved).toEqual([{ author: 'Noé' }]);
    });

    await storageAction(() => fireEvent.change(pseudo, { target: { value: '' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );
    await waitFor(() => {
      expect(preferences.saved).toEqual([{ author: 'Noé' }, {}]);
    });
  });

  it('retient le pseudo sans oublier que l’aide du niveau 1 est terminée (U8)', async () => {
    const preferences = memoryPreferences({ author: 'Lili', firstLevelHintDone: true });
    await renderDialog(levelOneWorkshop, {}, preferences.repository);
    const pseudo = screen.getByRole('textbox', { name: 'Pseudo (facultatif)' });

    await storageAction(() => fireEvent.change(pseudo, { target: { value: 'Noé' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );
    await storageAction(() => fireEvent.change(pseudo, { target: { value: '' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );

    await waitFor(() => {
      expect(preferences.saved).toEqual([
        { author: 'Noé', firstLevelHintDone: true },
        { firstLevelHintDone: true },
      ]);
    });
  });

  it('retient le pseudo sans oublier le refus de l’invitation d’installation (U10)', async () => {
    const preferences = memoryPreferences({
      firstLevelHintDone: true,
      installInvitationDeclined: true,
    });
    await renderDialog(levelOneWorkshop, {}, preferences.repository);
    const pseudo = screen.getByRole('textbox', { name: 'Pseudo (facultatif)' });

    await storageAction(() => fireEvent.change(pseudo, { target: { value: 'Noé' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );

    await waitFor(() => {
      expect(preferences.saved).toEqual([
        { author: 'Noé', firstLevelHintDone: true, installInvitationDeclined: true },
      ]);
    });
  });

  it.each<[string, PreferencesRepository]>([
    [
      'renvoie une erreur',
      {
        patch: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
        load: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
        save: () => Promise.resolve({ status: 'error', code: 'quota-exceeded' }),
      },
    ],
    [
      'lève une exception',
      {
        patch: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
        load: () => {
          return Promise.reject(new Error('stockage bloqué'));
        },
        save: () => {
          return Promise.reject(new Error('stockage bloqué'));
        },
      },
    ],
  ])('exporte quand le stockage des préférences %s', async (_description, preferences) => {
    const { downloadFile, writeClipboard } = await renderDialog(levelOneWorkshop, {}, preferences);
    const pseudo = screen.getByRole('textbox', { name: 'Pseudo (facultatif)' });
    await waitFor(() => {
      expect(pseudo).toHaveValue('');
    });

    await storageAction(() => fireEvent.change(pseudo, { target: { value: 'Lili' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );
    await waitFor(() => {
      expect(downloadedDocument(downloadFile).metadata.author).toBe('Lili');
    });

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Copier le lien de partage' })),
    );
    await waitFor(async () => {
      expect(await screen.findByText('Lien copié')).toBeVisible();
    });
    await waitFor(() => {
      expect(writeClipboard).toHaveBeenCalledTimes(1);
    });
  });

  it('applique à l’export le titre et le pseudo saisis par des commandes d’auteur', async () => {
    const applied: (readonly Command<ConstructionAttempt>[])[] = [];
    await renderDialog(levelOneWorkshop, {
      onApplyAttribution: (commands) => {
        applied.push(commands);
      },
    });

    await storageAction(() =>
      fireEvent.change(screen.getByRole('textbox', { name: 'Nom du niveau' }), {
        target: { value: '  Ma machine ' },
      }),
    );
    await storageAction(() =>
      fireEvent.change(screen.getByRole('textbox', { name: 'Pseudo (facultatif)' }), {
        target: { value: ' Lili ' },
      }),
    );
    await waitFor(() => {
      expect(applied).toEqual([]);
    });
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );

    await waitFor(() => {
      expect(applied).toHaveLength(1);
    });
    const document = (applied[0] ?? []).reduce<ConstructionAttempt>((attempt, command) => {
      const outcome = command.execute(attempt);
      if (outcome.status !== 'accepted') throw new Error(`refusé : ${outcome.reason}`);
      return outcome.state;
    }, createConstructionAttempt(levelOneWorkshop)).document;
    // The workshop keeps its identifier: only the exported puzzle is renamed.
    await waitFor(() => {
      expect(document).toEqual({
        ...levelOneWorkshop,
        metadata: { ...levelOneWorkshop.metadata, title: 'Ma machine', author: 'Lili' },
      });
    });
  });
});

describe('description dans la boîte d’export (M14b, ADR 0016)', () => {
  /** Level 1 as a remix: its own description, an author and a source to keep. */
  const attributedWorkshop: LevelDocument = {
    ...levelOneWorkshop,
    metadata: {
      ...levelOneWorkshop.metadata,
      description: 'Une rampe et un panier.',
      author: 'Max',
      basedOn: [{ title: 'Origine', author: 'Zoé' }],
    },
  };

  const descriptionField = (): HTMLElement =>
    screen.getByRole('textbox', { name: 'Description (facultatif)' });

  /** Runs the commands handed to `onApplyAttribution`, one by one, on the workshop. */
  const applyAll = (
    document: LevelDocument,
    commands: readonly Command<ConstructionAttempt>[],
  ): { readonly attempt: ConstructionAttempt; readonly changes: number } =>
    commands.reduce<{ readonly attempt: ConstructionAttempt; readonly changes: number }>(
      ({ attempt, changes }, command) => {
        const outcome = command.execute(attempt);
        if (outcome.status !== 'accepted') throw new Error(`refusé : ${outcome.reason}`);
        return {
          attempt: outcome.state,
          changes: changes + (outcome.state === attempt ? 0 : 1),
        };
      },
      { attempt: createConstructionAttempt(document), changes: 0 },
    );

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('propose une description facultative, préremplie avec celle du niveau', async () => {
    await renderDialog(attributedWorkshop);

    const description = descriptionField();
    await waitFor(() => {
      expect(description.tagName).toBe('TEXTAREA');
    });
    await waitFor(() => {
      expect(description).toHaveValue('Une rampe et un panier.');
    });
    await waitFor(() => {
      expect(description).toHaveAttribute('maxlength', '2000');
    });
  });

  it('met la description saisie, sans ses espaces de bord, dans le fichier et dans le lien', async () => {
    const { downloadFile, writeClipboard } = await renderDialog(attributedWorkshop);

    await storageAction(() =>
      fireEvent.change(descriptionField(), { target: { value: '  Fais rouler la bille.\n ' } }),
    );
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );
    await waitFor(() => {
      expect(downloadedDocument(downloadFile).metadata.description).toBe('Fais rouler la bille.');
    });

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Copier le lien de partage' })),
    );
    await waitFor(async () => {
      expect(await screen.findByText('Lien copié')).toBeVisible();
    });
    const decoded = await decodeShareFragment(
      new URL(String(writeClipboard.mock.calls[0]?.[0])).hash,
    );
    await waitFor(() => {
      expect(decoded.status === 'ok' && decoded.document.metadata.description).toBe(
        'Fais rouler la bille.',
      );
    });
  });

  it('retire la description vidée, en gardant titre, pseudo et sources', async () => {
    const { downloadFile } = await renderDialog(attributedWorkshop);

    await storageAction(() => fireEvent.change(descriptionField(), { target: { value: '   ' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );

    await waitFor(() => {
      expect(downloadedDocument(downloadFile).metadata).toEqual({
        title: 'La bille de service',
        author: 'Max',
        basedOn: [{ title: 'Origine', author: 'Zoé' }],
      });
    });
  });

  it('accepte une description de 2000 caractères', async () => {
    const { downloadFile } = await renderDialog(attributedWorkshop);
    const longest = 'a'.repeat(2000);

    await storageAction(() => fireEvent.change(descriptionField(), { target: { value: longest } }));
    const download = screen.getByRole('button', { name: 'Télécharger le fichier' });
    await waitFor(() => {
      expect(download).toBeEnabled();
    });
    await storageAction(() => fireEvent.click(download));

    await waitFor(() => {
      expect(downloadedDocument(downloadFile).metadata.description).toBe(longest);
    });
  });

  it('applique à l’export la description saisie par une commande d’auteur', async () => {
    const applied: (readonly Command<ConstructionAttempt>[])[] = [];
    await renderDialog(attributedWorkshop, {
      onApplyAttribution: (commands) => {
        applied.push(commands);
      },
    });

    await storageAction(() =>
      fireEvent.change(descriptionField(), { target: { value: ' Fais rouler la bille. ' } }),
    );
    await waitFor(() => {
      expect(applied).toEqual([]);
    });
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );

    await waitFor(() => {
      expect(applied).toHaveLength(1);
    });
    const { attempt, changes } = applyAll(attributedWorkshop, applied[0] ?? []);
    await waitFor(() => {
      expect(changes).toBe(1);
    });
    await waitFor(() => {
      expect(attempt.document.metadata).toEqual({
        ...attributedWorkshop.metadata,
        description: 'Fais rouler la bille.',
      });
    });
  });

  it('retire la description de la création par une commande quand le champ est vidé', async () => {
    const applied: (readonly Command<ConstructionAttempt>[])[] = [];
    await renderDialog(attributedWorkshop, {
      onApplyAttribution: (commands) => {
        applied.push(commands);
      },
    });

    await storageAction(() => fireEvent.change(descriptionField(), { target: { value: '' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );

    const { attempt, changes } = applyAll(attributedWorkshop, applied[0] ?? []);
    await waitFor(() => {
      expect(changes).toBe(1);
    });
    await waitFor(() => {
      expect(attempt.document.metadata).not.toHaveProperty('description');
    });
    await waitFor(() => {
      expect(attempt.document.metadata).toEqual({
        title: 'La bille de service',
        author: 'Max',
        basedOn: [{ title: 'Origine', author: 'Zoé' }],
      });
    });
  });

  it('ne change rien à la création quand titre, pseudo et description sont inchangés', async () => {
    const applied: (readonly Command<ConstructionAttempt>[])[] = [];
    await renderDialog(attributedWorkshop, {
      onApplyAttribution: (commands) => {
        applied.push(commands);
      },
    });

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' })),
    );

    await waitFor(() => {
      expect(applied[0]).toHaveLength(3);
    });
    await waitFor(() => {
      expect(applyAll(attributedWorkshop, applied[0] ?? []).changes).toBe(0);
    });
  });
});
