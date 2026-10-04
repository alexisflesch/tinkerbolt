import { initialObjectFamilyRegistry } from '../../domain/object-family-registry';
import { placementFootprintCorners } from '../../domain/placement-footprint';
import {
  isPlacementUnconstrained,
  levelDocumentAttemptSchema,
  levelDocumentSchema,
  rotationMode,
  withSceneIncluding,
  type LevelDocument,
} from '../../domain/level-document';
import type { Command, CommandState } from '../history';

export type ConstructionContext = 'player' | 'author';

export type ConstructionErrorCode =
  | 'inventory-entry-not-found'
  | 'inventory-depleted'
  | 'inventory-entry-kind-mismatch'
  | 'placement-id-already-used'
  | 'placement-not-found'
  | 'placement-not-rotatable'
  | 'move-not-permitted'
  | 'rotate-not-permitted'
  | 'remove-not-permitted'
  | 'outside-build-zone'
  | 'goal-object-protected'
  | 'inventory-provenance-missing'
  | 'inventory-source-not-found'
  | 'inventory-provenance-mismatch'
  | 'properties-not-permitted'
  | 'wiring-not-permitted'
  | 'wire-already-connected'
  | 'timer-already-connected'
  | 'wire-not-found'
  | 'authoring-only'
  | 'scene-excludes-content'
  | 'build-zone-not-found'
  | 'identifier-already-used'
  | 'inventory-entry-in-use'
  | 'placement-has-inventory-provenance'
  | 'goal-ball-not-found'
  | 'goal-basket-not-found'
  | 'solution-not-found'
  | 'invalid-level-document';

/**
 * State for one editable construction. Provenance deliberately lives beside the
 * persistent document: it describes this attempt, not the authored level. It
 * maps the id of each object or wire (U21) the attempt took from the inventory
 * to its inventory entry; a player's wire id never collides with an object id.
 */
export interface ConstructionAttempt {
  readonly document: LevelDocument;
  readonly provenance: Readonly<Record<string, string>>;
}

type ConstructionCommandOutcome =
  | { readonly status: 'accepted'; readonly state: ConstructionAttempt }
  | { readonly status: 'rejected'; readonly reason: ConstructionErrorCode };

interface ConstructionCommand extends Command<ConstructionAttempt> {
  readonly execute: (state: CommandState<ConstructionAttempt>) => ConstructionCommandOutcome;
}

type Placement = LevelDocument['objects'][number];
type InventoryEntry = LevelDocument['inventory'][number];
type BeamPlacement = Extract<Placement, { readonly type: 'beam' }>;
export type BeamSize = BeamPlacement['props']['size'];
type Transform = Placement['transform'];
type WorldPosition = Transform['position'];

export interface BeamSizeChoice {
  readonly size: BeamSize;
  readonly isCurrent: boolean;
  readonly isAvailable: boolean;
  /** Remaining matching entries; `null` means the author catalogue has no stock limit. */
  readonly quantity: number | null;
}

interface PlaceFromInventoryInput {
  readonly context: ConstructionContext;
  readonly inventoryEntryId: string;
  readonly placementId: string;
  readonly transform: Transform;
}

interface MovePlacementInput {
  readonly context: ConstructionContext;
  readonly placementId: string;
  readonly position: WorldPosition;
}

interface RotatePlacementInput {
  readonly context: ConstructionContext;
  readonly placementId: string;
  readonly rotation: number;
}

interface RemovePlacementInput {
  readonly context: ConstructionContext;
  readonly placementId: string;
}

/**
 * Persistent properties are author-only: a beam's size, a lever's starting
 * position, a conveyor's direction. They are checked against the schema of
 * the placement's own family.
 */
interface UpdatePlacementPropertiesInput {
  readonly context: ConstructionContext;
  readonly placementId: string;
  readonly props: Placement['props'];
}

interface ChangeBeamSizeInput {
  readonly context: ConstructionContext;
  readonly placementId: string;
  readonly size: BeamSize;
}

/**
 * ADR 0009, amended by U21: the author wires freely; the player wires only by
 * consuming a wire entry of the inventory, named by `inventoryEntryId`.
 */
interface ConnectControlWireInput {
  readonly context: ConstructionContext;
  readonly wireId: string;
  readonly sourceId: string;
  readonly timerId?: string | undefined;
  readonly targetId: string;
  readonly inventoryEntryId?: string | undefined;
}

interface DisconnectControlWireInput {
  readonly context: ConstructionContext;
  readonly wireId: string;
}

const deepFreeze = <Value>(value: Value): Value => {
  const visited = new WeakSet();

  const freeze = (candidate: unknown): void => {
    if (typeof candidate !== 'object' || candidate === null || visited.has(candidate)) return;

    visited.add(candidate);
    Object.values(candidate).forEach(freeze);
    Object.freeze(candidate);
  };

  freeze(value);
  return value;
};

export const freezeAttempt = (
  document: LevelDocument,
  provenance: Readonly<Record<string, string>>,
): ConstructionAttempt => deepFreeze({ document, provenance: { ...provenance } });

export const createConstructionAttempt = (document: LevelDocument): ConstructionAttempt =>
  freezeAttempt(levelDocumentSchema.parse(document), {});

const reject = (reason: ConstructionErrorCode): ConstructionCommandOutcome => ({
  status: 'rejected',
  reason,
});

const coordinateTolerance = (left: number, right: number): number =>
  Number.EPSILON * 16 * Math.max(1, Math.abs(left), Math.abs(right));

const isCoordinateInside = (value: number, min: number, max: number): boolean =>
  value + coordinateTolerance(value, min) >= min && value - coordinateTolerance(value, max) <= max;

/**
 * A full object footprint must fit in one build zone; shared edges are
 * inclusive. A zone covering the whole scene restricts nothing.
 */
export const isFootprintInsideBuildZone = (
  document: LevelDocument,
  corners: ReturnType<typeof placementFootprintCorners>,
): boolean =>
  isPlacementUnconstrained(document) ||
  document.buildZones.some(({ min, max }) =>
    corners.every(
      ({ x, y }) => isCoordinateInside(x, min.x, max.x) && isCoordinateInside(y, min.y, max.y),
    ),
  );

/** Properties are flat objects of strings, so comparing their entries is exact. */
const samePropertyValues = (
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean =>
  Object.keys(left).length === Object.keys(right).length &&
  Object.entries(left).every(([key, value]) => right[key] === value);

export const definitionsMatch = (placement: Placement, inventoryEntry: InventoryEntry): boolean => {
  if (placement.type !== inventoryEntry.type) return false;

  const propertiesMatch = samePropertyValues(placement.props, inventoryEntry.props);

  return (
    propertiesMatch &&
    placement.permissions.move === inventoryEntry.permissions.move &&
    placement.permissions.rotate === inventoryEntry.permissions.rotate &&
    placement.permissions.remove === inventoryEntry.permissions.remove
  );
};

const BEAM_SIZES: readonly BeamSize[] = ['short', 'medium', 'long'];

const matchingBeamEntries = (
  attempt: ConstructionAttempt,
  placement: BeamPlacement,
  size: BeamSize,
): readonly Extract<InventoryEntry, { readonly type: 'beam' }>[] => {
  const resized = { ...placement, props: { size } };
  return attempt.document.inventory.filter(
    (entry): entry is Extract<InventoryEntry, { readonly type: 'beam' }> =>
      entry.type === 'beam' && entry.props.size === size && definitionsMatch(resized, entry),
  );
};

/**
 * Choices for the board's beam-size affordance. In player mode the beam must
 * come from inventory, and every alternative must be available in that same
 * level's remaining stock; changing size cannot mint a piece.
 */
export const beamSizeChoicesFor = (
  attempt: ConstructionAttempt,
  placementId: string,
  context: ConstructionContext,
): readonly BeamSizeChoice[] | null => {
  const placement = attempt.document.objects.find(({ id }) => id === placementId);
  if (placement?.type !== 'beam') return null;
  if (context === 'author') {
    return BEAM_SIZES.map((size) => ({
      size,
      isCurrent: placement.props.size === size,
      isAvailable: true,
      quantity: null,
    }));
  }

  if (!placement.permissions.move) return null;
  const sourceId = attempt.provenance[placementId];
  if (sourceId === undefined) return null;
  const source = attempt.document.inventory.find(({ id }) => id === sourceId);
  if (source?.type !== 'beam' || !definitionsMatch(placement, source)) return null;

  return BEAM_SIZES.map((size) => {
    const isCurrent = placement.props.size === size;
    const quantity = matchingBeamEntries(attempt, placement, size).reduce(
      (total, entry) => total + entry.quantity,
      0,
    );
    return {
      size,
      isCurrent,
      isAvailable: isCurrent || quantity > 0,
      quantity,
    };
  });
};

const acceptCandidate = (
  documentCandidate: unknown,
  provenance: Readonly<Record<string, string>>,
): ConstructionCommandOutcome => {
  const attemptValidation = levelDocumentAttemptSchema.safeParse(documentCandidate);
  if (!attemptValidation.success) return reject('invalid-level-document');
  const attemptDocument = attemptValidation.data;
  const placementsById = new Map(
    attemptDocument.objects.map((placement) => [placement.id, placement]),
  );
  const wireIds = new Set(attemptDocument.wires.map(({ id }) => id));
  const consumedByInventoryId = new Map<string, number>();

  for (const [takenId, inventoryEntryId] of Object.entries(provenance)) {
    const placement = placementsById.get(takenId);
    const inventoryEntry = attemptDocument.inventory.find(({ id }) => id === inventoryEntryId);
    if (inventoryEntry === undefined) continue;
    const consumed =
      placement === undefined
        ? inventoryEntry.type === 'wire' && wireIds.has(takenId)
        : definitionsMatch(placement, inventoryEntry);
    if (!consumed) continue;
    consumedByInventoryId.set(
      inventoryEntryId,
      (consumedByInventoryId.get(inventoryEntryId) ?? 0) + 1,
    );
  }

  // A player attempt stores remaining quantities in its document, while the
  // challenge invariant is defined against the level's original inventory.
  // Reconstruct that inventory for validation, then retain the remaining
  // quantities in the accepted attempt for the drawer and depletion checks.
  const inventoryForValidation = attemptDocument.inventory.map((entry) => ({
    ...entry,
    quantity: entry.quantity + (consumedByInventoryId.get(entry.id) ?? 0),
  }));
  const solutionWireIds = new Set(attemptDocument.solution?.wires?.map(({ id }) => id) ?? []);
  const validation = levelDocumentSchema.safeParse({
    ...attemptDocument,
    inventory: inventoryForValidation,
    // The exported solution describes a wire before the player lays it. During
    // an attempt, its concrete wire instance is validated by the attempt
    // schema above and must not collide with the solution metadata here.
    wires: attemptDocument.wires.filter(({ id }) => !solutionWireIds.has(id)),
  });
  if (!validation.success) return reject('invalid-level-document');

  return {
    status: 'accepted',
    state: freezeAttempt(
      {
        ...validation.data,
        inventory: attemptDocument.inventory,
        wires: attemptDocument.wires,
      },
      provenance,
    ),
  };
};

/** Revalidate a document edited by an author while retaining attempt provenance. */
export const acceptAuthoringCandidate = (
  state: ConstructionAttempt,
  documentCandidate: unknown,
): ConstructionCommandOutcome => acceptCandidate(documentCandidate, state.provenance);

export const placeFromInventory = (input: PlaceFromInventoryInput): ConstructionCommand => ({
  execute: (state) => {
    const inventoryEntry = state.document.inventory.find(({ id }) => id === input.inventoryEntryId);
    if (inventoryEntry === undefined) return reject('inventory-entry-not-found');
    if (inventoryEntry.type === 'wire') return reject('inventory-entry-kind-mismatch');
    if (inventoryEntry.quantity <= 0) return reject('inventory-depleted');
    if (state.document.objects.some(({ id }) => id === input.placementId)) {
      return reject('placement-id-already-used');
    }
    if (
      input.context === 'player' &&
      !isFootprintInsideBuildZone(
        state.document,
        placementFootprintCorners(inventoryEntry, input.transform),
      )
    ) {
      return reject('outside-build-zone');
    }

    const placementCandidate = {
      id: input.placementId,
      type: inventoryEntry.type,
      props: { ...inventoryEntry.props },
      transform: {
        position: { ...input.transform.position },
        rotation: input.transform.rotation,
      },
      permissions: { ...inventoryEntry.permissions },
    };
    const document =
      input.context === 'author'
        ? withSceneIncluding(state.document, input.transform.position)
        : state.document;
    const documentCandidate = {
      ...document,
      objects: [...document.objects, placementCandidate],
      inventory: state.document.inventory.map((entry) =>
        entry.id === inventoryEntry.id ? { ...entry, quantity: entry.quantity - 1 } : entry,
      ),
    };

    return acceptCandidate(documentCandidate, {
      ...state.provenance,
      [input.placementId]: inventoryEntry.id,
    });
  },
});

export const movePlacement = (input: MovePlacementInput): ConstructionCommand => ({
  execute: (state) => {
    const placement = state.document.objects.find(({ id }) => id === input.placementId);
    if (placement === undefined) return reject('placement-not-found');
    if (input.context === 'player' && !placement.permissions.move) {
      return reject('move-not-permitted');
    }
    if (
      input.context === 'player' &&
      !isFootprintInsideBuildZone(
        state.document,
        placementFootprintCorners(placement, {
          ...placement.transform,
          position: input.position,
        }),
      )
    ) {
      return reject('outside-build-zone');
    }
    if (
      placement.transform.position.x === input.position.x &&
      placement.transform.position.y === input.position.y
    ) {
      return { status: 'accepted', state };
    }

    // The author's board has no edge: the scene grows to take the object.
    const document =
      input.context === 'author'
        ? withSceneIncluding(state.document, input.position)
        : state.document;
    const documentCandidate = {
      ...document,
      objects: document.objects.map((entry) =>
        entry.id === placement.id
          ? {
              ...entry,
              transform: { ...entry.transform, position: { ...input.position } },
            }
          : entry,
      ),
    };
    return acceptCandidate(documentCandidate, state.provenance);
  },
});

export const rotatePlacement = (input: RotatePlacementInput): ConstructionCommand => ({
  execute: (state) => {
    const placement = state.document.objects.find(({ id }) => id === input.placementId);
    if (placement === undefined) return reject('placement-not-found');
    if (rotationMode(placement.type) === 'fixed') return reject('placement-not-rotatable');
    if (input.context === 'player' && !placement.permissions.rotate) {
      return reject('rotate-not-permitted');
    }
    if (
      input.context === 'player' &&
      !isFootprintInsideBuildZone(
        state.document,
        placementFootprintCorners(placement, {
          ...placement.transform,
          rotation: input.rotation,
        }),
      )
    ) {
      return reject('outside-build-zone');
    }
    if (placement.transform.rotation === input.rotation) {
      return { status: 'accepted', state };
    }

    const documentCandidate = {
      ...state.document,
      objects: state.document.objects.map((entry) =>
        entry.id === placement.id
          ? { ...entry, transform: { ...entry.transform, rotation: input.rotation } }
          : entry,
      ),
    };
    return acceptCandidate(documentCandidate, state.provenance);
  },
});

export const updatePlacementProperties = (
  input: UpdatePlacementPropertiesInput,
): ConstructionCommand => ({
  execute: (state) => {
    if (input.context === 'player') return reject('properties-not-permitted');

    const placement = state.document.objects.find(({ id }) => id === input.placementId);
    if (placement === undefined) return reject('placement-not-found');

    const family = initialObjectFamilyRegistry.get(placement.type);
    const properties = family?.propertiesSchema.safeParse(input.props);
    if (properties?.success !== true) return reject('invalid-level-document');

    if (samePropertyValues(placement.props, input.props)) {
      return { status: 'accepted', state };
    }

    const documentCandidate = {
      ...state.document,
      objects: state.document.objects.map((entry) =>
        entry.id === placement.id ? { ...entry, props: properties.data } : entry,
      ),
    };
    return acceptCandidate(documentCandidate, state.provenance);
  },
});

/**
 * Changes a beam's fixed size. Authors can choose any size; players exchange
 * an inventory-sourced beam for a matching size from the same level's stock.
 */
export const changeBeamSize = (input: ChangeBeamSizeInput): ConstructionCommand => ({
  execute: (state) => {
    const placement = state.document.objects.find(({ id }) => id === input.placementId);
    if (placement === undefined) return reject('placement-not-found');
    if (placement.type !== 'beam') return reject('invalid-level-document');
    if (placement.props.size === input.size) return { status: 'accepted', state };

    const resizedPlacement: BeamPlacement = {
      ...placement,
      props: { size: input.size },
    };
    if (input.context === 'author') {
      return acceptCandidate(
        {
          ...state.document,
          objects: state.document.objects.map((entry) =>
            entry.id === placement.id ? resizedPlacement : entry,
          ),
        },
        state.provenance,
      );
    }

    if (!placement.permissions.move) return reject('move-not-permitted');
    const sourceId = state.provenance[placement.id];
    if (sourceId === undefined) return reject('inventory-provenance-missing');
    const source = state.document.inventory.find(({ id }) => id === sourceId);
    if (source === undefined) return reject('inventory-source-not-found');
    if (source.type !== 'beam' || !definitionsMatch(placement, source)) {
      return reject('inventory-provenance-mismatch');
    }

    const target = matchingBeamEntries(state, placement, input.size).find(
      (entry) => entry.quantity > 0,
    );
    if (target === undefined) return reject('inventory-depleted');
    if (!isFootprintInsideBuildZone(state.document, placementFootprintCorners(resizedPlacement))) {
      return reject('outside-build-zone');
    }

    const documentCandidate = {
      ...state.document,
      objects: state.document.objects.map((entry) =>
        entry.id === placement.id ? resizedPlacement : entry,
      ),
      inventory: state.document.inventory.map((entry) =>
        entry.id === source.id
          ? { ...entry, quantity: entry.quantity + 1 }
          : entry.id === target.id
            ? { ...entry, quantity: entry.quantity - 1 }
            : entry,
      ),
    };
    return acceptCandidate(documentCandidate, {
      ...state.provenance,
      [placement.id]: target.id,
    });
  },
});

/**
 * Gives back to the inventory the wires in `wireIds` that this attempt took
 * from it (U21), and forgets their provenance. Level wires are left alone.
 */
const returnWiresToInventory = (
  inventory: readonly InventoryEntry[],
  provenance: Readonly<Record<string, string>>,
  wireIds: readonly string[],
): { inventory: InventoryEntry[]; provenance: Record<string, string> } => {
  const returnedByEntryId = new Map<string, number>();
  for (const wireId of wireIds) {
    const entryId = provenance[wireId];
    if (entryId !== undefined) {
      returnedByEntryId.set(entryId, (returnedByEntryId.get(entryId) ?? 0) + 1);
    }
  }
  return {
    inventory: inventory.map((entry) => {
      const returned = returnedByEntryId.get(entry.id) ?? 0;
      return returned === 0 ? entry : { ...entry, quantity: entry.quantity + returned };
    }),
    provenance: Object.fromEntries(
      Object.entries(provenance).filter(([takenId]) => !wireIds.includes(takenId)),
    ),
  };
};

export const removePlacement = (input: RemovePlacementInput): ConstructionCommand => ({
  execute: (state) => {
    const placement = state.document.objects.find(({ id }) => id === input.placementId);
    if (placement === undefined) return reject('placement-not-found');
    if (
      placement.id === state.document.goal.ballId ||
      placement.id === state.document.goal.basketId
    ) {
      return reject('goal-object-protected');
    }
    if (input.context === 'player' && !placement.permissions.remove) {
      return reject('remove-not-permitted');
    }

    const sourceId = state.provenance[placement.id];
    if (input.context === 'player' && sourceId === undefined) {
      return reject('inventory-provenance-missing');
    }

    let inventory = state.document.inventory;
    if (sourceId !== undefined) {
      const source = inventory.find(({ id }) => id === sourceId);
      if (source === undefined) return reject('inventory-source-not-found');
      if (input.context === 'player' && !definitionsMatch(placement, source)) {
        return reject('inventory-provenance-mismatch');
      }

      inventory = inventory.map((entry) =>
        entry.id === source.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
      );
    }

    // A wire never outlives either of its ends; a player's wire goes back to
    // the inventory it came from (U21).
    const isCut = ({ sourceId: from, targetId: to }: { sourceId: string; targetId: string }) =>
      from === placement.id || to === placement.id;
    const returned = returnWiresToInventory(
      inventory,
      state.provenance,
      state.document.wires.filter(isCut).map(({ id }) => id),
    );
    const documentCandidate = {
      ...state.document,
      objects: state.document.objects.filter(({ id }) => id !== placement.id),
      inventory: returned.inventory,
      wires: state.document.wires.filter((wire) => !isCut(wire)),
    };
    const provenance = Object.fromEntries(
      Object.entries(returned.provenance).filter(([placementId]) => placementId !== placement.id),
    );
    return acceptCandidate(documentCandidate, provenance);
  },
});

/**
 * The player's side of `connectControlWire` (U21): the wire comes from a wire
 * entry of the inventory, which loses one unit and becomes its provenance.
 */
const takeWireFromInventory = (
  state: ConstructionAttempt,
  input: ConnectControlWireInput,
):
  | {
      readonly status: 'taken';
      readonly inventory: readonly InventoryEntry[];
      readonly provenance: Readonly<Record<string, string>>;
    }
  | { readonly status: 'rejected'; readonly reason: ConstructionErrorCode } => {
  if (input.context === 'author') {
    return { status: 'taken', inventory: state.document.inventory, provenance: state.provenance };
  }
  if (input.inventoryEntryId === undefined)
    return { status: 'rejected', reason: 'wiring-not-permitted' };
  const entry = state.document.inventory.find(({ id }) => id === input.inventoryEntryId);
  if (entry === undefined) return { status: 'rejected', reason: 'inventory-entry-not-found' };
  if (entry.type !== 'wire') return { status: 'rejected', reason: 'inventory-entry-kind-mismatch' };
  if (entry.quantity <= 0) return { status: 'rejected', reason: 'inventory-depleted' };
  // Provenance keys objects and wires alike: a player's wire id stays apart.
  if (
    state.document.objects.some(({ id }) => id === input.wireId) ||
    state.provenance[input.wireId] !== undefined
  ) {
    return { status: 'rejected', reason: 'identifier-already-used' };
  }
  return {
    status: 'taken',
    inventory: state.document.inventory.map((candidate) =>
      candidate.id === entry.id ? { ...candidate, quantity: candidate.quantity - 1 } : candidate,
    ),
    provenance: { ...state.provenance, [input.wireId]: entry.id },
  };
};

export const connectControlWire = (input: ConnectControlWireInput): ConstructionCommand => ({
  execute: (state) => {
    const taken = takeWireFromInventory(state, input);
    if (taken.status === 'rejected') return reject(taken.reason);
    if (state.document.wires.some(({ targetId }) => targetId === input.targetId)) {
      return reject('wire-already-connected');
    }
    if (
      input.timerId !== undefined &&
      state.document.wires.some(({ timerId }) => timerId === input.timerId)
    ) {
      return reject('timer-already-connected');
    }

    const documentCandidate = {
      ...state.document,
      inventory: taken.inventory,
      wires: [
        ...state.document.wires,
        {
          id: input.wireId,
          sourceId: input.sourceId,
          ...(input.timerId !== undefined ? { timerId: input.timerId } : {}),
          targetId: input.targetId,
        },
      ],
    };
    return acceptCandidate(documentCandidate, taken.provenance);
  },
});

/**
 * Unlinks a wire. The player unlinks only a wire he laid, if its entry lets
 * him take it back, and gets it back in the inventory (U21); level wires stay.
 */
export const disconnectControlWire = (input: DisconnectControlWireInput): ConstructionCommand => ({
  execute: (state) => {
    if (!state.document.wires.some(({ id }) => id === input.wireId)) {
      return reject('wire-not-found');
    }
    if (input.context === 'player') {
      const entryId = state.provenance[input.wireId];
      if (entryId === undefined) return reject('inventory-provenance-missing');
      const entry = state.document.inventory.find(({ id }) => id === entryId);
      if (entry === undefined) return reject('inventory-source-not-found');
      if (!entry.permissions.remove) return reject('remove-not-permitted');
    }

    const returned = returnWiresToInventory(state.document.inventory, state.provenance, [
      input.wireId,
    ]);
    const documentCandidate = {
      ...state.document,
      inventory: returned.inventory,
      wires: state.document.wires.filter(({ id }) => id !== input.wireId),
    };
    return acceptCandidate(documentCandidate, returned.provenance);
  },
});
