import type { LevelDocument, Solution } from '../../domain/level-document';

type Placement = LevelDocument['objects'][number];
type InventoryEntry = LevelDocument['inventory'][number];

/** An object present in the workshop is locked, like any object of the decor. */
const lockedPermissions = { move: false, rotate: false, remove: false } as const;

/** `base`, then `base-2`, `base-3`… : the first identifier nobody uses yet. */
export const uniqueIdentifier = (base: string, used: Set<string>): string => {
  let candidate = base;
  for (let suffix = 2; used.has(candidate); suffix += 1) candidate = `${base}-${String(suffix)}`;
  used.add(candidate);
  return candidate;
};

/**
 * The poses and wires of `solution`, back on a workshop board and marked to
 * place (ADR 0013): each pose takes the family and properties of its entry in
 * `inventory` and an identifier not yet in `usedIds` (which it then reserves);
 * a wire end that names a pose's `placementId` is remapped to the restored
 * object. Shared by `workshopFromPuzzle`, the creations of ADR 0015 and the
 * reveal of the author's solution (M7). Wire identifiers are reserved in
 * `usedIds` too, so that a wire never takes an identifier already used.
 */
export const restoreSolution = (
  solution: Solution,
  inventory: readonly InventoryEntry[],
  usedIds: Set<string>,
): { readonly objects: Placement[]; readonly wires: LevelDocument['wires'] } => {
  const restoredIdsByReference = new Map<string, string>();
  const objects = solution.placements.flatMap((pose): Placement[] => {
    const entry = inventory.find(({ id }) => id === pose.inventoryId);
    if (entry === undefined || entry.type === 'wire') return [];
    const restoredId = uniqueIdentifier(entry.id, usedIds);
    if (pose.placementId !== undefined) {
      restoredIdsByReference.set(pose.placementId, restoredId);
    }
    // The rest keeps the entry's family and properties paired, as one placement type.
    const {
      id: ignoredId,
      quantity: ignoredQuantity,
      permissions: ignoredPermissions,
      ...family
    } = entry;
    void ignoredId;
    void ignoredQuantity;
    void ignoredPermissions;
    return [
      {
        ...family,
        id: restoredId,
        transform: pose.transform,
        permissions: lockedPermissions,
        toPlace: true,
      },
    ];
  });
  const wires = (solution.wires ?? []).map((wire) => ({
    id: uniqueIdentifier(wire.id, usedIds),
    sourceId: restoredIdsByReference.get(wire.sourceId) ?? wire.sourceId,
    ...(wire.timerId === undefined
      ? {}
      : { timerId: restoredIdsByReference.get(wire.timerId) ?? wire.timerId }),
    targetId: restoredIdsByReference.get(wire.targetId) ?? wire.targetId,
    toPlace: true as const,
  }));
  return { objects, wires };
};
