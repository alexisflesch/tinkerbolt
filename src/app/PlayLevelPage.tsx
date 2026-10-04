import { useCallback, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import type { ConstructionAttempt } from '../application/construction';
import { countObjectsUsed, evaluateTier } from '../application/progression';
import { embeddedLevels, nextCampaignLevel } from '../content/embedded-levels';
import type { LevelDocument } from '../domain/level-document';
import type { CampaignVictory } from '../ui/CampaignVictoryDialog';
import { PlayerConstructionBoard } from './PlayerConstructionBoard';
import { offersFirstLevelHint } from './first-level-hint';
import { StorageLoading } from './StorageLoading';
import { useStorageRead } from './use-storage-read';
import { LockedLevelPage } from './LockedLevelPage';
import { usePreferencesRepository } from './preferences-repository-context';
import { useCampaignProgress } from './use-campaign-progress';
import { useRemix } from './use-remix';

/**
 * `/levels/:levelId/play` (ADR 0008). `levelId` is the `LevelDocument`'s own
 * `id`, never a separately invented index. An unknown id (stale link, typo)
 * redirects to the level list rather than rendering a broken board.
 */
export function PlayLevelPage() {
  const { levelId } = useParams();
  const { levels: levelProgress, loading } = useCampaignProgress();
  const levelIndex = embeddedLevels.findIndex((level) => level.id === levelId);
  const level = embeddedLevels[levelIndex];

  if (loading) return <StorageLoading title="Campagne" />;

  if (level === undefined) return <Navigate to="/levels" replace />;

  /*
   * U5b (decision, 27 Sept. 2026): a locked level's own URL used to stay
   * playable (L21's original choice). Direct access is now blocked with a
   * simple screen instead of the board — the list already disables
   * "Lancer" for the same level, so the URL must not be a bypass. Its
   * creation is locked the same way in the editor (M11, ADR 0015).
   */
  if (levelProgress[level.id]?.unlocked !== true) {
    return <LockedLevelPage title={`Niveau ${String(levelIndex + 1)} · ${level.metadata.title}`} />;
  }

  return <CampaignLevelBoard key={level.id} level={level} levelIndex={levelIndex} />;
}

interface CampaignLevelBoardProps {
  readonly level: LevelDocument;
  /** Position in the embedded campaign: 0 for level 1. */
  readonly levelIndex: number;
}

/**
 * An unlocked campaign level, played: the attempt snapshot taken at launch
 * records the victory (L21) and is what « Remixer » poses (M11).
 */
function CampaignLevelBoard({ level, levelIndex }: CampaignLevelBoardProps) {
  const navigate = useNavigate();
  const { recordCampaignSuccess, levels: levelProgress, storageError } = useCampaignProgress();
  const firstLevelHint = useFirstLevelHint(levelIndex, levelProgress[level.id]?.resolved === true);
  const launchedAttemptRef = useRef<ConstructionAttempt | null>(null);
  /** The last won attempt, as launched (U4); `null` otherwise. */
  const [wonAttempt, setWonAttempt] = useState<ConstructionAttempt | null>(null);
  const { remix, error: remixError, clearError: clearRemixError } = useRemix(level);
  const wonObjectCount = wonAttempt === null ? null : countObjectsUsed(wonAttempt);

  const nextLevel = nextCampaignLevel(level.id);
  const campaignVictory: CampaignVictory | null =
    wonAttempt === null || wonObjectCount === null
      ? null
      : {
          tier: evaluateTier(wonObjectCount, level.challenge),
          objectsUsed: wonObjectCount,
          hasChallenge: level.challenge !== undefined,
          hint: levelProgress[level.id]?.nextChallengeHint ?? null,
          isNewRecord:
            level.challenge !== undefined && wonObjectCount < level.challenge.minimalObjectCount,
          onNextLevel:
            nextLevel !== undefined && levelProgress[nextLevel.id]?.unlocked === true
              ? () => {
                  setWonAttempt(null);
                  void navigate(`/levels/${nextLevel.id}/play`);
                }
              : null,
          onRemix: () => {
            remix(wonAttempt);
          },
          ...(remixError === undefined ? {} : { remixError }),
        };

  return (
    <PlayerConstructionBoard
      scope="campaign"
      levelId={level.id}
      initialDocument={level}
      mode="resolution"
      title={`Niveau ${String(levelIndex + 1)} · ${level.metadata.title}`}
      subtitle="Campagne"
      firstLevelHint={firstLevelHint}
      storageError={
        storageError === null
          ? undefined
          : 'La progression ne peut pas être enregistrée : le stockage est indisponible.'
      }
      campaignVictory={campaignVictory}
      onSimulationLaunched={(attempt) => {
        launchedAttemptRef.current = attempt;
        setWonAttempt(null);
        clearRemixError();
      }}
      onSimulationCompleted={(outcome) => {
        const attempt = launchedAttemptRef.current;
        launchedAttemptRef.current = null;
        if (outcome.outcome === 'won' && attempt !== null) {
          recordCampaignSuccess(level.id, countObjectsUsed(attempt));
          setWonAttempt(attempt);
        }
      }}
    />
  );
}

/**
 * U8: level 1's hint, offered until it is closed or followed. That moment is
 * kept in the local preferences (ADR 0011, amendment of 2 Oct. 2026) with
 * the other preferences untouched; a storage failure only hides it for this
 * visit.
 */
function useFirstLevelHint(
  levelIndex: number,
  isLevelSolved: boolean,
): { readonly onDone: () => void } | undefined {
  const preferences = usePreferencesRepository();
  const loaded = useStorageRead(useCallback(() => preferences.load(), [preferences]));
  const [dismissed, setDismissed] = useState(false);
  const isHintDone =
    dismissed || (loaded?.status === 'ok' && loaded.preferences.firstLevelHintDone === true);
  if (loaded === null || !offersFirstLevelHint({ levelIndex, isLevelSolved, isHintDone }))
    return undefined;
  return {
    onDone: () => {
      setDismissed(true);
      void preferences.patch({ firstLevelHintDone: true });
    },
  };
}
