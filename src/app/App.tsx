import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import type { DraftRepository } from '../application/drafts/draft-repository';
import type { PreferencesRepository } from '../application/preferences/preferences-repository';
import type { ProgressRepository } from '../application/progression/progress-repository';
import type { ReceivedLevelRepository } from '../application/received/received-level-repository';
import { createIndexedDBDraftRepository } from '../infrastructure/storage/indexed-db-draft-repository';
import { createIndexedDBPreferencesRepository } from '../infrastructure/storage/indexed-db-preferences-repository';
import { createIndexedDBProgressRepository } from '../infrastructure/storage/indexed-db-progress-repository';
import { createIndexedDBReceivedLevelRepository } from '../infrastructure/storage/indexed-db-received-level-repository';

import { createTinkerboltDatabase } from '../infrastructure/storage/tinkerbolt-database';
import type { PlayerConstructionRepository } from '../application/construction/player-construction-repository';
import { createPlayerConstructionWrites } from '../application/construction/player-construction-writes';
import { createIndexedDBPlayerConstructionRepository } from '../infrastructure/storage/indexed-db-player-construction-repository';
import {
  PlayerConstructionContext,
  unavailablePlayerConstructionRepository,
} from './player-construction-context';

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
  /** Called after the first application tree has committed to the DOM. */
  readonly onReady?: () => void;
  readonly playerConstructionRepository?: PlayerConstructionRepository;
  /** Injectable local progress port, primarily used by application tests. */
  readonly progressRepository?: ProgressRepository;
  /** Injectable local draft port (L26); defaults to IndexedDB. */
  readonly draftRepository?: DraftRepository;
  /** Injectable local port for received levels (ADR 0015); defaults to IndexedDB. */
  readonly receivedLevelRepository?: ReceivedLevelRepository;
  /** Injectable local preferences port (ADR 0011, M14); defaults to IndexedDB. */
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
  merge: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  load: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  save: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  recordVictory: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
  clear: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
};

const browserRepositories = () => {
  if (typeof indexedDB === 'undefined' || typeof IDBKeyRange === 'undefined')
    return {
      drafts: unavailableDraftRepository,
      received: unavailableReceivedLevelRepository,
      preferences: unavailablePreferencesRepository,
      progress: unavailableProgressRepository,
      constructions: unavailablePlayerConstructionRepository,
    };
  const db = createTinkerboltDatabase({ indexedDB, IDBKeyRange });
  const clock = () => new Date();
  return {
    drafts: createIndexedDBDraftRepository(db, clock),
    received: createIndexedDBReceivedLevelRepository(db, clock),
    preferences: createIndexedDBPreferencesRepository(db, clock),
    progress: createIndexedDBProgressRepository(db, clock),
    constructions: createIndexedDBPlayerConstructionRepository(db, clock),
  };
};

export function App({
  onReady,
  playerConstructionRepository,
  progressRepository,
  draftRepository,
  receivedLevelRepository,
  preferencesRepository,
  unlockAllLevels = false,
  developmentMode = false,
  registerServiceWorker,
}: AppProps = {}) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  const [browser] = useState(browserRepositories);
  const repository = progressRepository ?? browser.progress;
  const constructions = playerConstructionRepository ?? browser.constructions;
  const constructionWrites = useMemo(
    () => createPlayerConstructionWrites(constructions),
    [constructions],
  );

  return (
    <PwaUpdateProvider registerServiceWorker={registerServiceWorker}>
      <DevelopmentModeContext value={developmentMode}>
        <PlayerConstructionContext value={constructionWrites}>
          <CampaignProgressProvider repository={repository} unlockAllLevels={unlockAllLevels}>
            <DraftRepositoryContext value={draftRepository ?? browser.drafts}>
              <ReceivedLevelRepositoryContext value={receivedLevelRepository ?? browser.received}>
                <PreferencesRepositoryContext value={preferencesRepository ?? browser.preferences}>
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
        </PlayerConstructionContext>
      </DevelopmentModeContext>
    </PwaUpdateProvider>
  );
}
