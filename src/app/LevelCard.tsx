import { useEffect, useId, useRef, useState } from 'react';
import { CircleCheck, Ellipsis, LockKeyhole, Star, Trophy, type LucideIcon } from 'lucide-react';

import type { LevelDocument } from '../domain/level-document';
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
  /** The action's text in the menu; elsewhere its tooltip and default accessible name. */
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
  /** A state worth showing on a creation (« Jouable »), laid over the preview like a tier. */
  badge?: string;
  /** The main action: the whole card triggers it. */
  primary?: LevelCardAction;
  /** The other actions, listed in the « ⋯ » menu beside the title. */
  actions?: readonly LevelCardAction[];
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
 * The « ⋯ » disclosure beside the title: plain buttons, shown on click (never on
 * hover alone), closed by Escape, by a press elsewhere or by choosing an action.
 */
function LevelCardMenu({
  actions,
  isDisabled,
}: {
  readonly actions: readonly LevelCardAction[];
  readonly isDisabled: (action: LevelCardAction) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target) !== true)
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="level-card-menu" ref={menuRef}>
      <button
        ref={toggleRef}
        type="button"
        className="level-card-menu-toggle"
        aria-label="Autres actions"
        title="Autres actions"
        aria-expanded={open}
        aria-controls={listId}
        disabled={actions.every(isDisabled)}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <Ellipsis size={20} aria-hidden="true" />
      </button>
      <div className="level-card-menu-list" id={listId} hidden={!open}>
        {actions.map((action) => (
          <button
            key={action.name ?? action.label}
            type="button"
            className={`level-card-menu-item${action.danger === true ? ' level-card-menu-item-danger' : ''}`}
            disabled={isDisabled(action)}
            {...(action.name === undefined ? {} : { 'aria-label': action.name })}
            onClick={() => {
              setOpen(false);
              action.onSelect();
            }}
          >
            <action.icon size={17} aria-hidden="true" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The one card for a level: the campaign, « Mes créations » and « Niveaux
 * reçus » all show a level this way. A preview with its number and tier laid
 * over it, a title, an optional attribution line and a description kept to
 * three lines on desktop. The card itself is the main action and the others sit
 * in a menu, so no row of buttons remains.
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
  badge,
  primary,
  actions = [],
  previewCache,
}: LevelCardProps) {
  const { title, description } = document.metadata;
  const decoration = levelCardDecoration(document.id);
  const attribution = showAttribution ? attributionParts(document.metadata) : [];
  const TierIcon = tier === null ? null : tierIcons[tier];
  const isDisabled = (action: LevelCardAction): boolean =>
    action.disabled === true || (locked && action.availableWhenLocked !== true);
  const isPrimaryEnabled = primary !== undefined && !isDisabled(primary);

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
      {primary !== undefined && (
        // Stretched over the whole card (`styles.css`): the menu alone stays above it.
        <button
          type="button"
          className="level-card-thumb-action"
          aria-label={primary.name ?? primary.label}
          title={primary.label}
          disabled={!isPrimaryEnabled}
          onClick={primary.onSelect}
        />
      )}
      <div className="level-card-thumb">
        <LevelPreview
          document={document}
          {...(previewCache === undefined ? {} : { cache: previewCache })}
        />
        {number !== undefined && <span className="level-card-number">{number}</span>}
        {!locked && tier !== null && TierIcon !== null && (
          <span className={`level-card-tier level-card-tier-${tier}`}>
            <TierIcon size={16} aria-hidden="true" />
            {tier === 'resolved' && objectCount !== undefined
              ? `${tierLabels[tier]} · ${objectsLabel(objectCount)}`
              : tierLabels[tier]}
          </span>
        )}
        {!locked && tier === null && badge !== undefined && (
          <span className="level-card-tier level-card-tier-resolved">
            <CircleCheck size={16} aria-hidden="true" />
            {badge}
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
        <div className="level-card-heading">
          <h3 className="level-card-title">{title}</h3>
          {actions.length > 0 && <LevelCardMenu actions={actions} isDisabled={isDisabled} />}
        </div>
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
      </div>
    </section>
  );
}
