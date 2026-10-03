import { createContext, useContext } from 'react';

import type { ReceivedLevelRepository } from '../application/received/received-level-repository';

export const unavailableReceivedLevelRepository: ReceivedLevelRepository = {
  list: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  load: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  save: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  delete: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  receive: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  recordVictory: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
};

/** Received levels (ADR 0015), provided by `App`; without a provider nothing is stored. */
export const ReceivedLevelRepositoryContext = createContext<ReceivedLevelRepository>(
  unavailableReceivedLevelRepository,
);

export const useReceivedLevelRepository = (): ReceivedLevelRepository =>
  useContext(ReceivedLevelRepositoryContext);
