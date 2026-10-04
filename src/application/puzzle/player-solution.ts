import type { Solution } from '../../domain/level-document';
import type { ConstructionAttempt } from '../construction';

/**
 * ADR 0015 § Victoire sur un niveau reçu: the player's solution is derived
 * from the attempt's provenance (ADR 0005), in the `solution` shape of
 * ADR 0013. Only what the player took from the inventory counts: the poses of
 * their objects and their wires. A decor object they moved is not part of it.
 * A pose that one of their wires touches keeps the player's object id as
 * `placementId`, so that replaying the solution remaps the wire's ends.
 */
export const solutionFromAttempt = ({ document, provenance }: ConstructionAttempt): Solution => {
  const wires = document.wires.flatMap((wire) => {
    const inventoryId = provenance[wire.id];
    return inventoryId === undefined
      ? []
      : [
          {
            id: wire.id,
            inventoryId,
            sourceId: wire.sourceId,
            ...(wire.timerId === undefined ? {} : { timerId: wire.timerId }),
            targetId: wire.targetId,
          },
        ];
  });
  const wiredIds = new Set(
    wires.flatMap(({ sourceId, timerId, targetId }) => [
      sourceId,
      ...(timerId === undefined ? [] : [timerId]),
      targetId,
    ]),
  );
  const placements = document.objects.flatMap((placement) => {
    const inventoryId = provenance[placement.id];
    if (inventoryId === undefined) return [];
    return [
      {
        inventoryId,
        ...(wiredIds.has(placement.id) ? { placementId: placement.id } : {}),
        transform: {
          position: { ...placement.transform.position },
          rotation: placement.transform.rotation,
        },
      },
    ];
  });

  return { placements, ...(wires.length > 0 ? { wires } : {}) };
};
