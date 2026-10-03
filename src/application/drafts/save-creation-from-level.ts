import type { LevelDocument, Solution } from '../../domain/level-document';
import { creationFromLevel } from './creation-from-level';
import type { DraftRepository, DraftRepositoryErrorCode } from './draft-repository';
import { freeCreationId } from './free-creation-id';

type SaveCreationFromLevelResult =
  | { readonly status: 'ok'; readonly draftId: string }
  | { readonly status: 'error'; readonly code: DraftRepositoryErrorCode };

interface SaveCreationFromLevelOptions {
  readonly playerSolution?: Solution;
  readonly createId: () => string;
}

/** Modify/remix creates a distinct creation with an exclusive id. */
export const saveCreationFromLevel = (
  repository: DraftRepository,
  level: LevelDocument,
  { playerSolution, createId }: SaveCreationFromLevelOptions,
): Promise<SaveCreationFromLevelResult> =>
  freeCreationId(repository, createId, (draftId) =>
    creationFromLevel(level, {
      ...(playerSolution === undefined ? {} : { playerSolution }),
      createId: () => draftId,
    }),
  );
