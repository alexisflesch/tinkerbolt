import type Dexie from 'dexie';
import { z } from 'zod';

import type {
  DraftCreation,
  DraftCreationContent,
  DraftRepository,
  DraftRepositoryErrorCode,
  DraftWriteResult,
} from '../../application/drafts/draft-repository';
import {
  checkedRow,
  currentInstant,
  decodedDocument,
  documentValueSchema,
  idSchema,
  instantSchema,
  storageErrorCode,
  storedDocument,
  warningPart,
} from './indexed-db-common';

const envelopeSchema = z.strictObject({
  kind: z.literal('draft'),
  version: z.literal(2),
  data: z.strictObject({
    document: documentValueSchema,
    source: documentValueSchema.optional(),
    updatedAt: instantSchema,
  }),
});
const rowSchema = z.strictObject({
  id: idSchema,
  updatedAt: instantSchema,
  envelope: envelopeSchema,
});

const decodeRow = (raw: unknown, id: string): DraftCreation | null => {
  const parsed = rowSchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.id !== id ||
    parsed.data.updatedAt !== parsed.data.envelope.data.updatedAt
  )
    return null;
  const { document: rawDocument, source: rawSource, updatedAt } = parsed.data.envelope.data;
  const document = decodedDocument(rawDocument);
  if (document === null || document.id !== id) return null;
  if (rawSource === undefined) return { document, updatedAt };
  const source = decodedDocument(rawSource);
  return source === null ? null : { document, source, updatedAt };
};

const prepare = (creation: DraftCreationContent, clock: () => Date): unknown => {
  if (!idSchema.safeParse(creation.document.id).success) return null;
  const updatedAt = currentInstant(clock);
  const document = storedDocument(creation.document);
  const source = creation.source === undefined ? undefined : storedDocument(creation.source);
  if (updatedAt === null || document === null || source === null) return null;
  const row = {
    id: creation.document.id,
    updatedAt,
    envelope: {
      kind: 'draft',
      version: 2,
      data: { document, ...(source === undefined ? {} : { source }), updatedAt },
    },
  };
  return rowSchema.safeParse(row).success ? row : null;
};

const failure = (
  error: unknown,
): { readonly status: 'error'; readonly code: DraftRepositoryErrorCode } => ({
  status: 'error',
  code: storageErrorCode(error),
});

export const createIndexedDBDraftRepository = (db: Dexie, clock: () => Date): DraftRepository => ({
  async list() {
    try {
      return await db.transaction('rw', db.table('creations'), db.table('backups'), async () => {
        const rows: unknown[] = await db.table('creations').toArray();
        const ids: string[] = [];
        let warning = false;
        for (const raw of rows) {
          const key = typeof raw === 'object' && raw !== null && 'id' in raw ? raw.id : undefined;
          if (typeof key !== 'string' && typeof key !== 'number')
            throw new Error('Invalid IndexedDB key');
          const checked = await checkedRow(
            db,
            'creations',
            key,
            (value) => (typeof key === 'string' ? decodeRow(value, key) : null),
            2,
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
      });
    } catch (error) {
      return failure(error);
    }
  },
  async load(id) {
    if (!idSchema.safeParse(id).success) return { status: 'error', code: 'invalid-draft' };
    try {
      return await db.transaction('rw', db.table('creations'), db.table('backups'), async () => {
        const checked = await checkedRow(
          db,
          'creations',
          id,
          (raw) => decodeRow(raw, id),
          2,
          clock,
        );
        if (checked.status === 'future')
          return { status: 'error', code: 'unsupported-version' } as const;
        if (checked.value !== null) {
          const creation = checked.value;
          // Persist migrated level bytes without changing the author's last edit date.
          const row = {
            id,
            updatedAt: creation.updatedAt,
            envelope: {
              kind: 'draft',
              version: 2,
              data: {
                document: storedDocument(creation.document),
                ...(creation.source === undefined
                  ? {}
                  : { source: storedDocument(creation.source) }),
                updatedAt: creation.updatedAt,
              },
            },
          };
          const raw: unknown = await db.table('creations').get(id);
          if (JSON.stringify(raw) !== JSON.stringify(row)) await db.table('creations').put(row);
        }
        return { status: 'ok', creation: checked.value, ...warningPart(checked.warning) } as const;
      });
    } catch (error) {
      return failure(error);
    }
  },
  async save(creation): Promise<DraftWriteResult> {
    const row = prepare(creation, clock);
    if (row === null) return { status: 'error', code: 'invalid-draft' };
    const id = creation.document.id;
    try {
      return await db.transaction('rw', db.table('creations'), db.table('backups'), async () => {
        const checked = await checkedRow(
          db,
          'creations',
          id,
          (raw) => decodeRow(raw, id),
          2,
          clock,
        );
        if (checked.status === 'future')
          return { status: 'error', code: 'unsupported-version' } as const;
        await db.table('creations').put(row);
        return { status: 'ok', ...warningPart(checked.warning) } as const;
      });
    } catch (error) {
      return failure(error);
    }
  },
  async create(creation): Promise<DraftWriteResult> {
    const row = prepare(creation, clock);
    if (row === null) return { status: 'error', code: 'invalid-draft' };
    try {
      await db.table('creations').add(row);
      return { status: 'ok' };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'ConstraintError'
      )
        return { status: 'error', code: 'identity-collision' };
      return failure(error);
    }
  },
  async delete(id): Promise<DraftWriteResult> {
    if (!idSchema.safeParse(id).success) return { status: 'error', code: 'invalid-draft' };
    try {
      return await db.transaction('rw', db.table('creations'), db.table('backups'), async () => {
        const checked = await checkedRow(
          db,
          'creations',
          id,
          (raw) => decodeRow(raw, id),
          2,
          clock,
        );
        if (checked.status === 'future')
          return { status: 'error', code: 'unsupported-version' } as const;
        await db.table('creations').delete(id);
        return { status: 'ok', ...warningPart(checked.warning) } as const;
      });
    } catch (error) {
      return failure(error);
    }
  },
});
