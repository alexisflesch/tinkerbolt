import type { AttemptFailureReason, AttemptOutcome } from '../domain/attempt-failure-evaluator';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { CampaignVictory } from './CampaignVictoryDialog';
import { Button } from './Button';
import { Panel } from './Panel';

/**
 * U4b: a campaign victory tells its tier and next steps in
 * `CampaignVictoryDialog`. The banner below the board only keeps the tier
 * for styles and tests, a way to reopen that dialog after « Voir la scène »,
 * and « Recommencer ». « Retour aux niveaux » is left to the menu.
 */
export interface CampaignResult {
  readonly tier: CampaignVictory['tier'];
  /** C5: delayed with the dialog, retained after it closes. Defaults to available. */
  readonly areActionsAvailable?: boolean;
  readonly onOpenResult: () => void;
}

interface LevelResultProps {
  /** How the attempt ended; `null` while none has concluded. */
  readonly outcome: AttemptOutcome | null;
  readonly isCreation: boolean;
  readonly onReplay: () => void;
  readonly onReset: () => void;
  readonly onReturnToLevels: () => void;
  /** U22: « Retour à l’atelier » while the author plays his puzzle. */
  readonly returnLabel?: string;
  readonly campaign?: CampaignResult;
}

/**
 * B2 (plan-remise-en-jeu.md § 4): the two reasons an attempt can be lost, in
 * the player's words. The wording carries the explanation the status word
 * cannot: "Échec" alone never says what went wrong.
 */
const failureExplanations: Record<AttemptFailureReason, string> = {
  'out-of-scene': 'Hors de la scène : la balle a quitté le plateau.',
  timeout: 'Temps écoulé : la balle n’est pas entrée dans le panier.',
};

/**
 * The banner shown once a level's simulation has concluded, won or lost.
 * Renders `null` when there is nothing to show — `BoardShell` mounts this
 * through `InspectorDrawer` inside one shared, always-mounted `.status-slot`
 * whose size is reserved up front, so the banner appearing never resizes
 * the board (B5).
 */
export function LevelResult({
  outcome,
  isCreation,
  onReplay,
  onReset,
  onReturnToLevels,
  returnLabel = 'Retour aux niveaux',
  campaign,
}: LevelResultProps) {
  if (outcome === null) return null;

  if (outcome.outcome === 'lost') {
    return (
      <Panel className="level-result level-result-failure" label="Résultat du niveau" title="Échec">
        <p className="level-result-reason">{failureExplanations[outcome.reason]}</p>
        <div className="level-result-actions">
          <Button tone="reset" onClick={onReset}>
            <RotateCcw size={18} aria-hidden="true" />
            Recommencer
          </Button>
          <Button onClick={onReturnToLevels}>{returnLabel}</Button>
        </div>
      </Panel>
    );
  }

  if (isCreation) {
    return (
      <Panel
        className="level-result level-result-victory"
        label="Résultat du niveau"
        title="Victoire"
      >
        <div className="level-result-actions">
          <Button tone="go" onClick={onReset}>
            <ArrowLeft size={18} aria-hidden="true" />
            Retour à l’édition
          </Button>
        </div>
      </Panel>
    );
  }

  if (campaign !== undefined) {
    return (
      <Panel
        className="level-result level-result-victory"
        label="Résultat du niveau"
        title="Victoire"
        dataAttributes={{ 'data-level-tier': campaign.tier }}
      >
        {campaign.areActionsAvailable !== false && (
          <div className="level-result-actions">
            <Button onClick={campaign.onOpenResult}>Voir le résultat</Button>
            <Button tone="go" onClick={onReplay}>
              <RotateCcw size={18} aria-hidden="true" />
              Recommencer
            </Button>
          </div>
        )}
      </Panel>
    );
  }

  return (
    <Panel
      className="level-result level-result-victory"
      label="Résultat du niveau"
      title="Victoire"
    >
      <div className="level-result-actions">
        <Button tone="go" onClick={onReplay}>
          <RotateCcw size={18} aria-hidden="true" />
          Recommencer
        </Button>
        <Button onClick={onReturnToLevels}>{returnLabel}</Button>
      </div>
    </Panel>
  );
}
