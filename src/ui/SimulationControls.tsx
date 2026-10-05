import {
  currentEditorAttempt,
  type EditorSession,
} from '../application/editor-session/editor-session';
import type { ObjectKind } from '../app/object-catalog';
import type { ReactNode } from 'react';
import {
  Maximize2,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  Trophy,
} from 'lucide-react';
import type { AttemptFailureReason, AttemptOutcome } from '../domain/attempt-failure-evaluator';
import { Button } from './Button';

interface SimulationControlsProps {
  readonly isLaunching?: boolean;
  readonly session: EditorSession;
  readonly isCreation: boolean;
  readonly feedback: string | null;
  /** How the last attempt ended, told in the bar once the simulation is over. */
  readonly outcome?: AttemptOutcome | null;
  /** Reopens the campaign victory dialog, once the attempt is won and the dialog closed. */
  readonly onOpenResult?: (() => void) | undefined;
  /** A discreet, dismissable status (M8: a shared level not kept), shown when no feedback is. */
  readonly notice?: { readonly message: string; readonly onDismiss: () => void } | undefined;
  readonly activePlacementKind: ObjectKind | null;
  /** The "Fil" card's guidance (U15), or `null` when no wire is being made. */
  readonly wiringGuide: { readonly prompt: string; readonly exitLabel: string } | null;
  readonly onExitWiring: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onCancelPlacement: () => void;
  readonly onLaunchSimulation: () => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onRestoreConstruction: () => void;
  readonly onResetDocument: () => void;
  /**
   * The wide layout's single bar: history and framing as icons, then the
   * level's name and its own actions, so that nothing but this bar and the
   * catalogue takes room from the board.
   */
  readonly desk?:
    | {
        readonly title: string;
        readonly actions: ReactNode;
        readonly onZoomIn: () => void;
        readonly onZoomOut: () => void;
        readonly onFitToScene: () => void;
      }
    | undefined;
}

/**
 * B2 (plan-remise-en-jeu.md § 4): the two reasons an attempt can be lost, in
 * the player's words, said in the bar rather than in an error panel.
 */
const failureExplanations: Record<AttemptFailureReason, string> = {
  'out-of-scene': 'Raté : la balle a quitté le plateau.',
  timeout: 'Raté : la balle n’est pas entrée dans le panier à temps.',
};

/** The "tester / pause / reset" bar: construction commands while building, playback controls while simulating. */
export function SimulationControls({
  isLaunching = false,
  session,
  feedback,
  outcome = null,
  onOpenResult,
  notice,
  isCreation,
  activePlacementKind,
  wiringGuide,
  onExitWiring,
  onUndo,
  onRedo,
  onCancelPlacement,
  onLaunchSimulation,
  onPause,
  onResume,
  onRestoreConstruction,
  onResetDocument,
  desk,
}: SimulationControlsProps) {
  // A session with no inventory (level 1: `initial-progression.md` § Niveau 1,
  // "Aucune action d'édition") has nothing a command could ever undo or redo:
  // hiding these buttons outright, rather than just disabling them, keeps the
  // action bar limited to what B1 (plan-remise-en-jeu.md § 4) allows.
  // The author always edits, even a creation without inventory (ADR 0015).
  const canEdit = isCreation || currentEditorAttempt(session).document.inventory.length > 0;

  const resetLabel = isCreation ? 'Remettre l’atelier à zéro' : 'Recommencer le niveau';
  const framing = desk !== undefined && (
    <div className="toolbar-group toolbar-icons" role="group" aria-label="Cadrage du plateau">
      <Button
        className="toolbar-icon"
        aria-label="Zoom arrière"
        title="Zoom arrière"
        onClick={desk.onZoomOut}
      >
        <ZoomOut size={20} aria-hidden="true" />
      </Button>
      <Button
        className="toolbar-icon"
        aria-label="Zoom avant"
        title="Zoom avant"
        onClick={desk.onZoomIn}
      >
        <ZoomIn size={20} aria-hidden="true" />
      </Button>
      <Button
        className="toolbar-icon"
        aria-label="Ajuster à la scène"
        title="Ajuster à la scène"
        onClick={desk.onFitToScene}
      >
        <Maximize2 size={20} aria-hidden="true" />
      </Button>
    </div>
  );

  const undoRedo = canEdit && (
    <>
      <Button
        className={desk === undefined ? 'toolbar-button' : 'toolbar-icon'}
        disabled={session.history.past.length === 0}
        {...(desk === undefined ? {} : { 'aria-label': 'Annuler', title: 'Annuler' })}
        onClick={onUndo}
      >
        <Undo2 size={desk === undefined ? 18 : 20} aria-hidden="true" />
        {desk === undefined && <span className="toolbar-button-label">Annuler</span>}
      </Button>
      <Button
        className={desk === undefined ? 'toolbar-button' : 'toolbar-icon'}
        disabled={session.history.future.length === 0}
        {...(desk === undefined ? {} : { 'aria-label': 'Rétablir', title: 'Rétablir' })}
        onClick={onRedo}
      >
        <Redo2 size={desk === undefined ? 18 : 20} aria-hidden="true" />
        {desk === undefined && <span className="toolbar-button-label">Rétablir</span>}
      </Button>
    </>
  );
  const placementStatus = activePlacementKind !== null && (
    <div className="toolbar-status" aria-live="polite">
      <span className="toolbar-status-text">Placement actif : {activePlacementKind}.</span>
      <Button className="placement-cancel" onClick={onCancelPlacement}>
        {/* Short visible form for narrow toolbars; the accessible name stays the full label. */}
        <span className="placement-cancel-short" aria-hidden="true">
          <X size={18} aria-hidden="true" />
          <span className="placement-cancel-kind"> {activePlacementKind}</span>
        </span>
        <span className="placement-cancel-label">Annuler le placement</span>
      </Button>
    </div>
  );
  const launch = (
    <Button
      tone="go"
      className="toolbar-primary"
      disabled={isLaunching}
      onClick={onLaunchSimulation}
    >
      <Play size={18} aria-hidden="true" />
      <span className="toolbar-button-label">Lancer</span>
    </Button>
  );

  return (
    <div
      className={
        desk === undefined ? 'workspace-toolbar' : 'workspace-toolbar workspace-toolbar-desk'
      }
      aria-label={
        session.phase === 'construction' ? 'Actions de construction' : 'Actions de simulation'
      }
    >
      {session.phase === 'construction' && desk === undefined && (
        <>
          {canEdit && <div className="toolbar-group">{undoRedo}</div>}
          {placementStatus}
          <Button
            tone="reset"
            className="toolbar-reset"
            aria-label={resetLabel}
            aria-haspopup="dialog"
            onClick={onResetDocument}
          >
            <RotateCcw size={18} aria-hidden="true" />
            {isCreation ? 'Ràz atelier' : 'Recommencer le niveau'}
          </Button>
          {launch}
        </>
      )}
      {session.phase === 'construction' && desk !== undefined && (
        <>
          <div className="toolbar-group toolbar-icons" role="group" aria-label="Historique">
            {undoRedo}
            <Button
              className="toolbar-icon"
              aria-label={resetLabel}
              title={resetLabel}
              aria-haspopup="dialog"
              onClick={onResetDocument}
            >
              <RotateCcw size={20} aria-hidden="true" />
            </Button>
          </div>
          {framing}
          {placementStatus === false ? (
            <p className="toolbar-title">{desk.title}</p>
          ) : (
            placementStatus
          )}
          {desk.actions}
          {launch}
        </>
      )}
      {session.phase !== 'construction' && framing}

      {session.phase !== 'construction' && (
        <>
          <div className="toolbar-status" aria-live="polite">
            <strong className="toolbar-status-text">
              {session.phase === 'running'
                ? 'Simulation en cours'
                : session.phase === 'paused'
                  ? 'Simulation en pause'
                  : outcome === null
                    ? 'Simulation terminée'
                    : outcome.outcome === 'won'
                      ? 'Gagné !'
                      : failureExplanations[outcome.reason]}
            </strong>
          </div>
          {session.phase === 'running' && (
            <Button onClick={onPause}>
              <Pause size={18} aria-hidden="true" />
              <span className="toolbar-button-label">Mettre en pause</span>
            </Button>
          )}
          {session.phase === 'paused' && (
            <Button tone="go" onClick={onResume}>
              <Play size={18} aria-hidden="true" />
              <span className="toolbar-button-label">Reprendre</span>
            </Button>
          )}
          {session.phase === 'result' && onOpenResult !== undefined && (
            <Button tone="go" onClick={onOpenResult}>
              <Trophy size={18} aria-hidden="true" />
              <span className="toolbar-button-label">Voir le résultat</span>
            </Button>
          )}
          {/*
            Always the last command, where « Lancer » was, and still there once
            the attempt has ended: the hand that is about to press it never
            finds it gone.
          */}
          <Button className="toolbar-primary toolbar-restart" onClick={onRestoreConstruction}>
            <RotateCcw size={18} aria-hidden="true" />
            <span className="toolbar-button-label">Recommencer</span>
          </Button>
        </>
      )}

      {session.phase === 'construction' && wiringGuide !== null ? (
        // U15: the step and its refusal share one card over the board, so a
        // narrow toolbar never hides the guidance.
        <div className="wiring-guide" role="group" aria-label="Pose d’un fil">
          <div className="wiring-guide-copy">
            <p className="wiring-guide-prompt" aria-live="polite">
              {wiringGuide.prompt}
            </p>
            {feedback !== null && (
              <p className="wiring-guide-refusal" aria-live="assertive">
                {feedback}
              </p>
            )}
          </div>
          <Button className="wiring-guide-exit" onClick={onExitWiring}>
            {wiringGuide.exitLabel}
          </Button>
        </div>
      ) : feedback !== null ? (
        <p className="toolbar-feedback" aria-live="assertive">
          {feedback}
        </p>
      ) : (
        notice !== undefined && (
          <div className="toolbar-notice">
            <p role="status">{notice.message}</p>
            <button
              className="toolbar-notice-dismiss"
              type="button"
              aria-label="Masquer le message"
              onClick={notice.onDismiss}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )
      )}
    </div>
  );
}
