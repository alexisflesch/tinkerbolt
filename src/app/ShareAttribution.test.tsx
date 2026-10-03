// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DraftCreation, DraftRepository } from '../application/drafts/draft-repository';
import type { ReceivedLevel } from '../application/received/received-level-repository';
import { levelDocumentSchema, type LevelDocument } from '../domain/level-document';
import { decodeShareFragment } from '../infrastructure/level-share/level-share-codec';

import {
  testDraftRepository,
  testReceivedRepository,
  testPreferencesRepository,
  renderStorageReady,
  storageAction,
} from './storage-test-fixture';
import { App } from './App';

const locked = { move: false, rotate: false, remove: false } as const;

/** The U22 machine as a workshop: its short beam is « à placer » and the complete machine wins. */
const machine = (id: string, metadata: LevelDocument['metadata']): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 2,
    id,
    metadata,
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        props: {},
        transform: { position: { x: 2.3, y: 1.177 }, rotation: 0 },
        permissions: locked,
      },
      {
        id: 'slope',
        type: 'beam',
        props: { size: 'medium' },
        transform: { position: { x: 2.2, y: 1.6 }, rotation: 0.2617993877991494 },
        permissions: locked,
      },
      {
        id: 'basket-1',
        type: 'basket',
        props: {},
        transform: { position: { x: 6.9, y: 4.9 }, rotation: 0 },
        permissions: locked,
      },
      {
        id: 'placement-1',
        type: 'beam',
        props: { size: 'short' },
        transform: { position: { x: 5, y: 2.15 }, rotation: 0 },
        permissions: locked,
        toPlace: true,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [{ min: { x: 3.6, y: 1.7 }, max: { x: 7, y: 2.9 } }],
    scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  });

const draftStorage = (): DraftRepository =>
  testDraftRepository(() => new Date('2026-10-01T12:00:00Z'));

const saveCreation = async (document: LevelDocument, source?: LevelDocument): Promise<void> => {
  await waitFor(async () => {
    expect(
      (await draftStorage().save({ document, ...(source === undefined ? {} : { source }) })).status,
    ).toBe('ok');
  });
};

const storedCreation = async (id: string): Promise<DraftCreation> => {
  const loaded = await draftStorage().load(id);
  if (loaded.status !== 'ok' || loaded.creation === null) throw new Error('Création introuvable.');
  return loaded.creation;
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

const openAt = async (path: string): Promise<void> => {
  window.history.replaceState(null, '', path);
  await renderStorageReady(<App />);
};

const exportDialog = (): HTMLElement => screen.getByRole('dialog', { name: 'Exporter le niveau' });

/** jsdom has no clipboard: the dialog shows the link to copy by hand. */
const sharedDocument = async (dialog: HTMLElement): Promise<LevelDocument> => {
  await storageAction(() =>
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copier le lien de partage' })),
  );
  const field = await within(dialog).findByRole('textbox', { name: 'Lien de partage' });
  if (!(field instanceof HTMLTextAreaElement)) throw new Error('Lien introuvable.');
  const decoded = await decodeShareFragment(new URL(field.value).hash);
  if (decoded.status !== 'ok') throw new Error(`Lien illisible : ${decoded.status}`);
  return decoded.document;
};

const fillAttribution = async (
  dialog: HTMLElement,
  title: string,
  pseudo: string,
): Promise<void> => {
  await storageAction(() =>
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nom du niveau' }), {
      target: { value: title },
    }),
  );
  await storageAction(() =>
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Pseudo (facultatif)' }), {
      target: { value: pseudo },
    }),
  );
};

describe('partager : titre, pseudo et licence (M14)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(boardCanvasRect);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('enregistre dans la création, depuis l’atelier, le titre et le pseudo exportés, annulables', async () => {
    await saveCreation(machine('machine', { title: 'Machine' }));
    await openAt('/editor?draft=machine');

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Exporter le niveau' })),
    );
    await fillAttribution(exportDialog(), ' Grand saut ', ' Lili ');
    const shared = await sharedDocument(exportDialog());

    await waitFor(() => {
      expect(shared.metadata).toEqual({ title: 'Grand saut', author: 'Lili' });
    });
    await waitFor(async () => {
      expect((await storedCreation('machine')).document.metadata).toEqual({
        title: 'Grand saut',
        author: 'Lili',
      });
    });

    await storageAction(() =>
      fireEvent.click(within(exportDialog()).getByRole('button', { name: 'Fermer l’export' })),
    );
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));
    await waitFor(async () => {
      expect((await storedCreation('machine')).document.metadata).toEqual({
        title: 'Grand saut',
      });
    });
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));
    await waitFor(async () => {
      expect((await storedCreation('machine')).document.metadata).toEqual({
        title: 'Machine',
      });
    });
  });

  it('préremplit le pseudo de l’export suivant après rechargement', async () => {
    await saveCreation(machine('premiere', { title: 'Première' }));
    await saveCreation(machine('seconde', { title: 'Seconde' }));
    await openAt('/editor?draft=premiere');
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Exporter le niveau' })),
    );
    await fillAttribution(exportDialog(), 'Première', 'Lili');
    await sharedDocument(exportDialog());
    cleanup();

    await openAt('/editor?draft=seconde');
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Exporter le niveau' })),
    );

    await waitFor(() => {
      expect(
        within(exportDialog()).getByRole('textbox', { name: 'Pseudo (facultatif)' }),
      ).toHaveValue('Lili');
    });
    await waitFor(async () => {
      expect((await sharedDocument(exportDialog())).metadata.author).toBe('Lili');
    });
  });

  it('exporte et enregistre le pseudo depuis « Partager » d’une création de « Mes niveaux »', async () => {
    const source = machine('origine', { title: 'Origine', author: 'Max' });
    await saveCreation(
      machine('remix', {
        title: 'Origine (remix)',
        basedOn: [{ title: 'Origine', author: 'Max' }],
      }),
      source,
    );
    await openAt('/my-levels');

    const card = screen.getByRole('region', { name: 'Origine (remix)' });
    await storageAction(() =>
      fireEvent.click(within(card).getByRole('button', { name: 'Partager' })),
    );
    await waitFor(() => {
      expect(
        within(exportDialog()).getByRole('textbox', { name: 'Pseudo (facultatif)' }),
      ).toHaveValue('');
    });
    await fillAttribution(exportDialog(), 'Mon remix', 'Lili');
    const shared = await sharedDocument(exportDialog());

    const metadata = {
      title: 'Mon remix',
      author: 'Lili',
      basedOn: [{ title: 'Origine', author: 'Max' }],
    };
    await waitFor(() => {
      expect(shared.metadata).toEqual(metadata);
    });
    const stored = await storedCreation('remix');
    await waitFor(() => {
      expect(stored.document).toEqual(machine('remix', metadata));
    });
    await waitFor(() => {
      expect(stored.source).toEqual(source);
    });
    await waitFor(() => {
      expect(
        within(screen.getByRole('region', { name: 'Mes créations' })).getByRole('region', {
          name: 'Mon remix',
        }),
      ).toBeVisible();
    });
    await waitFor(async () => {
      expect(await testPreferencesRepository().load()).toEqual({
        status: 'ok',
        preferences: { author: 'Lili' },
      });
    });
  });

  it('enregistre dans la création, depuis l’atelier, la description exportée, annulable (M14b)', async () => {
    await saveCreation(machine('machine', { title: 'Machine', author: 'Max' }));
    await openAt('/editor?draft=machine');

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Exporter le niveau' })),
    );
    const description = within(exportDialog()).getByRole('textbox', {
      name: 'Description (facultatif)',
    });
    await waitFor(() => {
      expect(description).toHaveValue('');
    });
    await storageAction(() =>
      fireEvent.change(description, { target: { value: ' Une rampe, puis le panier. ' } }),
    );
    const shared = await sharedDocument(exportDialog());

    const metadata = { title: 'Machine', author: 'Max', description: 'Une rampe, puis le panier.' };
    await waitFor(() => {
      expect(shared.metadata).toEqual(metadata);
    });
    await waitFor(async () => {
      expect((await storedCreation('machine')).document.metadata).toEqual(metadata);
    });

    await storageAction(() =>
      fireEvent.click(within(exportDialog()).getByRole('button', { name: 'Fermer l’export' })),
    );
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Annuler' })));
    await waitFor(async () => {
      expect((await storedCreation('machine')).document.metadata).toEqual({
        title: 'Machine',
        author: 'Max',
      });
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();
    });
  });

  it('enregistre la description depuis « Partager » d’une création de « Mes niveaux » (M14b)', async () => {
    const source = machine('origine', {
      title: 'Origine',
      description: 'La description de Max.',
      author: 'Max',
    });
    await saveCreation(
      machine('remix', {
        title: 'Origine (remix)',
        description: 'La description de Max.',
        basedOn: [{ title: 'Origine', author: 'Max' }],
      }),
      source,
    );
    await openAt('/my-levels');

    await storageAction(() =>
      fireEvent.click(
        within(screen.getByRole('region', { name: 'Origine (remix)' })).getByRole('button', {
          name: 'Partager',
        }),
      ),
    );
    const description = within(exportDialog()).getByRole('textbox', {
      name: 'Description (facultatif)',
    });
    await waitFor(() => {
      expect(description).toHaveValue('La description de Max.');
    });
    await storageAction(() =>
      fireEvent.change(description, { target: { value: 'Ma version, plus rapide.' } }),
    );
    const shared = await sharedDocument(exportDialog());

    const metadata = {
      title: 'Origine (remix)',
      description: 'Ma version, plus rapide.',
      basedOn: [{ title: 'Origine', author: 'Max' }],
    };
    await waitFor(() => {
      expect(shared.metadata).toEqual(metadata);
    });
    const stored = await storedCreation('remix');
    await waitFor(() => {
      expect(stored.document).toEqual(machine('remix', metadata));
    });
    await waitFor(() => {
      expect(stored.source).toEqual(source);
    });
  });

  it('partage un niveau reçu tel quel, sans champ de titre ni de pseudo', async () => {
    const document = machine('recu', { title: 'Reçu', author: 'Max' });
    const level: ReceivedLevel = {
      id: `recu-${'5'.repeat(16)}`,
      document,
      origin: 'link',
      receivedAt: '2026-09-01T08:00:00.000Z',
      solved: false,
    };
    await waitFor(async () => {
      expect((await testReceivedRepository().save(level)).status).toBe('ok');
    });
    await openAt('/my-levels');

    const card = screen.getByRole('region', { name: 'Reçu' });
    await storageAction(() =>
      fireEvent.click(within(card).getByRole('button', { name: 'Partager' })),
    );

    const dialog = screen.getByRole('dialog', { name: 'Partager le niveau' });
    await waitFor(() => {
      expect(within(dialog).queryByRole('textbox', { name: 'Pseudo (facultatif)' })).toBeNull();
    });
    await waitFor(() => {
      expect(within(dialog).queryByRole('textbox', { name: 'Nom du niveau' })).toBeNull();
    });
    await waitFor(() => {
      expect(
        within(dialog).queryByRole('textbox', { name: 'Description (facultatif)' }),
      ).toBeNull();
    });
  });
});
