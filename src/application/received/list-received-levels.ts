import type {
  ReceivedLevel,
  ReceivedLevelRepository,
  ReceivedLevelRepositoryErrorCode,
  ReceivedLevelRepositoryWarning,
} from './received-level-repository';

type ListReceivedLevelsResult =
  | {
      readonly status: 'ok';
      readonly levels: readonly ReceivedLevel[];
      readonly warning?: ReceivedLevelRepositoryWarning;
    }
  | { readonly status: 'error'; readonly code: ReceivedLevelRepositoryErrorCode };

/**
 * ADR 0015 § Page « Mes niveaux »: every readable received level, most
 * recently received first. An unreadable entry is left out (the repository
 * has backed it up) and reported once as a warning.
 */
export const listReceivedLevels = async (
  repository: ReceivedLevelRepository,
): Promise<ListReceivedLevelsResult> => {
  const index = await repository.list();
  if (index.status === 'error') return index;

  let warning = index.warning;
  const levels: ReceivedLevel[] = [];
  for (const id of index.ids) {
    const loaded = await repository.load(id);
    if (loaded.status === 'error' || loaded.warning !== undefined)
      warning = 'invalid-data-backed-up';
    if (loaded.status === 'ok' && loaded.level !== null) levels.push(loaded.level);
  }
  levels.sort((left, right) => Date.parse(right.receivedAt) - Date.parse(left.receivedAt));
  return { status: 'ok', levels, ...(warning === undefined ? {} : { warning }) };
};
