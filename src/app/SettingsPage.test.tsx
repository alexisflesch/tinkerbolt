// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  Preferences,
  PreferencesRepository,
} from '../application/preferences/preferences-repository';
import type { ProgressRepository } from '../application/progression/progress-repository';
import { campaignChapters } from '../content/embedded-levels';
import { renderStorageReady, storageAction, testDatabase } from './storage-test-fixture';
import { App } from './App';

const progressKey = 'progress:campaign';
const preferencesKey = 'preferences:player';

const [firstLevelId = '', secondLevelId = ''] = campaignChapters.flatMap(({ levels }) =>
  levels.map(({ id }) => id),
);

const progressEnvelope = JSON.stringify({
  kind: 'progress',
  version: 1,
  data: {
    [firstLevelId]: { resolved: true, bestObjectCount: 2 },
    [secondLevelId]: { resolved: true, bestObjectCount: 3 },
  },
});

const preferencesEnvelope = (data: Preferences): string =>
  JSON.stringify({ kind: 'preferences', version: 1, data });

const storedPreferences = async (): Promise<unknown> => {
  const row: unknown = await testDatabase().table('preferences').get('player');
  return typeof row === 'object' && row !== null && 'envelope' in row ? row.envelope : null;
};

/** Independent tables and backups are left intact by the campaign transaction. */
const untouchedEntries = {
  [`creations:${secondLevelId}-brouillon`]: JSON.stringify('création du niveau 2'),
  'creations:creation-abc': JSON.stringify('création libre'),
  'receivedLevels:recu-0123456789abcdef': JSON.stringify('niveau reçu'),
  'backups:1': JSON.stringify('ancienne sauvegarde'),
  [preferencesKey]: preferencesEnvelope({
    author: 'Lili',
    firstLevelHintDone: true,
    installInvitationDeclined: true,
  }),
} as const;
const seed = async (entries: Readonly<Record<string, string>>): Promise<void> => {
  const db = testDatabase();
  for (const [key, value] of Object.entries(entries)) {
    const [table, id] = key.split(':');
    if (table === undefined || id === undefined) throw new Error('Clé fixture invalide');
    const envelope: unknown = JSON.parse(value);
    await db.table(table).put({ id: table === 'backups' ? Number(id) : id, envelope });
  }
};
const stored = async (key: string): Promise<string | null> => {
  const [table, id] = key.split(':');
  if (table === undefined || id === undefined) throw new Error('Clé fixture invalide');
  const row: unknown = await testDatabase()
    .table(table)
    .get(table === 'backups' ? Number(id) : id);
  return typeof row === 'object' && row !== null && 'envelope' in row
    ? JSON.stringify(row.envelope)
    : null;
};

const renderSettings = async (props: Parameters<typeof App>[0] = {}): Promise<void> => {
  window.history.replaceState(null, '', '/settings');
  await renderStorageReady(<App {...props} />);
};

const pseudoField = (): HTMLInputElement => screen.getByRole('textbox', { name: 'Pseudo retenu' });

const openLevelList = async (): Promise<void> => {
  await storageAction(() =>
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' })),
  );
  await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Campagne' })));
};

beforeEach(() => {});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('Paramètres — pseudo retenu (U11, ADR 0016 § Pseudo)', () => {
  it('présente la version, la licence et le dépôt du projet', async () => {
    await renderSettings();

    const about = screen.getByRole('region', { name: 'À propos de TinkerBolt' });
    await waitFor(() => {
      expect(about).toHaveTextContent(/Version\s*:\s*1\.0/);
    });
    expect(about).toHaveTextContent(/Licence\s*:\s*AGPL-3\.0-or-later/);
    expect(within(about).getByRole('link', { name: 'Voir le dépôt' })).toHaveAttribute(
      'href',
      'https://github.com/alexisflesch/tinkerbolt',
    );
  });

  it('affiche le pseudo retenu', async () => {
    await seed({ [preferencesKey]: preferencesEnvelope({ author: 'Lili' }) });
    await renderSettings();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Pseudo' })).toBeVisible();
    });
    await waitFor(() => {
      expect(pseudoField()).toHaveValue('Lili');
    });
    await waitFor(() => {
      expect(screen.getByText('Un pseudo, pas ton vrai nom.', { exact: false })).toBeVisible();
    });
  });

  it('montre un champ vide sans pseudo retenu, et « Effacer » désactivé', async () => {
    await renderSettings();

    await waitFor(() => {
      expect(pseudoField()).toHaveValue('');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Effacer le pseudo' })).toBeDisabled();
    });
  });

  it('modifie le pseudo, rogné, sans perdre les autres préférences', async () => {
    await seed({
      [preferencesKey]: preferencesEnvelope({
        author: 'Lili',
        firstLevelHintDone: true,
        installInvitationDeclined: true,
      }),
    });
    await renderSettings();

    await storageAction(() => fireEvent.change(pseudoField(), { target: { value: '  Noé  ' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le pseudo' })),
    );

    await waitFor(async () => {
      expect(await storedPreferences()).toEqual({
        kind: 'preferences',
        version: 1,
        data: { author: 'Noé', firstLevelHintDone: true, installInvitationDeclined: true },
      });
    });
    await waitFor(() => {
      expect(pseudoField()).toHaveValue('Noé');
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Pseudo enregistré.');
    });
  });

  it('efface le pseudo seulement', async () => {
    await seed({
      [preferencesKey]: preferencesEnvelope({ author: 'Lili', firstLevelHintDone: true }),
    });
    await renderSettings();

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Effacer le pseudo' })),
    );

    await waitFor(async () => {
      expect(await storedPreferences()).toEqual({
        kind: 'preferences',
        version: 1,
        data: { firstLevelHintDone: true },
      });
    });
    await waitFor(() => {
      expect(pseudoField()).toHaveValue('');
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Pseudo effacé.');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Effacer le pseudo' })).toBeDisabled();
    });
  });

  it('oublie le pseudo quand le champ est vidé puis enregistré, comme à l’export (M14)', async () => {
    await seed({ [preferencesKey]: preferencesEnvelope({ author: 'Lili' }) });
    await renderSettings();

    await storageAction(() => fireEvent.change(pseudoField(), { target: { value: '   ' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le pseudo' })),
    );

    await waitFor(async () => {
      expect(await storedPreferences()).toEqual({ kind: 'preferences', version: 1, data: {} });
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Pseudo effacé.');
    });
  });

  it('refuse un pseudo invalide sous le champ, sans rien écrire', async () => {
    await seed({ [preferencesKey]: preferencesEnvelope({ author: 'Lili' }) });
    await renderSettings();
    const before = await stored(preferencesKey);

    await storageAction(() => fireEvent.change(pseudoField(), { target: { value: 'Li li' } }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Le pseudo ne doit contenir ni saut de ligne ni caractère de contrôle.',
      );
    });
    await waitFor(() => {
      expect(pseudoField()).toHaveAttribute('aria-invalid', 'true');
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enregistrer le pseudo' })).toBeDisabled();
    });
    await waitFor(async () => {
      expect(await stored(preferencesKey)).toBe(before);
    });
  });

  it('dit qu’un pseudo n’a pas pu être enregistré, sans exception', async () => {
    const repository: PreferencesRepository = {
      patch: () => Promise.resolve({ status: 'error', code: 'quota-exceeded' }),
      load: () => Promise.resolve({ status: 'ok', preferences: { author: 'Lili' } }),
      save: () => Promise.resolve({ status: 'error', code: 'quota-exceeded' }),
    };
    await renderSettings({ preferencesRepository: repository });

    await storageAction(() => fireEvent.change(pseudoField(), { target: { value: 'Noé' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le pseudo' })),
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'L’espace de stockage de cet appareil est plein. Ton pseudo n’a pas été enregistré.',
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  it('reste affichée quand les préférences ne peuvent pas être lues', async () => {
    const repository: PreferencesRepository = {
      patch: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
      load: () => {
        return Promise.reject(new Error('stockage bloqué'));
      },
      save: () => {
        return Promise.reject(new Error('stockage bloqué'));
      },
    };
    await renderSettings({ preferencesRepository: repository });

    await waitFor(() => {
      expect(pseudoField()).toHaveValue('');
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Le stockage local de cet appareil est indisponible. Ton pseudo ne peut pas être lu.',
      );
    });

    await storageAction(() => fireEvent.change(pseudoField(), { target: { value: 'Noé' } }));
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le pseudo' })),
    );
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Le stockage local de cet appareil est indisponible. Ton pseudo n’a pas été enregistré.',
      );
    });
  });
});

describe('Paramètres — remettre la progression à zéro (U11, ADR 0010, ADR 0011)', () => {
  it('affiche une jauge accessible avec le nombre de niveaux résolus', async () => {
    await seed({ [progressKey]: progressEnvelope });
    await renderSettings();

    const meter = screen.getByRole('progressbar', { name: 'Progression de la campagne' });
    await waitFor(() => {
      expect(meter).toHaveAttribute('value', '2');
    });
    expect(meter).toHaveAttribute('max', '7');
  });

  it('demande confirmation, « Annuler » ciblé, et « Annuler » ne change rien', async () => {
    await seed({ ...untouchedEntries, [progressKey]: progressEnvelope });
    await renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Niveaux résolus : 2 sur 7.')).toBeVisible();
    });
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Remettre la progression à zéro' })),
    );

    const dialog = screen.getByRole('dialog', { name: 'Remettre la progression à zéro ?' });
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Annuler' })).toHaveFocus();
    });
    await waitFor(() => {
      expect(dialog).toHaveTextContent(
        'les niveaux résolus de la campagne et leurs records, leurs solutions et toutes les constructions de campagne seront effacés',
      );
    });
    await waitFor(() => {
      expect(dialog).toHaveTextContent('Seul le niveau 1 restera ouvert.');
    });
    await waitFor(() => {
      expect(dialog).toHaveTextContent(
        'Tes créations, tes niveaux reçus et ton pseudo sont conservés.',
      );
    });

    await storageAction(() =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' })),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(async () => {
      expect(await stored(progressKey)).toBe(progressEnvelope);
    });
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText('Niveaux résolus : 2 sur 7.')).toBeVisible();
    });
  });

  it('efface la progression et rien d’autre, le dit, et la campagne est de nouveau verrouillée', async () => {
    await seed({ ...untouchedEntries, [progressKey]: progressEnvelope });
    await renderSettings();

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Remettre la progression à zéro' })),
    );
    const dialog = screen.getByRole('dialog', { name: 'Remettre la progression à zéro ?' });
    await storageAction(() =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remettre à zéro' })),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Progression remise à zéro : seul le niveau 1 est ouvert.',
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Niveaux résolus : 0 sur 7.')).toBeVisible();
    });
    await waitFor(async () => {
      expect(await stored(progressKey)).toBeNull();
    });
    for (const [key, value] of Object.entries(untouchedEntries)) {
      await waitFor(async () => {
        expect(await stored(key)).toBe(value);
      });
    }
    await waitFor(() => {
      expect(pseudoField()).toHaveValue('Lili');
    });

    await openLevelList();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jouer le niveau 1' })).toBeEnabled();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jouer le niveau 2' })).toBeDisabled();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jouer le niveau 3' })).toBeDisabled();
    });
  });

  it('dit que rien n’a été effacé quand le stockage refuse, sans exception', async () => {
    const repository: ProgressRepository = {
      recordVictory: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
      load: () =>
        Promise.resolve({
          status: 'ok',
          progress: { [firstLevelId]: { resolved: true, bestObjectCount: 2 } },
        }),
      save: () => Promise.resolve({ status: 'ok' }),
      clear: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
    };
    await renderSettings({ progressRepository: repository });

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Remettre la progression à zéro' })),
    );
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Remettre à zéro' })),
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Le stockage local de cet appareil est indisponible. La progression n’a pas été effacée.',
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText('Niveaux résolus : 1 sur 7.')).toBeVisible();
    });

    await openLevelList();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jouer le niveau 2' })).toBeEnabled();
    });
  });
});
