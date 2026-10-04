import { z } from 'zod';

import {
  levelDocumentSchema,
  levelDocumentAttemptSchema,
  levelDocumentV2AttemptSchema,
  type LevelDocument,
} from '../../domain/level-document';
import { freezeAttempt } from '../../application/construction/construction-attempt';
import {
  playerConstructionAttemptSchema,
  validatePlayerConstruction,
} from '../../application/construction/player-construction';
import type { PlayerConstructionSource } from '../../application/construction/player-construction-repository';
import { levelSourceFingerprint } from '../level-file/level-fingerprint';
import { idSchema, instantSchema, receivedIdSchema } from '../storage/indexed-db-common';

const sourceIdentitySchema = z
  .strictObject({
    scope: z.enum(['campaign', 'received']),
    levelId: idSchema,
  })
  .refine(
    ({ scope, levelId }) => scope !== 'received' || receivedIdSchema.safeParse(levelId).success,
  );
export const playerConstructionSourceSchema = z
  .strictObject({
    scope: sourceIdentitySchema.shape.scope,
    levelId: idSchema,
    sourceFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    document: levelDocumentSchema,
  })
  .refine(({ scope, levelId, document }) =>
    scope === 'received' ? receivedIdSchema.safeParse(levelId).success : levelId === document.id,
  );

export const playerConstructionEnvelopeSchema = z.strictObject({
  kind: z.literal('player-construction'),
  version: z.literal(1),
  data: z
    .strictObject({
      scope: z.enum(['campaign', 'received']),
      levelId: idSchema,
      sourceFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      updatedAt: instantSchema,
      attempt: playerConstructionAttemptSchema,
    })
    .refine(({ scope, levelId }) => sourceIdentitySchema.safeParse({ scope, levelId }).success),
});
const migratedAttemptSchema = z.union([
  playerConstructionAttemptSchema,
  playerConstructionAttemptSchema
    .extend({ document: levelDocumentV2AttemptSchema })
    .transform(({ document, provenance }) => ({
      document: levelDocumentAttemptSchema.parse({ ...document, schemaVersion: 3 }),
      provenance,
    })),
]);
const migratedEnvelopeSchema = playerConstructionEnvelopeSchema.extend({
  data: z
    .strictObject({
      ...playerConstructionEnvelopeSchema.shape.data.shape,
      attempt: migratedAttemptSchema,
    })
    .refine(({ scope, levelId }) => sourceIdentitySchema.safeParse({ scope, levelId }).success),
});
const rowSchema = z.strictObject({
  scope: z.enum(['campaign', 'received']),
  levelId: idSchema,
  envelope: migratedEnvelopeSchema,
});

type SourceResult =
  | { readonly status: 'ok'; readonly source: PlayerConstructionSource }
  | { readonly status: 'error'; readonly code: 'invalid-construction' | 'fingerprint-unavailable' };

/** Validate and hash the canonical source before starting any IndexedDB transaction. */
export const preparePlayerConstructionSource = async (
  scope: PlayerConstructionSource['scope'],
  levelId: string,
  candidate: LevelDocument,
): Promise<SourceResult> => {
  const parsed = levelDocumentSchema.safeParse(candidate);
  if (
    !parsed.success ||
    !sourceIdentitySchema.safeParse({ scope, levelId }).success ||
    (scope === 'campaign' && parsed.data.id !== levelId)
  )
    return { status: 'error', code: 'invalid-construction' };
  try {
    const sourceFingerprint = await levelSourceFingerprint(parsed.data);
    return {
      status: 'ok',
      source: Object.freeze({
        scope,
        levelId,
        sourceFingerprint,
        document: freezeAttempt(parsed.data, {}).document,
      }),
    };
  } catch {
    return { status: 'error', code: 'fingerprint-unavailable' };
  }
};

/** Strict structural validation precedes compatibility checks against a current source. */
export const decodePlayerConstructionRow = (
  raw: unknown,
  scope: PlayerConstructionSource['scope'],
  levelId: string,
  migrationSource?: {
    readonly legacyFingerprint: string | null;
    readonly currentFingerprint: string;
  },
): z.infer<typeof playerConstructionEnvelopeSchema> | null => {
  const parsed = rowSchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.scope !== scope ||
    parsed.data.levelId !== levelId ||
    parsed.data.envelope.data.scope !== scope ||
    parsed.data.envelope.data.levelId !== levelId
  )
    return null;
  const envelope = parsed.data.envelope;
  // Only rebase an old source fingerprint after comparing its exact v2 bytes.
  // A real source change keeps its old hash and follows the source-changed path.
  if (migrationSource?.legacyFingerprint === envelope.data.sourceFingerprint) {
    return {
      ...envelope,
      data: { ...envelope.data, sourceFingerprint: migrationSource.currentFingerprint },
    };
  }
  return envelope;
};

export const constructionForSource = (
  envelope: z.infer<typeof playerConstructionEnvelopeSchema>,
  source: PlayerConstructionSource,
) => validatePlayerConstruction(source.document, envelope.data.attempt);
