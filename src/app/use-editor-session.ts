import { useCallback, useRef, useState, type RefObject } from 'react';

import {
  currentEditorAttempt,
  executeEditorCommand,
  redoEditorCommand,
  selectEditorPlacement,
  undoEditorCommand,
  type EditorSession,
} from '../application/editor-session/editor-session';
import type { LevelDocument } from '../domain/level-document';
import type { ConstructionAttempt } from '../application/construction';

/** Translates an `EditorActionResult` rejection reason into user-facing feedback. */
const refusalMessage = (reason: string): string =>
  reason === 'outside-build-zone'
    ? 'Action refusée : choisis une position dans la zone de construction.'
    : reason === 'move-not-permitted' || reason === 'rotate-not-permitted'
      ? 'Action indisponible : cet objet est verrouillé.'
      : reason === 'remove-not-permitted' || reason === 'goal-object-protected'
        ? 'Suppression indisponible pour cet objet.'
        : reason === 'wire-already-connected'
          ? 'Cet appareil a déjà un contrôleur : il n’obéit qu’à un seul levier ou bouton.'
          : reason === 'inventory-depleted'
            ? 'Il n’en reste plus dans l’inventaire.'
            : reason === 'inventory-provenance-missing'
              ? 'Cet élément fait partie du niveau : il reste en place.'
              : 'Cette action est indisponible.';

interface EditorSessionController {
  readonly session: EditorSession;
  /** Always in sync with `session`, but updated synchronously: for gesture handlers that need the latest value within a single event. */
  readonly sessionRef: RefObject<EditorSession>;
  readonly feedback: string | null;
  readonly setFeedback: (message: string | null) => void;
  /** Sets `feedback` from an `EditorActionResult`/`EditorTransitionResult` rejection reason. */
  readonly reportRefusal: (reason: string) => void;
  readonly updateSession: (next: EditorSession, notifyCommit?: boolean) => void;
  readonly currentScene: () => LevelDocument['scene'];
  readonly undo: () => void;
  readonly redo: () => void;
  readonly selectPlacement: (placementId: string) => void;
  /** Runs `command`, reports a refusal, and returns the result. */
  readonly executeCommand: (
    command: Parameters<typeof executeEditorCommand>[1],
  ) => ReturnType<typeof executeEditorCommand>;
}

/**
 * Owns the `EditorSession` (state, commands, undo/redo history) and the
 * refusal feedback shown to the user when a command or manipulation is
 * rejected. Manipulation lifecycle (begin/preview/commit/cancel) stays with
 * the pointer gestures that drive it (`use-board-pointers.ts`); this hook
 * exposes `sessionRef` and `updateSession` so those gestures can read and
 * write the session without owning it.
 *
 * `createInitialSession` is only read as `useState`'s lazy initializer: it
 * runs once, on mount. A route that loads a different document (a different
 * level, or the workshop) remounts its `BoardShell` with a fresh `key`
 * instead of asking this hook to react to a changed initializer.
 */
export function useEditorSession(
  createInitialSession: () => EditorSession,
  onCommitted?: (attempt: ConstructionAttempt) => void,
): EditorSessionController {
  const [session, setSession] = useState<EditorSession>(createInitialSession);
  const [feedback, setFeedback] = useState<string | null>(null);
  const sessionRef = useRef(session);
  const onCommittedRef = useRef(onCommitted);
  onCommittedRef.current = onCommitted;

  // Wrapped in `useCallback` (with only ref/setState-setter dependencies, both
  // stable) so every function this hook returns keeps its identity across
  // renders. `sessionRef`/`setFeedback` are already stable on their own. This
  // lets consumers (this hook's own callbacks, and effects in other hooks
  // that read the latest session via `sessionRef.current`) list them
  // truthfully in dependency arrays without eslint's exhaustive-deps losing
  // track of them through this custom hook's boundary.
  const updateSession = useCallback((nextSession: EditorSession, notifyCommit = true): void => {
    const previous = sessionRef.current.history.state;
    sessionRef.current = nextSession;
    setSession(nextSession);
    if (notifyCommit && previous !== nextSession.history.state)
      onCommittedRef.current?.(nextSession.history.state);
  }, []);

  const reportRefusal = useCallback(
    (reason: string): void => {
      setFeedback(refusalMessage(reason));
    },
    [setFeedback],
  );

  const currentScene = useCallback(
    (): LevelDocument['scene'] => currentEditorAttempt(sessionRef.current).document.scene,
    [],
  );

  const undo = useCallback((): void => {
    updateSession(undoEditorCommand(sessionRef.current).session);
  }, [updateSession]);

  const redo = useCallback((): void => {
    updateSession(redoEditorCommand(sessionRef.current).session);
  }, [updateSession]);

  const selectPlacement = useCallback(
    (placementId: string): void => {
      updateSession(selectEditorPlacement(sessionRef.current, placementId));
    },
    [updateSession],
  );

  const executeCommand = useCallback(
    (
      command: Parameters<typeof executeEditorCommand>[1],
    ): ReturnType<typeof executeEditorCommand> => {
      const result = executeEditorCommand(sessionRef.current, command);
      updateSession(result.session);
      if (result.status === 'rejected') reportRefusal(result.reason);
      return result;
    },
    [updateSession, reportRefusal],
  );

  return {
    session,
    sessionRef,
    feedback,
    setFeedback,
    reportRefusal,
    updateSession,
    currentScene,
    undo,
    redo,
    selectPlacement,
    executeCommand,
  };
}
