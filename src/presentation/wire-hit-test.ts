import type { WorldPoint } from '../domain/family-geometry';
import type { ProjectedWire, ProjectedWireSegment } from './control-wires';

const segmentRoute = ({ from, bend, to }: ProjectedWireSegment): readonly WorldPoint[] =>
  bend === undefined ? [from, to] : [from, bend, to];

/**
 * The polylines a wire is drawn along, in world units: one, or two when a
 * timer is inserted in it. Shared by the selection highlight and the hit test,
 * so that what is touched is what is shown.
 */
export const wireRoutes = (wire: ProjectedWire): readonly (readonly WorldPoint[])[] =>
  wire.segments === undefined ? [segmentRoute(wire)] : wire.segments.map(segmentRoute);

const distanceToSegment = (point: WorldPoint, start: WorldPoint, end: WorldPoint): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const along =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
        );
  return Math.hypot(point.x - (start.x + along * dx), point.y - (start.y + along * dy));
};

const distanceToWire = (point: WorldPoint, wire: ProjectedWire): number =>
  Math.min(
    ...wireRoutes(wire).flatMap((route) =>
      route.slice(1).map((end, index) => {
        const start = route[index];
        return start === undefined
          ? Number.POSITIVE_INFINITY
          : distanceToSegment(point, start, end);
      }),
    ),
  );

/**
 * The wires within `tolerance` world units of `point`, nearest first. Several
 * wires may share a stretch of route: the caller cycles through the result.
 */
export const hitTestWires = (
  point: WorldPoint,
  wires: readonly ProjectedWire[],
  tolerance: number,
): readonly string[] =>
  wires
    .map((wire) => ({ id: wire.id, distance: distanceToWire(point, wire) }))
    .filter(({ distance }) => distance <= tolerance)
    .sort((first, second) => first.distance - second.distance)
    .map(({ id }) => id);
