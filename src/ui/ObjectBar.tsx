import type { ReactNode } from 'react';
import { FlipHorizontal2, Minus, Plus, Trash2 } from 'lucide-react';

import {
  setControlWireToPlace,
  setPlacementToPlace,
} from '../application/construction/authoring-commands';
import {
  disconnectControlWire,
  removePlacement,
  rotatePlacement,
  updatePlacementProperties,
} from '../application/construction/construction-attempt';
import {
  currentEditorAttempt,
  type EditorSession,
  type executeEditorCommand,
} from '../application/editor-session/editor-session';
import { mirroredRotation } from '../domain/family-geometry';
import { isMirrorableFamily, type LevelDocument } from '../domain/level-document';
import { placementName, placementNameWithArticle } from './placement-name';

type Placement = LevelDocument['objects'][number];
type Command = Parameters<typeof executeEditorCommand>[1];

interface ObjectBarProps {
  readonly session: EditorSession;
  readonly onExecuteCommand: (command: Command) => void;
}

interface Choice {
  readonly label: string;
  readonly isCurrent: boolean;
  readonly command: Command;
}

/** One line of the bar: two or three exclusive values, the current one pressed. */
function Choices({
  label,
  choices,
  onExecuteCommand,
}: {
  readonly label: string;
  readonly choices: readonly Choice[];
  readonly onExecuteCommand: (command: Command) => void;
}) {
  return (
    <div className="object-bar-choices" role="group" aria-label={label}>
      {choices.map((choice) => (
        <button
          key={choice.label}
          type="button"
          aria-pressed={choice.isCurrent}
          onClick={() => {
            if (!choice.isCurrent) onExecuteCommand(choice.command);
          }}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

/** The frame shared by both bars: a name, its icon commands, then its lines. */
function Bar({
  label,
  name,
  commands,
  children,
}: {
  readonly label: string;
  readonly name: string;
  readonly commands: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="object-bar" role="toolbar" aria-label={label}>
      <div className="object-bar-head">
        <span className="object-bar-name">{name}</span>
        {commands}
      </div>
      {children}
    </div>
  );
}

const MIN_TIMER_DELAY = 1;
const MAX_TIMER_DELAY = 10;

/** The author's own setting of a family, when it has one that no handle offers. */
const familySetting = (
  placement: Placement,
  isWired: boolean,
  onExecuteCommand: (command: Command) => void,
): ReactNode => {
  const placementId = placement.id;
  switch (placement.type) {
    case 'box':
      return (
        <Choices
          label="Matériau de la caisse"
          onExecuteCommand={onExecuteCommand}
          choices={(
            [
              ['Bois', 'wood'],
              ['Métal', 'metal'],
            ] as const
          ).map(([label, material]) => ({
            label,
            isCurrent: placement.props.material === material,
            command: updatePlacementProperties({
              context: 'author',
              placementId,
              props: { material },
            }),
          }))}
        />
      );
    case 'lever':
      return (
        <Choices
          label="Position de départ"
          onExecuteCommand={onExecuteCommand}
          choices={(
            [
              ['Gauche', 'left'],
              ['Centre', 'center'],
              ['Droite', 'right'],
            ] as const
          ).map(([label, position]) => ({
            label,
            isCurrent: placement.props.position === position,
            command: updatePlacementProperties({
              context: 'author',
              placementId,
              props: { position },
            }),
          }))}
        />
      );
    case 'conveyor':
      // A wired conveyor takes its direction from its command.
      return isWired ? null : (
        <Choices
          label="Sens du tapis"
          onExecuteCommand={onExecuteCommand}
          choices={(
            [
              ['Gauche', 'left'],
              ['Arrêté', 'stopped'],
              ['Droite', 'right'],
            ] as const
          ).map(([label, direction]) => ({
            label,
            isCurrent: placement.props.direction === direction,
            command: updatePlacementProperties({
              context: 'author',
              placementId,
              props: { direction },
            }),
          }))}
        />
      );
    case 'fan':
    case 'electro-magnet':
      return (
        <Choices
          label="État de départ"
          onExecuteCommand={onExecuteCommand}
          choices={(
            [
              ['En marche', 'on'],
              ['Arrêté', 'off'],
            ] as const
          ).map(([label, state]) => ({
            label,
            isCurrent: placement.props.state === state,
            command: updatePlacementProperties({
              context: 'author',
              placementId,
              props: { state },
            }),
          }))}
        />
      );
    case 'barrier':
      return (
        <Choices
          label="État de départ"
          onExecuteCommand={onExecuteCommand}
          choices={(
            [
              ['Fermée', 'closed'],
              ['Ouverte', 'open'],
            ] as const
          ).map(([label, state]) => ({
            label,
            isCurrent: placement.props.state === state,
            command: updatePlacementProperties({
              context: 'author',
              placementId,
              props: { state },
            }),
          }))}
        />
      );
    case 'timer': {
      const { delaySeconds } = placement.props;
      const setDelay = (next: number): void => {
        onExecuteCommand(
          updatePlacementProperties({
            context: 'author',
            placementId,
            props: { delaySeconds: next },
          }),
        );
      };
      return (
        <div className="object-bar-stepper" role="group" aria-label="Délai du minuteur">
          <button
            type="button"
            aria-label="Réduire le délai"
            disabled={delaySeconds <= MIN_TIMER_DELAY}
            onClick={() => {
              setDelay(delaySeconds - 1);
            }}
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <output aria-live="polite">{delaySeconds} s</output>
          <button
            type="button"
            aria-label="Augmenter le délai"
            disabled={delaySeconds >= MAX_TIMER_DELAY}
            onClick={() => {
              setDelay(delaySeconds + 1);
            }}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      );
    }
    // These families have no setting of their own: the beam's length is a handle on the board.
    case 'ball':
    case 'basket':
    case 'beam':
    case 'seesaw':
    case 'mass':
    case 'button':
    case 'springboard':
    case 'piston':
      return null;
  }
};

/**
 * The selected object's commands, in a small card floating over the board
 * beside it (identité visuelle, maquette `docs/maquettes/identite/atelier.html`):
 * « Fixe / À placer » and the family's own setting for the author, mirroring
 * and removal for whoever may. Moving, turning and resizing stay gestures on
 * the board. `BoardShell` shows it only after a plain click on a placed object.
 */
export function ObjectBar({ session, onExecuteCommand }: ObjectBarProps) {
  const attempt = currentEditorAttempt(session);
  const placement = attempt.document.objects.find(({ id }) => id === session.selectedPlacementId);
  if (placement === undefined || session.phase !== 'construction') return null;

  const isAuthor = session.mode === 'creation';
  const context = isAuthor ? 'author' : 'player';
  const { goal, wires } = attempt.document;
  const isGoalObject = placement.id === goal?.ballId || placement.id === goal?.basketId;
  // The goal's ball and basket are the author's to remove (ADR 0020), never the player's.
  const canRemove = isAuthor || (!isGoalObject && placement.permissions.remove);
  const canMirror =
    isMirrorableFamily(placement.type) && (isAuthor || placement.permissions.rotate);
  const isWired = wires.some(
    ({ sourceId, targetId, timerId }) =>
      sourceId === placement.id || targetId === placement.id || timerId === placement.id,
  );
  const setting = isAuthor ? familySetting(placement, isWired, onExecuteCommand) : null;
  const hasRole = isAuthor && !isGoalObject;

  return (
    <Bar
      label={`Réglages de ${placementName(placement)}`}
      name={placementName(placement)}
      commands={
        <>
          {canMirror && (
            <button
              className="object-bar-command"
              type="button"
              aria-label="Retourner"
              title="Retourner"
              onClick={() => {
                onExecuteCommand(
                  rotatePlacement({
                    context,
                    placementId: placement.id,
                    rotation: mirroredRotation(placement.transform.rotation),
                  }),
                );
              }}
            >
              <FlipHorizontal2 size={17} aria-hidden="true" />
            </button>
          )}
          {canRemove && (
            <button
              className="object-bar-command object-bar-remove"
              type="button"
              aria-label={`Supprimer ${placementNameWithArticle(placement)}`}
              title="Supprimer"
              onClick={() => {
                onExecuteCommand(removePlacement({ context, placementId: placement.id }));
              }}
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
          )}
        </>
      }
    >
      {hasRole && (
        // U22: the author says which objects the player will have to place.
        <Choices
          label="Pour le joueur"
          onExecuteCommand={onExecuteCommand}
          choices={(
            [
              ['Fixe', false],
              ['À placer', true],
            ] as const
          ).map(([label, toPlace]) => ({
            label,
            isCurrent: (placement.toPlace === true) === toPlace,
            command: setPlacementToPlace({
              context: 'author',
              placementId: placement.id,
              toPlace,
            }),
          }))}
        />
      )}
      {setting}
      {!hasRole && setting === null && !canMirror && !canRemove && (
        <p className="object-bar-note">Cet objet est fixe.</p>
      )}
    </Bar>
  );
}

interface WireBarProps extends ObjectBarProps {
  readonly wireId: string;
}

/** A selected wire's commands: « Fixe / À placer » for the author, and unplugging. */
export function WireBar({ session, wireId, onExecuteCommand }: WireBarProps) {
  const attempt = currentEditorAttempt(session);
  const wire = attempt.document.wires.find(({ id }) => id === wireId);
  if (wire === undefined || session.phase !== 'construction') return null;

  const isAuthor = session.mode === 'creation';
  const nameOf = (placementId: string): string => {
    const placement = attempt.document.objects.find(({ id }) => id === placementId);
    return placement === undefined ? '?' : placementName(placement);
  };
  // U21: the player unplugs only a wire he laid from the inventory, when its
  // entry lets him take it back; the level's wires stay.
  const canUnplug =
    isAuthor ||
    attempt.document.inventory.find(({ id }) => id === attempt.provenance[wire.id])?.permissions
      .remove === true;

  return (
    <Bar
      label="Réglages du fil"
      name={`Fil · ${nameOf(wire.sourceId)} → ${nameOf(wire.targetId)}`}
      commands={
        canUnplug && (
          <button
            className="object-bar-command object-bar-remove"
            type="button"
            aria-label="Débrancher le fil"
            title="Débrancher"
            onClick={() => {
              onExecuteCommand(
                disconnectControlWire({ context: isAuthor ? 'author' : 'player', wireId: wire.id }),
              );
            }}
          >
            <Trash2 size={17} aria-hidden="true" />
          </button>
        )
      }
    >
      {isAuthor ? (
        <Choices
          label="Pour le joueur"
          onExecuteCommand={onExecuteCommand}
          choices={(
            [
              ['Fixe', false],
              ['À placer', true],
            ] as const
          ).map(([label, toPlace]) => ({
            label,
            isCurrent: (wire.toPlace === true) === toPlace,
            command: setControlWireToPlace({ context: 'author', wireId: wire.id, toPlace }),
          }))}
        />
      ) : (
        !canUnplug && <p className="object-bar-note">Ce fil est fixe.</p>
      )}
    </Bar>
  );
}
