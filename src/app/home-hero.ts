import { restoreSolution } from '../application/puzzle/restore-solution';
import type { LevelDocument } from '../domain/level-document';

const HOME_PREVIEW_VERTICAL_PAN = 0.75;

/**
 * `level` with its reference solution already on the board, for the home
 * page's picture of a finished machine. The copy is never played nor edited:
 * the restored objects and wires lose their workshop « à placer » marker so
 * that the board draws them like the rest of the decor.
 */
export const withSolutionPlaced = (level: LevelDocument): LevelDocument => {
  const { solution, ...board } = level;
  if (solution === undefined) return level;
  const usedIds = new Set([...level.objects, ...level.wires].map(({ id }) => id));
  const restored = restoreSolution(solution, level.inventory, usedIds);
  // Without its solution, which would name the same wires twice, the copy stays a valid document.
  // Pan this display-only copy down to show the full springboard with bottom margin.
  return {
    ...board,
    scene: {
      ...level.scene,
      min: { ...level.scene.min, y: level.scene.min.y + HOME_PREVIEW_VERTICAL_PAN },
      max: { ...level.scene.max, y: level.scene.max.y + HOME_PREVIEW_VERTICAL_PAN },
    },
    buildZones: level.buildZones.map((zone) => ({
      ...zone,
      min: { ...zone.min, y: zone.min.y + HOME_PREVIEW_VERTICAL_PAN },
      max: { ...zone.max, y: zone.max.y + HOME_PREVIEW_VERTICAL_PAN },
    })),
    objects: [
      ...level.objects,
      ...restored.objects.map(({ toPlace, ...object }) => {
        void toPlace;
        return object;
      }),
    ],
    wires: [
      ...level.wires,
      ...restored.wires.map(({ toPlace, ...wire }) => {
        void toPlace;
        return wire;
      }),
    ],
  };
};
