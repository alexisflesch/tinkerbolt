// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { creationFromLevel } from '../application/drafts/creation-from-level';
import type { ReceivedLevel } from '../application/received/received-level-repository';
import { embeddedLevels } from '../content/embedded-levels';
import { levelDocumentSchema, type LevelDocument } from '../domain/level-document';
import {
  encodeLevelFile,
  MAX_LEVEL_FILE_SIZE_BYTES,
} from '../infrastructure/level-file/level-file-codec';
import { levelFingerprint } from '../infrastructure/level-file/level-fingerprint';
import { decodeShareFragment } from '../infrastructure/level-share/level-share-codec';

import {
  testDraftRepository,
  testReceivedRepository,
  renderStorageReady,
  storageAction,
} from './storage-test-fixture';
import { App } from './App';

const locked = { move: false, rotate: false, remove: false } as const;

/** A small puzzle level: nothing in it is « à placer », so it can be received. */
const puzzle = (id: string, metadata: LevelDocument['metadata']): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id,
    metadata,
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        props: {},
        transform: { position: { x: 1, y: 1 }, rotation: 0 },
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

/** A workshop: its beam is « à placer », so « Jouer » has a puzzle to open. */
const workshop = (id: string, title: string): LevelDocument =>
  levelDocumentSchema.parse({
    ...puzzle(id, { title }),
    objects: [
      ...puzzle(id, { title }).objects,
      {
        id: 'beam-1',
        type: 'beam',
        props: { size: 'medium' },
        transform: { position: { x: 4, y: 3 }, rotation: 0 },
        permissions: locked,
        toPlace: true,
      },
    ],
  });

const clockAt = (instant: string) => (): Date => new Date(instant);

const saveCreation = async (
  document: LevelDocument,
  updatedAt: string,
  source?: LevelDocument,
): Promise<void> => {
  const drafts = testDraftRepository(clockAt(updatedAt));
  await waitFor(async () => {
    expect(
      (await drafts.save({ document, ...(source === undefined ? {} : { source }) })).status,
    ).toBe('ok');
  });
};

const saveReceived = async (level: ReceivedLevel): Promise<void> => {
  await waitFor(async () => {
    expect((await testReceivedRepository().save(level)).status).toBe('ok');
  });
};

const receivedLevel = (
  document: LevelDocument,
  fingerprint: string,
  receivedAt: string,
  extra: Partial<ReceivedLevel> = {},
): ReceivedLevel => ({
  id: `recu-${fingerprint}`,
  document,
  origin: 'link',
  receivedAt,
  solved: false,
  ...extra,
});

const openMyLevels = async (): Promise<void> => {
  window.history.replaceState(null, '', '/my-levels');
  await renderStorageReady(<App />);
};

const section = (name: 'Mes créations' | 'Niveaux reçus'): HTMLElement =>
  screen.getByRole('region', { name });

const cardTitles = (name: 'Mes créations' | 'Niveaux reçus'): string[] =>
  within(section(name))
    .queryAllByRole('region')
    .map((card) => card.getAttribute('aria-label') ?? '');

const card = (title: string): HTMLElement => screen.getByRole('region', { name: title });

const chooseFile = async (name: string, contents: string): Promise<void> => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('Sélecteur de fichier introuvable.');
  const file = new File([contents], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) });
  await storageAction(() => fireEvent.change(input, { target: { files: [file] } }));
};

const storedDraftIds = async (): Promise<readonly string[]> => {
  const list = await testDraftRepository(() => new Date()).list();
  return list.status === 'ok' ? list.ids : [];
};

const storedReceivedIds = async (): Promise<readonly string[]> => {
  const list = await testReceivedRepository().list();
  return list.status === 'ok' ? list.ids : [];
};

const campaignLevel = (index: number): LevelDocument => {
  const level = embeddedLevels[index];
  if (level === undefined) throw new Error('Niveau de campagne introuvable.');
  return level;
};

describe('page « Mes niveaux » (M9, ADR 0015 § Page « Mes niveaux »)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('s’ouvre depuis le menu et l’accueil, avec deux sections vides et leurs invites', async () => {
    await renderStorageReady(<App />);
    const destinations = screen.getByRole('navigation', { name: 'Explorer TinkerBolt' });
    await waitFor(() => {
      expect(within(destinations).getByRole('link', { name: /Mes niveaux/u })).toHaveAttribute(
        'href',
        '/my-levels',
      );
    });

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' })),
    );
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Importer un fichier JSON' })).toBeNull();
    });
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Mes niveaux' })));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/my-levels');
    });
    await waitFor(() => {
      expect(within(section('Mes créations')).getByText(/aucune création/u)).toBeVisible();
    });
    await waitFor(() => {
      expect(within(section('Niveaux reçus')).getByText(/aucun niveau reçu/u)).toBeVisible();
    });
    await waitFor(() => {
      expect(within(section('Mes créations')).getByText('0')).toBeVisible();
    });
    await waitFor(() => {
      expect(within(section('Niveaux reçus')).getByText('0')).toBeVisible();
    });
  });

  it('met « Importer » et « Nouveau niveau » dans le bandeau du haut, pas dans les sections (V6)', async () => {
    await openMyLevels();

    const banner = screen.getByRole('banner');
    await waitFor(() => {
      expect(within(banner).getByRole('button', { name: 'Importer' })).toBeVisible();
    });
    await waitFor(() => {
      expect(within(banner).getByRole('button', { name: 'Nouveau niveau' })).toBeVisible();
    });
    await waitFor(() => {
      expect(within(section('Mes créations')).queryByRole('button')).toBeNull();
    });
    await waitFor(() => {
      expect(within(section('Niveaux reçus')).queryByRole('button')).toBeNull();
    });
  });

  it('ouvre le sélecteur de fichier avec « Importer »', async () => {
    await openMyLevels();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('Sélecteur de fichier introuvable.');
    const open = vi.spyOn(input, 'click').mockImplementation(() => undefined);

    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Importer' })));

    await waitFor(() => {
      expect(open).toHaveBeenCalledTimes(1);
    });
  });

  it('compte les niveaux de chaque section dans son en-tête (V6)', async () => {
    await saveCreation(workshop('creation-a', 'A'), '2026-09-01T08:00:00.000Z');
    await saveCreation(workshop('creation-b', 'B'), '2026-09-02T08:00:00.000Z');
    await saveReceived(
      receivedLevel(
        puzzle('recu-a', { title: 'Reçu' }),
        'a'.repeat(16),
        '2026-09-25T08:00:00.000Z',
      ),
    );

    await openMyLevels();

    await waitFor(() => {
      expect(within(section('Mes créations')).getByText('2')).toBeVisible();
    });
    await waitFor(() => {
      expect(within(section('Niveaux reçus')).getByText('1')).toBeVisible();
    });
  });

  it('redirige `/import` vers `/my-levels`', async () => {
    window.history.replaceState(null, '', '/import');
    await renderStorageReady(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/my-levels');
    });
    await waitFor(() => {
      expect(section('Niveaux reçus')).toBeVisible();
    });
  });

  it('liste les créations et les niveaux reçus du plus récent au plus ancien', async () => {
    await saveCreation(
      workshop('creation-ancienne', 'Création ancienne'),
      '2026-09-01T08:00:00.000Z',
    );
    await saveCreation(
      workshop('creation-recente', 'Création récente'),
      '2026-09-20T08:00:00.000Z',
    );
    await saveCreation(
      workshop('creation-moyenne', 'Création moyenne'),
      '2026-09-10T08:00:00.000Z',
    );
    await saveReceived(
      receivedLevel(
        puzzle('recu-a', { title: 'Reçu récent' }),
        'a'.repeat(16),
        '2026-09-25T08:00:00.000Z',
      ),
    );
    await saveReceived(
      receivedLevel(
        puzzle('recu-b', { title: 'Reçu ancien' }),
        'b'.repeat(16),
        '2026-09-02T08:00:00.000Z',
      ),
    );

    await openMyLevels();

    await waitFor(() => {
      expect(cardTitles('Mes créations')).toEqual([
        'Création récente',
        'Création moyenne',
        'Création ancienne',
      ]);
    });
    await waitFor(() => {
      expect(cardTitles('Niveaux reçus')).toEqual(['Reçu récent', 'Reçu ancien']);
    });
  });

  it('date chaque création de sa dernière modification, l’année seulement si elle diffère (V6)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 2, 12, 0));
    try {
      await saveCreation(
        workshop('creation-recente', 'Récente'),
        new Date(2026, 8, 20, 10).toISOString(),
      );
      await saveCreation(
        workshop('creation-ancienne', 'Ancienne'),
        new Date(2025, 2, 4, 10).toISOString(),
      );
      await saveReceived(
        receivedLevel(puzzle('recu-a', { title: 'Reçu' }), 'a'.repeat(16), '2026-09-25T08:00:00Z'),
      );

      await openMyLevels();

      await waitFor(() => {
        expect(within(card('Récente')).getByText('Modifié le 20 septembre')).toBeVisible();
      });
      await waitFor(() => {
        expect(within(card('Ancienne')).getByText('Modifié le 4 mars 2025')).toBeVisible();
      });
      await waitFor(() => {
        expect(within(card('Reçu')).queryByText(/^Modifié le/u)).toBeNull();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('montre l’état, l’auteur et la première source d’un niveau reçu, en texte brut', async () => {
    await saveReceived(
      receivedLevel(
        puzzle('recu-resolu', {
          title: '<b>Le saut</b>',
          author: '<i>Lili</i>',
          basedOn: [
            { title: 'La chute', author: 'Max' },
            { title: 'Plus ancien', author: 'Zoé' },
          ],
        }),
        'c'.repeat(16),
        '2026-09-25T08:00:00.000Z',
        {
          solved: true,
          bestObjectCount: 2,
          playerSolution: { placements: [] },
        },
      ),
    );
    await saveReceived(
      receivedLevel(
        puzzle('recu-neuf', { title: 'Pas encore' }),
        'd'.repeat(16),
        '2026-09-01T08:00:00.000Z',
      ),
    );

    await openMyLevels();

    const solved = card('<b>Le saut</b>');
    await waitFor(() => {
      expect(within(solved).getByText('par <i>Lili</i>')).toBeVisible();
    });
    await waitFor(() => {
      expect(within(solved).getByText('d’après La chute (par Max)')).toBeVisible();
    });
    await waitFor(() => {
      expect(within(solved).queryByText(/Plus ancien/u)).toBeNull();
    });
    // V6: the record is part of the tier badge laid over the preview (V4 mock-up).
    await waitFor(() => {
      expect(within(solved).getByText('Résolu · 2 objets')).toBeVisible();
    });
    await waitFor(() => {
      expect(solved.querySelector('b, i')).toBeNull();
    });
    await waitFor(() => {
      expect(within(card('Pas encore')).getByText('Pas encore résolu')).toBeVisible();
    });
    // V6: no badge for an unsolved level; the state stays for screen readers.
    await waitFor(() => {
      expect(card('Pas encore').querySelector('.level-card-tier')).toBeNull();
    });
    await waitFor(() => {
      expect(within(card('Pas encore')).queryByText(/^par /u)).toBeNull();
    });
  });

  it('montre la description d’un niveau reçu en texte brut, et rien sans description (M14b)', async () => {
    await saveReceived(
      receivedLevel(
        puzzle('recu-decrit', { title: 'Décrit', description: 'Pousse <b>x</b> dans le panier.' }),
        'e'.repeat(16),
        '2026-09-25T08:00:00.000Z',
      ),
    );
    await saveReceived(
      receivedLevel(
        puzzle('recu-muet', { title: 'Muet' }),
        'f'.repeat(16),
        '2026-09-01T08:00:00.000Z',
      ),
    );

    await openMyLevels();

    const described = card('Décrit');
    const description = within(described).getByText('Pousse <b>x</b> dans le panier.');
    await waitFor(() => {
      expect(description).toBeVisible();
    });
    await waitFor(() => {
      expect(description).toHaveClass('level-card-description');
    });
    await waitFor(() => {
      expect(described.querySelector('b')).toBeNull();
    });
    await waitFor(() => {
      expect(card('Muet').querySelector('.level-card-description')).toBeNull();
    });
  });

  it('supprime une création après confirmation, et l’annulation ne supprime rien', async () => {
    await saveCreation(workshop('creation-a-garder', 'À garder'), '2026-09-01T08:00:00.000Z');
    await openMyLevels();

    await storageAction(() =>
      fireEvent.click(within(card('À garder')).getByRole('button', { name: 'Supprimer' })),
    );
    const dialog = screen.getByRole('dialog', { name: 'Confirmer la suppression' });
    await waitFor(() => {
      expect(within(dialog).getByText(/« À garder »/u)).toBeVisible();
    });
    await storageAction(() =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' })),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(cardTitles('Mes créations')).toEqual(['À garder']);
    });
    await waitFor(async () => {
      expect(await storedDraftIds()).toEqual(['creation-a-garder']);
    });

    await storageAction(() =>
      fireEvent.click(within(card('À garder')).getByRole('button', { name: 'Supprimer' })),
    );
    await storageAction(() =>
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Confirmer la suppression' })).getByRole(
          'button',
          {
            name: 'Supprimer',
          },
        ),
      ),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(cardTitles('Mes créations')).toEqual([]);
    });
    await waitFor(async () => {
      expect(await storedDraftIds()).toEqual([]);
    });
  });

  it('supprime un niveau reçu après confirmation, et l’annulation ne supprime rien', async () => {
    const id = `recu-${'e'.repeat(16)}`;
    await saveReceived(
      receivedLevel(
        puzzle('recu-sup', { title: 'À effacer' }),
        'e'.repeat(16),
        '2026-09-01T08:00:00.000Z',
      ),
    );
    await openMyLevels();

    await storageAction(() =>
      fireEvent.click(within(card('À effacer')).getByRole('button', { name: 'Supprimer' })),
    );
    await storageAction(() =>
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Confirmer la suppression' })).getByRole(
          'button',
          {
            name: 'Annuler',
          },
        ),
      ),
    );
    await waitFor(async () => {
      expect(await storedReceivedIds()).toEqual([id]);
    });

    await storageAction(() =>
      fireEvent.click(within(card('À effacer')).getByRole('button', { name: 'Supprimer' })),
    );
    await storageAction(() =>
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Confirmer la suppression' })).getByRole(
          'button',
          {
            name: 'Supprimer',
          },
        ),
      ),
    );

    await waitFor(() => {
      expect(cardTitles('Niveaux reçus')).toEqual([]);
    });
    await waitFor(async () => {
      expect(await storedReceivedIds()).toEqual([]);
    });
  });

  it('importe un fichier valide comme niveau reçu, en tête de liste, sans quitter la page', async () => {
    await saveReceived(
      receivedLevel(
        puzzle('recu-avant', { title: 'Reçu avant' }),
        'f'.repeat(16),
        '2026-01-01T08:00:00.000Z',
      ),
    );
    const imported = puzzle('mon-puzzle', { title: 'Mon puzzle', author: 'Lili' });
    await openMyLevels();

    await chooseFile('mon-puzzle.json', encodeLevelFile(imported));

    await waitFor(async () => {
      expect(await screen.findByText('« Mon puzzle » est dans tes niveaux reçus.')).toHaveAttribute(
        'role',
        'status',
      );
    });
    await waitFor(() => {
      expect(window.location.pathname).toBe('/my-levels');
    });
    await waitFor(() => {
      expect(cardTitles('Niveaux reçus')).toEqual(['Mon puzzle', 'Reçu avant']);
    });
    const id = `recu-${await levelFingerprint(imported)}`;
    const stored = await testReceivedRepository().load(id);
    await waitFor(() => {
      expect(stored.status === 'ok' && stored.level).toMatchObject({
        id,
        document: imported,
        origin: 'file',
        solved: false,
      });
    });
  });

  it('remet en tête un niveau déjà reçu qu’on importe à nouveau', async () => {
    const again = puzzle('deja-recu', { title: 'Déjà reçu' });
    const fingerprint = await levelFingerprint(again);
    await saveReceived(receivedLevel(again, fingerprint, '2026-01-01T08:00:00.000Z'));
    await saveReceived(
      receivedLevel(
        puzzle('recu-recent', { title: 'Plus récent' }),
        '1'.repeat(16),
        '2026-02-01T08:00:00.000Z',
      ),
    );
    await openMyLevels();
    await waitFor(() => {
      expect(cardTitles('Niveaux reçus')).toEqual(['Plus récent', 'Déjà reçu']);
    });

    await chooseFile('deja-recu.json', encodeLevelFile(again));

    await waitFor(async () => {
      expect(await screen.findByText('« Déjà reçu » est dans tes niveaux reçus.')).toBeVisible();
    });
    await waitFor(() => {
      expect(cardTitles('Niveaux reçus')).toEqual(['Déjà reçu', 'Plus récent']);
    });
    await waitFor(async () => {
      expect(await storedReceivedIds()).toHaveLength(2);
    });
  });

  it('refuse un JSON invalide sans rien enregistrer', async () => {
    await openMyLevels();
    await chooseFile('casse.json', '{ JSON cassé');

    await waitFor(async () => {
      expect(await screen.findByRole('alert')).toHaveTextContent('JSON valide');
    });
    await waitFor(async () => {
      expect(await storedReceivedIds()).toEqual([]);
    });
  });

  it('refuse un fichier trop gros avant de le lire', async () => {
    await openMyLevels();
    await chooseFile('trop-grand.json', ' '.repeat(MAX_LEVEL_FILE_SIZE_BYTES + 1));

    await waitFor(async () => {
      expect(await screen.findByRole('alert')).toHaveTextContent('256 Kio');
    });
    await waitFor(async () => {
      expect(await storedReceivedIds()).toEqual([]);
    });
  });

  it('refuse un atelier qui porte un objet « à placer », sans rien enregistrer', async () => {
    await openMyLevels();
    await chooseFile('atelier.json', encodeLevelFile(workshop('mon-atelier', 'Mon atelier')));

    await waitFor(async () => {
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Ce fichier est un atelier, pas un niveau à jouer.',
      );
    });
    await waitFor(async () => {
      expect(await storedReceivedIds()).toEqual([]);
    });
    await waitFor(() => {
      expect(cardTitles('Niveaux reçus')).toEqual([]);
    });
  });

  it('duplique une création en « (copie) » avec la même source, en tête de liste', async () => {
    const source = puzzle('origine', { title: 'Origine' });
    await saveCreation(workshop('creation-1', 'Ma machine'), '2026-09-01T08:00:00.000Z', source);
    await openMyLevels();

    await storageAction(() =>
      fireEvent.click(within(card('Ma machine')).getByRole('button', { name: 'Dupliquer' })),
    );

    await waitFor(() => {
      expect(cardTitles('Mes créations')).toEqual(['Ma machine (copie)', 'Ma machine']);
    });
    const copyId = (await storedDraftIds()).find((id) => id !== 'creation-1') ?? '';
    await waitFor(() => {
      expect(copyId).toMatch(/^creation-[0-9a-f]{32}$/u);
    });
    const copy = await testDraftRepository(() => new Date()).load(copyId);
    await waitFor(() => {
      expect(copy.status === 'ok' && copy.creation).toMatchObject({
        document: { id: copyId, metadata: { title: 'Ma machine (copie)' } },
        source,
      });
    });
  });

  it('ouvre une création dans l’atelier avec « Modifier »', async () => {
    await saveCreation(workshop('creation-1', 'Ma machine'), '2026-09-01T08:00:00.000Z');
    await openMyLevels();

    await storageAction(() =>
      fireEvent.click(within(card('Ma machine')).getByRole('button', { name: 'Modifier' })),
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor');
    });
    await waitFor(() => {
      expect(window.location.search).toBe('?draft=creation-1');
    });
    await waitFor(() => {
      expect(screen.getByText('Atelier')).toBeVisible();
    });
  });

  it('joue le puzzle d’une création avec « Jouer », et revient à son atelier', async () => {
    await saveCreation(workshop('creation-1', 'Ma machine'), '2026-09-01T08:00:00.000Z');
    await openMyLevels();

    await storageAction(() =>
      fireEvent.click(within(card('Ma machine')).getByRole('button', { name: 'Jouer' })),
    );

    await waitFor(() => {
      expect(window.location.search).toBe('?draft=creation-1');
    });
    await waitFor(() => {
      expect(screen.getByText('Atelier', { selector: '.level-mode' })).toBeVisible();
    });
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Retour à l’atelier' })),
    );
    await waitFor(() => {
      expect(screen.getByText('Atelier')).toBeVisible();
    });
  });

  it('ne propose pas « Jouer » sur une création sans objet à placer', async () => {
    await saveCreation(
      puzzle('creation-vide', { title: 'Sans objet à placer' }),
      '2026-09-01T08:00:00.000Z',
    );
    await openMyLevels();

    await waitFor(() => {
      expect(
        within(card('Sans objet à placer')).getByRole('button', { name: 'Jouer' }),
      ).toBeDisabled();
    });
  });

  it('ouvre la boîte d’export vérifiée pour partager une création', async () => {
    await saveCreation(
      puzzle('creation-vide', { title: 'Sans objet à placer' }),
      '2026-09-01T08:00:00.000Z',
    );
    await openMyLevels();

    await storageAction(() =>
      fireEvent.click(
        within(card('Sans objet à placer')).getByRole('button', { name: 'Partager' }),
      ),
    );

    const dialog = screen.getByRole('dialog', { name: 'Exporter le niveau' });
    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Aucun objet n’est à placer');
    });
  });

  it('partage un niveau reçu tel quel, sans vérification', async () => {
    const document = puzzle('recu-partage', { title: 'À partager', author: 'Lili' });
    await saveReceived(receivedLevel(document, '2'.repeat(16), '2026-09-01T08:00:00.000Z'));
    await openMyLevels();

    await storageAction(() =>
      fireEvent.click(within(card('À partager')).getByRole('button', { name: 'Partager' })),
    );
    const dialog = screen.getByRole('dialog', { name: 'Partager le niveau' });
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Télécharger le fichier' })).toBeEnabled();
    });
    await storageAction(() =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Copier le lien de partage' })),
    );

    // jsdom has no clipboard: the link is shown to be copied by hand.
    const link = await within(dialog).findByRole('textbox', { name: 'Lien de partage' });
    const fragment = new URL((link as HTMLTextAreaElement).value).hash;
    await waitFor(async () => {
      expect(await decodeShareFragment(fragment)).toEqual({ status: 'ok', document });
    });
  });

  it('joue un niveau reçu sur `/my-levels/:id/play`', async () => {
    await saveReceived(
      receivedLevel(
        puzzle('recu-jeu', { title: 'À jouer' }),
        '3'.repeat(16),
        '2026-09-01T08:00:00.000Z',
      ),
    );
    await openMyLevels();
    await waitFor(() => {
      expect(within(card('À jouer')).getByRole('button', { name: 'Modifier' })).toBeEnabled();
    });

    await storageAction(() =>
      fireEvent.click(within(card('À jouer')).getByRole('button', { name: 'Jouer' })),
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe(`/my-levels/recu-${'3'.repeat(16)}/play`);
    });
    await waitFor(() => {
      expect(screen.getByText('Mes niveaux', { selector: '.level-mode' })).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    });
  });

  it('dit qu’un niveau reçu inconnu est introuvable, avec un lien vers « Mes niveaux »', async () => {
    window.history.replaceState(null, '', `/my-levels/recu-${'4'.repeat(16)}/play`);
    await renderStorageReady(<App />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('introuvable');
    });
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Mes niveaux' })).toHaveAttribute(
        'href',
        '/my-levels',
      );
    });
  });

  it('marque « Verrouillé » la création d’un niveau de campagne verrouillé, avec Supprimer seulement', async () => {
    const second = campaignLevel(1);
    await saveCreation(
      creationFromLevel(second, { createId: () => `${second.id}-brouillon` }).document,
      '2026-09-01T08:00:00.000Z',
      second,
    );
    const first = campaignLevel(0);
    await saveCreation(
      creationFromLevel(first, { createId: () => `${first.id}-brouillon` }).document,
      '2026-08-01T08:00:00.000Z',
      first,
    );
    await openMyLevels();

    const lockedCard = card(`${second.metadata.title} (remix)`);
    await waitFor(() => {
      expect(within(lockedCard).getByText('Verrouillé')).toBeVisible();
    });
    // V6: the buttons are icons, named by `aria-label` (they had a visible label).
    await waitFor(() => {
      expect(
        within(lockedCard)
          .getAllByRole('button')
          .map((button) => button.getAttribute('aria-label')),
      ).toEqual(['Supprimer']);
    });
    const openCard = card(`${first.metadata.title} (remix)`);
    await waitFor(() => {
      expect(within(openCard).queryByText('Verrouillé')).toBeNull();
    });
    await waitFor(() => {
      expect(within(openCard).getByRole('button', { name: 'Modifier' })).toBeEnabled();
    });
  });

  it('ouvre l’atelier libre avec « Nouveau niveau »', async () => {
    await openMyLevels();

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Nouveau niveau' })),
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor');
    });
    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
  });
});
