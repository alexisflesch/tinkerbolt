import { useRef, useState } from 'react';

import type { ConstructionAttempt } from '../application/construction';
import { countObjectsUsed } from '../application/progression';
import { recordReceivedVictory } from '../application/received/record-received-victory';
import type { LevelDocument } from '../domain/level-document';
import type { CampaignVictory } from '../ui/CampaignVictoryDialog';
import { PlayerConstructionBoard } from './PlayerConstructionBoard';
import { attributionLine } from './level-attribution';
import { victoryNotKeptNotice } from './not-kept-notice';
import { useReceivedLevelRepository } from './received-level-repository-context';
import { useRemix } from './use-remix';

interface ReceivedLevelBoardProps {
  readonly document: LevelDocument;
  readonly title: string;
  /** The stored entry a victory updates; `null` for a level not kept: nothing is recorded. */
  readonly entryId: string | null;
  readonly notice?: string | undefined;
  readonly exit?: {
    readonly label: string;
    readonly shortLabel: string;
    readonly onExit: () => void;
  };
}

/**
 * A received level, played (ADR 0015 § Victoire sur un niveau reçu): the
 * attempt snapshot taken at launch records a victory on the stored entry,
 * as `PlayLevelPage` does for the campaign, which it never touches. A
 * storage failure never stops the game: a discreet status says the victory
 * was not kept (M11). The result only shows ✅, like an exported puzzle
 * (U24), and « Remixer » poses the winning attempt in a new creation. The
 * header carries the attribution (ADR 0016 § Affichage).
 */
export function ReceivedLevelBoard({
  document,
  title,
  entryId,
  notice,
  exit,
}: ReceivedLevelBoardProps) {
  const repository = useReceivedLevelRepository();
  const launchedAttemptRef = useRef<ConstructionAttempt | null>(null);
  /** The last won attempt, as launched; `null` otherwise. */
  const [wonAttempt, setWonAttempt] = useState<ConstructionAttempt | null>(null);
  const [isVictoryNotKept, setIsVictoryNotKept] = useState(false);
  const { remix, error: remixError, clearError: clearRemixError } = useRemix(document);
  const victory: CampaignVictory | null =
    wonAttempt === null
      ? null
      : {
          tier: 'resolved',
          objectsUsed: countObjectsUsed(wonAttempt),
          hasChallenge: false,
          hint: null,
          isNewRecord: false,
          onNextLevel: null,
          onRemix: () => {
            remix(wonAttempt);
          },
          ...(remixError === undefined ? {} : { remixError }),
        };
  const shownNotice = isVictoryNotKept ? victoryNotKeptNotice : notice;

  return (
    <PlayerConstructionBoard
      scope="received"
      levelId={entryId}
      initialDocument={document}
      mode="resolution"
      title={title}
      subtitle="Mes niveaux"
      attribution={attributionLine(document.metadata)}
      campaignVictory={victory}
      onSimulationLaunched={(attempt) => {
        launchedAttemptRef.current = attempt;
        setWonAttempt(null);
        clearRemixError();
      }}
      onSimulationCompleted={(outcome) => {
        const attempt = launchedAttemptRef.current;
        launchedAttemptRef.current = null;
        if (outcome.outcome !== 'won' || attempt === null) return;
        if (entryId !== null) {
          void recordReceivedVictory(repository, entryId, document, attempt).then((recorded) => {
            setIsVictoryNotKept(recorded.status === 'not-kept');
          });
        }
        setWonAttempt(attempt);
      }}
      {...(shownNotice === undefined ? {} : { notice: shownNotice })}
      {...(exit === undefined ? {} : { exit })}
    />
  );
}
