import {
  levelDocumentSchema,
  levelDocumentV1Schema,
  levelDocumentV2Schema,
  migrateLevelDocumentV2ToV3,
  migrateLevelDocumentV1ToV2,
  type LevelDocument,
} from '../../domain/level-document';

export const MAX_LEVEL_FILE_SIZE_BYTES = 256 * 1024;

type LevelFileDecodeErrorCode =
  | 'too-large'
  | 'invalid-json'
  | 'unsupported-version'
  | 'invalid-document';

type LevelFileDecodeResult =
  | { readonly status: 'ok'; readonly document: LevelDocument }
  | {
      readonly status: 'error';
      readonly code: LevelFileDecodeErrorCode;
      readonly issues?: readonly {
        readonly path: readonly PropertyKey[];
        readonly message: string;
      }[];
    };

const utf8SizeExceedsLimit = (text: string): boolean => {
  if (text.length > MAX_LEVEL_FILE_SIZE_BYTES) return true;

  let byteCount = 0;
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index);
    if (codeUnit <= 0x7f) {
      byteCount += 1;
    } else if (codeUnit <= 0x7ff) {
      byteCount += 2;
    } else if (
      codeUnit >= 0xd800 &&
      codeUnit <= 0xdbff &&
      index + 1 < text.length &&
      text.charCodeAt(index + 1) >= 0xdc00 &&
      text.charCodeAt(index + 1) <= 0xdfff
    ) {
      byteCount += 4;
      index += 1;
    } else {
      // TextEncoder encodes lone surrogates as the three-byte replacement character.
      byteCount += 3;
    }

    if (byteCount > MAX_LEVEL_FILE_SIZE_BYTES) return true;
  }

  return false;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const decodeLevelFileUnchecked = (text: string): LevelFileDecodeResult => {
  if (utf8SizeExceedsLimit(text)) return { status: 'error', code: 'too-large' };

  let candidate: unknown;
  try {
    candidate = JSON.parse(text);
  } catch {
    return { status: 'error', code: 'invalid-json' };
  }

  if (!isRecord(candidate)) return { status: 'error', code: 'unsupported-version' };

  if (candidate.schemaVersion === 1) {
    const legacy = levelDocumentV1Schema.safeParse(candidate);
    if (!legacy.success) {
      return { status: 'error', code: 'invalid-document', issues: legacy.error.issues };
    }

    const migration = migrateLevelDocumentV1ToV2(legacy.data);
    if (migration.status !== 'migrated') return { status: 'error', code: 'invalid-document' };

    const current = levelDocumentSchema.safeParse(migrateLevelDocumentV2ToV3(migration.document));
    if (!current.success) {
      return { status: 'error', code: 'invalid-document', issues: current.error.issues };
    }
    return { status: 'ok', document: current.data };
  }

  if (candidate.schemaVersion === 2) {
    const legacy = levelDocumentV2Schema.safeParse(candidate);
    if (!legacy.success)
      return { status: 'error', code: 'invalid-document', issues: legacy.error.issues };
    return { status: 'ok', document: migrateLevelDocumentV2ToV3(legacy.data) };
  }

  if (candidate.schemaVersion !== 3) return { status: 'error', code: 'unsupported-version' };

  const current = levelDocumentSchema.safeParse(candidate);
  if (!current.success) {
    return { status: 'error', code: 'invalid-document', issues: current.error.issues };
  }
  return { status: 'ok', document: current.data };
};

/** Encode a validated document in canonical schema order for file interchange. */
export const encodeLevelFile = (document: LevelDocument): string =>
  `${JSON.stringify(levelDocumentSchema.parse(document), null, 2)}\n`;

/** Parse, migrate and validate an untrusted level file without throwing. */
export const decodeLevelFile = (text: string): LevelFileDecodeResult => {
  if (typeof text !== 'string') return { status: 'error', code: 'invalid-json' };
  try {
    return decodeLevelFileUnchecked(text);
  } catch {
    return { status: 'error', code: 'invalid-document' };
  }
};
