import type { DraftRepository, DraftRepositoryErrorCode } from './draft-repository';
import { freeCreationId } from './free-creation-id';
import { withTitleSuffix } from './title-suffix';

type DuplicateCreationResult =
  | { readonly status: 'ok'; readonly draftId: string }
  | { readonly status: 'error'; readonly code: DraftRepositoryErrorCode };

const COPY_SUFFIX = ' (copie)';

export const duplicateCreation = async (
  repository: DraftRepository,
  id: string,
  createId: () => string,
): Promise<DuplicateCreationResult> => {
  const original = await repository.load(id);
  if (original.status === 'error') return original;
  if (original.creation === null) return { status: 'error', code: 'invalid-draft' };
  const { document, source } = original.creation;
  return freeCreationId(repository, createId, (draftId) => ({
    document: {
      ...document,
      id: draftId,
      metadata: {
        ...document.metadata,
        title: withTitleSuffix(document.metadata.title, COPY_SUFFIX),
      },
    },
    ...(source === undefined ? {} : { source }),
  }));
};
