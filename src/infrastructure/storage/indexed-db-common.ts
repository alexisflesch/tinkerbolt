import type Dexie from 'dexie';
import { z } from 'zod';

import { decodeLevelFile, encodeLevelFile } from '../level-file/level-file-codec';
import type { LevelDocument } from '../../domain/level-document';

export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
export const receivedIdSchema = z.string().regex(/^recu-[0-9a-f]{16}$/);
export const instantSchema = z.iso.datetime({ offset: true });
export const documentValueSchema = z.record(z.string(), z.unknown());

export const currentInstant = (clock: () => Date): string | null => {
  try {
    const value = clock().toISOString();
    return instantSchema.safeParse(value).success ? value : null;
  } catch {
    return null;
  }
};

export const storedDocument = (document: LevelDocument): unknown => {
  try {
    const value: unknown = JSON.parse(encodeLevelFile(document));
    return value;
  } catch {
    return null;
  }
};

export const decodedDocument = (value: unknown): LevelDocument | null => {
  if (!documentValueSchema.safeParse(value).success) return null;
  try {
    const result = decodeLevelFile(JSON.stringify(value));
    return result.status === 'ok' ? result.document : null;
  } catch {
    return null;
  }
};

const errorName = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('name' in error)) return undefined;
  return typeof error.name === 'string' ? error.name : undefined;
};

const hasErrorName = (error: unknown, target: string, depth = 0): boolean => {
  if (depth > 4 || typeof error !== 'object' || error === null) return false;
  if (errorName(error) === target) return true;
  if ('inner' in error && hasErrorName(error.inner, target, depth + 1)) return true;
  if ('cause' in error && hasErrorName(error.cause, target, depth + 1)) return true;
  return false;
};

export const storageErrorCode = (
  error: unknown,
): 'quota-exceeded' | 'storage-unavailable' | 'unsupported-version' => {
  if (hasErrorName(error, 'QuotaExceededError') || hasErrorName(error, 'QuotaExceeded'))
    return 'quota-exceeded';
  if (hasErrorName(error, 'VersionError')) return 'unsupported-version';
  return 'storage-unavailable';
};

export const isFutureEnvelope = (raw: unknown, currentVersion: number): boolean => {
  if (typeof raw !== 'object' || raw === null || !('envelope' in raw)) return false;
  const envelope = raw.envelope;
  return (
    typeof envelope === 'object' &&
    envelope !== null &&
    'version' in envelope &&
    typeof envelope.version === 'number' &&
    envelope.version > currentVersion
  );
};

type CheckedRow<T> =
  | { readonly status: 'ok'; readonly value: T | null; readonly warning?: 'invalid-data-backed-up' }
  | { readonly status: 'future' };

/** Call only inside a read-write Dexie transaction covering the active table and backups. */
export const checkedRow = async <T>(
  db: Dexie,
  tableName: string,
  key: string | number | readonly string[],
  decode: (raw: unknown) => T | null,
  version: number,
  clock: () => Date,
): Promise<CheckedRow<T>> => {
  const raw: unknown = await db.table(tableName).get(key);
  if (raw === undefined) return { status: 'ok', value: null };
  if (isFutureEnvelope(raw, version)) return { status: 'future' };
  const value = decode(raw);
  if (value !== null) return { status: 'ok', value };
  const createdAt = currentInstant(clock);
  if (createdAt === null) throw new Error('Invalid injected clock');
  await db
    .table('backups')
    .add({ table: tableName, key, reason: 'invalid-data', createdAt, rawValue: raw });
  await db.table(tableName).delete(key);
  return { status: 'ok', value: null, warning: 'invalid-data-backed-up' };
};

export const warningPart = (
  warning?: 'invalid-data-backed-up',
): { readonly warning?: 'invalid-data-backed-up' } => (warning === undefined ? {} : { warning });
