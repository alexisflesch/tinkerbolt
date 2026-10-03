import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  evaluateTier,
  isLevelUnlocked,
  nextChallengeHint,
  recordSuccess,
  type CampaignProgress,
} from '../application/progression';
import type {
  ProgressRepository,
  ProgressRepositoryErrorCode,
  ProgressSaveResult,
} from '../application/progression/progress-repository';
import { campaignChapters } from '../content/embedded-levels';
import { CampaignProgressContext } from './campaign-progress-context';

interface CampaignProgressProviderProps {
  readonly repository: ProgressRepository;
  /**
   * Dev-mode override, injected from `main.tsx` via `App` (`import.meta.env.DEV`).
   * Defaults to `false` so tests and production builds keep the real lock.
   */
  readonly unlockAllLevels?: boolean;
  readonly children: ReactNode;
}

export function CampaignProgressProvider({
  repository,
  unlockAllLevels = false,
  children,
}: CampaignProgressProviderProps) {
  const [progress, setProgress] = useState<CampaignProgress>({});
  const progressRef = useRef(progress);
  const [loading, setLoading] = useState(true);
  const [known, setKnown] = useState(false);
  const storagePersistenceRequestedRef = useRef(false);
  const [storageError, setStorageError] = useState<ProgressRepositoryErrorCode | null>(null);
  const [storageWarning, setStorageWarning] = useState<'invalid-data-backed-up' | null>(null);
  const generation = useRef(0);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const resetting = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);
    void repository.load().then((result) => {
      if (generation.current !== current) return;
      if (result.status === 'ok') {
        progressRef.current = result.progress;
        setProgress(result.progress);
        setKnown(true);
        setStorageWarning(result.warning ?? null);
      } else setStorageError(result.code);
      setLoading(false);
    });
    return () => {
      generation.current += 1;
    };
  }, [repository]);

  const recordCampaignSuccess = useCallback(
    (levelId: string, objectsUsed: number): void => {
      if (resetting.current) return;
      const current = generation.current;
      const updated = recordSuccess(progressRef.current, levelId, objectsUsed);
      progressRef.current = updated;
      setProgress(updated);
      writes.current = writes.current.then(async () => {
        const result = await repository
          .recordVictory(levelId, objectsUsed)
          .catch(() => ({ status: 'error' as const, code: 'storage-unavailable' as const }));
        if (generation.current !== current) return;
        setStorageError(result.status === 'error' ? result.code : null);
        if (result.status === 'ok') setKnown(true);
      });
      if (!storagePersistenceRequestedRef.current) {
        storagePersistenceRequestedRef.current = true;
        try {
          if (typeof navigator !== 'undefined' && typeof navigator.storage.persist === 'function')
            void navigator.storage.persist().catch(() => false);
        } catch {
          /* A browser refusal must not block play. */
        }
      }
    },
    [repository],
  );

  const resetCampaignProgress = useCallback(async (): Promise<ProgressSaveResult> => {
    resetting.current = true;
    generation.current += 1;
    await writes.current;
    let result: ProgressSaveResult;
    try {
      result = await repository.clear();
    } catch {
      result = { status: 'error', code: 'storage-unavailable' };
    }
    if (result.status === 'ok') {
      progressRef.current = {};
      setProgress({});
      setStorageError(null);
      setKnown(true);
    } else setStorageError(result.code);
    resetting.current = false;
    return result;
  }, [repository]);

  const levels = useMemo(() => {
    const entries = campaignChapters.flatMap(({ levels: chapterLevels }) =>
      chapterLevels.map((level) => {
        const saved = progress[level.id];
        const resolved = saved?.resolved === true;
        const bestObjectCount = saved?.bestObjectCount ?? null;

        return [
          level.id,
          {
            unlocked: unlockAllLevels || isLevelUnlocked(campaignChapters, progress, level.id),
            resolved,
            bestObjectCount,
            tier:
              resolved && bestObjectCount !== null
                ? evaluateTier(bestObjectCount, level.challenge)
                : null,
            nextChallengeHint: resolved
              ? nextChallengeHint(bestObjectCount, level.challenge)
              : null,
          },
        ] as const;
      }),
    );

    return Object.fromEntries(entries);
  }, [progress, unlockAllLevels]);

  const value = useMemo(
    () => ({
      progress,
      loading,
      known,
      levels,
      storageError,
      storageWarning,
      recordCampaignSuccess,
      resetCampaignProgress,
      unlockAllLevels,
    }),
    [
      levels,
      loading,
      known,
      progress,
      recordCampaignSuccess,
      resetCampaignProgress,
      storageError,
      storageWarning,
      unlockAllLevels,
    ],
  );

  return (
    <CampaignProgressContext.Provider value={value}>{children}</CampaignProgressContext.Provider>
  );
}
