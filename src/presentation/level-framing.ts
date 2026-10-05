import type { WorldPoint } from '../domain/family-geometry';
import type { LevelDocument } from '../domain/level-document';
import { placementFootprintCorners } from '../domain/placement-footprint';
import type { SceneRect } from './board-camera';

/** Room left around the machine, in world units, on every side. */
const LEVEL_FRAMING_MARGIN = 0.75;

/**
 * ADR 0007 § Scène d'un niveau: a first-chapter level holds in 8 × 5,5 units,
 * the smallest frame that keeps a ball readable on a phone. The framing never
 * zooms in further than that.
 */
export const LEVEL_FRAMING_MIN_SIZE = { width: 8, height: 5.5 } as const;

/** Where the reference solution lays its objects: the room the player will need. */
const solutionCorners = (document: LevelDocument): readonly WorldPoint[] =>
  (document.solution?.placements ?? []).flatMap(({ inventoryId, transform }) => {
    const entry = document.inventory.find(({ id }) => id === inventoryId);
    return entry === undefined || entry.type === 'wire'
      ? [transform.position]
      : placementFootprintCorners(entry, transform);
  });

/** Grows `[min, max]` to `size` around its middle, then slides it back inside the scene's own span. */
const fitSpan = (
  min: number,
  max: number,
  size: number,
  sceneMin: number,
  sceneMax: number,
): readonly [number, number] => {
  const length = Math.max(max - min, size);
  if (length >= sceneMax - sceneMin) return [sceneMin, sceneMax];
  const start = Math.min(Math.max((min + max - length) / 2, sceneMin), sceneMax - length);
  return [start, start + length];
};

/**
 * The useful part of a level (ADR 0007, amendment of 5 October 2026): its
 * objects and the poses of its reference solution, with a margin, never
 * smaller than `LEVEL_FRAMING_MIN_SIZE` and never past the scene. It is the
 * framing a level opens on; nothing is persisted, the scene still bounds the
 * world and the zoom. A level with no object is framed on its scene.
 */
export const frameLevel = (document: LevelDocument): SceneRect => {
  const { scene } = document;
  const points = [
    ...document.objects.flatMap((object) => placementFootprintCorners(object)),
    ...solutionCorners(document),
  ];
  if (points.length === 0) return scene;

  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const [minX, maxX] = fitSpan(
    Math.min(...xs) - LEVEL_FRAMING_MARGIN,
    Math.max(...xs) + LEVEL_FRAMING_MARGIN,
    LEVEL_FRAMING_MIN_SIZE.width,
    scene.min.x,
    scene.max.x,
  );
  const [minY, maxY] = fitSpan(
    Math.min(...ys) - LEVEL_FRAMING_MARGIN,
    Math.max(...ys) + LEVEL_FRAMING_MARGIN,
    LEVEL_FRAMING_MIN_SIZE.height,
    scene.min.y,
    scene.max.y,
  );
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
};
