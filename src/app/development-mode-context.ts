import { createContext, useContext } from 'react';

/**
 * ADR 0015 § Révéler: under `pnpm dev` (`import.meta.env.DEV`, read by
 * `main.tsx` only, like `unlockAllLevels`), a new campaign creation opens
 * with the author's solution revealed.
 * `false` without a provider: production builds, Playwright and tests.
 */
export const DevelopmentModeContext = createContext(false);

export const useDevelopmentMode = (): boolean => useContext(DevelopmentModeContext);
