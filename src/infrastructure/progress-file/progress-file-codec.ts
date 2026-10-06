import { z } from 'zod';
import type { CampaignProgress } from '../../application/progression';

const levelProgressSchema = z
  .strictObject({
    resolved: z.boolean(),
    bestObjectCount: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  })
  .refine(({ resolved, bestObjectCount }) => resolved === (bestObjectCount !== null));

/** Shared by file imports and IndexedDB; progress never carries engine or UI state. */
// Zod skips __proto__ in records: reject it before parsing rather than silently dropping it.
export const progressSchema = z
  .unknown()
  .refine((raw) => !(typeof raw === 'object' && raw !== null && Object.hasOwn(raw, '__proto__')))
  .pipe(
    z.record(
      z
        .string()
        .min(1)
        .max(128)
        .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/),
      levelProgressSchema,
    ),
  );
export const progressEnvelopeSchema = z.strictObject({
  kind: z.literal('progress'),
  version: z.literal(1),
  data: progressSchema,
});
export const MAX_PROGRESS_FILE_SIZE_BYTES = 256 * 1024;

type ProgressFileResult =
  | { readonly status: 'ok'; readonly progress: CampaignProgress }
  | {
      readonly status: 'error';
      readonly code: 'too-large' | 'invalid-json' | 'unsupported-version' | 'invalid-progress';
    };

export const decodeProgressFile = (text: string): ProgressFileResult => {
  if (new TextEncoder().encode(text).length > MAX_PROGRESS_FILE_SIZE_BYTES)
    return { status: 'error', code: 'too-large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { status: 'error', code: 'invalid-json' };
  }
  const version = z.object({ kind: z.literal('progress'), version: z.number() }).safeParse(raw);
  if (version.success && version.data.version !== 1)
    return { status: 'error', code: 'unsupported-version' };
  const parsed = progressEnvelopeSchema.safeParse(raw);
  return parsed.success
    ? { status: 'ok', progress: parsed.data.data }
    : { status: 'error', code: 'invalid-progress' };
};

export const encodeProgressFile = (progress: CampaignProgress): string => {
  const envelope = progressEnvelopeSchema.parse({ kind: 'progress', version: 1, data: progress });
  const text = JSON.stringify(envelope, null, 2);
  if (new TextEncoder().encode(text).length > MAX_PROGRESS_FILE_SIZE_BYTES)
    throw new RangeError('La progression dépasse 256 Kio.');
  return text;
};
