import { z } from 'zod';

import {
  ballPropertiesSchema,
  boxPropertiesSchema,
  electroMagnetPropertiesSchema,
  pistonPropertiesSchema,
  barrierPropertiesSchema,
  basketPropertiesSchema,
  beamPropertiesSchema,
  buttonPropertiesSchema,
  conveyorPropertiesSchema,
  fanPropertiesSchema,
  leverPropertiesSchema,
  massPropertiesSchema,
  seesawPropertiesSchema,
  springboardPropertiesSchema,
  timerPropertiesSchema,
} from './object-family-registry';

/**
 * The current persistent level format (ADR 0018). Legacy versions are
 * readable through explicit v1 → v2 → v3 migrations only.
 */
const LEVEL_DOCUMENT_SCHEMA_VERSION = 3 as const;
const LEVEL_DOCUMENT_V2_SCHEMA_VERSION = 2 as const;

/** Legacy schema version, retained solely as migration input. */
const LEVEL_DOCUMENT_V1_SCHEMA_VERSION = 1 as const;

const MAX_IDENTIFIER_LENGTH = 128;
export const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 2_000;
/** ADR 0016 - Champs du format: a pseudonym, measured once edge spaces are removed. */
const MAX_AUTHOR_LENGTH = 40;
/** ADR 0016 - Champs du format: sources kept, the most recent first. */
export const MAX_BASED_ON_ENTRIES = 16;
export const MAX_OBJECTS = 512;
const MAX_INVENTORY_ENTRIES = 128;
const MAX_BUILD_ZONES = 64;
export const MAX_WIRES = 128;
const MAX_INVENTORY_QUANTITY = 999;
const MAX_CHALLENGE_OBJECT_COUNT = 999;
const MAX_WORLD_COORDINATE = 1_000_000;
const MAX_ROTATION_RADIANS = 100_000;

/** ADR 0007 - Scène d'un niveau: world-unit bounds a scene rectangle must fit within. */
const MIN_SCENE_SIZE = 4;
const MAX_SCENE_SIZE = 64;

/** ADR 0007 / plan A2: margin applied on every side when deriving a v1 document's scene. */
const SCENE_MIGRATION_MARGIN = 2;

const identifierSchema = z
  .string()
  .min(1)
  .max(MAX_IDENTIFIER_LENGTH)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: 'L’identifiant doit utiliser des lettres minuscules, chiffres ou tirets.',
  });

const finiteWorldCoordinateSchema = z.number().min(-MAX_WORLD_COORDINATE).max(MAX_WORLD_COORDINATE);

const finiteRotationSchema = z.number().min(-MAX_ROTATION_RADIANS).max(MAX_ROTATION_RADIANS);

const worldPositionSchema = z.strictObject({
  x: finiteWorldCoordinateSchema,
  y: finiteWorldCoordinateSchema,
});

const transformSchema = z.strictObject({
  position: worldPositionSchema,
  /** Persisted in radians; rendering pixels and physics handles never enter this value. */
  rotation: finiteRotationSchema,
});

const objectPermissionsSchema = z.strictObject({
  move: z.boolean(),
  rotate: z.boolean(),
  remove: z.boolean(),
});

const placementFields = {
  id: identifierSchema,
  transform: transformSchema,
  permissions: objectPermissionsSchema,
};

/** Builds the discriminated union of placed objects over `fields`, shared by every family. */
const placementSchemasFor = <Fields extends z.ZodRawShape>(fields: Fields) =>
  [
    z.strictObject({ ...fields, type: z.literal('ball'), props: ballPropertiesSchema }),
    z.strictObject({ ...fields, type: z.literal('basket'), props: basketPropertiesSchema }),
    z.strictObject({ ...fields, type: z.literal('beam'), props: beamPropertiesSchema }),
    z.strictObject({ ...fields, type: z.literal('seesaw'), props: seesawPropertiesSchema }),
    z.strictObject({ ...fields, type: z.literal('mass'), props: massPropertiesSchema }),
    z.strictObject({ ...fields, type: z.literal('lever'), props: leverPropertiesSchema }),
    z.strictObject({ ...fields, type: z.literal('conveyor'), props: conveyorPropertiesSchema }),
    z.strictObject({ ...fields, type: z.literal('button'), props: buttonPropertiesSchema }),
    z.strictObject({ ...fields, type: z.literal('fan'), props: fanPropertiesSchema }),
    z.strictObject({ ...fields, type: z.literal('barrier'), props: barrierPropertiesSchema }),
    z.strictObject({
      ...fields,
      type: z.literal('springboard'),
      props: springboardPropertiesSchema,
    }),
  ] as const;
const placementSchemaFor = <Fields extends z.ZodRawShape>(fields: Fields) =>
  z.discriminatedUnion('type', placementSchemasFor(fields));

/** v1 placements: no workshop marking. */
const objectPlacementV1Schema = placementSchemaFor(placementFields);

/**
 * v2 placements. `toPlace` (U22, ADR 0013) marks, in the workshop only, an
 * object the player will have to place; absent means fixed, so only `true`
 * is accepted.
 */
const objectPlacementV2Schema = placementSchemaFor({
  ...placementFields,
  toPlace: z.literal(true).optional(),
});

const objectPlacementSchema = z.discriminatedUnion('type', [
  ...placementSchemasFor({ ...placementFields, toPlace: z.literal(true).optional() }),
  z.strictObject({
    ...placementFields,
    toPlace: z.literal(true).optional(),
    type: z.literal('box'),
    props: boxPropertiesSchema,
  }),
  z.strictObject({
    ...placementFields,
    toPlace: z.literal(true).optional(),
    type: z.literal('electro-magnet'),
    props: electroMagnetPropertiesSchema,
  }),
  z.strictObject({
    ...placementFields,
    toPlace: z.literal(true).optional(),
    type: z.literal('piston'),
    props: pistonPropertiesSchema,
  }),
  z.strictObject({
    ...placementFields,
    toPlace: z.literal(true).optional(),
    type: z.literal('timer'),
    props: timerPropertiesSchema,
  }),
]);

const inventoryFields = {
  id: identifierSchema,
  quantity: z.int().min(0).max(MAX_INVENTORY_QUANTITY),
  permissions: objectPermissionsSchema,
};

const placementInventoryEntrySchemas = [
  z.strictObject({
    ...inventoryFields,
    type: z.literal('ball'),
    props: ballPropertiesSchema,
  }),
  z.strictObject({
    ...inventoryFields,
    type: z.literal('basket'),
    props: basketPropertiesSchema,
  }),
  z.strictObject({
    ...inventoryFields,
    type: z.literal('beam'),
    props: beamPropertiesSchema,
  }),
  z.strictObject({
    ...inventoryFields,
    type: z.literal('seesaw'),
    props: seesawPropertiesSchema,
  }),
  z.strictObject({
    ...inventoryFields,
    type: z.literal('mass'),
    props: massPropertiesSchema,
  }),
  z.strictObject({
    ...inventoryFields,
    type: z.literal('lever'),
    props: leverPropertiesSchema,
  }),
  z.strictObject({
    ...inventoryFields,
    type: z.literal('conveyor'),
    props: conveyorPropertiesSchema,
  }),
  z.strictObject({
    ...inventoryFields,
    type: z.literal('button'),
    props: buttonPropertiesSchema,
  }),
  z.strictObject({
    ...inventoryFields,
    type: z.literal('fan'),
    props: fanPropertiesSchema,
  }),
  z.strictObject({
    ...inventoryFields,
    type: z.literal('barrier'),
    props: barrierPropertiesSchema,
  }),
  z.strictObject({
    ...inventoryFields,
    type: z.literal('springboard'),
    props: springboardPropertiesSchema,
  }),
] as const;

/** v1 inventories only ever held placeable families. */
const placementInventoryEntrySchema = z.discriminatedUnion('type', placementInventoryEntrySchemas);

/**
 * U21 (ADR 0009, amendement du 27 septembre 2026): a wire the player may lay
 * between a controller and a device. It has no position, angle or property,
 * so `move` and `rotate` are always `false`; `remove` says whether the player
 * may take back a wire he laid, like any object placed from the inventory.
 */
const wireInventoryEntrySchema = z.strictObject({
  id: identifierSchema,
  quantity: z.int().min(0).max(MAX_INVENTORY_QUANTITY),
  type: z.literal('wire'),
  props: z.strictObject({}),
  permissions: z.strictObject({
    move: z.literal(false),
    rotate: z.literal(false),
    remove: z.boolean(),
  }),
});

/** v2 inventories add wires to the placeable families, compatibly (U21). */
const inventoryEntryV2Schema = z.discriminatedUnion('type', [
  ...placementInventoryEntrySchemas,
  wireInventoryEntrySchema,
]);

const inventoryEntrySchema = z.discriminatedUnion('type', [
  ...placementInventoryEntrySchemas,
  wireInventoryEntrySchema,
  z.strictObject({ ...inventoryFields, type: z.literal('box'), props: boxPropertiesSchema }),
  z.strictObject({
    ...inventoryFields,
    type: z.literal('electro-magnet'),
    props: electroMagnetPropertiesSchema,
  }),
  z.strictObject({ ...inventoryFields, type: z.literal('piston'), props: pistonPropertiesSchema }),
  z.strictObject({ ...inventoryFields, type: z.literal('timer'), props: timerPropertiesSchema }),
]);

/**
 * ADR 0009: a direct link from a controller to a device. Only the relation
 * is stored; route, colour and circuit letter are derived when drawing.
 */
const controlWireV2Schema = z.strictObject({
  id: identifierSchema,
  sourceId: identifierSchema,
  targetId: identifierSchema,
  /** Workshop-only marker; absent means that the authored wire stays fixed. */
  toPlace: z.literal(true).optional(),
});

const controlWireSchema = z.strictObject({
  id: identifierSchema,
  sourceId: identifierSchema,
  timerId: identifierSchema.optional(),
  targetId: identifierSchema,
  /** Workshop-only marker; absent means that the authored wire stays fixed. */
  toPlace: z.literal(true).optional(),
});

const basketGoalSchema = z.strictObject({
  type: z.literal('basket'),
  ballId: identifierSchema,
  basketId: identifierSchema,
});

const challengeObjectCountSchema = z.int().min(1).max(MAX_CHALLENGE_OBJECT_COUNT);

/**
 * U22 (ADR 0013): one pose of the reference solution. The family and the
 * properties are those of the inventory entry it names.
 */
const solutionPlacementSchema = z.strictObject({
  inventoryId: identifierSchema,
  transform: transformSchema,
  /** Original workshop object id, only needed when a solution wire references this pose. */
  placementId: identifierSchema.optional(),
});

const solutionWireV2Schema = z.strictObject({
  id: identifierSchema,
  inventoryId: identifierSchema,
  sourceId: identifierSchema,
  targetId: identifierSchema,
});

const solutionWireSchema = z.strictObject({
  id: identifierSchema,
  inventoryId: identifierSchema,
  sourceId: identifierSchema,
  timerId: identifierSchema.optional(),
  targetId: identifierSchema,
});

/** ADR 0013 solution shape, also used for a player's winning solution (ADR 0015). */
const solutionSchemaV2 = z.strictObject({
  placements: z.array(solutionPlacementSchema).max(MAX_OBJECTS),
  wires: z.array(solutionWireV2Schema).max(MAX_WIRES).optional(),
});
export const solutionSchema = z.strictObject({
  placements: z.array(solutionPlacementSchema).max(MAX_OBJECTS),
  wires: z.array(solutionWireSchema).max(MAX_WIRES).optional(),
});

const challengeSchema = z.strictObject({
  elegantObjectCount: challengeObjectCountSchema,
  minimalObjectCount: challengeObjectCountSchema,
});

const buildZoneSchema = z
  .strictObject({
    min: worldPositionSchema,
    max: worldPositionSchema,
  })
  .superRefine((zone, context) => {
    if (zone.min.x >= zone.max.x) {
      context.addIssue({
        code: 'custom',
        path: ['max', 'x'],
        message: 'La borne maximale x doit être supérieure à la borne minimale x.',
      });
    }

    if (zone.min.y >= zone.max.y) {
      context.addIssue({
        code: 'custom',
        path: ['max', 'y'],
        message: 'La borne maximale y doit être supérieure à la borne minimale y.',
      });
    }
  });

/**
 * ADR 0007 - Scène d'un niveau: the rectangle that frames a level in world
 * units. It drives the initial camera fit, world-exit detection and the
 * background, so it is part of the persistent document rather than a view
 * setting.
 */
const sceneSchema = z
  .strictObject({
    min: worldPositionSchema,
    max: worldPositionSchema,
  })
  .superRefine((scene, context) => {
    if (scene.min.x >= scene.max.x) {
      context.addIssue({
        code: 'custom',
        path: ['max', 'x'],
        message: 'La borne maximale x de la scène doit être supérieure à la borne minimale x.',
      });
    } else {
      const width = scene.max.x - scene.min.x;
      if (width < MIN_SCENE_SIZE || width > MAX_SCENE_SIZE) {
        context.addIssue({
          code: 'custom',
          path: ['max', 'x'],
          message: `La largeur de la scène doit être comprise entre ${String(MIN_SCENE_SIZE)} et ${String(MAX_SCENE_SIZE)} unités monde.`,
        });
      }
    }

    if (scene.min.y >= scene.max.y) {
      context.addIssue({
        code: 'custom',
        path: ['max', 'y'],
        message: 'La borne maximale y de la scène doit être supérieure à la borne minimale y.',
      });
    } else {
      const height = scene.max.y - scene.min.y;
      if (height < MIN_SCENE_SIZE || height > MAX_SCENE_SIZE) {
        context.addIssue({
          code: 'custom',
          path: ['max', 'y'],
          message: `La hauteur de la scène doit être comprise entre ${String(MIN_SCENE_SIZE)} et ${String(MAX_SCENE_SIZE)} unités monde.`,
        });
      }
    }
  });

const titleSchema = z.string().min(1).max(MAX_TITLE_LENGTH);

/** Control characters and the Unicode line and paragraph separators. */
const CONTROL_OR_LINE_BREAK = /[\p{Cc}\u2028\u2029]/u;

/**
 * ADR 0016: a pseudonym of 1 to 40 characters once edge spaces are removed,
 * on one line. The value is checked, never rewritten, so that a document
 * reads back identically.
 */
export const authorSchema = z.string().superRefine((author, context) => {
  const length = author.trim().length;
  if (length < 1 || length > MAX_AUTHOR_LENGTH) {
    context.addIssue({
      code: 'custom',
      message: `Le pseudo doit compter de 1 à ${String(MAX_AUTHOR_LENGTH)} caractères, espaces de bord exclus.`,
    });
  }
  if (CONTROL_OR_LINE_BREAK.test(author)) {
    context.addIssue({
      code: 'custom',
      message: 'Le pseudo ne doit contenir ni saut de ligne ni caractère de contrôle.',
    });
  }
});

/** v1 metadata, frozen: attribution only exists in v2 (ADR 0016). */
const metadataV1Schema = z.strictObject({
  title: titleSchema,
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
});

/** ADR 0016 - Champs du format: optional, so a v2 document without them stays valid as is. */
const metadataSchema = z.strictObject({
  ...metadataV1Schema.shape,
  author: authorSchema.optional(),
  basedOn: z
    .array(z.strictObject({ title: titleSchema, author: authorSchema.optional() }))
    .max(MAX_BASED_ON_ENTRIES)
    .optional(),
});

/** Fields shared by every schema version, independent of `schemaVersion` and `scene`. */
const sharedDocumentFields = {
  id: identifierSchema,
  metadata: metadataV1Schema,
  objects: z.array(objectPlacementV2Schema).max(MAX_OBJECTS),
  inventory: z.array(inventoryEntryV2Schema).max(MAX_INVENTORY_ENTRIES),
  goal: basketGoalSchema,
  buildZones: z.array(buildZoneSchema).max(MAX_BUILD_ZONES),
};

const levelDocumentV1StructureSchema = z.strictObject({
  schemaVersion: z.literal(LEVEL_DOCUMENT_V1_SCHEMA_VERSION),
  ...sharedDocumentFields,
  // Override the shared keys in place, keeping the key order: no workshop
  // marking and no wire in v1.
  objects: z.array(objectPlacementV1Schema).max(MAX_OBJECTS),
  inventory: z.array(placementInventoryEntrySchema).max(MAX_INVENTORY_ENTRIES),
});

const levelDocumentV2StructureSchema = z.strictObject({
  schemaVersion: z.literal(LEVEL_DOCUMENT_V2_SCHEMA_VERSION),
  ...sharedDocumentFields,
  metadata: metadataSchema,
  scene: sceneSchema,
  /** Optional on input so that documents written before ADR 0009 stay valid v2. */
  wires: z.array(controlWireV2Schema).max(MAX_WIRES).default([]),
  /** Optional without a default: absent means that the level has no challenge (ADR 0010). */
  challenge: challengeSchema.optional(),
  /** Optional without a default: absent means that the level ships no reference solution (ADR 0013). */
  solution: solutionSchemaV2.optional(),
});

const levelDocumentV3StructureSchema = z.strictObject({
  ...levelDocumentV2StructureSchema.shape,
  schemaVersion: z.literal(LEVEL_DOCUMENT_SCHEMA_VERSION),
  objects: z.array(objectPlacementSchema).max(MAX_OBJECTS),
  inventory: z.array(inventoryEntrySchema).max(MAX_INVENTORY_ENTRIES),
  wires: z.array(controlWireSchema).max(MAX_WIRES).default([]),
  solution: solutionSchema.optional(),
});

type ObjectPlacement = z.infer<typeof objectPlacementSchema>;
type InventoryEntry = z.infer<typeof inventoryEntrySchema>;
/** An inventory entry the player places on the board, as opposed to a wire. */
export type PlaceableInventoryEntry = Exclude<InventoryEntry, { readonly type: 'wire' }>;
type WorldPosition = z.infer<typeof worldPositionSchema>;
type BuildZone = z.infer<typeof buildZoneSchema>;
type Challenge = z.infer<typeof challengeSchema>;

/** The legacy v1 contract (ADR 0004). Accepted only as migration input. */
export type LevelDocumentV1 = z.infer<typeof levelDocumentV1StructureSchema>;

/** The legacy v2 contract, kept strict as migration input (ADR 0018). */
type LevelDocumentV2 = z.infer<typeof levelDocumentV2StructureSchema>;
export type LevelDocument = z.infer<typeof levelDocumentV3StructureSchema>;

interface LevelDocumentValidationIssue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

const addUniqueIdentifierIssues = (
  values: readonly { readonly id: string }[],
  property: 'objects' | 'inventory',
  issues: LevelDocumentValidationIssue[],
): void => {
  const firstIndexesById = new Map<string, number>();

  values.forEach((value, index) => {
    const firstIndex = firstIndexesById.get(value.id);
    if (firstIndex === undefined) {
      firstIndexesById.set(value.id, index);
      return;
    }

    issues.push({
      path: [property, index, 'id'],
      message: `L’identifiant « ${value.id} » est déjà utilisé par ${property}[${String(firstIndex)}].`,
    });
  });
};

/**
 * How a family turns: every family by any angle — the editor steps by
 * fifteen degrees — except the ball, whose turn shows nothing, and the
 * basket, whose opening must face up.
 */
export const rotationMode = (type: ObjectPlacement['type']): 'free' | 'fixed' =>
  type === 'ball' || type === 'basket' ? 'fixed' : 'free';

type SceneRectangle = LevelDocument['scene'];

const covers = (zone: SceneRectangle, scene: SceneRectangle): boolean =>
  zone.min.x <= scene.min.x &&
  zone.min.y <= scene.min.y &&
  zone.max.x >= scene.max.x &&
  zone.max.y >= scene.max.y;

/**
 * A zone covering the whole scene restricts nothing (the default since the
 * 1st October 2026 decision): the player then places like the author, the
 * scene alone bounding each object's centre.
 */
export const isPlacementUnconstrained = (document: LevelDocument): boolean =>
  document.buildZones.some((zone) => covers(zone, document.scene));

/** Room left around an object the author lays past the scene's edge, in world units. */
const SCENE_GROWTH_MARGIN = 1;

/**
 * The author lays an object at `point`: past the scene's edge, the scene
 * grows to whole units around it, and a zone that covered the old scene
 * follows. Beyond `MAX_SCENE_SIZE`, validation still refuses the document.
 */
export const withSceneIncluding = (
  document: LevelDocument,
  point: Readonly<{ readonly x: number; readonly y: number }>,
): LevelDocument => {
  const { scene } = document;
  if (
    point.x >= scene.min.x &&
    point.x <= scene.max.x &&
    point.y >= scene.min.y &&
    point.y <= scene.max.y
  ) {
    return document;
  }
  const grown = {
    min: {
      x: Math.min(scene.min.x, Math.floor(point.x - SCENE_GROWTH_MARGIN)),
      y: Math.min(scene.min.y, Math.floor(point.y - SCENE_GROWTH_MARGIN)),
    },
    max: {
      x: Math.max(scene.max.x, Math.ceil(point.x + SCENE_GROWTH_MARGIN)),
      y: Math.max(scene.max.y, Math.ceil(point.y + SCENE_GROWTH_MARGIN)),
    },
  };
  return {
    ...document,
    scene: grown,
    buildZones: document.buildZones.map((zone) => (covers(zone, scene) ? grown : zone)),
  };
};

/** Families drawn facing one side (fan, barrier): « Retourner » mirrors them left to right. */
export const isMirrorableFamily = (type: ObjectPlacement['type']): boolean =>
  type === 'fan' || type === 'barrier';

const addRotationPermissionIssues = (
  entries: readonly (ObjectPlacement | InventoryEntry)[],
  property: 'objects' | 'inventory',
  issues: LevelDocumentValidationIssue[],
): void => {
  entries.forEach((entry, index) => {
    // A wire's permissions forbid rotation structurally.
    if (entry.type === 'wire') return;
    if (rotationMode(entry.type) === 'fixed' && entry.permissions.rotate) {
      issues.push({
        path: [property, index, 'permissions', 'rotate'],
        message: `La rotation n’est pas disponible pour la famille « ${entry.type} ».`,
      });
    }
  });
};

type ControlWire = z.infer<typeof controlWireSchema>;

type PlacementType = ObjectPlacement['type'];

/**
 * ADR 0009: whether a `source` may command a `target`. Levers and buttons
 * command; conveyors, fans, barriers, electro-magnets and pistons obey. A button has two states and a
 * conveyor three: a button never commands a conveyor. Electro-magnets accept
 * only a button (ADR 0019).
 */
const canCommand = (source: PlacementType, target: PlacementType): boolean => {
  if (source === 'lever') return target === 'conveyor' || target === 'fan' || target === 'barrier';
  if (source === 'button')
    return (
      target === 'fan' || target === 'barrier' || target === 'electro-magnet' || target === 'piston'
    );
  return false;
};

const controlSources: ReadonlySet<PlacementType> = new Set(['lever', 'button']);
const controlTargets: ReadonlySet<PlacementType> = new Set([
  'conveyor',
  'fan',
  'barrier',
  'electro-magnet',
  'piston',
]);

/** Why `type` cannot start a wire, or `null` when it can (ADR 0009). */
export const controlWireSourceIssue = (type: PlacementType | undefined): string | null =>
  type !== undefined && controlSources.has(type)
    ? null
    : 'Un fil doit partir d’un levier ou d’un bouton placé.';

/**
 * Why a wire from a `source` controller cannot reach `target`, or `null` when
 * it can. The one-controller rule depends on the other wires: validation and
 * the `connectControlWire` command check it (`wire-already-connected`).
 */
export const controlWireTargetIssue = (
  source: PlacementType | undefined,
  target: PlacementType | undefined,
): string | null => {
  if (target === undefined || !controlTargets.has(target)) {
    return 'Un fil doit arriver sur un convoyeur, un ventilateur, une barrière, un électroaimant ou un piston placés.';
  }
  if (source !== undefined && controlSources.has(source) && !canCommand(source, target)) {
    if (target === 'electro-magnet') return 'Seul un bouton commande un électroaimant.';
    if (target === 'piston') return 'Seul un bouton commande un piston.';
    return 'Un bouton ne commande pas de convoyeur : seul un levier en donne le sens.';
  }
  return null;
};

/**
 * ADR 0009: a wire goes from a placed controller (lever, button) to a placed
 * device it can command, and a device obeys at
 * most one controller, so that its state is never ambiguous.
 */
const addControlWireIssues = (
  objects: readonly ObjectPlacement[],
  wires: readonly ControlWire[],
  issues: LevelDocumentValidationIssue[],
): void => {
  const placementsById = new Map(objects.map((placement) => [placement.id, placement]));
  const wireIds = new Set<string>();
  const commandedTargets = new Set<string>();
  const usedTimers = new Set<string>();

  wires.forEach((wire, index) => {
    if (wireIds.has(wire.id)) {
      issues.push({
        path: ['wires', index, 'id'],
        message: `L’identifiant de fil « ${wire.id} » est déjà utilisé.`,
      });
    }
    wireIds.add(wire.id);

    const source = placementsById.get(wire.sourceId);
    const target = placementsById.get(wire.targetId);
    const sourceIssue = controlWireSourceIssue(source?.type);
    if (sourceIssue !== null) {
      issues.push({ path: ['wires', index, 'sourceId'], message: sourceIssue });
    }
    const targetIssue = controlWireTargetIssue(source?.type, target?.type);
    if (targetIssue !== null) {
      issues.push({ path: ['wires', index, 'targetId'], message: targetIssue });
    } else if (commandedTargets.has(wire.targetId)) {
      issues.push({
        path: ['wires', index, 'targetId'],
        message: `L’appareil « ${wire.targetId} » est déjà commandé.`,
      });
    }
    commandedTargets.add(wire.targetId);

    if (wire.timerId !== undefined) {
      const timer = placementsById.get(wire.timerId);
      if (timer?.type !== 'timer') {
        issues.push({
          path: ['wires', index, 'timerId'],
          message: `Le minuteur « ${wire.timerId} » doit référencer un minuteur placé.`,
        });
      } else if (usedTimers.has(wire.timerId)) {
        issues.push({
          path: ['wires', index, 'timerId'],
          message: `Le minuteur « ${wire.timerId} » est déjà inséré dans un fil.`,
        });
      }
      usedTimers.add(wire.timerId);
    }
  });
};

interface DocumentRelationsInput {
  readonly objects: readonly ObjectPlacement[];
  readonly inventory: readonly InventoryEntry[];
  readonly goal: { readonly ballId: string; readonly basketId: string };
  readonly challenge?: Challenge | undefined;
}

/**
 * Validates relations that cannot be expressed by the structural Zod schemas:
 * identifier uniqueness, the target object references and current object
 * capabilities. Shared by the v1 and v2 schemas.
 */
const addLevelDocumentRelationIssues = (
  document: DocumentRelationsInput,
  issues: LevelDocumentValidationIssue[],
  validateChallengeAgainstInventory = true,
): void => {
  addUniqueIdentifierIssues(document.objects, 'objects', issues);
  addUniqueIdentifierIssues(document.inventory, 'inventory', issues);
  addRotationPermissionIssues(document.objects, 'objects', issues);
  addRotationPermissionIssues(document.inventory, 'inventory', issues);

  const placementsById = new Map(document.objects.map((placement) => [placement.id, placement]));
  const ball = placementsById.get(document.goal.ballId);
  if (ball?.type !== 'ball') {
    issues.push({
      path: ['goal', 'ballId'],
      message: 'L’objectif doit référencer une balle déjà placée.',
    });
  }

  const basket = placementsById.get(document.goal.basketId);
  if (basket?.type !== 'basket') {
    issues.push({
      path: ['goal', 'basketId'],
      message: 'L’objectif doit référencer un panier déjà placé.',
    });
  }

  if (document.challenge !== undefined) {
    const { elegantObjectCount, minimalObjectCount } = document.challenge;
    if (minimalObjectCount > elegantObjectCount) {
      issues.push({
        path: ['challenge', 'minimalObjectCount'],
        message: 'Le nombre minimal connu ne peut pas dépasser le seuil élégant.',
      });
    }

    const inventoryObjectCount = document.inventory.reduce(
      (total, entry) => total + entry.quantity,
      0,
    );
    if (validateChallengeAgainstInventory && minimalObjectCount > inventoryObjectCount) {
      issues.push({
        path: ['challenge', 'minimalObjectCount'],
        message: 'Le nombre minimal connu ne peut pas dépasser la quantité totale de l’inventaire.',
      });
    }
  }
};

export type Solution = z.infer<typeof solutionSchema>;

interface PuzzleRelationsInput {
  readonly scene: { readonly min: WorldPosition; readonly max: WorldPosition };
  readonly objects: readonly ObjectPlacement[];
  readonly inventory: readonly InventoryEntry[];
  readonly wires: readonly ControlWire[];
  readonly goal: { readonly ballId: string; readonly basketId: string };
  readonly solution?: Solution | undefined;
}

const isInsideRange = (value: number, min: number, max: number): boolean =>
  value >= min && value <= max;

/**
 * U22 (ADR 0013): the goal is never to be placed; a workshop marking and a
 * reference solution never coexist; each pose of the solution names a
 * placeable inventory entry, within its quantity when `checkQuantities`
 * (an attempt consumes its inventory), inside the scene, and turned as its
 * family allows.
 */
const addPuzzleIssues = (
  document: PuzzleRelationsInput,
  issues: LevelDocumentValidationIssue[],
  checkQuantities: boolean,
  allowSolutionWireInstances = false,
): void => {
  document.objects.forEach((placement, index) => {
    const isGoal = placement.id === document.goal.ballId || placement.id === document.goal.basketId;
    if (placement.toPlace === true && isGoal) {
      issues.push({
        path: ['objects', index, 'toPlace'],
        message: 'La balle et le panier de l’objectif restent fixes.',
      });
    }
  });

  const { solution } = document;
  if (solution === undefined) return;

  document.wires.forEach((wire, index) => {
    if (wire.toPlace === true) {
      issues.push({
        path: ['wires', index, 'toPlace'],
        message: 'Un puzzle exporté ne conserve pas le marquage « à placer » des fils.',
      });
    }
  });

  if (document.objects.some(({ toPlace }) => toPlace === true)) {
    issues.push({
      path: ['solution'],
      message: 'Un niveau avec une solution de référence n’a plus d’objet à placer.',
    });
  }

  const usesByEntryId = new Map<string, number>();
  const placementTypesByReference = new Map<string, PlacementType>();
  const placementReferences = new Set<string>();
  solution.placements.forEach((pose, index) => {
    const path = ['solution', 'placements', index] as const;
    const entry = document.inventory.find(({ id }) => id === pose.inventoryId);
    if (entry === undefined || entry.type === 'wire') {
      issues.push({
        path: [...path, 'inventoryId'],
        message: `La solution doit poser un objet de l’inventaire, pas « ${pose.inventoryId} ».`,
      });
      return;
    }

    if (pose.placementId !== undefined) {
      if (placementReferences.has(pose.placementId)) {
        issues.push({
          path: [...path, 'placementId'],
          message: `La référence de pose « ${pose.placementId} » est déjà utilisée.`,
        });
      }
      placementReferences.add(pose.placementId);
      placementTypesByReference.set(pose.placementId, entry.type);
    }

    const uses = (usesByEntryId.get(entry.id) ?? 0) + 1;
    usesByEntryId.set(entry.id, uses);
    if (checkQuantities && uses > entry.quantity) {
      issues.push({
        path: [...path, 'inventoryId'],
        message: `La solution pose plus d’objets « ${entry.id} » que l’inventaire n’en contient.`,
      });
    }

    const { position } = pose.transform;
    if (!isInsideRange(position.x, document.scene.min.x, document.scene.max.x)) {
      issues.push({
        path: [...path, 'transform', 'position', 'x'],
        message: 'Chaque pose de la solution doit être dans la scène sur l’axe x.',
      });
    }
    if (!isInsideRange(position.y, document.scene.min.y, document.scene.max.y)) {
      issues.push({
        path: [...path, 'transform', 'position', 'y'],
        message: 'Chaque pose de la solution doit être dans la scène sur l’axe y.',
      });
    }
  });

  const fixedObjectsById = new Map(document.objects.map((placement) => [placement.id, placement]));
  const solutionWireIds = new Set<string>();
  const declaredSolutionWireIds = new Set((solution.wires ?? []).map(({ id }) => id));
  const fixedWireIds = new Set(
    document.wires
      .filter(({ id }) => !allowSolutionWireInstances || !declaredSolutionWireIds.has(id))
      .map(({ id }) => id),
  );
  const commandedTargets = new Set(
    document.wires
      .filter(({ id }) => checkQuantities || !declaredSolutionWireIds.has(id))
      .map(({ targetId }) => targetId),
  );
  const usesByWireEntryId = new Map<string, number>();
  const usedTimerIds = new Set(
    document.wires
      .filter(({ id }) => !allowSolutionWireInstances || !declaredSolutionWireIds.has(id))
      .flatMap(({ timerId }) => (timerId === undefined ? [] : [timerId])),
  );
  (solution.wires ?? []).forEach((wire, index) => {
    const path = ['solution', 'wires', index] as const;
    const entry = document.inventory.find(({ id }) => id === wire.inventoryId);
    if (entry === undefined || entry.type !== 'wire') {
      issues.push({
        path: [...path, 'inventoryId'],
        message: `La solution doit utiliser une entrée de fil « ${wire.inventoryId} ».`,
      });
    } else {
      const uses = (usesByWireEntryId.get(entry.id) ?? 0) + 1;
      usesByWireEntryId.set(entry.id, uses);
      if (checkQuantities && uses > entry.quantity) {
        issues.push({
          path: [...path, 'inventoryId'],
          message: `La solution utilise plus de fils « ${entry.id} » que l’inventaire n’en contient.`,
        });
      }
    }

    if (fixedWireIds.has(wire.id) || solutionWireIds.has(wire.id)) {
      issues.push({
        path: [...path, 'id'],
        message: `L’identifiant de fil « ${wire.id} » est déjà utilisé.`,
      });
    }
    solutionWireIds.add(wire.id);

    const source = fixedObjectsById.get(wire.sourceId);
    const sourceType = source?.type ?? placementTypesByReference.get(wire.sourceId);
    const target = fixedObjectsById.get(wire.targetId);
    const targetType = target?.type ?? placementTypesByReference.get(wire.targetId);
    const sourceIssue = controlWireSourceIssue(sourceType);
    if (sourceIssue !== null) {
      issues.push({ path: [...path, 'sourceId'], message: sourceIssue });
    }
    const targetIssue = controlWireTargetIssue(sourceType, targetType);
    if (targetIssue !== null) {
      issues.push({ path: [...path, 'targetId'], message: targetIssue });
    } else if (commandedTargets.has(wire.targetId)) {
      issues.push({
        path: [...path, 'targetId'],
        message: `L’appareil « ${wire.targetId} » est déjà commandé.`,
      });
    }
    commandedTargets.add(wire.targetId);

    if (wire.timerId !== undefined) {
      const fixedTimer = fixedObjectsById.get(wire.timerId);
      const timerType = fixedTimer?.type ?? placementTypesByReference.get(wire.timerId);
      if (timerType !== 'timer') {
        issues.push({
          path: [...path, 'timerId'],
          message: `La solution doit référencer un minuteur placé ou à placer « ${wire.timerId} ».`,
        });
      } else if (usedTimerIds.has(wire.timerId)) {
        issues.push({
          path: [...path, 'timerId'],
          message: `Le minuteur « ${wire.timerId} » est déjà inséré dans un fil.`,
        });
      }
      usedTimerIds.add(wire.timerId);
    }
  });
};

interface SceneContainmentInput {
  readonly scene: { readonly min: WorldPosition; readonly max: WorldPosition };
  readonly objects: readonly ObjectPlacement[];
  readonly buildZones: readonly BuildZone[];
}

/**
 * ADR 0007: every placed object's centre and every build zone must be
 * contained in the scene. Full-shape containment for objects is a known debt
 * (see `docs/backlog.md` § Dettes transverses) because object dimensions are
 * not yet part of the domain.
 */
const addSceneContainmentIssues = (
  document: SceneContainmentInput,
  issues: LevelDocumentValidationIssue[],
): void => {
  document.objects.forEach((placement, index) => {
    const { x, y } = placement.transform.position;
    if (x < document.scene.min.x || x > document.scene.max.x) {
      issues.push({
        path: ['objects', index, 'transform', 'position', 'x'],
        message: `Le centre de l’objet « ${placement.id} » doit être contenu dans la scène sur l’axe x.`,
      });
    }
    if (y < document.scene.min.y || y > document.scene.max.y) {
      issues.push({
        path: ['objects', index, 'transform', 'position', 'y'],
        message: `Le centre de l’objet « ${placement.id} » doit être contenu dans la scène sur l’axe y.`,
      });
    }
  });

  document.buildZones.forEach((zone, index) => {
    if (zone.min.x < document.scene.min.x) {
      issues.push({
        path: ['buildZones', index, 'min', 'x'],
        message: 'La zone de construction doit être contenue dans la scène sur l’axe x.',
      });
    }
    if (zone.max.x > document.scene.max.x) {
      issues.push({
        path: ['buildZones', index, 'max', 'x'],
        message: 'La zone de construction doit être contenue dans la scène sur l’axe x.',
      });
    }
    if (zone.min.y < document.scene.min.y) {
      issues.push({
        path: ['buildZones', index, 'min', 'y'],
        message: 'La zone de construction doit être contenue dans la scène sur l’axe y.',
      });
    }
    if (zone.max.y > document.scene.max.y) {
      issues.push({
        path: ['buildZones', index, 'max', 'y'],
        message: 'La zone de construction doit être contenue dans la scène sur l’axe y.',
      });
    }
  });
};

/** Legacy v1 contract (ADR 0004), accepted only as `migrateLevelDocumentV1ToV2` input. */
export const levelDocumentV1Schema = levelDocumentV1StructureSchema.superRefine(
  (document, context) => {
    const issues: LevelDocumentValidationIssue[] = [];
    addLevelDocumentRelationIssues(document, issues);
    for (const issue of issues) {
      context.addIssue({ code: 'custom', path: [...issue.path], message: issue.message });
    }
  },
);

/** The strict legacy v2 contract (ADR 0018). */
export const levelDocumentV2Schema = levelDocumentV2StructureSchema.superRefine(
  (document, context) => {
    const issues: LevelDocumentValidationIssue[] = [];
    addLevelDocumentRelationIssues(document, issues);
    addSceneContainmentIssues(document, issues);
    addPuzzleIssues(document, issues, true);
    addControlWireIssues(document.objects, document.wires, issues);
    for (const issue of issues) {
      context.addIssue({ code: 'custom', path: [...issue.path], message: issue.message });
    }
  },
);

export const levelDocumentSchema = levelDocumentV3StructureSchema.superRefine(
  (document, context) => {
    const issues: LevelDocumentValidationIssue[] = [];
    addLevelDocumentRelationIssues(document, issues);
    addSceneContainmentIssues(document, issues);
    addPuzzleIssues(document, issues, true);
    addControlWireIssues(document.objects, document.wires, issues);
    for (const issue of issues)
      context.addIssue({ code: 'custom', path: [...issue.path], message: issue.message });
  },
);

/**
 * Construction attempts expose remaining inventory in their document while
 * the challenge is defined against the original stock. Use this schema only
 * for that ephemeral projection; `ConstructionAttempt` separately restores
 * quantities from validated provenance before accepting a candidate.
 */
export const levelDocumentV2AttemptSchema = levelDocumentV2StructureSchema.superRefine(
  (document, context) => {
    const issues: LevelDocumentValidationIssue[] = [];
    addLevelDocumentRelationIssues(document, issues, false);
    addSceneContainmentIssues(document, issues);
    addPuzzleIssues(document, issues, false, true);
    addControlWireIssues(document.objects, document.wires, issues);
    for (const issue of issues) {
      context.addIssue({ code: 'custom', path: [...issue.path], message: issue.message });
    }
  },
);

export const levelDocumentAttemptSchema = levelDocumentV3StructureSchema.superRefine(
  (document, context) => {
    const issues: LevelDocumentValidationIssue[] = [];
    addLevelDocumentRelationIssues(document, issues, false);
    addSceneContainmentIssues(document, issues);
    addPuzzleIssues(document, issues, false, true);
    addControlWireIssues(document.objects, document.wires, issues);
    for (const issue of issues) {
      context.addIssue({ code: 'custom', path: [...issue.path], message: issue.message });
    }
  },
);

/**
 * Outcome of `migrateLevelDocumentV1ToV2`.
 *
 * ADR 0007 fixes the scene at [`MIN_SCENE_SIZE`, `MAX_SCENE_SIZE`] world
 * units per side, but v1 allowed coordinates up to ±1 000 000: a
 * perfectly valid v1 document can have a bounding box wider or taller than
 * the migration is able to represent (e.g. a ball and a basket 100 units
 * apart). Clamping the scene to `MAX_SCENE_SIZE` in that case would leave
 * some objects outside the declared rectangle, which is exactly the
 * invariant `levelDocumentSchema` exists to reject — the v2 document would
 * still fail validation, just later and less legibly. So this case is
 * surfaced explicitly instead of silently producing an invalid v2 document.
 *
 * It is modelled as a typed result rather than a thrown exception: this
 * mirrors how the rest of this codebase expresses expected, recoverable
 * failures (`ConstructionCommandOutcome`, `ContentCatalogValidationResult`),
 * keeps the function total and easy to test without `try`/`catch`, and
 * forces a caller to handle the failure at the type level instead of being
 * able to forget it.
 */
type LevelDocumentMigrationResult =
  | { readonly status: 'migrated'; readonly document: LevelDocumentV2 }
  | {
      readonly status: 'scene-too-large';
      readonly width: number;
      readonly height: number;
    };

/**
 * ADR 0007: derives the scene rectangle a pre-scene v1 document never had.
 * The scene is the bounding box of every object centre and build-zone corner,
 * widened by `SCENE_MIGRATION_MARGIN` units on every side, then widened
 * further so that no side is smaller than `MIN_SCENE_SIZE`. If the result is
 * still wider or taller than `MAX_SCENE_SIZE`, the migration fails explicitly
 * (see `LevelDocumentMigrationResult`) instead of returning a document that
 * `levelDocumentSchema` would reject. Pure: it neither mutates its input nor
 * performs I/O.
 */
export const migrateLevelDocumentV1ToV2 = (
  document: LevelDocumentV1,
): LevelDocumentMigrationResult => {
  const validated = levelDocumentV1Schema.parse(document);
  const points: WorldPosition[] = [
    ...validated.objects.map((placement) => placement.transform.position),
    ...validated.buildZones.flatMap((zone) => [zone.min, zone.max]),
  ];

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  // A v1 document valid under `levelDocumentV1Schema` always places at least a
  // ball and a basket (the goal references require it), so `points` is never
  // empty in practice; the fallback only guards a document built by hand.
  const rawMinX = xs.length > 0 ? Math.min(...xs) : -MIN_SCENE_SIZE / 2;
  const rawMaxX = xs.length > 0 ? Math.max(...xs) : MIN_SCENE_SIZE / 2;
  const rawMinY = ys.length > 0 ? Math.min(...ys) : -MIN_SCENE_SIZE / 2;
  const rawMaxY = ys.length > 0 ? Math.max(...ys) : MIN_SCENE_SIZE / 2;

  const widenToMinimumSize = (rawMin: number, rawMax: number): { min: number; max: number } => {
    const min = rawMin - SCENE_MIGRATION_MARGIN;
    const max = rawMax + SCENE_MIGRATION_MARGIN;
    if (max - min >= MIN_SCENE_SIZE) return { min, max };

    const center = (min + max) / 2;
    return { min: center - MIN_SCENE_SIZE / 2, max: center + MIN_SCENE_SIZE / 2 };
  };

  const xRange = widenToMinimumSize(rawMinX, rawMaxX);
  const yRange = widenToMinimumSize(rawMinY, rawMaxY);
  const width = xRange.max - xRange.min;
  const height = yRange.max - yRange.min;

  if (width > MAX_SCENE_SIZE || height > MAX_SCENE_SIZE) {
    return { status: 'scene-too-large', width, height };
  }

  return {
    status: 'migrated',
    document: levelDocumentV2Schema.parse({
      ...validated,
      schemaVersion: LEVEL_DOCUMENT_V2_SCHEMA_VERSION,
      wires: [],
      scene: {
        min: { x: xRange.min, y: yRange.min },
        max: { x: xRange.max, y: yRange.max },
      },
    }),
  };
};

/** ADR 0018: validate both ends; existing data survives the version change. */
export const migrateLevelDocumentV2ToV3 = (candidate: LevelDocumentV2): LevelDocument =>
  levelDocumentSchema.parse({ ...levelDocumentV2Schema.parse(candidate), schemaVersion: 3 });
