import { createContext, useContext } from 'react';
import type { PlayerConstructionRepository } from '../application/construction/player-construction-repository';
import { createPlayerConstructionWrites } from '../application/construction/player-construction-writes';

export const unavailablePlayerConstructionRepository: PlayerConstructionRepository = {
  load: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  save: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  delete: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
};
export const PlayerConstructionContext = createContext(
  createPlayerConstructionWrites(unavailablePlayerConstructionRepository),
);
export const usePlayerConstructionWrites = () => useContext(PlayerConstructionContext);
