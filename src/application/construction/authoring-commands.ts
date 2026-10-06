import { initialObjectFamilyRegistry } from '../../domain/object-family-registry';
import { withSceneIncluding, type LevelDocument } from '../../domain/level-document';
import type { Command, CommandOutcome, CommandState } from '../history';
import { restoreSolution } from '../puzzle/restore-solution';
import {
  acceptAuthoringCandidate,
  type ConstructionAttempt,
  type ConstructionContext,
  type ConstructionErrorCode,
} from './construction-attempt';

type BuildZone = LevelDocument['buildZones'][number];
type Scene = LevelDocument['scene'];
type InventoryEntry = LevelDocument['inventory'][number];
type Permissions = InventoryEntry['permissions'];
type Placement = LevelDocument['objects'][number];
type ControlWire = LevelDocument['wires'][number];
type Challenge = NonNullable<LevelDocument['challenge']>;
type WorldPosition = Scene['min'];

type AuthoringTransition =
  | { readonly status: 'candidate'; readonly document: unknown }
  | { readonly status: 'unchanged' }
  | { readonly status: 'rejected'; readonly reason: ConstructionErrorCode };

type AuthoringCommand = Command<ConstructionAttempt>;

interface UpdateSceneInput {
  readonly context: ConstructionContext;
  readonly scene: Scene;
}

interface AddBuildZoneInput {
  readonly context: ConstructionContext;
  readonly zone: BuildZone;
}

interface MoveBuildZoneInput {
  readonly context: ConstructionContext;
  readonly index: number;
  readonly offset: WorldPosition;
}

interface ResizeBuildZoneInput {
  readonly context: ConstructionContext;
  readonly index: number;
  readonly zone: BuildZone;
}

interface RemoveBuildZoneInput {
  readonly context: ConstructionContext;
  readonly index: number;
}

interface AddInventoryEntryInput {
  readonly context: ConstructionContext;
  readonly entry: InventoryEntry;
}

interface UpdateInventoryQuantityInput {
  readonly context: ConstructionContext;
  readonly entryId: string;
  readonly quantity: number;
}

interface UpdateInventoryPropertiesInput {
  readonly context: ConstructionContext;
  readonly entryId: string;
  readonly props: InventoryEntry['props'];
}

interface UpdateInventoryPermissionsInput {
  readonly context: ConstructionContext;
  readonly entryId: string;
  readonly permissions: Permissions;
}

interface RemoveInventoryEntryInput {
  readonly context: ConstructionContext;
  readonly entryId: string;
}

interface UpdatePlacementPermissionsInput {
  readonly context: ConstructionContext;
  readonly placementId: string;
  readonly permissions: Placement['permissions'];
}

interface SetPlacementToPlaceInput {
  readonly context: ConstructionContext;
  readonly placementId: string;
  /** `true`: the player will place it (U22); `false`: it stays in the decor. */
  readonly toPlace: boolean;
}

interface SetControlWireToPlaceInput {
  readonly context: ConstructionContext;
  readonly wireId: string;
  /** `true`: the player will lay the wire (U25); `false`: it stays fixed. */
  readonly toPlace: boolean;
}

interface UpdateLevelGoalInput {
  readonly context: ConstructionContext;
  readonly ballId: string;
  readonly basketId: string;
}

/**
 * An object the author places from the catalogue, outside the player's
 * inventory. With `goalRole` it is the goal's red ball or its basket (ADR
 * 0020): the goal names it, and each exists once at most.
 */
interface AddAuthoredPlacementInput {
  readonly context: ConstructionContext;
  readonly placementId: string;
  readonly type: Placement['type'];
  readonly props: Placement['props'];
  readonly transform: Placement['transform'];
  readonly goalRole?: 'ball' | 'basket';
}

/** An object present at the start of a level is locked for the player. */
const startingObjectPermissions = { move: false, rotate: false, remove: false } as const;

interface UpdateLevelTitleInput {
  readonly context: ConstructionContext;
  readonly title: string;
}

interface UpdateLevelAuthorInput {
  readonly context: ConstructionContext;
  /** ADR 0016 § Pseudo; `undefined` removes it. Checked by the schema, never rewritten (M1). */
  readonly author: string | undefined;
}

interface UpdateLevelDescriptionInput {
  readonly context: ConstructionContext;
  /** Pass `undefined` to remove the optional description. */
  readonly description: string | undefined;
}

interface SetLevelChallengeInput {
  readonly context: ConstructionContext;
  readonly challenge: Challenge;
}

interface RemoveLevelChallengeInput {
  readonly context: ConstructionContext;
}

interface RevealAuthorSolutionInput {
  readonly context: ConstructionContext;
  /** The level a creation comes from (ADR 0015): its envelope keeps it, not the document. */
  readonly source: LevelDocument;
}

/**
 * The command interface only returns a state, so the reveal also tells, for
 * the state it is about to run on, how many wires of the author's solution it
 * leaves out (ADR 0015: the result dialog says so).
 */
interface RevealAuthorSolutionCommand extends AuthoringCommand {
  readonly ignoredWireCount: (state: CommandState<ConstructionAttempt>) => number;
}

const createAuthoringCommand = (
  context: ConstructionContext,
  transition: (state: CommandState<ConstructionAttempt>) => AuthoringTransition,
): AuthoringCommand => ({
  execute: (state): CommandOutcome<ConstructionAttempt> => {
    if (context !== 'author') return { status: 'rejected', reason: 'authoring-only' };

    const result = transition(state);
    if (result.status === 'rejected') return result;
    if (result.status === 'unchanged') return { status: 'accepted', state };
    return acceptAuthoringCandidate(state, result.document);
  },
});

const samePoint = (left: WorldPosition, right: WorldPosition): boolean =>
  left.x === right.x && left.y === right.y;

const sameRectangle = (
  left: { readonly min: WorldPosition; readonly max: WorldPosition },
  right: { readonly min: WorldPosition; readonly max: WorldPosition },
): boolean => samePoint(left.min, right.min) && samePoint(left.max, right.max);

const isInsideScene = (point: WorldPosition, scene: Scene): boolean =>
  point.x >= scene.min.x &&
  point.x <= scene.max.x &&
  point.y >= scene.min.y &&
  point.y <= scene.max.y;

const sceneContainsContents = (scene: Scene, document: LevelDocument): boolean =>
  document.objects.every(({ transform }) => isInsideScene(transform.position, scene)) &&
  document.buildZones.every(
    ({ min, max }) => isInsideScene(min, scene) && isInsideScene(max, scene),
  );

const permissionsMatch = (left: Permissions, right: Permissions): boolean =>
  left.move === right.move && left.rotate === right.rotate && left.remove === right.remove;

const propertiesMatch = (
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean =>
  Object.keys(left).length === Object.keys(right).length &&
  Object.entries(left).every(([key, value]) => right[key] === value);

const zoneAt = (document: LevelDocument, index: number): BuildZone | undefined =>
  Number.isSafeInteger(index) && index >= 0 ? document.buildZones[index] : undefined;

const inventoryEntryAt = (document: LevelDocument, entryId: string): InventoryEntry | undefined =>
  document.inventory.find(({ id }) => id === entryId);

const placementAt = (document: LevelDocument, placementId: string): Placement | undefined =>
  document.objects.find(({ id }) => id === placementId);

const controlWireAt = (document: LevelDocument, wireId: string): ControlWire | undefined =>
  document.wires.find(({ id }) => id === wireId);

export const updateScene = (input: UpdateSceneInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    if (sameRectangle(state.document.scene, input.scene)) return { status: 'unchanged' };
    if (!sceneContainsContents(input.scene, state.document)) {
      return { status: 'rejected', reason: 'scene-excludes-content' };
    }
    return {
      status: 'candidate',
      document: { ...state.document, scene: input.scene },
    };
  });

export const addBuildZone = (input: AddBuildZoneInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => ({
    status: 'candidate',
    document: { ...state.document, buildZones: [...state.document.buildZones, input.zone] },
  }));

export const moveBuildZone = (input: MoveBuildZoneInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const zone = zoneAt(state.document, input.index);
    if (zone === undefined) return { status: 'rejected', reason: 'build-zone-not-found' };
    if (input.offset.x === 0 && input.offset.y === 0) return { status: 'unchanged' };

    return {
      status: 'candidate',
      document: {
        ...state.document,
        buildZones: state.document.buildZones.map((candidate, index) =>
          index === input.index
            ? {
                min: {
                  x: zone.min.x + input.offset.x,
                  y: zone.min.y + input.offset.y,
                },
                max: {
                  x: zone.max.x + input.offset.x,
                  y: zone.max.y + input.offset.y,
                },
              }
            : candidate,
        ),
      },
    };
  });

export const resizeBuildZone = (input: ResizeBuildZoneInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const current = zoneAt(state.document, input.index);
    if (current === undefined) return { status: 'rejected', reason: 'build-zone-not-found' };
    if (sameRectangle(current, input.zone)) return { status: 'unchanged' };

    return {
      status: 'candidate',
      document: {
        ...state.document,
        buildZones: state.document.buildZones.map((zone, index) =>
          index === input.index ? input.zone : zone,
        ),
      },
    };
  });

export const removeBuildZone = (input: RemoveBuildZoneInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    if (zoneAt(state.document, input.index) === undefined) {
      return { status: 'rejected', reason: 'build-zone-not-found' };
    }
    return {
      status: 'candidate',
      document: {
        ...state.document,
        buildZones: state.document.buildZones.filter((_zone, index) => index !== input.index),
      },
    };
  });

export const addInventoryEntry = (input: AddInventoryEntryInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    if (
      state.document.objects.some(({ id }) => id === input.entry.id) ||
      state.document.inventory.some(({ id }) => id === input.entry.id)
    ) {
      return { status: 'rejected', reason: 'identifier-already-used' };
    }
    return {
      status: 'candidate',
      document: { ...state.document, inventory: [...state.document.inventory, input.entry] },
    };
  });

export const updateInventoryQuantity = (input: UpdateInventoryQuantityInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const entry = inventoryEntryAt(state.document, input.entryId);
    if (entry === undefined) return { status: 'rejected', reason: 'inventory-entry-not-found' };
    if (entry.quantity === input.quantity) return { status: 'unchanged' };
    return {
      status: 'candidate',
      document: {
        ...state.document,
        inventory: state.document.inventory.map((candidate) =>
          candidate.id === input.entryId ? { ...candidate, quantity: input.quantity } : candidate,
        ),
      },
    };
  });

export const updateInventoryProperties = (
  input: UpdateInventoryPropertiesInput,
): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const entry = inventoryEntryAt(state.document, input.entryId);
    if (entry === undefined) return { status: 'rejected', reason: 'inventory-entry-not-found' };
    if (Object.values(state.provenance).includes(input.entryId)) {
      return { status: 'rejected', reason: 'inventory-entry-in-use' };
    }

    if (propertiesMatch(entry.props, input.props)) return { status: 'unchanged' };
    const family = initialObjectFamilyRegistry.get(entry.type);
    const properties = family?.propertiesSchema.safeParse(input.props);
    if (properties?.success !== true) {
      return { status: 'rejected', reason: 'invalid-level-document' };
    }

    return {
      status: 'candidate',
      document: {
        ...state.document,
        inventory: state.document.inventory.map((candidate) =>
          candidate.id === input.entryId ? { ...candidate, props: properties.data } : candidate,
        ),
      },
    };
  });

export const updateInventoryPermissions = (
  input: UpdateInventoryPermissionsInput,
): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const entry = inventoryEntryAt(state.document, input.entryId);
    if (entry === undefined) return { status: 'rejected', reason: 'inventory-entry-not-found' };
    if (Object.values(state.provenance).includes(input.entryId)) {
      return { status: 'rejected', reason: 'inventory-entry-in-use' };
    }
    if (permissionsMatch(entry.permissions, input.permissions)) return { status: 'unchanged' };
    return {
      status: 'candidate',
      document: {
        ...state.document,
        inventory: state.document.inventory.map((candidate) =>
          candidate.id === input.entryId
            ? { ...candidate, permissions: input.permissions }
            : candidate,
        ),
      },
    };
  });

export const removeInventoryEntry = (input: RemoveInventoryEntryInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    if (inventoryEntryAt(state.document, input.entryId) === undefined) {
      return { status: 'rejected', reason: 'inventory-entry-not-found' };
    }
    if (Object.values(state.provenance).includes(input.entryId)) {
      return { status: 'rejected', reason: 'inventory-entry-in-use' };
    }
    return {
      status: 'candidate',
      document: {
        ...state.document,
        inventory: state.document.inventory.filter(({ id }) => id !== input.entryId),
      },
    };
  });

export const updatePlacementPermissions = (
  input: UpdatePlacementPermissionsInput,
): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const placement = placementAt(state.document, input.placementId);
    if (placement === undefined) return { status: 'rejected', reason: 'placement-not-found' };
    if (state.provenance[input.placementId] !== undefined) {
      return { status: 'rejected', reason: 'placement-has-inventory-provenance' };
    }
    if (permissionsMatch(placement.permissions, input.permissions)) return { status: 'unchanged' };
    return {
      status: 'candidate',
      document: {
        ...state.document,
        objects: state.document.objects.map((candidate) =>
          candidate.id === input.placementId
            ? { ...candidate, permissions: input.permissions }
            : candidate,
        ),
      },
    };
  });

/**
 * U22 (ADR 0013): the « Fixe / À placer » setting. A fixed object carries no
 * marking at all, so there is a single way to write it; the goal's ball and
 * basket always stay fixed.
 */
export const setPlacementToPlace = (input: SetPlacementToPlaceInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const placement = placementAt(state.document, input.placementId);
    if (placement === undefined) return { status: 'rejected', reason: 'placement-not-found' };
    const { goal } = state.document;
    if (placement.id === goal?.ballId || placement.id === goal?.basketId) {
      return { status: 'rejected', reason: 'goal-object-protected' };
    }
    const { toPlace, ...fixed } = placement;
    if ((toPlace === true) === input.toPlace) return { status: 'unchanged' };

    const next = input.toPlace ? { ...fixed, toPlace: true } : fixed;
    return {
      status: 'candidate',
      document: {
        ...state.document,
        objects: state.document.objects.map((candidate) =>
          candidate.id === input.placementId ? next : candidate,
        ),
      },
    };
  });

/** U25: the author decides whether a connected wire belongs to the decor or the player's inventory. */
export const setControlWireToPlace = (input: SetControlWireToPlaceInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const wire = controlWireAt(state.document, input.wireId);
    if (wire === undefined) return { status: 'rejected', reason: 'wire-not-found' };
    if ((wire.toPlace === true) === input.toPlace) return { status: 'unchanged' };

    const nextWire: ControlWire = input.toPlace
      ? { ...wire, toPlace: true }
      : { id: wire.id, sourceId: wire.sourceId, targetId: wire.targetId };
    return {
      status: 'candidate',
      document: {
        ...state.document,
        wires: state.document.wires.map((candidate) =>
          candidate.id === input.wireId ? nextWire : candidate,
        ),
      },
    };
  });

export const addAuthoredPlacement = (input: AddAuthoredPlacementInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    if (
      placementAt(state.document, input.placementId) !== undefined ||
      inventoryEntryAt(state.document, input.placementId) !== undefined
    ) {
      return { status: 'rejected', reason: 'identifier-already-used' };
    }
    const placement = {
      id: input.placementId,
      type: input.type,
      props: { ...input.props },
      transform: {
        position: { ...input.transform.position },
        rotation: input.transform.rotation,
      },
      permissions: startingObjectPermissions,
    };
    const { goalRole } = input;
    if (goalRole !== undefined) {
      const expectedType = goalRole === 'ball' ? 'ball' : 'basket';
      if (input.type !== expectedType) return { status: 'rejected', reason: 'goal-role-mismatch' };
      const existing =
        goalRole === 'ball' ? state.document.goal?.ballId : state.document.goal?.basketId;
      if (existing !== undefined) return { status: 'rejected', reason: 'goal-role-taken' };
    }
    // The author's board has no edge: the scene grows to take the object.
    const document = withSceneIncluding(state.document, input.transform.position);
    return {
      status: 'candidate',
      document: {
        ...document,
        objects: [...document.objects, placement],
        ...(goalRole === undefined
          ? {}
          : {
              goal: {
                type: 'basket',
                ...document.goal,
                ...(goalRole === 'ball'
                  ? { ballId: input.placementId }
                  : { basketId: input.placementId }),
              },
            }),
      },
    };
  });

export const updateLevelGoal = (input: UpdateLevelGoalInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const ball = placementAt(state.document, input.ballId);
    if (ball?.type !== 'ball') return { status: 'rejected', reason: 'goal-ball-not-found' };
    const basket = placementAt(state.document, input.basketId);
    if (basket?.type !== 'basket') return { status: 'rejected', reason: 'goal-basket-not-found' };
    if (
      state.document.goal?.ballId === input.ballId &&
      state.document.goal.basketId === input.basketId
    ) {
      return { status: 'unchanged' };
    }
    return {
      status: 'candidate',
      document: {
        ...state.document,
        goal: { type: 'basket', ballId: input.ballId, basketId: input.basketId },
      },
    };
  });

export const updateLevelTitle = (input: UpdateLevelTitleInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    if (state.document.metadata.title === input.title) return { status: 'unchanged' };
    return {
      status: 'candidate',
      document: {
        ...state.document,
        metadata: { ...state.document.metadata, title: input.title },
      },
    };
  });

export const updateLevelAuthor = (input: UpdateLevelAuthorInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const { author, ...metadataWithoutAuthor } = state.document.metadata;
    if (author === input.author) return { status: 'unchanged' };
    const metadata =
      input.author === undefined
        ? metadataWithoutAuthor
        : { ...metadataWithoutAuthor, author: input.author };
    return { status: 'candidate', document: { ...state.document, metadata } };
  });

export const updateLevelDescription = (input: UpdateLevelDescriptionInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const { description, ...metadataWithoutDescription } = state.document.metadata;
    if (description === input.description) return { status: 'unchanged' };
    // Only the description goes: title, author and sources stay (M14b).
    const metadata =
      input.description === undefined
        ? metadataWithoutDescription
        : { ...metadataWithoutDescription, description: input.description };
    return { status: 'candidate', document: { ...state.document, metadata } };
  });

export const setLevelChallenge = (input: SetLevelChallengeInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const current = state.document.challenge;
    if (
      current?.elegantObjectCount === input.challenge.elegantObjectCount &&
      current.minimalObjectCount === input.challenge.minimalObjectCount
    ) {
      return { status: 'unchanged' };
    }
    return {
      status: 'candidate',
      document: { ...state.document, challenge: input.challenge },
    };
  });

export const removeLevelChallenge = (input: RemoveLevelChallengeInput): AuthoringCommand =>
  createAuthoringCommand(input.context, (state) => {
    const { challenge, ...documentWithoutChallenge } = state.document;
    if (challenge === undefined) return { status: 'unchanged' };
    return { status: 'candidate', document: documentWithoutChallenge };
  });

interface RevealedSolution {
  readonly document: LevelDocument;
  readonly ignoredWireCount: number;
}

/**
 * ADR 0015 § Révéler: the author's poses and wires, restored to place as
 * `workshopFromPuzzle` does, next to everything on the board. Identifiers
 * already used (the board's, the source inventory's, as `workshopFromPuzzle`
 * reserves them) are skipped. A wire with an end no longer on the board, or
 * aimed at a device already commanded, is left out and counted (M7b); a pose
 * past the scene's edge grows the scene as an authored placement does.
 */
const revealedSolution = (
  document: LevelDocument,
  source: LevelDocument,
): RevealedSolution | undefined => {
  const { solution, inventory } = source;
  if (solution === undefined) return undefined;
  const usedIds = new Set(
    [...document.objects, ...document.inventory, ...document.wires, ...inventory].map(
      ({ id }) => id,
    ),
  );
  const restored = restoreSolution(solution, inventory, usedIds);
  const objects = [...document.objects, ...restored.objects];
  const onBoard = new Set(objects.map(({ id }) => id));
  const commanded = new Set(document.wires.map(({ targetId }) => targetId));
  const kept = restored.wires.filter(({ sourceId, targetId }) => {
    if (!onBoard.has(sourceId) || !onBoard.has(targetId) || commanded.has(targetId)) return false;
    commanded.add(targetId);
    return true;
  });
  const grown = restored.objects.reduce(
    (current, { transform }) => withSceneIncluding(current, transform.position),
    document,
  );
  return {
    document: { ...grown, objects, wires: [...document.wires, ...kept] },
    ignoredWireCount: restored.wires.length - kept.length,
  };
};

/**
 * ADR 0015 § Révéler la solution de l'auteur: adds, never removes; one
 * history entry, undone as a whole.
 */
export const revealAuthorSolution = (
  input: RevealAuthorSolutionInput,
): RevealAuthorSolutionCommand => ({
  ...createAuthoringCommand(input.context, (state) => {
    const revealed = revealedSolution(state.document, input.source);
    if (revealed === undefined) return { status: 'rejected', reason: 'solution-not-found' };
    return { status: 'candidate', document: revealed.document };
  }),
  ignoredWireCount: (state) =>
    revealedSolution(state.document, input.source)?.ignoredWireCount ?? 0,
});
