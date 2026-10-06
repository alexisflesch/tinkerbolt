import { restoreSolution } from '../application/puzzle/restore-solution';
import type { LevelDocument } from '../domain/level-document';
import type { MachineScene } from '../domain/machine-scene';

/** Place the author's machine, then remove the goal and seesaw requested in levels/README.md. */
export const createHomeScene = (level: LevelDocument): MachineScene => {
  const restored =
    level.solution === undefined
      ? { objects: [], wires: [] }
      : restoreSolution(
          level.solution,
          level.inventory,
          new Set([...level.objects, ...level.wires].map(({ id }) => id)),
        );
  const objects = [...level.objects, ...restored.objects]
    .filter(
      ({ id, type }) =>
        id !== level.goal?.ballId && id !== level.goal?.basketId && type !== 'seesaw',
    )
    .map(({ toPlace, ...object }) => {
      void toPlace;
      return object;
    });
  const ids = new Set(objects.map(({ id }) => id));
  return {
    objects,
    wires: [...level.wires, ...restored.wires].filter(
      ({ sourceId, targetId, timerId }) =>
        ids.has(sourceId) && ids.has(targetId) && (timerId === undefined || ids.has(timerId)),
    ),
    // Display crop only: the source's wide authoring scene would dwarf this compact machine.
    scene: { min: { x: -4.5, y: 2.5 }, max: { x: 5, y: 8 } },
  };
};
