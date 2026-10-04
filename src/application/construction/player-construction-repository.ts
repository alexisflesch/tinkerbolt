import type { LevelDocument } from '../../domain/level-document';
import type { ConstructionAttempt } from './construction-attempt';

/** Identity of a validated source; prepared before entering storage transactions. */
export interface PlayerConstructionSource {
  readonly scope: 'campaign' | 'received';
  readonly levelId: string;
  readonly sourceFingerprint: string;
  readonly document: LevelDocument;
}

type PlayerConstructionErrorCode =
  | 'invalid-construction'
  | 'unsupported-version'
  | 'storage-unavailable'
  | 'quota-exceeded'
  | 'fingerprint-unavailable'
  | 'source-not-found'
  | 'source-changed';
type PlayerConstructionWarning = 'invalid-data-backed-up' | 'source-changed';
export type PlayerConstructionWriteResult =
  | { readonly status: 'ok'; readonly warning?: PlayerConstructionWarning }
  | { readonly status: 'error'; readonly code: PlayerConstructionErrorCode };
type PlayerConstructionLoadResult =
  | {
      readonly status: 'ok';
      readonly attempt: ConstructionAttempt | null;
      readonly warning?: PlayerConstructionWarning;
    }
  | { readonly status: 'error'; readonly code: PlayerConstructionErrorCode };

/** Storage only; session write ordering and invalidation belong to the caller. */
export interface PlayerConstructionRepository {
  load(source: PlayerConstructionSource): Promise<PlayerConstructionLoadResult>;
  save(
    source: PlayerConstructionSource,
    attempt: ConstructionAttempt,
  ): Promise<PlayerConstructionWriteResult>;
  delete(source: PlayerConstructionSource): Promise<PlayerConstructionWriteResult>;
}
