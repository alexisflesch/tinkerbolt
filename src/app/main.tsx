import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import '../ui/styles.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Le point de montage de TinkerBolt est introuvable.');
}

/**
 * U5b: only this entry point may read `import.meta.env.DEV` — the domain and
 * `useCampaignProgress()` never do, since Vitest sets it to `true` and would
 * break the lock tests. Under `pnpm dev` every level unlocks, in the list and
 * by direct URL; a production build (and Playwright, which serves it) keeps
 * the real campaign lock. `developmentMode` likewise reveals the solution of
 * a new campaign creation (ADR 0015 § Révéler).
 */
createRoot(rootElement).render(
  <StrictMode>
    <App unlockAllLevels={import.meta.env.DEV} developmentMode={import.meta.env.DEV} />
  </StrictMode>,
);
