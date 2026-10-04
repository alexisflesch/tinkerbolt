import {
  currentEditorAttempt,
  type EditorSession,
} from '../application/editor-session/editor-session';
import type { ObjectKind } from '../app/object-catalog';
import { Pause, Play, Redo2, RotateCcw, Undo2, X } from 'lucide-react';
import { Button } from './Button';

interface SimulationControlsProps {
  readonly isLaunching?: boolean;
  readonly session: EditorSession;
  readonly isCreation: boolean;
  readonly feedback: string | null;
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
}

/** The "tester / pause / reset" bar: construction commands while building, playback controls while simulating. */
export function SimulationControls({
  isLaunching = false,
  session,
  feedback,
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
}: SimulationControlsProps) {
  // A session with no inventory (level 1: `initial-progression.md` § Niveau 1,
  // "Aucune action d'édition") has nothing a command could ever undo or redo:
  // hiding these buttons outright, rather than just disabling them, keeps the
  // action bar limited to what B1 (plan-remise-en-jeu.md § 4) allows.
  // The author always edits, even a creation without inventory (ADR 0015).
  const canEdit = isCreation || currentEditorAttempt(session).document.inventory.length > 0;

  return (
    <div
      className="workspace-toolbar"
      aria-label={
        session.phase === 'construction' ? 'Actions de construction' : 'Actions de simulation'
      }
    >
      {session.phase === 'construction' && (
        <>
          {canEdit && (
            <div className="toolbar-group">
              <Button
                className="toolbar-button"
                disabled={session.history.past.length === 0}
                onClick={onUndo}
              >
                <Undo2 size={18} aria-hidden="true" />
                <span className="toolbar-button-label">Annuler</span>
              </Button>
              <Button
                className="toolbar-button"
                disabled={session.history.future.length === 0}
                onClick={onRedo}
              >
                <Redo2 size={18} aria-hidden="true" />
                <span className="toolbar-button-label">Rétablir</span>
              </Button>
            </div>
          )}
          {activePlacementKind !== null && (
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
          )}
          <Button
            tone="reset"
            className="toolbar-reset"
            aria-label={isCreation ? 'Remettre l’atelier à zéro' : 'Recommencer le niveau'}
            aria-haspopup="dialog"
            onClick={onResetDocument}
          >
            <RotateCcw size={18} aria-hidden="true" />
            {isCreation ? 'Ràz atelier' : 'Recommencer le niveau'}
          </Button>
          <Button
            tone="go"
            className="toolbar-primary"
            disabled={isLaunching}
            onClick={onLaunchSimulation}
          >
            <Play size={18} aria-hidden="true" />
            Lancer
          </Button>
        </>
      )}

      {session.phase !== 'construction' && (
        <div className="toolbar-status" aria-live="polite">
          <strong className="toolbar-status-text">
            {session.phase === 'running'
              ? 'Simulation en cours'
              : session.phase === 'paused'
                ? 'Simulation en pause'
                : 'Simulation terminée'}
          </strong>
          {session.phase === 'running' && (
            <Button tone="pause" onClick={onPause}>
              <Pause size={18} aria-hidden="true" />
              Mettre en pause
            </Button>
          )}
          {session.phase === 'paused' && (
            <Button tone="go" onClick={onResume}>
              <Play size={18} aria-hidden="true" />
              Reprendre
            </Button>
          )}
          {session.phase !== 'result' && (
            <Button tone="reset" onClick={onRestoreConstruction}>
              <RotateCcw size={18} aria-hidden="true" />
              Recommencer
            </Button>
          )}
        </div>
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
