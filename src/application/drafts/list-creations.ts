import type {
  DraftCreation,
  DraftRepository,
  DraftRepositoryErrorCode,
  DraftRepositoryWarning,
} from './draft-repository';

interface ListedCreation {
  readonly id: string;
  readonly creation: DraftCreation;
}

type ListCreationsResult =
  | {
      readonly status: 'ok';
      readonly creations: readonly ListedCreation[];
      readonly warning?: DraftRepositoryWarning;
    }
  | { readonly status: 'error'; readonly code: DraftRepositoryErrorCode };

/**
 * ADR 0015 § Page « Mes niveaux »: every readable creation, most recently
 * saved first. An unreadable entry is left out (the repository has backed it
 * up) and reported once as a warning.
 */
export const listCreations = async (repository: DraftRepository): Promise<ListCreationsResult> => {
  const index = await repository.list();
  if (index.status === 'error') return index;

  let warning = index.warning;
  const creations: ListedCreation[] = [];
  for (const id of index.ids) {
    const loaded = await repository.load(id);
    if (loaded.status === 'error' || loaded.warning !== undefined)
      warning = 'invalid-data-backed-up';
    if (loaded.status === 'ok' && loaded.creation !== null) {
      creations.push({ id, creation: loaded.creation });
    }
  }
  creations.sort(
    (left, right) => Date.parse(right.creation.updatedAt) - Date.parse(left.creation.updatedAt),
  );
  return { status: 'ok', creations, ...(warning === undefined ? {} : { warning }) };
};
