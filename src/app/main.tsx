import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { StartupErrorBoundary } from './StartupErrorBoundary';
import '../ui/styles.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Le point de montage de TinkerBolt est introuvable.');
}

const signalAppReady = () => {
  document.dispatchEvent(new Event('tinkerbolt:app-ready'));
};

const signalAppFailure = () => {
  document.dispatchEvent(new Event('tinkerbolt:app-failed'));
};

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
    <StartupErrorBoundary onFailure={signalAppFailure}>
      <App
        onReady={signalAppReady}
        unlockAllLevels={import.meta.env.DEV}
        developmentMode={import.meta.env.DEV}
      />
    </StartupErrorBoundary>
  </StrictMode>,
);
