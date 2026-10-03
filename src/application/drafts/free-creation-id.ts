import type {
  DraftCreationContent,
  DraftRepository,
  DraftRepositoryErrorCode,
} from './draft-repository';

type FreeCreationIdResult =
  | { readonly status: 'ok'; readonly draftId: string }
  | { readonly status: 'error'; readonly code: DraftRepositoryErrorCode };

const MAX_ID_ATTEMPTS = 10;

/** Exclusive insertion is the identity check, so competing tabs cannot overwrite a creation. */
export const freeCreationId = async (
  repository: DraftRepository,
  createId: () => string,
  contentForId: (id: string) => DraftCreationContent,
): Promise<FreeCreationIdResult> => {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const draftId = `creation-${createId()}`;
    const result = await repository.create(contentForId(draftId));
    if (result.status === 'ok') return { status: 'ok', draftId };
    if (result.code !== 'identity-collision') return result;
  }
  return { status: 'error', code: 'identity-collision' };
};
