import { CircleCheck, LockKeyhole, Star, Trophy, type LucideIcon } from 'lucide-react';

import type { LevelDocument } from '../domain/level-document';
import { Button } from '../ui/Button';
import { attributionParts } from './level-attribution';
import { levelCardDecoration } from './level-card-decoration';
import type { LevelPreviewCache } from './level-preview-cache';
import { LevelPreview } from './LevelPreview';

const tierIcons: Readonly<Record<'resolved' | 'elegant' | 'minimal', LucideIcon>> = {
  resolved: CircleCheck,
  elegant: Star,
  minimal: Trophy,
};

const tierLabels: Readonly<Record<keyof typeof tierIcons, string>> = {
  resolved: 'Résolu',
  elegant: 'Élégant',
  minimal: 'Minimal',
};

type LevelCardAction = Readonly<{
  /** The visible text of the main action; the tooltip and default accessible name of an icon. */
  label: string;
  /** A more precise accessible name (« Jouer le niveau 3 »), when the label alone is ambiguous. */
  name?: string;
  icon: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  /** A destructive command (« Supprimer »): its hover warns. */
  danger?: boolean;
  /** Stays usable on a locked card (deleting a locked creation, ADR 0015). */
  availableWhenLocked?: boolean;
}>;

type LevelCardProps = Readonly<{
  /** Its preview, title, description and, if asked, attribution. */
  document: LevelDocument;
  /** The card's accessible name; the level's title by default. */
  label?: string;
  /** The campaign number laid over the preview. */
  number?: number;
  /** The best tier reached, shown over the preview. */
  tier?: keyof typeof tierIcons | null;
  /** With `tier`, the objects used: « Résolu · 4 objets » (a received level). */
  objectCount?: number;
  /** Greys the preview, says « Verrouillé » and disables the actions. */
  locked?: boolean;
  /** ADR 0016 § Affichage: « par … », « d’après … », as plain text. */
  showAttribution?: boolean;
  /** A short line under the title (« Modifié le 2 octobre »). */
  meta?: string;
  /** A status heard by screen readers only (« Pas encore résolu »): the card shows no badge for it. */
  assistiveStatus?: string;
  /** The main action, with its icon and visible label. */
  primary?: LevelCardAction;
  /** Icon-only actions, each named and with a tooltip. */
  actions: readonly LevelCardAction[];
  /** The preview image source, replaceable in tests. */
  previewCache?: LevelPreviewCache;
}>;

const SKETCH_NOTE = 'Esquisse non calibrée.';

/** Plain text; the sketch note of the embedded drafts is set apart. */
function Description({ text }: { readonly text: string }) {
  if (!text.startsWith(SKETCH_NOTE)) return <p className="level-card-description">{text}</p>;
  return (
    <p className="level-card-description">
      <span className="level-card-sketch-note">{SKETCH_NOTE}</span>
      {text.slice(SKETCH_NOTE.length).trim()}
    </p>
  );
}

const objectsLabel = (count: number): string => `${String(count)} objet${count > 1 ? 's' : ''}`;

/**
 * The one card for a level (V6): the campaign, « Mes créations » and « Niveaux
 * reçus » all show a level this way (V4 mock-ups). A preview with its number and
 * tier laid over it, a title, an optional attribution line, a description kept to
 * three lines on desktop, one main action and secondary actions as icons.
 */
export function LevelCard({
  document,
  label,
  number,
  tier = null,
  objectCount,
  locked = false,
  showAttribution = false,
  meta,
  assistiveStatus,
  primary,
  actions,
  previewCache,
}: LevelCardProps) {
  const { title, description } = document.metadata;
  const decoration = levelCardDecoration(document.id);
  const attribution = showAttribution ? attributionParts(document.metadata) : [];
  const TierIcon = tier === null ? null : tierIcons[tier];
  const isDisabled = (action: LevelCardAction): boolean =>
    action.disabled === true || (locked && action.availableWhenLocked !== true);
  const previewAction = primary !== undefined && !isDisabled(primary) ? primary : undefined;

  return (
    <section
      className={`level-card${locked ? ' level-card-locked' : ''}`}
      style={decoration.style}
      aria-label={label ?? title}
      {...(number === undefined ? {} : { 'data-level-number': String(number).padStart(2, '0') })}
      {...(tier === null ? {} : { 'data-level-tier': tier })}
    >
      <span
        className={`level-card-attachment level-card-attachment-${decoration.kind}`}
        aria-hidden="true"
      />
      <div className="level-card-thumb">
        <LevelPreview
          document={document}
          {...(previewCache === undefined ? {} : { cache: previewCache })}
        />
        {previewAction !== undefined && (
          // A larger pointer target for the main action. Keyboard and screen-reader users have
          // the named button below: this one is out of the tab order and of the accessibility tree.
          <button
            type="button"
            className="level-card-thumb-action"
            tabIndex={-1}
            aria-hidden="true"
            onClick={previewAction.onSelect}
          />
        )}
        {number !== undefined && <span className="level-card-number">{number}</span>}
        {!locked && tier !== null && TierIcon !== null && (
          <span className={`level-card-tier level-card-tier-${tier}`}>
            <TierIcon size={16} aria-hidden="true" />
            {tier === 'resolved' && objectCount !== undefined
              ? `${tierLabels[tier]} · ${objectsLabel(objectCount)}`
              : tierLabels[tier]}
          </span>
        )}
        {locked && (
          <span className="level-card-lock">
            <LockKeyhole size={16} aria-hidden="true" />
            Verrouillé
          </span>
        )}
      </div>
      <div className="level-card-body">
        <h3 className="level-card-title">{title}</h3>
        {meta !== undefined && <p className="level-card-meta">{meta}</p>}
        {attribution.length > 0 && (
          <p className="level-card-meta level-card-attribution">
            {attribution.map((part) => (
              <span key={part}>{part}</span>
            ))}
          </p>
        )}
        {description !== undefined && <Description text={description} />}
        {assistiveStatus !== undefined && <p className="visually-hidden">{assistiveStatus}</p>}
        <div className="level-card-actions">
          {primary !== undefined && (
            <Button
              tone="go"
              className="level-card-primary"
              disabled={isDisabled(primary)}
              {...(primary.name === undefined ? {} : { 'aria-label': primary.name })}
              onClick={primary.onSelect}
            >
              <primary.icon size={18} aria-hidden="true" />
              {primary.label}
            </Button>
          )}
          {actions.map((action) => (
            <Button
              key={action.name ?? action.label}
              className={`level-card-tool${action.danger === true ? ' level-card-tool-danger' : ''}`}
              disabled={isDisabled(action)}
              aria-label={action.name ?? action.label}
              title={action.label}
              onClick={action.onSelect}
            >
              <action.icon size={18} aria-hidden="true" />
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
