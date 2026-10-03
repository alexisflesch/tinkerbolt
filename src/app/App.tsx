import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import type { DraftRepository } from '../application/drafts/draft-repository';
import type { PreferencesRepository } from '../application/preferences/preferences-repository';
import type { ProgressRepository } from '../application/progression/progress-repository';
import type { ReceivedLevelRepository } from '../application/received/received-level-repository';
import { createLocalStorageDraftRepository } from '../infrastructure/storage/local-storage-draft-repository';
import { createLocalStoragePreferencesRepository } from '../infrastructure/storage/local-storage-preferences-repository';
import { createLocalStorageProgressRepository } from '../infrastructure/storage/local-storage-progress-repository';
import { createLocalStorageReceivedLevelRepository } from '../infrastructure/storage/local-storage-received-level-repository';

import { BenchPage } from './BenchPage';
import { BenchPlayPage } from './BenchPlayPage';
import { EditorPage } from './EditorPage';
import { HomePage } from './HomePage';
import { LevelsPage } from './LevelsPage';
import { MyLevelsPage } from './MyLevelsPage';
import { PlayLevelPage } from './PlayLevelPage';
import { ReceivedLevelPlayPage } from './ReceivedLevelPlayPage';
import { SettingsPage } from './SettingsPage';
import { SharedLevelPage } from './SharedLevelPage';
import { CampaignProgressProvider } from './CampaignProgressProvider';
import { DevelopmentModeContext } from './development-mode-context';
import { DraftRepositoryContext, unavailableDraftRepository } from './draft-repository-context';
import {
  PreferencesRepositoryContext,
  unavailablePreferencesRepository,
} from './preferences-repository-context';
import { PwaUpdateProvider, type RegisterServiceWorker } from './PwaUpdateProvider';
import {
  ReceivedLevelRepositoryContext,
  unavailableReceivedLevelRepository,
} from './received-level-repository-context';

/** Route declarations only (ADR 0008); each route's screen lives in its own page module. */
interface AppProps {
  /** Injectable local progress port, primarily used by application tests. */
  readonly progressRepository?: ProgressRepository;
  /** Injectable local draft port (L26); defaults to `localStorage`. */
  readonly draftRepository?: DraftRepository;
  /** Injectable local port for received levels (ADR 0015); defaults to `localStorage`. */
  readonly receivedLevelRepository?: ReceivedLevelRepository;
  /** Injectable local preferences port (ADR 0011, M14); defaults to `localStorage`. */
  readonly preferencesRepository?: PreferencesRepository;
  /**
   * Dev-mode override (U5b): `main.tsx` passes `import.meta.env.DEV` here so
   * every level is unlocked under `pnpm dev`, in the list and by direct URL.
   * Defaults to `false`, which is what a production build (and Playwright)
   * always gets.
   */
  readonly unlockAllLevels?: boolean;
  /**
   * Dev-mode tools (ADR 0015 § Révéler): `main.tsx` passes
   * `import.meta.env.DEV`; a new campaign creation opens with its solution
   * revealed. `false` by default.
   */
  readonly developmentMode?: boolean;
  /** U10: replaces the production service worker registration (tests only). */
  readonly registerServiceWorker?: RegisterServiceWorker;
}

const unavailableProgressRepository: ProgressRepository = {
  load: () => ({ status: 'error', code: 'storage-unavailable' }),
  save: () => ({ status: 'error', code: 'storage-unavailable' }),
  clear: () => ({ status: 'error', code: 'storage-unavailable' }),
};

const createBrowserProgressRepository = (): ProgressRepository => {
  try {
    if (typeof window === 'undefined') return unavailableProgressRepository;
    return createLocalStorageProgressRepository(window.localStorage);
  } catch {
    return unavailableProgressRepository;
  }
};

const createBrowserDraftRepository = (): DraftRepository => {
  try {
    if (typeof window === 'undefined') return unavailableDraftRepository;
    // Composition point: the real clock is injected here, like `BenchPage`'s default `now`.
    return createLocalStorageDraftRepository(window.localStorage, () => new Date());
  } catch {
    return unavailableDraftRepository;
  }
};

const createBrowserReceivedLevelRepository = (): ReceivedLevelRepository => {
  try {
    if (typeof window === 'undefined') return unavailableReceivedLevelRepository;
    return createLocalStorageReceivedLevelRepository(window.localStorage);
  } catch {
    return unavailableReceivedLevelRepository;
  }
};

const createBrowserPreferencesRepository = (): PreferencesRepository => {
  try {
    if (typeof window === 'undefined') return unavailablePreferencesRepository;
    return createLocalStoragePreferencesRepository(window.localStorage);
  } catch {
    return unavailablePreferencesRepository;
  }
};

export function App({
  progressRepository,
  draftRepository,
  receivedLevelRepository,
  preferencesRepository,
  unlockAllLevels = false,
  developmentMode = false,
  registerServiceWorker,
}: AppProps = {}) {
  const [browserDraftRepository] = useState(() =>
    draftRepository === undefined ? createBrowserDraftRepository() : unavailableDraftRepository,
  );
  const [browserReceivedLevelRepository] = useState(() =>
    receivedLevelRepository === undefined
      ? createBrowserReceivedLevelRepository()
      : unavailableReceivedLevelRepository,
  );
  const [browserPreferencesRepository] = useState(() =>
    preferencesRepository === undefined
      ? createBrowserPreferencesRepository()
      : unavailablePreferencesRepository,
  );
  const [browserProgressRepository] = useState(() =>
    progressRepository === undefined
      ? createBrowserProgressRepository()
      : unavailableProgressRepository,
  );
  const repository = progressRepository ?? browserProgressRepository;

  return (
    <PwaUpdateProvider registerServiceWorker={registerServiceWorker}>
      <DevelopmentModeContext value={developmentMode}>
        <CampaignProgressProvider repository={repository} unlockAllLevels={unlockAllLevels}>
          <DraftRepositoryContext value={draftRepository ?? browserDraftRepository}>
            <ReceivedLevelRepositoryContext
              value={receivedLevelRepository ?? browserReceivedLevelRepository}
            >
              <PreferencesRepositoryContext
                value={preferencesRepository ?? browserPreferencesRepository}
              >
                <BrowserRouter basename={import.meta.env.BASE_URL}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/levels" element={<LevelsPage />} />
                    <Route path="/levels/:levelId/play" element={<PlayLevelPage />} />
                    <Route path="/editor" element={<EditorPage />} />
                    <Route path="/my-levels" element={<MyLevelsPage />} />
                    <Route path="/my-levels/:id/play" element={<ReceivedLevelPlayPage />} />
                    <Route path="/import" element={<Navigate to="/my-levels" replace />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/shared" element={<SharedLevelPage />} />
                    <Route path="/bench" element={<BenchPage />} />
                    <Route path="/bench/play" element={<BenchPlayPage />} />
                    <Route path="*" element={<Navigate to="/levels" replace />} />
                  </Routes>
                </BrowserRouter>
              </PreferencesRepositoryContext>
            </ReceivedLevelRepositoryContext>
          </DraftRepositoryContext>
        </CampaignProgressProvider>
      </DevelopmentModeContext>
    </PwaUpdateProvider>
  );
}
