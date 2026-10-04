import type { LevelDocument } from '../../domain/level-document';
import { encodeLevelFile } from './level-file-codec';

const FINGERPRINT_HEX_DIGITS = 16;

/** Full SHA-256 of the canonical file bytes, for source compatibility (ADR 0017). */
export const levelSourceFingerprint = async (document: LevelDocument): Promise<string> => {
  const bytes = new TextEncoder().encode(encodeLevelFile(document));
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** ADR 0015 received identity keeps the first sixteen hexadecimal digits. */
export const levelFingerprint = async (document: LevelDocument): Promise<string> =>
  (await levelSourceFingerprint(document)).slice(0, FINGERPRINT_HEX_DIGITS);
