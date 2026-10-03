import type { ConstructionAttempt } from '../construction';
import type { LevelDocument } from '../../domain/level-document';
import { countObjectsUsed } from '../progression';
import { solutionFromAttempt } from '../puzzle/player-solution';
import type {
  ReceivedLevel,
  ReceivedLevelRepository,
  ReceivedLevelRepositoryErrorCode,
} from './received-level-repository';

type RecordReceivedVictoryResult =
  | { readonly status: 'recorded'; readonly level: ReceivedLevel }
  /** The entry is gone (deleted elsewhere): nothing is written. */
  | { readonly status: 'not-found' }
  /** The victory could not be stored; the game goes on. */
  | { readonly status: 'not-kept'; readonly code: ReceivedLevelRepositoryErrorCode };

/**
 * ADR 0015 § Victoire sur un niveau reçu: a victory marks the entry solved,
 * keeps the best object count (ADR 0010 definition) and replaces the
 * player's solution by the winning one. `attempt` is the snapshot taken at
 * launch, as for the campaign progression. A storage failure is a result,
 * never an exception.
 */
export const recordReceivedVictory = async (
  repository: ReceivedLevelRepository,
  id: string,
  source: LevelDocument,
  attempt: ConstructionAttempt,
): Promise<RecordReceivedVictoryResult> => {
  const objectsUsed = countObjectsUsed(attempt);
  const saved = await repository.recordVictory(
    id,
    source,
    objectsUsed,
    solutionFromAttempt(attempt),
  );
  if (saved.status === 'error') return { status: 'not-kept', code: saved.code };
  if (saved.level === null) return { status: 'not-found' };
  return { status: 'recorded', level: saved.level };
};
