import type { DraftRepository } from './draft-repository';
import { listCreations } from './list-creations';

/**
 * ADR 0015 (amendment of 6 Oct. 2026): the creation « Atelier » reopens, the
 * most recently saved one that may be opened. An unreadable repository gives
 * none, so the free workshop opens as before.
 */
export const lastEditableCreationId = async (
  repository: DraftRepository,
  isLocked: (creationId: string) => boolean,
): Promise<string | null> => {
  const listed = await listCreations(repository);
  if (listed.status === 'error') return null;
  return listed.creations.find(({ id }) => !isLocked(id))?.id ?? null;
};
