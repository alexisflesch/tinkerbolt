import type { CampaignProgress } from './index';

export type ProgressRepositoryErrorCode =
  | 'storage-unavailable'
  | 'quota-exceeded'
  | 'invalid-progress'
  | 'unsupported-version';

export type ProgressLoadResult =
  | {
      readonly status: 'ok';
      readonly progress: CampaignProgress;
      readonly warning?: 'invalid-data-backed-up';
    }
  | { readonly status: 'error'; readonly code: ProgressRepositoryErrorCode };

export type ProgressSaveResult =
  | { readonly status: 'ok'; readonly warning?: 'invalid-data-backed-up' }
  | { readonly status: 'error'; readonly code: ProgressRepositoryErrorCode };

export type ProgressVictoryResult =
  | {
      readonly status: 'ok';
      readonly progress: CampaignProgress;
      readonly warning?: 'invalid-data-backed-up';
    }
  | { readonly status: 'error'; readonly code: ProgressRepositoryErrorCode };

/** Application port for the campaign's small, local progress record. */
export interface ProgressRepository {
  load(): Promise<ProgressLoadResult>;
  save(progress: CampaignProgress): Promise<ProgressSaveResult>;
  /** Merge validated imported records atomically, preserving every better result. */
  merge(progress: CampaignProgress): Promise<ProgressVictoryResult>;
  recordVictory(levelId: string, objectsUsed: number): Promise<ProgressVictoryResult>;
  /**
   * U11: forget the whole campaign progress (resolved levels, records, hence
   * unlocks). Nothing else is touched: creations, received levels and
   * preferences live under their own keys.
   */
  clear(): Promise<ProgressSaveResult>;
}
