import { useEffect, useRef, useState, type RefObject } from 'react';

import {
  completeSimulation,
  pauseSimulation,
  resetSimulation,
  resumeSimulation,
  startSimulation,
  type EditorSession,
} from '../application/editor-session/editor-session';
import { resolveAttemptOutcome, type AttemptOutcome } from '../domain/attempt-failure-evaluator';
import { hasCompleteGoal, type LevelDocument } from '../domain/level-document';
import type { ConstructionAttempt } from '../application/construction';
import {
  createSimulationSession,
  type SimulationSession,
  type SimulationSnapshot,
} from '../simulation/simulation-session';

export const fixedStepSeconds = 1 / 60;

/**
 * ADR 0007 does not cover this; it is this task's own rule. After a tab
 * returns from the background, `requestAnimationFrame` was suspended and the
 * elapsed gap between two frames can be several seconds. Catching up the
 * entirety of it at once would run thousands of fixed steps synchronously
 * and freeze the page, so at most this many fixed steps are caught up per
 * frame; the rest of the elapsed duration is dropped, not deferred.
 */
export const MAX_CATCH_UP_FIXED_STEPS_PER_FRAME = 5;

/**
 * Caps a frame's elapsed duration so `advanceElapsedSeconds` can never catch
 * up more than `maxSteps` fixed steps at once. Pure and DOM-free on purpose:
 * this is the one behaviour this task is allowed to change, so it is unit
 * tested directly (`use-simulation-runner.test.ts`) without going through a
 * rendered `App`.
 */
export const capElapsedSecondsForCatchUp = (
  elapsedSeconds: number,
  fixedStepSeconds: number,
  maxSteps: number = MAX_CATCH_UP_FIXED_STEPS_PER_FRAME,
): number => Math.min(elapsedSeconds, maxSteps * fixedStepSeconds);

/**
 * ADR 0020: without a complete goal a run is watched, never won or lost. It
 * lasts until the time limit, then the board returns to its stopped state.
 */
export const isWatchedRunOver = (
  document: Pick<LevelDocument, 'goal'>,
  hasReachedTimeLimit: boolean,
): boolean => !hasCompleteGoal(document) && hasReachedTimeLimit;

interface SimulationLifecyclePointers {
  /** Clears the active placement tool. */
  readonly clearPlacementTool: () => void;
  /** Clears the placement preview and every pointer/gesture tracking ref. */
  readonly resetGestureState: () => void;
}

interface UseSimulationRunnerOptions {
  readonly sessionRef: RefObject<EditorSession>;
  readonly updateSession: (next: EditorSession) => void;
  readonly setFeedback: (message: string | null) => void;
  readonly pointers: SimulationLifecyclePointers;
  readonly onSimulationLaunched?: (attempt: ConstructionAttempt) => void;
  readonly onSimulationCompleted?: (outcome: AttemptOutcome) => void;
}

interface SimulationRunnerController {
  readonly simulationState: SimulationSnapshot | null;
  /**
   * How the last attempt ended, and why. The outcome model
   * replaces the previous `hasWon` boolean: `completeSimulation` moves to
   * `phase: 'result'` for any outcome on purpose, so remembering which one
   * happened belongs to this hook.
   */
  readonly attemptOutcome: AttemptOutcome | null;
  /** Forgets a finished attempt, when leaving the level it belonged to. */
  readonly clearAttemptOutcome: () => void;
  readonly simulationStateRef: RefObject<SimulationSnapshot | null>;
  readonly launchSimulation: () => void;
  readonly restoreConstruction: () => void;
  readonly pauseCurrentSimulation: () => void;
  readonly resumeCurrentSimulation: () => void;
  /** Tears down the physics session immediately, without validating a phase transition. For switching levels. */
  readonly disposeSimulationSession: () => void;
}

/**
 * Owns the fixed-step physics loop: the RAF scheduling (with the catch-up
 * cap above), the physical `SimulationSession`'s lifecycle (create on
 * launch, destroy on dispose/unmount), and the `EditorSession` phase
 * transitions that drive it (running/paused/result/construction).
 */
export function useSimulationRunner({
  sessionRef,
  updateSession,
  setFeedback,
  pointers,
  onSimulationLaunched,
  onSimulationCompleted,
}: UseSimulationRunnerOptions): SimulationRunnerController {
  const [simulationState, setSimulationState] = useState<SimulationSnapshot | null>(null);
  const [attemptOutcome, setAttemptOutcome] = useState<AttemptOutcome | null>(null);
  const simulationStateRef = useRef<SimulationSnapshot | null>(null);
  const simulationSessionRef = useRef<SimulationSession | null>(null);
  const simulationAnimationFrameRef = useRef<number | null>(null);
  const simulationTimestampRef = useRef<number | null>(null);

  const updateSimulationState = (nextState: SimulationSnapshot | null): void => {
    simulationStateRef.current = nextState;
    setSimulationState(nextState);
  };

  const cancelSimulationFrame = (): void => {
    const frameId = simulationAnimationFrameRef.current;
    if (frameId === null) return;

    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frameId);
    }
    simulationAnimationFrameRef.current = null;
  };

  const disposeSimulationSession = (): void => {
    cancelSimulationFrame();
    simulationTimestampRef.current = null;
    const physicalSession = simulationSessionRef.current;
    simulationSessionRef.current = null;
    if (physicalSession !== null) physicalSession.destroy();
    updateSimulationState(null);
  };

  const scheduleSimulationFrame = (): void => {
    if (
      sessionRef.current.phase !== 'running' ||
      simulationSessionRef.current === null ||
      typeof requestAnimationFrame !== 'function'
    ) {
      return;
    }

    simulationAnimationFrameRef.current = requestAnimationFrame((timestamp) => {
      simulationAnimationFrameRef.current = null;
      const physicalSession = simulationSessionRef.current;
      if (physicalSession === null || sessionRef.current.phase !== 'running') return;

      const previousTimestamp = simulationTimestampRef.current;
      simulationTimestampRef.current = timestamp;
      const rawElapsedSeconds =
        previousTimestamp === null ? 0 : Math.max(0, timestamp - previousTimestamp) / 1000;
      const elapsedSeconds = capElapsedSecondsForCatchUp(rawElapsedSeconds, fixedStepSeconds);

      physicalSession.advanceElapsedSeconds(elapsedSeconds);
      const nextState = physicalSession.readState();
      updateSimulationState(nextState);

      const simulatedDocument = sessionRef.current.simulationSnapshot?.document;
      if (simulatedDocument !== undefined && !hasCompleteGoal(simulatedDocument)) {
        if (isWatchedRunOver(simulatedDocument, physicalSession.hasReachedTimeLimit())) {
          restoreConstruction();
          return;
        }
        scheduleSimulationFrame();
        return;
      }

      const outcome = resolveAttemptOutcome(
        physicalSession.readGoalEvaluation(),
        physicalSession.readFailureEvaluation(),
      );
      if (outcome !== null) {
        const completed = completeSimulation(sessionRef.current);
        if (completed.status === 'accepted') {
          updateSession(completed.session);
          setAttemptOutcome(outcome);
          onSimulationCompleted?.(outcome);
          simulationTimestampRef.current = null;
          return;
        }
      }

      scheduleSimulationFrame();
    });
  };

  const launchSimulation = (): void => {
    const result = startSimulation(sessionRef.current);
    if (result.status === 'rejected') {
      setFeedback('Simulation indisponible : reviens à la construction pour la relancer.');
      return;
    }

    const simulationSnapshot = result.session.simulationSnapshot;
    if (simulationSnapshot === null) {
      setFeedback('Simulation indisponible : le snapshot du niveau est absent.');
      return;
    }

    let physicalSession: SimulationSession;
    try {
      physicalSession = createSimulationSession(simulationSnapshot.document, {
        fixedStepSeconds,
      });
    } catch {
      setFeedback('Simulation indisponible : le niveau ne peut pas être simulé.');
      return;
    }

    disposeSimulationSession();
    simulationSessionRef.current = physicalSession;
    simulationTimestampRef.current = null;
    updateSimulationState(physicalSession.readState());
    updateSession(result.session);
    onSimulationLaunched?.(simulationSnapshot);
    pointers.clearPlacementTool();
    pointers.resetGestureState();
    setFeedback(null);
    setAttemptOutcome(null);
    scheduleSimulationFrame();
  };

  const restoreConstruction = (): void => {
    const result = resetSimulation(sessionRef.current);
    if (result.status === 'rejected') {
      setFeedback('Retour à la construction indisponible pour cette simulation.');
      return;
    }

    disposeSimulationSession();
    updateSession(result.session);
    pointers.resetGestureState();
    setFeedback(null);
    setAttemptOutcome(null);
  };

  const pauseCurrentSimulation = (): void => {
    const result = pauseSimulation(sessionRef.current);
    if (result.status === 'rejected') {
      setFeedback('Pause indisponible : la simulation n’est pas en cours.');
      return;
    }

    cancelSimulationFrame();
    simulationTimestampRef.current = null;
    updateSession(result.session);
    setFeedback(null);
  };

  const resumeCurrentSimulation = (): void => {
    const result = resumeSimulation(sessionRef.current);
    if (result.status === 'rejected') {
      setFeedback('Reprise indisponible : la simulation n’est pas en pause.');
      return;
    }

    simulationTimestampRef.current = null;
    updateSession(result.session);
    setFeedback(null);
    scheduleSimulationFrame();
  };

  useEffect(
    () => () => {
      const frameId = simulationAnimationFrameRef.current;
      if (frameId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frameId);
      }
      simulationAnimationFrameRef.current = null;
      simulationTimestampRef.current = null;

      const physicalSession = simulationSessionRef.current;
      simulationSessionRef.current = null;
      if (physicalSession !== null) physicalSession.destroy();
    },
    [],
  );

  return {
    simulationState,
    attemptOutcome,
    clearAttemptOutcome: () => {
      setAttemptOutcome(null);
    },
    simulationStateRef,
    launchSimulation,
    restoreConstruction,
    pauseCurrentSimulation,
    resumeCurrentSimulation,
    disposeSimulationSession,
  };
}
