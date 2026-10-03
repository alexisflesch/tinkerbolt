import type { PreferencesRepository, PreferencesSaveResult } from './preferences-repository';

/** Patch only the pseudonym; the repository reads and merges other preferences atomically. */
export const rememberAuthor = async (
  repository: PreferencesRepository,
  author: string | undefined,
): Promise<PreferencesSaveResult> => {
  try {
    const patched = await repository.patch({ author: author ?? null });
    return patched.status === 'error'
      ? patched
      : { status: 'ok', ...(patched.warning === undefined ? {} : { warning: patched.warning }) };
  } catch {
    return { status: 'error', code: 'storage-unavailable' };
  }
};
