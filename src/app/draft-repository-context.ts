import { createContext, useContext } from 'react';

import type { DraftRepository } from '../application/drafts/draft-repository';

export const unavailableDraftRepository: DraftRepository = {
  list: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  load: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  save: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  delete: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  create: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
};

/** L26 drafts, provided by `App`; without a provider nothing is stored. */
export const DraftRepositoryContext = createContext<DraftRepository>(unavailableDraftRepository);

export const useDraftRepository = (): DraftRepository => useContext(DraftRepositoryContext);
