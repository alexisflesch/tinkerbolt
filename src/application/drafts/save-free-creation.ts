import type { LevelDocument } from '../../domain/level-document';
import type {
  DraftRepository,
  DraftRepositoryErrorCode,
  DraftWriteResult,
} from './draft-repository';
import { freeCreationId } from './free-creation-id';

type StartFreeCreationResult =
  | { readonly status: 'ok'; readonly draftId: string }
  | { readonly status: 'error'; readonly code: DraftRepositoryErrorCode };

/** Later committed changes update the creation already adopted by the workshop. */
export const saveFreeCreation = (
  repository: DraftRepository,
  draftId: string,
  document: LevelDocument,
): Promise<DraftWriteResult> => repository.save({ document: { ...document, id: draftId } });

/** The first committed change adopts an id only after its exclusive insertion succeeds. */
export const startFreeCreation = (
  repository: DraftRepository,
  document: LevelDocument,
  createId: () => string,
): Promise<StartFreeCreationResult> =>
  freeCreationId(repository, createId, (draftId) => ({ document: { ...document, id: draftId } }));
