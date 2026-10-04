import {
  ballGeometry,
  boxGeometry,
  electroMagnetGeometry,
  barrierFootprint,
  basketGeometry,
  beamGeometry,
  buttonGeometry,
  conveyorGeometry,
  fanGeometry,
  leverFootprint,
  massGeometry,
  pistonGeometry,
  seesawGeometry,
  springboardGeometry,
  timerGeometry,
  type WorldPoint,
  type WorldPolygon,
  type WorldRect,
} from './family-geometry';
import type { LevelDocument, PlaceableInventoryEntry } from './level-document';

type Placement = LevelDocument['objects'][number];
type Transform = Placement['transform'];
type FootprintSource = Placement | PlaceableInventoryEntry;

const rectangleCorners = ({ x, y, width, height }: WorldRect): WorldPolygon => [
  { x, y },
  { x: x + width, y },
  { x: x + width, y: y + height },
  { x, y: y + height },
];

const localFootprintFor = (placement: FootprintSource): WorldRect => {
  switch (placement.type) {
    case 'ball':
      return ballGeometry.footprint;
    case 'basket':
      return basketGeometry.footprint;
    case 'beam':
      return beamGeometry.footprints[placement.props.size];
    case 'seesaw':
      return seesawGeometry.footprint;
    case 'electro-magnet':
      return electroMagnetGeometry.footprint;
    case 'piston':
      return pistonGeometry.footprint;
    case 'box':
      return boxGeometry.footprint;
    case 'mass':
      return massGeometry.footprint;
    case 'lever':
      return leverFootprint(placement.props.position);
    case 'conveyor':
      return conveyorGeometry.footprint;
    case 'button':
      return buttonGeometry.footprint;
    case 'fan':
      return fanGeometry.body.footprint;
    case 'barrier':
      return barrierFootprint(placement.props.state);
    case 'springboard':
      return springboardGeometry.footprint;
    case 'timer':
      return timerGeometry.footprint;
    default:
      return assertNever(placement);
  }
};

const assertNever = (value: never): never => {
  throw new Error(`Famille d’objet sans empreinte : ${JSON.stringify(value)}`);
};

const translatedPoint = (point: WorldPoint, origin: WorldPoint, rotation: number): WorldPoint => {
  if (rotation === 0) return { x: origin.x + point.x, y: origin.y + point.y };

  const reducedRotation = rotation % (2 * Math.PI);
  const cosine = Math.cos(reducedRotation);
  const sine = Math.sin(reducedRotation);
  return {
    x: origin.x + point.x * cosine - point.y * sine,
    y: origin.y + point.x * sine + point.y * cosine,
  };
};

export function placementFootprintCorners(
  placement: Placement,
  transform?: Transform,
): WorldPolygon;
export function placementFootprintCorners(
  placement: PlaceableInventoryEntry,
  transform: Transform,
): WorldPolygon;
export function placementFootprintCorners(
  placement: FootprintSource,
  transformOverride?: Transform,
): WorldPolygon {
  const transform =
    transformOverride ?? ('transform' in placement ? placement.transform : undefined);
  if (transform === undefined) {
    throw new Error('Une transformée est requise pour calculer l’empreinte de l’objet.');
  }

  const rotation = placement.type === 'ball' ? 0 : transform.rotation;
  return rectangleCorners(localFootprintFor(placement)).map((point) =>
    translatedPoint(point, transform.position, rotation),
  );
}
