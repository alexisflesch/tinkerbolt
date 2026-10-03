import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { rememberAuthor } from '../../application/preferences/remember-author';
import { createIndexedDBPreferencesRepository } from './indexed-db-preferences-repository';
import { createTinkerboltDatabase } from './tinkerbolt-database';

const instant = '2026-10-03T12:00:00.000Z';
const clock = (): Date => new Date(instant);
const open = () =>
  createTinkerboltDatabase({
    name: 'preferences-contracts',
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
const row = (data: unknown) => ({
  id: 'player',
  envelope: { kind: 'preferences', version: 1, data },
});
const quota = (): DOMException => new DOMException('Quota exceeded', 'QuotaExceededError');

describe('contrats historiques des préférences sur IndexedDB', () => {
  it('retient pseudo, aide et invitation, puis oublie seulement le pseudo', async () => {
    const db = open();
    const repository = createIndexedDBPreferencesRepository(db, clock);
    const preferences = {
      author: 'Lili',
      firstLevelHintDone: true,
      installInvitationDeclined: true,
    } as const;
    expect(await repository.save(preferences)).toEqual({ status: 'ok' });
    expect(await db.table('preferences').get('player')).toEqual(row(preferences));
    expect(await repository.load()).toEqual({ status: 'ok', preferences });
    expect(await rememberAuthor(repository, undefined)).toEqual({ status: 'ok' });
    expect(await repository.load()).toEqual({
      status: 'ok',
      preferences: { firstLevelHintDone: true, installInvitationDeclined: true },
    });
  });

  it('relit les enveloppes v1 qui précèdent les champs facultatifs', async () => {
    const db = open();
    const repository = createIndexedDBPreferencesRepository(db, clock);
    await db.table('preferences').put(row({ author: 'Lili' }));
    expect(await repository.load()).toEqual({ status: 'ok', preferences: { author: 'Lili' } });
    await db.table('preferences').put(row({ author: 'Lili', firstLevelHintDone: true }));
    expect(await repository.load()).toEqual({
      status: 'ok',
      preferences: { author: 'Lili', firstLevelHintDone: true },
    });
  });

  it('secourt une valeur invalide avant remplacement, sans perdre les champs acceptés', async () => {
    const db = open();
    const raw = row({ firstLevelHintDone: false });
    await db.table('preferences').put(raw);
    const repository = createIndexedDBPreferencesRepository(db, clock);
    expect(await repository.save({ author: 'Lili', installInvitationDeclined: true })).toEqual({
      status: 'ok',
      warning: 'invalid-data-backed-up',
    });
    expect(await repository.load()).toEqual({
      status: 'ok',
      preferences: { author: 'Lili', installInvitationDeclined: true },
    });
    expect(await db.table('backups').toArray()).toMatchObject([
      { table: 'preferences', key: 'player', rawValue: raw },
    ]);
  });

  it('refuse pseudo, drapeau et champ inconnu avant toute écriture', async () => {
    const db = open();
    const repository = createIndexedDBPreferencesRepository(db, clock);
    expect(await repository.save({ author: '   ' })).toEqual({
      status: 'error',
      code: 'invalid-preferences',
    });
    const withUnknownField = { author: 'Lili', inconnu: true };
    expect(await repository.save(withUnknownField)).toEqual({
      status: 'error',
      code: 'invalid-preferences',
    });
    expect(await db.table('preferences').count()).toBe(0);
  });

  it('n’écrase pas une valeur invalide si le secours échoue', async () => {
    const db = open();
    const raw = row({ author: 'Lili\nNoé' });
    await db.table('preferences').put(raw);
    db.table('backups').hook('creating', () => {
      throw quota();
    });
    expect(await createIndexedDBPreferencesRepository(db, clock).save({ author: 'Lili' })).toEqual({
      status: 'error',
      code: 'quota-exceeded',
    });
    expect(await db.table('preferences').get('player')).toEqual(raw);
  });

  it('refuse un pseudo invalide depuis les paramètres sans toucher la valeur', async () => {
    const db = open();
    const repository = createIndexedDBPreferencesRepository(db, clock);
    await repository.save({ author: 'Lili' });
    expect(await rememberAuthor(repository, 'Lili\u2028Noé')).toEqual({
      status: 'error',
      code: 'invalid-preferences',
    });
    expect(await repository.load()).toEqual({ status: 'ok', preferences: { author: 'Lili' } });
  });
});
