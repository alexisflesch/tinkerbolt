import { useRef, useState, type ReactNode } from 'react';

import type { LevelDocument } from '../domain/level-document';
import { Button } from './Button';
import { placementName } from './placement-name';

type PlacedObject = LevelDocument['objects'][number];

interface LabeledPlacement {
  readonly placement: PlacedObject;
  readonly label: string;
}

const sceneObjectName = (placement: PlacedObject): string =>
  placement.type === 'beam'
    ? `Poutre ${
        placement.props.size === 'short'
          ? 'courte'
          : placement.props.size === 'medium'
            ? 'moyenne'
            : 'longue'
      }`
    : placementName(placement);

const labelPlacements = (placements: readonly PlacedObject[]): LabeledPlacement[] => {
  const totals = new Map<string, number>();
  for (const placement of placements) {
    const name = sceneObjectName(placement);
    totals.set(name, (totals.get(name) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  return placements.map((placement) => {
    const name = sceneObjectName(placement);
    const ordinal = (seen.get(name) ?? 0) + 1;
    seen.set(name, ordinal);
    return {
      placement,
      label: (totals.get(name) ?? 0) > 1 ? `${name} ${String(ordinal)}` : name,
    };
  });
};

interface InspectorDrawerProps {
  readonly isWideLayout: boolean;
  /** Whether the selected object's properties are open in either layout. */
  readonly isPropertiesOpen: boolean;
  readonly placements: readonly PlacedObject[];
  readonly selectedPlacementId: string | null;
  readonly isSceneSelectionDisabled: boolean;
  readonly onOpenProperties: () => void;
  readonly onCloseProperties: () => void;
  readonly onSelectPlacement: (placementId: string) => void;
  /** The selected object's panel, or `null` when nothing is selected. */
  readonly properties: ReactNode;
  /** The attempt result banner (renders nothing until an attempt concludes). */
  readonly result: ReactNode;
}

/**
 * The home of the selected object's properties and of the attempt result
 * (docs/mobile-editor-interactions.md). The objective is not here: it opens
 * on demand in a dialog from the header (`BoardShell`), so it never takes
 * board space.
 *
 * - Wide layout: one right rail, selected properties on request, then result.
 * - Compact layouts: the result stays in the page flow, in the fixed-size
 *   `.status-slot` *after* the board — never over it, never resizing it (B5)
 *   — and the properties become an overlay sheet with its own scrim.
 *
 * The closed inspector keeps a keyboard-accessible scene-object list and an
 * explicit properties button. Selection alone never opens the panel (C4a).
 */
export function InspectorDrawer({
  isWideLayout,
  isPropertiesOpen,
  placements,
  selectedPlacementId,
  isSceneSelectionDisabled,
  onOpenProperties,
  onCloseProperties,
  onSelectPlacement,
  properties,
  result,
}: InspectorDrawerProps) {
  const hasSelection = properties !== null;
  const showsPropertiesInline = isWideLayout && hasSelection && isPropertiesOpen;
  const showsPropertiesSheet = !isWideLayout && hasSelection && isPropertiesOpen;
  const labeledPlacements = labelPlacements(placements);
  const [isSceneListOpen, setIsSceneListOpen] = useState(false);

  return (
    <>
      <aside
        className="inspector"
        aria-label={hasSelection ? 'Inspecteur des propriétés' : 'Inspecteur du niveau'}
      >
        {showsPropertiesInline && properties}
        {hasSelection && !isPropertiesOpen && (
          <Button className="inspector-open" onClick={onOpenProperties}>
            Ouvrir les propriétés
          </Button>
        )}
        {placements.length > 0 && (
          <section className="inspector-scene-list" role="group" aria-label="Objets sur le plateau">
            <button
              className="inspector-scene-toggle"
              type="button"
              aria-expanded={isSceneListOpen}
              aria-controls="inspector-scene-objects"
              onClick={() => {
                setIsSceneListOpen((open) => !open);
              }}
            >
              Objets sur le plateau
            </button>
            <ul id="inspector-scene-objects" hidden={!isSceneListOpen}>
              {labeledPlacements.map(({ placement, label }) => {
                return (
                  <li key={placement.id}>
                    <button
                      type="button"
                      aria-label={`Sélectionner ${label}`}
                      aria-pressed={selectedPlacementId === placement.id}
                      disabled={isSceneSelectionDisabled}
                      onClick={() => {
                        onSelectPlacement(placement.id);
                      }}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {result}
      </aside>
      {showsPropertiesSheet && (
        <>
          <InspectorScrim onClose={onCloseProperties} />
          {properties}
        </>
      )}
    </>
  );
}

/**
 * The scrim is remounted at each opening, so a press never carries over from
 * a previous one. A press started on the board cannot accidentally close the
 * sheet through its trailing synthetic click.
 */
function InspectorScrim({ onClose }: { readonly onClose: () => void }) {
  const pressStartedHereRef = useRef(false);

  return (
    <button
      className="inspector-scrim"
      type="button"
      aria-label="Fermer"
      onPointerDown={() => {
        pressStartedHereRef.current = true;
      }}
      onClick={(event) => {
        const pressStartedHere = pressStartedHereRef.current;
        pressStartedHereRef.current = false;
        if (pressStartedHere || event.detail === 0) onClose();
      }}
    />
  );
}
