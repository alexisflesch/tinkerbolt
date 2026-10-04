import { z } from 'zod';
import {
  levelDocumentAttemptSchema,
  levelDocumentSchema,
  MAX_OBJECTS,
  MAX_WIRES,
  rotationMode,
  type LevelDocument,
} from '../../domain/level-document';
import { placementFootprintCorners } from '../../domain/placement-footprint';
import {
  definitionsMatch,
  freezeAttempt,
  isFootprintInsideBuildZone,
  type ConstructionAttempt,
} from './construction-attempt';

const identifierSchema = levelDocumentSchema.shape.id;
export const playerConstructionAttemptSchema = z.strictObject({
  document: levelDocumentAttemptSchema,
  provenance: z
    .record(identifierSchema, identifierSchema)
    .refine((provenance) => Object.keys(provenance).length <= MAX_OBJECTS + MAX_WIRES),
});

const equal = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
const sourceFields = ({
  schemaVersion,
  id,
  metadata,
  goal,
  scene,
  buildZones,
  challenge,
  solution,
}: LevelDocument) => ({
  schemaVersion,
  id,
  metadata,
  goal,
  scene,
  buildZones,
  challenge,
  solution,
});

type ValidationResult =
  | { readonly status: 'ok'; readonly attempt: ConstructionAttempt }
  | { readonly status: 'error'; readonly code: 'invalid-construction' };

export const validatePlayerConstruction = (
  source: LevelDocument,
  candidate: unknown,
): ValidationResult => {
  const invalid = { status: 'error', code: 'invalid-construction' } as const;
  const sourceValidation = levelDocumentSchema.safeParse(source);
  const attemptValidation = playerConstructionAttemptSchema.safeParse(candidate);
  if (!sourceValidation.success || !attemptValidation.success) return invalid;
  const original = sourceValidation.data;
  const { document, provenance } = attemptValidation.data;
  if (
    !equal(sourceFields(original), sourceFields(document)) ||
    document.inventory.length !== original.inventory.length
  )
    return invalid;
  if (
    document.objects.some(({ toPlace }) => toPlace === true) ||
    document.wires.some(({ toPlace }) => toPlace === true)
  )
    return invalid;

  const sourceObjects = new Map(original.objects.map((object) => [object.id, object]));
  const sourceWires = new Map(original.wires.map((wire) => [wire.id, wire]));
  const objects = new Map(document.objects.map((object) => [object.id, object]));
  const wires = new Map(document.wires.map((wire) => [wire.id, wire]));
  const inventory = new Map(original.inventory.map((entry) => [entry.id, entry]));
  const consumed = new Map<string, number>();

  for (const [id, entryId] of Object.entries(provenance)) {
    const object = objects.get(id);
    const wire = wires.get(id);
    const entry = inventory.get(entryId);
    if (
      sourceObjects.has(id) ||
      sourceWires.has(id) ||
      entry === undefined ||
      (object === undefined) === (wire === undefined)
    )
      return invalid;
    if (object !== undefined ? !definitionsMatch(object, entry) : entry.type !== 'wire')
      return invalid;
    consumed.set(entryId, (consumed.get(entryId) ?? 0) + 1);
  }
  for (const remaining of document.inventory) {
    const entry = inventory.get(remaining.id);
    if (
      entry === undefined ||
      !equal({ ...remaining, quantity: entry.quantity }, entry) ||
      remaining.quantity + (consumed.get(entry.id) ?? 0) !== entry.quantity
    )
      return invalid;
  }

  for (const originalObject of original.objects) {
    const object = objects.get(originalObject.id);
    if (
      object === undefined ||
      !equal({ ...object, transform: originalObject.transform }, originalObject)
    )
      return invalid;
    const moved = !equal(object.transform.position, originalObject.transform.position);
    const rotated = object.transform.rotation !== originalObject.transform.rotation;
    if (
      (moved && !originalObject.permissions.move) ||
      (rotated && !originalObject.permissions.rotate)
    )
      return invalid;
    if (
      (moved || rotated) &&
      !isFootprintInsideBuildZone(document, placementFootprintCorners(object, object.transform))
    )
      return invalid;
  }
  for (const object of document.objects) {
    if (sourceObjects.has(object.id)) continue;
    const sourceEntry = inventory.get(provenance[object.id] ?? '');
    if (
      sourceWires.has(object.id) ||
      sourceEntry === undefined ||
      (object.transform.rotation !== 0 &&
        (!sourceEntry.permissions.rotate || rotationMode(object.type) === 'fixed')) ||
      !isFootprintInsideBuildZone(document, placementFootprintCorners(object, object.transform))
    )
      return invalid;
  }
  for (const originalWire of original.wires) {
    if (!equal(wires.get(originalWire.id), originalWire)) return invalid;
  }
  for (const wire of document.wires) {
    if (sourceWires.has(wire.id)) continue;
    if (sourceObjects.has(wire.id) || !Object.hasOwn(provenance, wire.id)) return invalid;
  }

  // Challenge and hidden solution use the initial stock. A concrete player
  // wire may carry the same id as the wire advertised in that solution.
  const solutionWireIds = new Set(document.solution?.wires?.map(({ id }) => id) ?? []);
  const restored = levelDocumentSchema.safeParse({
    ...document,
    inventory: original.inventory,
    wires: document.wires.filter(({ id }) => !solutionWireIds.has(id)),
  });
  return restored.success
    ? { status: 'ok', attempt: freezeAttempt(document, provenance) }
    : invalid;
};
