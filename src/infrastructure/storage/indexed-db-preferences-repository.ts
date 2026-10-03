import type Dexie from 'dexie';
import { z } from 'zod';

import type {
  Preferences,
  PreferencesPatch,
  PreferencesRepository,
  PreferencesRepositoryErrorCode,
} from '../../application/preferences/preferences-repository';
import { authorSchema } from '../../domain/level-document';
import { checkedRow, storageErrorCode, warningPart } from './indexed-db-common';

const preferencesSchema = z.strictObject({
  author: authorSchema.optional(),
  firstLevelHintDone: z.literal(true).optional(),
  installInvitationDeclined: z.literal(true).optional(),
});
const patchSchema = z.strictObject({
  author: authorSchema.nullable().optional(),
  firstLevelHintDone: z.literal(true).optional(),
  installInvitationDeclined: z.literal(true).optional(),
});
const envelopeSchema = z.strictObject({
  kind: z.literal('preferences'),
  version: z.literal(1),
  data: preferencesSchema,
});
const rowSchema = z.strictObject({ id: z.literal('player'), envelope: envelopeSchema });
const decodeRow = (raw: unknown): Preferences | null => {
  const parsed = rowSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { author, firstLevelHintDone, installInvitationDeclined } = parsed.data.envelope.data;
  return {
    ...(author === undefined ? {} : { author }),
    ...(firstLevelHintDone === undefined ? {} : { firstLevelHintDone }),
    ...(installInvitationDeclined === undefined ? {} : { installInvitationDeclined }),
  };
};
const rowFor = (preferences: Preferences) => ({
  id: 'player',
  envelope: { kind: 'preferences', version: 1, data: preferences },
});
const failure = (
  error: unknown,
): { readonly status: 'error'; readonly code: PreferencesRepositoryErrorCode } => ({
  status: 'error',
  code: storageErrorCode(error),
});
const applyPatch = (current: Preferences, changes: PreferencesPatch): Preferences => {
  const others = { ...current };
  delete others.author;
  if (changes.author === undefined) {
    return {
      ...current,
      ...(changes.firstLevelHintDone === undefined
        ? {}
        : { firstLevelHintDone: changes.firstLevelHintDone }),
      ...(changes.installInvitationDeclined === undefined
        ? {}
        : { installInvitationDeclined: changes.installInvitationDeclined }),
    };
  }
  const { author: changedAuthor, ...otherChanges } = changes;
  return {
    ...others,
    ...(otherChanges.firstLevelHintDone === undefined
      ? {}
      : { firstLevelHintDone: otherChanges.firstLevelHintDone }),
    ...(otherChanges.installInvitationDeclined === undefined
      ? {}
      : { installInvitationDeclined: otherChanges.installInvitationDeclined }),
    ...(changedAuthor === null ? {} : { author: changedAuthor }),
  };
};

export const createIndexedDBPreferencesRepository = (
  db: Dexie,
  clock: () => Date,
): PreferencesRepository => ({
  async load() {
    try {
      return await db.transaction('rw', db.table('preferences'), db.table('backups'), async () => {
        const checked = await checkedRow(db, 'preferences', 'player', decodeRow, 1, clock);
        return checked.status === 'future'
          ? ({ status: 'error', code: 'unsupported-version' } as const)
          : ({
              status: 'ok',
              preferences: checked.value ?? {},
              ...warningPart(checked.warning),
            } as const);
      });
    } catch (error) {
      return failure(error);
    }
  },
  async save(preferences) {
    if (!preferencesSchema.safeParse(preferences).success)
      return { status: 'error', code: 'invalid-preferences' };
    try {
      return await db.transaction('rw', db.table('preferences'), db.table('backups'), async () => {
        const checked = await checkedRow(db, 'preferences', 'player', decodeRow, 1, clock);
        if (checked.status === 'future')
          return { status: 'error', code: 'unsupported-version' } as const;
        await db.table('preferences').put(rowFor(preferences));
        return { status: 'ok', ...warningPart(checked.warning) } as const;
      });
    } catch (error) {
      return failure(error);
    }
  },
  async patch(changes) {
    if (!patchSchema.safeParse(changes).success)
      return { status: 'error', code: 'invalid-preferences' };
    try {
      return await db.transaction('rw', db.table('preferences'), db.table('backups'), async () => {
        const checked = await checkedRow(db, 'preferences', 'player', decodeRow, 1, clock);
        if (checked.status === 'future')
          return { status: 'error', code: 'unsupported-version' } as const;
        const preferences = applyPatch(checked.value ?? {}, changes);
        if (!preferencesSchema.safeParse(preferences).success)
          return { status: 'error', code: 'invalid-preferences' } as const;
        await db.table('preferences').put(rowFor(preferences));
        return { status: 'ok', preferences, ...warningPart(checked.warning) } as const;
      });
    } catch (error) {
      return failure(error);
    }
  },
});
