import { useCallback, useRef, useState, type RefObject } from 'react';

import { connectControlWire } from '../application/construction/construction-attempt';
import {
  currentEditorAttempt,
  type EditorSession,
  type executeEditorCommand,
} from '../application/editor-session/editor-session';
import {
  controlWireSourceIssue,
  controlWireTargetIssue,
  type LevelDocument,
} from '../domain/level-document';

type Placement = LevelDocument['objects'][number];

/**
 * Where the "Fil" card's gesture stands: a first object, then the one it
 * links to — a controller (lever, button) and a device, in either order.
 */
export type WiringStep =
  | { readonly kind: 'first' }
  | {
      readonly kind: 'second';
      readonly firstId: string;
      /** The wire's end the first object takes. */
      readonly first: 'source' | 'target';
    }
  | {
      readonly kind: 'device-after-timer';
      readonly sourceId: string;
      readonly timerId: string;
    };

type WiringTapOutcome =
  | { readonly kind: 'next'; readonly step: WiringStep }
  | { readonly kind: 'refused'; readonly message: string }
  | {
      readonly kind: 'connect';
      readonly sourceId: string;
      readonly timerId?: string;
      readonly targetId: string;
    };

const unlinkableMessage =
  'Un fil relie un levier ou un bouton à un convoyeur, un ventilateur, une barrière, un électroaimant ou un piston.';

/**
 * What a tap on `placementId` does at `step`. The rules and their wording
 * are the domain's (`controlWireSourceIssue`, `controlWireTargetIssue`); the
 * one-controller rule depends on the other wires and is left to the
 * `connectControlWire` command (`wire-already-connected`).
 */
export const wiringTap = (
  step: WiringStep,
  objects: readonly Pick<Placement, 'id' | 'type'>[],
  placementId: string,
): WiringTapOutcome => {
  const typeOf = (id: string): Placement['type'] | undefined =>
    objects.find((object) => object.id === id)?.type;
  const tapped = typeOf(placementId);

  if (step.kind === 'first') {
    if (controlWireSourceIssue(tapped) === null) {
      return { kind: 'next', step: { kind: 'second', firstId: placementId, first: 'source' } };
    }
    if (controlWireTargetIssue(undefined, tapped) === null) {
      return { kind: 'next', step: { kind: 'second', firstId: placementId, first: 'target' } };
    }
    return { kind: 'refused', message: unlinkableMessage };
  }

  if (step.kind === 'device-after-timer') {
    const source = typeOf(step.sourceId);
    if (source === undefined) return { kind: 'next', step: { kind: 'first' } };
    if (typeOf(step.timerId) !== 'timer') {
      return {
        kind: 'next',
        step: { kind: 'second', firstId: step.sourceId, first: 'source' },
      };
    }
    const issue = controlWireTargetIssue(source, tapped);
    return issue === null
      ? {
          kind: 'connect',
          sourceId: step.sourceId,
          timerId: step.timerId,
          targetId: placementId,
        }
      : { kind: 'refused', message: issue };
  }

  const first = typeOf(step.firstId);
  // An undo can take the first object away mid-gesture: start over.
  if (first === undefined) return { kind: 'next', step: { kind: 'first' } };
  if (step.first === 'source') {
    if (tapped === 'timer') {
      return {
        kind: 'next',
        step: { kind: 'device-after-timer', sourceId: step.firstId, timerId: placementId },
      };
    }
    const issue = controlWireTargetIssue(first, tapped);
    return issue === null
      ? { kind: 'connect', sourceId: step.firstId, targetId: placementId }
      : { kind: 'refused', message: issue };
  }
  const issue = controlWireSourceIssue(tapped) ?? controlWireTargetIssue(tapped, first);
  return issue === null
    ? { kind: 'connect', sourceId: placementId, targetId: step.firstId }
    : { kind: 'refused', message: issue };
};

/** The guidance shown for `step`, and the label of the command that leaves the gesture. */
export const wiringGuide = (
  step: WiringStep,
): { readonly prompt: string; readonly exitLabel: string } => {
  const prompt =
    step.kind === 'first'
      ? 'Choisis une commande ou l’appareil à relier'
      : step.kind === 'device-after-timer'
        ? 'Choisis l’appareil à commander'
        : step.first === 'source'
          ? 'Choisis le minuteur ou l’appareil à commander'
          : 'Choisis le levier ou le bouton qui le commande';
  return { prompt, exitLabel: 'Annuler le fil' };
};

/** The objects the wire being laid already holds: the board draws it from them to the cursor. */
export const wiringAnchor = (
  step: WiringStep | null,
): { readonly firstId: string; readonly timerId?: string } | null => {
  if (step === null || step.kind === 'first') return null;
  return step.kind === 'second'
    ? { firstId: step.firstId }
    : { firstId: step.sourceId, timerId: step.timerId };
};

/** Wire ids stay apart from object ids: an attempt's provenance keys both (U21). */
const nextWireId = (document: LevelDocument): string => {
  const used = new Set([...document.wires, ...document.objects].map(({ id }) => id));
  let index = 1;
  while (used.has(`wire-${String(index)}`)) index += 1;
  return `wire-${String(index)}`;
};

interface UseWiringToolOptions {
  readonly sessionRef: RefObject<EditorSession>;
  readonly executeCommand: (
    command: Parameters<typeof executeEditorCommand>[1],
  ) => ReturnType<typeof executeEditorCommand>;
  readonly setFeedback: (message: string | null) => void;
  /** The first object is selected, so the board shows it and, once linked, its circuit. */
  readonly onFirstChosen: (placementId: string) => void;
  /** The wire is laid and the gesture has ended. */
  readonly onWireLaid: () => void;
}

interface WiringTool {
  /** The gesture in progress, or `null` when the "Fil" card is not active. */
  readonly wiringStep: WiringStep | null;
  /** Whether the gesture is active, readable synchronously by the board's pointer handlers. */
  readonly isWiringRef: RefObject<boolean>;
  /** Starts the gesture; the player names the inventory entry his wires come from (U21). */
  readonly startWiring: (inventoryEntryId?: string) => void;
  readonly cancelWiring: () => void;
  /** A placement was touched while wiring. */
  readonly handleWiringTap: (placementId: string) => void;
}

/**
 * U15: the "Fil" card. Touch it, then a controller and the device it
 * commands, in either order: the wire is laid on the second touch and the
 * gesture ends there. Every wire goes through `connectControlWire`, so undo
 * and redo cover it. U21: the player's card takes the wire from an
 * inventory entry.
 */
export function useWiringTool({
  sessionRef,
  executeCommand,
  setFeedback,
  onFirstChosen,
  onWireLaid,
}: UseWiringToolOptions): WiringTool {
  const [wiringStep, setWiringStep] = useState<WiringStep | null>(null);
  const stepRef = useRef<WiringStep | null>(null);
  const isWiringRef = useRef(false);
  const inventoryEntryIdRef = useRef<string | undefined>(undefined);

  const updateStep = useCallback((step: WiringStep | null): void => {
    stepRef.current = step;
    isWiringRef.current = step !== null;
    setWiringStep(step);
  }, []);

  const startWiring = useCallback(
    (inventoryEntryId?: string): void => {
      inventoryEntryIdRef.current = inventoryEntryId;
      updateStep({ kind: 'first' });
      setFeedback(null);
    },
    [updateStep, setFeedback],
  );

  const cancelWiring = useCallback((): void => {
    if (stepRef.current === null) return;
    updateStep(null);
    setFeedback(null);
  }, [updateStep, setFeedback]);

  const handleWiringTap = useCallback(
    (placementId: string): void => {
      const step = stepRef.current;
      if (step === null) return;
      const session = sessionRef.current;
      const { document } = currentEditorAttempt(session);
      const outcome = wiringTap(step, document.objects, placementId);

      if (outcome.kind === 'refused') {
        setFeedback(outcome.message);
        return;
      }
      if (outcome.kind === 'next') {
        updateStep(outcome.step);
        if (outcome.step.kind === 'second') onFirstChosen(outcome.step.firstId);
        setFeedback(null);
        return;
      }

      const inventoryEntryId = inventoryEntryIdRef.current;
      const result = executeCommand(
        connectControlWire({
          context: session.mode === 'resolution' ? 'player' : 'author',
          wireId: nextWireId(document),
          sourceId: outcome.sourceId,
          ...(outcome.timerId !== undefined ? { timerId: outcome.timerId } : {}),
          targetId: outcome.targetId,
          inventoryEntryId,
        }),
      );
      // A refusal is already reported by `executeCommand`; the gesture stays
      // on its first object then. A laid wire ends the gesture.
      if (result.status === 'accepted') {
        updateStep(null);
        setFeedback('Fil posé.');
        onWireLaid();
      }
    },
    [sessionRef, executeCommand, setFeedback, updateStep, onFirstChosen, onWireLaid],
  );

  return { wiringStep, isWiringRef, startWiring, cancelWiring, handleWiringTap };
}
