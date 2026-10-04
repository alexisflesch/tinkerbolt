import { useRef, type ReactNode } from 'react';
import {
  ArrowRight,
  CircleCheck,
  RotateCcw,
  Shuffle,
  Star,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

import type { ChallengeHint } from '../application/progression';
import { Button } from './Button';
import { Dialog } from './Dialog';

/**
 * U4: what a campaign victory tells the player (ADR 0010). Absent for the
 * workshop and the technical bench, which only say « Victoire ».
 */
export interface CampaignVictory {
  /** Tier earned by this attempt, from the objects counted at launch. */
  readonly tier: 'resolved' | 'elegant' | 'minimal';
  readonly objectsUsed: number;
  /** Whether the level declares a challenge: without one, the Resolved tier is the only tier. */
  readonly hasChallenge: boolean;
  /** Progressive revelation from the saved best result (ADR 0010). */
  readonly hint: ChallengeHint;
  /** Fewer objects than the author's known minimum. */
  readonly isNewRecord: boolean;
  /** Opens the next campaign level; `null` when none exists or it is locked. */
  readonly onNextLevel: (() => void) | null;
  /** M11 (ADR 0015 § Points d'entrée): opens the winning attempt in a new creation. */
  readonly onRemix: (() => void) | null;
  /** Why the last « Remixer » could not create the creation (storage). */
  readonly remixError?: string;
}

type Tier = CampaignVictory['tier'];

const tierOrder: readonly Tier[] = ['resolved', 'elegant', 'minimal'];

const tierBadges: Record<Tier, { readonly icon: LucideIcon; readonly name: string }> = {
  resolved: { icon: CircleCheck, name: 'Résolu' },
  elegant: { icon: Star, name: 'Élégant' },
  minimal: { icon: Trophy, name: 'Minimal' },
};

const objectCountLabel = (objectsUsed: number): string => {
  if (objectsUsed === 0) return 'Résolu sans poser d’objet.';
  return `Résolu avec ${String(objectsUsed)} ${objectsUsed === 1 ? 'objet' : 'objets'}.`;
};

const challengeLabel = ({ hint, isNewRecord }: CampaignVictory): ReactNode | null => {
  if (isNewRecord) return 'Nouveau record : moins que le minimum connu !';
  if (hint === null) return null;
  if (hint.nextTier === 'elegant') {
    return `Tu penses pouvoir le faire avec ${String(hint.objectCount)} ?`;
  }
  return `Record à battre : avec ${String(hint.objectCount)} ${
    hint.objectCount === 1 ? 'objet' : 'objets'
  }.`;
};

/**
 * The tiers side by side, those earned by this attempt lit. Dimming is not
 * the only cue: each tier also says « obtenu » or « non obtenu » to
 * assistive technology, and the earned names are bold.
 */
function TierRow({ campaign }: { readonly campaign: CampaignVictory }) {
  const earnedRank = tierOrder.indexOf(campaign.tier);
  const tiers = campaign.hasChallenge ? tierOrder : tierOrder.slice(0, 1);
  return (
    <ul className="victory-tiers" aria-label="Paliers">
      {tiers.map((tier, rank) => {
        const isEarned = rank <= earnedRank;
        const { icon: Icon, name } = tierBadges[tier];
        return (
          <li key={tier} className="victory-tier" data-earned={String(isEarned)}>
            <span className="victory-tier-icon" aria-hidden="true">
              <Icon size={30} aria-hidden="true" />
            </span>
            <span className="victory-tier-name">{name}</span>
            <span className="visually-hidden">{isEarned ? ' obtenu' : ' non obtenu'}</span>
          </li>
        );
      })}
    </ul>
  );
}

interface CampaignVictoryDialogProps {
  readonly campaign: CampaignVictory;
  /** Starts the level over from its initial document. */
  readonly onReplay: () => void;
  /** Closes the dialog and leaves the final scene in view (« Voir la scène », Escape, backdrop). */
  readonly onClose: () => void;
}

/**
 * U4b: the campaign victory, in a modal over the final scene. Built on the
 * shared `Dialog` (focus trap, Escape, backdrop tap) and named by its visible
 * title « Bravo ! ». Focus starts on the way forward: the next level when it
 * is open, otherwise « Recommencer ».
 */
export function CampaignVictoryDialog({ campaign, onReplay, onClose }: CampaignVictoryDialogProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const challenge = challengeLabel(campaign);
  const { onNextLevel } = campaign;

  return (
    <Dialog
      title="Bravo !"
      className="victory-dialog"
      dataAttributes={{ 'data-level-tier': campaign.tier }}
      closeLabel="Fermer le résultat"
      onClose={onClose}
      initialFocusRef={primaryRef}
    >
      <TierRow campaign={campaign} />
      <div className="victory-summary-row">
        <div className="victory-summary">
          <p className="victory-count">{objectCountLabel(campaign.objectsUsed)}</p>
          {challenge !== null && <p className="victory-challenge">{challenge}</p>}
        </div>
        <figure className="victory-bolt" aria-hidden="true">
          <img src="/assets/bolt/bolt-victory.webp" alt="" draggable={false} />
        </figure>
      </div>
      {campaign.remixError !== undefined && (
        <p className="panel-note victory-remix-error" role="alert">
          {campaign.remixError}
        </p>
      )}
      <div className="victory-actions">
        {onNextLevel !== null && (
          <Button ref={primaryRef} tone="go" className="victory-next" onClick={onNextLevel}>
            Niveau suivant
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
        )}
        <Button
          {...(onNextLevel === null ? { ref: primaryRef, tone: 'go' as const } : {})}
          className="victory-replay"
          onClick={onReplay}
        >
          <RotateCcw size={18} aria-hidden="true" />
          Recommencer
        </Button>
        {campaign.onRemix !== null && (
          <Button className="victory-remix" onClick={campaign.onRemix}>
            <Shuffle size={18} aria-hidden="true" />
            Remixer
          </Button>
        )}
        <button className="victory-see-scene" type="button" onClick={onClose}>
          Voir la scène
        </button>
      </div>
    </Dialog>
  );
}
