import type Dexie from 'dexie';
import { z } from 'zod';

import type { CampaignProgress } from '../../application/progression';
import { recordSuccess } from '../../application/progression';
import type {
  ProgressRepository,
  ProgressRepositoryErrorCode,
} from '../../application/progression/progress-repository';
import {
  checkedRow,
  isFutureEnvelope,
  idSchema,
  storageErrorCode,
  warningPart,
} from './indexed-db-common';
import { decodePlayerConstructionRow } from '../player-construction/player-construction-codec';

import { progressSchema, progressEnvelopeSchema } from '../progress-file/progress-file-codec';

const rowSchema = z.strictObject({ id: z.literal('campaign'), envelope: progressEnvelopeSchema });
const decodeRow = (raw: unknown): CampaignProgress | null => {
  const parsed = rowSchema.safeParse(raw);
  return parsed.success ? parsed.data.envelope.data : null;
};
const rowFor = (progress: CampaignProgress) => ({
  id: 'campaign',
  envelope: { kind: 'progress', version: 1, data: progress },
});
const failure = (
  error: unknown,
): { readonly status: 'error'; readonly code: ProgressRepositoryErrorCode } => ({
  status: 'error',
  code: storageErrorCode(error),
});

export const createIndexedDBProgressRepository = (
  db: Dexie,
  clock: () => Date,
): ProgressRepository => ({
  async load() {
    try {
      return await db.transaction('rw', db.table('progress'), db.table('backups'), async () => {
        const checked = await checkedRow(db, 'progress', 'campaign', decodeRow, 1, clock);
        return checked.status === 'future'
          ? ({ status: 'error', code: 'unsupported-version' } as const)
          : ({
              status: 'ok',
              progress: checked.value ?? {},
              ...warningPart(checked.warning),
            } as const);
      });
    } catch (error) {
      return failure(error);
    }
  },
  async save(progress) {
    if (!progressSchema.safeParse(progress).success)
      return { status: 'error', code: 'invalid-progress' };
    try {
      return await db.transaction('rw', db.table('progress'), db.table('backups'), async () => {
        const checked = await checkedRow(db, 'progress', 'campaign', decodeRow, 1, clock);
        if (checked.status === 'future')
          return { status: 'error', code: 'unsupported-version' } as const;
        await db.table('progress').put(rowFor(progress));
        return { status: 'ok', ...warningPart(checked.warning) } as const;
      });
    } catch (error) {
      return failure(error);
    }
  },
  async merge(imported) {
    const validated = progressSchema.safeParse(imported);
    if (!validated.success) return { status: 'error', code: 'invalid-progress' };
    try {
      return await db.transaction('rw', db.table('progress'), db.table('backups'), async () => {
        const checked = await checkedRow(db, 'progress', 'campaign', decodeRow, 1, clock);
        if (checked.status === 'future')
          return { status: 'error', code: 'unsupported-version' } as const;
        let progress: CampaignProgress = checked.value ?? {};
        for (const [id, result] of Object.entries(validated.data)) {
          if (result.resolved && result.bestObjectCount !== null)
            progress = recordSuccess(progress, id, result.bestObjectCount);
          else if (progress[id] === undefined) progress = { ...progress, [id]: result };
        }
        await db.table('progress').put(rowFor(progress));
        return { status: 'ok', progress, ...warningPart(checked.warning) } as const;
      });
    } catch (error) {
      return failure(error);
    }
  },
  async recordVictory(levelId, objectsUsed) {
    if (
      !idSchema.safeParse(levelId).success ||
      !Number.isSafeInteger(objectsUsed) ||
      objectsUsed < 0
    )
      return { status: 'error', code: 'invalid-progress' };
    try {
      return await db.transaction('rw', db.table('progress'), db.table('backups'), async () => {
        const checked = await checkedRow(db, 'progress', 'campaign', decodeRow, 1, clock);
        if (checked.status === 'future')
          return { status: 'error', code: 'unsupported-version' } as const;
        const progress = recordSuccess(checked.value ?? {}, levelId, objectsUsed);
        await db.table('progress').put(rowFor(progress));
        return { status: 'ok', progress, ...warningPart(checked.warning) } as const;
      });
    } catch (error) {
      return failure(error);
    }
  },
  async clear() {
    try {
      return await db.transaction(
        'rw',
        db.table('progress'),
        db.table('playerConstructions'),
        db.table('backups'),
        async () => {
          const constructions: unknown[] = await db
            .table('playerConstructions')
            .where('scope')
            .equals('campaign')
            .toArray();
          if (constructions.some((row) => isFutureEnvelope(row, 1)))
            return { status: 'error', code: 'unsupported-version' } as const;
          const checked = await checkedRow(db, 'progress', 'campaign', decodeRow, 1, clock);
          if (checked.status === 'future')
            return { status: 'error', code: 'unsupported-version' } as const;
          let warning = checked.warning;
          for (const row of constructions) {
            const levelId =
              typeof row === 'object' && row !== null && 'levelId' in row ? row.levelId : undefined;
            if (typeof levelId !== 'string') throw new Error('Invalid construction key');
            const checkedConstruction = await checkedRow(
              db,
              'playerConstructions',
              ['campaign', levelId],
              (raw) => decodePlayerConstructionRow(raw, 'campaign', levelId),
              1,
              clock,
            );
            if (checkedConstruction.status === 'future')
              return { status: 'error', code: 'unsupported-version' } as const;
            warning ??= checkedConstruction.warning;
          }
          await db.table('progress').delete('campaign');
          await db.table('playerConstructions').where('scope').equals('campaign').delete();
          return { status: 'ok', ...warningPart(warning) } as const;
        },
      );
    } catch (error) {
      return failure(error);
    }
  },
});
