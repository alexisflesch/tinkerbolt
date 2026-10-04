import type Dexie from 'dexie';
import type {
  PlayerConstructionRepository,
  PlayerConstructionSource,
  PlayerConstructionWriteResult,
} from '../../application/construction/player-construction-repository';
import { validatePlayerConstruction } from '../../application/construction/player-construction';
import {
  constructionForSource,
  decodePlayerConstructionRow,
  playerConstructionEnvelopeSchema,
  playerConstructionSourceSchema,
} from '../player-construction/player-construction-codec';
import { encodeLevelFile } from '../level-file/level-file-codec';
import { decodeReceivedLevelRow } from './indexed-db-received-level-repository';
import { checkedRow, currentInstant, storageErrorCode, warningPart } from './indexed-db-common';

const failure = (error: unknown): PlayerConstructionWriteResult => ({
  status: 'error',
  code: storageErrorCode(error),
});

const checkedConstruction = (db: Dexie, source: PlayerConstructionSource, clock: () => Date) =>
  checkedRow(
    db,
    'playerConstructions',
    [source.scope, source.levelId],
    (raw) => {
      const envelope = decodePlayerConstructionRow(raw, source.scope, source.levelId);
      if (envelope === null) return null;
      // A changed source is incompatibility, not corruption. Validate all
      // relations only when the source represented by the envelope is available.
      return envelope.data.sourceFingerprint !== source.sourceFingerprint ||
        constructionForSource(envelope, source).status === 'ok'
        ? envelope
        : null;
    },
    1,
    clock,
  );

const checkReceivedParent = async (
  db: Dexie,
  source: PlayerConstructionSource,
  canonicalSource: string,
  clock: () => Date,
): Promise<PlayerConstructionWriteResult> => {
  if (source.scope !== 'received') return { status: 'ok' };
  const parent = await checkedRow(
    db,
    'receivedLevels',
    source.levelId,
    (raw) => decodeReceivedLevelRow(raw, source.levelId),
    1,
    clock,
  );
  if (parent.status === 'future') return { status: 'error', code: 'unsupported-version' };
  if (parent.value === null) return { status: 'error', code: 'source-not-found' };
  if (encodeLevelFile(parent.value.document) !== canonicalSource)
    return { status: 'error', code: 'source-changed' };
  return { status: 'ok' };
};

export const createIndexedDBPlayerConstructionRepository = (
  db: Dexie,
  clock: () => Date,
): PlayerConstructionRepository => ({
  async load(candidate) {
    const parsed = playerConstructionSourceSchema.safeParse(candidate);
    if (!parsed.success) return { status: 'error', code: 'invalid-construction' };
    const source = parsed.data;
    const canonicalSource = encodeLevelFile(source.document);
    const context: { operation?: 'delete-incompatible' } = {};
    try {
      return await db.transaction(
        'rw',
        db.table('playerConstructions'),
        db.table('receivedLevels'),
        db.table('backups'),
        async () => {
          const parent = await checkReceivedParent(db, source, canonicalSource, clock);
          if (parent.status === 'error') return parent;
          const checked = await checkedConstruction(db, source, clock);
          if (checked.status === 'future')
            return { status: 'error', code: 'unsupported-version' } as const;
          if (checked.value === null)
            return { status: 'ok', attempt: null, ...warningPart(checked.warning) } as const;
          if (checked.value.data.sourceFingerprint !== source.sourceFingerprint) {
            context.operation = 'delete-incompatible';
            await db.table('playerConstructions').delete([source.scope, source.levelId]);
            return { status: 'ok', attempt: null, warning: 'source-changed' } as const;
          }
          const validation = constructionForSource(checked.value, source);
          return validation.status === 'error'
            ? validation
            : ({ status: 'ok', attempt: validation.attempt } as const);
        },
      );
    } catch (error) {
      return {
        status: 'error',
        code: storageErrorCode(error),
        ...context,
      };
    }
  },
  async save(candidate, attempt) {
    const parsed = playerConstructionSourceSchema.safeParse(candidate);
    const updatedAt = currentInstant(clock);
    if (!parsed.success || updatedAt === null)
      return { status: 'error', code: 'invalid-construction' };
    const source = parsed.data;
    const validation = validatePlayerConstruction(source.document, attempt);
    if (validation.status === 'error') return validation;
    const envelope = playerConstructionEnvelopeSchema.safeParse({
      kind: 'player-construction',
      version: 1,
      data: {
        scope: source.scope,
        levelId: source.levelId,
        sourceFingerprint: source.sourceFingerprint,
        updatedAt,
        attempt: validation.attempt,
      },
    });
    if (!envelope.success) return { status: 'error', code: 'invalid-construction' };
    const row = { scope: source.scope, levelId: source.levelId, envelope: envelope.data };
    const canonicalSource = encodeLevelFile(source.document);
    try {
      return await db.transaction(
        'rw',
        db.table('playerConstructions'),
        db.table('receivedLevels'),
        db.table('backups'),
        async () => {
          const parent = await checkReceivedParent(db, source, canonicalSource, clock);
          if (parent.status === 'error') return parent;
          const checked = await checkedConstruction(db, source, clock);
          if (checked.status === 'future')
            return { status: 'error', code: 'unsupported-version' } as const;
          if (
            checked.value !== null &&
            checked.value.data.sourceFingerprint !== source.sourceFingerprint
          )
            return { status: 'error', code: 'source-changed' } as const;
          await db.table('playerConstructions').put(row);
          return { status: 'ok', ...warningPart(checked.warning) } as const;
        },
      );
    } catch (error) {
      return failure(error);
    }
  },
  async delete(candidate) {
    const parsed = playerConstructionSourceSchema.safeParse(candidate);
    if (!parsed.success) return { status: 'error', code: 'invalid-construction' };
    const source = parsed.data;
    try {
      return await db.transaction(
        'rw',
        db.table('playerConstructions'),
        db.table('backups'),
        async () => {
          const checked = await checkedConstruction(db, source, clock);
          if (checked.status === 'future')
            return { status: 'error', code: 'unsupported-version' } as const;
          await db.table('playerConstructions').delete([source.scope, source.levelId]);
          return { status: 'ok', ...warningPart(checked.warning) } as const;
        },
      );
    } catch (error) {
      return failure(error);
    }
  },
});
