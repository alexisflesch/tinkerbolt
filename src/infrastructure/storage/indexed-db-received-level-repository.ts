import type Dexie from 'dexie';
import { z } from 'zod';

import type { LevelDocument, Solution } from '../../domain/level-document';
import { solutionSchema } from '../../domain/level-document';
import type {
  ReceivedLevel,
  ReceivedLevelRepository,
  ReceivedLevelRepositoryErrorCode,
  ReceivedLevelReceiveResult,
  ReceivedLevelVictoryResult,
  ReceivedLevelWriteResult,
} from '../../application/received/received-level-repository';
import {
  checkedRow,
  isFutureEnvelope,
  decodedDocument,
  documentValueSchema,
  instantSchema,
  receivedIdSchema,
  storageErrorCode,
  storedDocument,
  warningPart,
} from './indexed-db-common';
import { encodeLevelFile } from '../level-file/level-file-codec';
import { decodePlayerConstructionRow } from '../player-construction/player-construction-codec';

const levelSchema = z
  .strictObject({
    id: receivedIdSchema,
    document: documentValueSchema,
    origin: z.enum(['link', 'file']),
    receivedAt: instantSchema,
    solved: z.boolean(),
    bestObjectCount: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    playerSolution: solutionSchema.optional(),
  })
  .refine(
    ({ solved, bestObjectCount, playerSolution }) =>
      solved || (bestObjectCount === undefined && playerSolution === undefined),
  );
const envelopeSchema = z.strictObject({
  kind: z.literal('received-level'),
  version: z.literal(1),
  data: levelSchema,
});
const rowSchema = z.strictObject({
  id: receivedIdSchema,
  receivedAt: instantSchema,
  envelope: envelopeSchema,
});

export const decodeReceivedLevelRow = (raw: unknown, id: string): ReceivedLevel | null => {
  const parsed = rowSchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.id !== id ||
    parsed.data.receivedAt !== parsed.data.envelope.data.receivedAt ||
    parsed.data.envelope.data.id !== id
  )
    return null;
  const {
    document: rawDocument,
    bestObjectCount,
    playerSolution,
    ...rest
  } = parsed.data.envelope.data;
  const document = decodedDocument(rawDocument);
  return document === null
    ? null
    : {
        ...rest,
        document,
        ...(bestObjectCount === undefined ? {} : { bestObjectCount }),
        ...(playerSolution === undefined ? {} : { playerSolution }),
      };
};
const prepare = (level: ReceivedLevel): unknown => {
  const document = storedDocument(level.document);
  if (document === null) return null;
  const row = {
    id: level.id,
    receivedAt: level.receivedAt,
    envelope: { kind: 'received-level', version: 1, data: { ...level, document } },
  };
  return rowSchema.safeParse(row).success ? row : null;
};
const canonical = (document: LevelDocument): string | null => {
  try {
    return encodeLevelFile(document);
  } catch {
    return null;
  }
};
const validSolution = (solution: Solution): boolean => solutionSchema.safeParse(solution).success;
const failure = (
  error: unknown,
): { readonly status: 'error'; readonly code: ReceivedLevelRepositoryErrorCode } => ({
  status: 'error',
  code: storageErrorCode(error),
});

export const createIndexedDBReceivedLevelRepository = (
  db: Dexie,
  clock: () => Date,
): ReceivedLevelRepository => ({
  async list() {
    try {
      return await db.transaction(
        'rw',
        db.table('receivedLevels'),
        db.table('backups'),
        async () => {
          const rows: unknown[] = await db.table('receivedLevels').toArray();
          const ids: string[] = [];
          let warning = false;
          for (const raw of rows) {
            const key = typeof raw === 'object' && raw !== null && 'id' in raw ? raw.id : undefined;
            if (typeof key !== 'string' && typeof key !== 'number')
              throw new Error('Invalid IndexedDB key');
            const checked = await checkedRow(
              db,
              'receivedLevels',
              key,
              (value) => (typeof key === 'string' ? decodeReceivedLevelRow(value, key) : null),
              1,
              clock,
            );
            if (checked.status === 'future')
              return { status: 'error', code: 'unsupported-version' } as const;
            if (checked.value !== null && typeof key === 'string') ids.push(key);
            warning ||= checked.warning !== undefined;
          }
          return {
            status: 'ok',
            ids,
            ...(warning ? warningPart('invalid-data-backed-up') : {}),
          } as const;
        },
      );
    } catch (error) {
      return failure(error);
    }
  },
  async load(id) {
    if (!receivedIdSchema.safeParse(id).success)
      return { status: 'error', code: 'invalid-received-level' };
    try {
      return await db.transaction(
        'rw',
        db.table('receivedLevels'),
        db.table('backups'),
        async () => {
          const checked = await checkedRow(
            db,
            'receivedLevels',
            id,
            (raw) => decodeReceivedLevelRow(raw, id),
            1,
            clock,
          );
          if (checked.status === 'future')
            return { status: 'error', code: 'unsupported-version' } as const;
          if (checked.value !== null) {
            const row = prepare(checked.value);
            const raw: unknown = await db.table('receivedLevels').get(id);
            if (JSON.stringify(raw) !== JSON.stringify(row))
              await db.table('receivedLevels').put(row);
          }
          return { status: 'ok', level: checked.value, ...warningPart(checked.warning) } as const;
        },
      );
    } catch (error) {
      return failure(error);
    }
  },
  async save(level): Promise<ReceivedLevelWriteResult> {
    const row = prepare(level);
    if (row === null) return { status: 'error', code: 'invalid-received-level' };
    try {
      return await db.transaction(
        'rw',
        db.table('receivedLevels'),
        db.table('backups'),
        async () => {
          const checked = await checkedRow(
            db,
            'receivedLevels',
            level.id,
            (raw) => decodeReceivedLevelRow(raw, level.id),
            1,
            clock,
          );
          if (checked.status === 'future')
            return { status: 'error', code: 'unsupported-version' } as const;
          await db.table('receivedLevels').put(row);
          return { status: 'ok', ...warningPart(checked.warning) } as const;
        },
      );
    } catch (error) {
      return failure(error);
    }
  },
  async receive(level): Promise<ReceivedLevelReceiveResult> {
    const row = prepare(level);
    const incomingSource = canonical(level.document);
    if (row === null || incomingSource === null)
      return { status: 'error', code: 'invalid-received-level' };
    try {
      return await db.transaction(
        'rw',
        db.table('receivedLevels'),
        db.table('backups'),
        async () => {
          const checked = await checkedRow(
            db,
            'receivedLevels',
            level.id,
            (raw) => decodeReceivedLevelRow(raw, level.id),
            1,
            clock,
          );
          if (checked.status === 'future')
            return { status: 'error', code: 'unsupported-version' } as const;
          const existing = checked.value;
          if (existing !== null && canonical(existing.document) !== incomingSource)
            return { status: 'error', code: 'identity-collision' } as const;
          const received =
            existing === null ? level : { ...existing, receivedAt: level.receivedAt };
          const nextRow = prepare(received);
          if (nextRow === null) return { status: 'error', code: 'invalid-received-level' } as const;
          await db.table('receivedLevels').put(nextRow);
          return {
            status: 'ok',
            level: received,
            isNew: existing === null,
            ...warningPart(checked.warning),
          } as const;
        },
      );
    } catch (error) {
      return failure(error);
    }
  },
  async recordVictory(
    id,
    expectedSource,
    objectsUsed,
    playerSolution,
  ): Promise<ReceivedLevelVictoryResult> {
    const expected = canonical(expectedSource);
    if (
      !receivedIdSchema.safeParse(id).success ||
      expected === null ||
      !Number.isSafeInteger(objectsUsed) ||
      objectsUsed < 0 ||
      !validSolution(playerSolution)
    )
      return { status: 'error', code: 'invalid-received-level' };
    try {
      return await db.transaction(
        'rw',
        db.table('receivedLevels'),
        db.table('backups'),
        async () => {
          const checked = await checkedRow(
            db,
            'receivedLevels',
            id,
            (raw) => decodeReceivedLevelRow(raw, id),
            1,
            clock,
          );
          if (checked.status === 'future')
            return { status: 'error', code: 'unsupported-version' } as const;
          const existing = checked.value;
          if (existing === null)
            return { status: 'ok', level: null, ...warningPart(checked.warning) } as const;
          if (canonical(existing.document) !== expected)
            return { status: 'error', code: 'source-changed' } as const;
          const level: ReceivedLevel = {
            ...existing,
            solved: true,
            bestObjectCount:
              existing.bestObjectCount === undefined
                ? objectsUsed
                : Math.min(existing.bestObjectCount, objectsUsed),
            playerSolution,
          };
          const row = prepare(level);
          if (row === null) return { status: 'error', code: 'invalid-received-level' } as const;
          await db.table('receivedLevels').put(row);
          return { status: 'ok', level, ...warningPart(checked.warning) } as const;
        },
      );
    } catch (error) {
      return failure(error);
    }
  },
  async delete(id): Promise<ReceivedLevelWriteResult> {
    if (!receivedIdSchema.safeParse(id).success)
      return { status: 'error', code: 'invalid-received-level' };
    try {
      return await db.transaction(
        'rw',
        db.table('receivedLevels'),
        db.table('playerConstructions'),
        db.table('backups'),
        async () => {
          const construction: unknown = await db.table('playerConstructions').get(['received', id]);
          if (isFutureEnvelope(construction, 1))
            return { status: 'error', code: 'unsupported-version' } as const;
          const checked = await checkedRow(
            db,
            'receivedLevels',
            id,
            (raw) => decodeReceivedLevelRow(raw, id),
            1,
            clock,
          );
          if (checked.status === 'future')
            return { status: 'error', code: 'unsupported-version' } as const;
          const checkedConstruction = await checkedRow(
            db,
            'playerConstructions',
            ['received', id],
            (raw) => decodePlayerConstructionRow(raw, 'received', id),
            1,
            clock,
          );
          if (checkedConstruction.status === 'future')
            return { status: 'error', code: 'unsupported-version' } as const;
          await db.table('receivedLevels').delete(id);
          await db.table('playerConstructions').delete(['received', id]);
          return {
            status: 'ok',
            ...warningPart(checked.warning ?? checkedConstruction.warning),
          } as const;
        },
      );
    } catch (error) {
      return failure(error);
    }
  },
});
