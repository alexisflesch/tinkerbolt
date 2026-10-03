import type { LevelDocument } from '../../domain/level-document';

/**
 * A creation (ADR 0015 § Stockage local): the author's level in workshop shape,
 * with an optional full copy of the level it comes from, in puzzle shape.
 */
export interface DraftCreation {
  readonly document: LevelDocument;
  /** Copy of the original level; it never lives inside the `LevelDocument`. */
  readonly source?: LevelDocument;
  /** ISO 8601 instant of the last save, from the repository's injected clock. */
  readonly updatedAt: string;
}

/** What a caller saves; the repository dates it with its injected clock. */
export type DraftCreationContent = Omit<DraftCreation, 'updatedAt'>;

export type DraftRepositoryErrorCode =
  | 'storage-unavailable'
  | 'quota-exceeded'
  | 'invalid-draft'
  | 'identity-collision'
  | 'unsupported-version';

export type DraftRepositoryWarning = 'invalid-data-backed-up';

type DraftIndexLoadResult =
  | {
      readonly status: 'ok';
      readonly ids: readonly string[];
      readonly warning?: DraftRepositoryWarning;
    }
  | { readonly status: 'error'; readonly code: DraftRepositoryErrorCode };

export type DraftLoadResult =
  | {
      readonly status: 'ok';
      readonly creation: DraftCreation | null;
      readonly warning?: DraftRepositoryWarning;
    }
  | { readonly status: 'error'; readonly code: DraftRepositoryErrorCode };

export type DraftWriteResult =
  | { readonly status: 'ok'; readonly warning?: DraftRepositoryWarning }
  | { readonly status: 'error'; readonly code: DraftRepositoryErrorCode };

/** Application port for author-created levels stored locally. */
export interface DraftRepository {
  list(): Promise<DraftIndexLoadResult>;
  load(id: string): Promise<DraftLoadResult>;
  save(creation: DraftCreationContent): Promise<DraftWriteResult>;
  create(creation: DraftCreationContent): Promise<DraftWriteResult>;
  delete(id: string): Promise<DraftWriteResult>;
}
