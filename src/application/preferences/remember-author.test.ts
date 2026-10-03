import { describe, expect, it } from 'vitest';

import type { Preferences, PreferencesRepository } from './preferences-repository';
import { rememberAuthor } from './remember-author';

/** A patch reads and updates under one repository operation, as IndexedDB does. */
const memoryPreferences = (initial: Preferences) => {
  let stored = initial;
  const saved: Preferences[] = [];
  const repository: PreferencesRepository = {
    load: () => Promise.resolve({ status: 'ok', preferences: stored }),
    save: async (preferences) => {
      await Promise.resolve();
      saved.push(preferences);
      stored = preferences;
      return { status: 'ok' };
    },
    patch: async ({ author }) => {
      await Promise.resolve();
      const { author: previousAuthor, ...others } = stored;
      void previousAuthor;
      stored =
        author === null ? others : { ...others, ...(author === undefined ? {} : { author }) };
      saved.push(stored);
      return { status: 'ok', preferences: stored };
    },
  };
  return { repository, saved, current: () => stored };
};

const otherFields = { firstLevelHintDone: true, installInvitationDeclined: true } as const;

describe('rememberAuthor (U11)', () => {
  it('modifie le pseudo sans perdre l’aide du niveau 1 ni le refus d’installation', async () => {
    const preferences = memoryPreferences({ author: 'Lili', ...otherFields });
    expect(await rememberAuthor(preferences.repository, 'Noé')).toEqual({ status: 'ok' });
    expect(preferences.current()).toEqual({ author: 'Noé', ...otherFields });
  });

  it('efface seulement le pseudo et garde les autres préférences', async () => {
    const preferences = memoryPreferences({ author: 'Lili', ...otherFields });
    expect(await rememberAuthor(preferences.repository, undefined)).toEqual({ status: 'ok' });
    expect(preferences.current()).toEqual(otherFields);
    expect(Object.hasOwn(preferences.current(), 'author')).toBe(false);
  });

  it('retient un premier pseudo dans des préférences vides', async () => {
    const preferences = memoryPreferences({});
    expect(await rememberAuthor(preferences.repository, 'Noé')).toEqual({ status: 'ok' });
    expect(preferences.current()).toEqual({ author: 'Noé' });
  });

  it('n’écrit rien quand les préférences ne peuvent pas être lues', async () => {
    const saved: Preferences[] = [];
    const repository: PreferencesRepository = {
      load: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
      save: async (preferences) => {
        await Promise.resolve();
        saved.push(preferences);
        return { status: 'ok' };
      },
      patch: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
    };
    expect(await rememberAuthor(repository, 'Noé')).toEqual({
      status: 'error',
      code: 'storage-unavailable',
    });
    expect(saved).toEqual([]);
  });

  it('rend l’erreur d’écriture du dépôt', async () => {
    const repository: PreferencesRepository = {
      load: () => Promise.resolve({ status: 'ok', preferences: {} }),
      save: () => Promise.resolve({ status: 'error', code: 'quota-exceeded' }),
      patch: () => Promise.resolve({ status: 'error', code: 'quota-exceeded' }),
    };
    expect(await rememberAuthor(repository, 'Noé')).toEqual({
      status: 'error',
      code: 'quota-exceeded',
    });
  });

  it('convertit une exception du dépôt en résultat d’erreur', async () => {
    const repository: PreferencesRepository = {
      load: async () => {
        await Promise.resolve();
        throw new Error('stockage bloqué');
      },
      save: async () => {
        await Promise.resolve();
        throw new Error('stockage bloqué');
      },
      patch: async () => {
        await Promise.resolve();
        throw new Error('stockage bloqué');
      },
    };
    await expect(rememberAuthor(repository, 'Noé')).resolves.toEqual({
      status: 'error',
      code: 'storage-unavailable',
    });
  });
});
