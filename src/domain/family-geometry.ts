/**
 * World-unit geometry of the object families (ADR 0007), relative to a
 * placement's origin, `y` growing downwards. The physics adapter builds its
 * colliders from it and the board projection derives sprite destinations
 * from it, so a sprite and its collider cannot drift apart.
 *
 * Polygons are measured on the source art by `art/build-sprites.py`, which
 * prints them; they are copied here by hand when the art changes.
 */

export type WorldPoint = Readonly<{ readonly x: number; readonly y: number }>;
export type WorldPolygon = readonly WorldPoint[];

/** A rectangle whose `x`/`y` is its top-left corner, relative to the placement's origin. */
export type WorldRect = Readonly<{
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}>;

const centeredRect = (width: number, height: number): WorldRect => ({
  x: -width / 2,
  y: -height / 2,
  width,
  height,
});

const polygon = (points: readonly (readonly [number, number])[]): WorldPolygon =>
  points.map(([x, y]) => ({ x, y }));

/** C9a gameplay footprint: a box fits the belt and presses a button. */
export const boxGeometry = { footprint: centeredRect(0.8, 0.8) } as const;

/** C9b gameplay footprint and radial field; independent of source pixels. */
export const electroMagnetGeometry = { footprint: centeredRect(1, 0.8), range: 2.8 } as const;

/** C9c piston: a fixed horizontal housing and a button-driven sliding assembly. */
export const pistonGeometry = {
  footprint: {
    x: -0.391,
    y: -0.32145858761987794,
    width: 1.2478526591107235,
    height: 0.6429171752397559,
  },
  housing: {
    footprint: { x: -0.391, y: -0.2148, width: 0.782, height: 0.4295 },
    polygon: polygon([
      [-0.3624, -0.0348],
      [-0.2492, -0.1636],
      [-0.0262, -0.2148],
      [0.2921, -0.2148],
      [0.3815, -0.0791],
      [0.2901, 0.2141],
      [-0.2471, 0.2052],
      [-0.3658, 0.1159],
    ]),
  },
  plate: {
    footprint: {
      x: -0.18885265911072363,
      y: -0.32145858761987794,
      width: 0.37770531822144726,
      height: 0.6429171752397559,
    },
    polygon: polygon([
      [-0.1868, -0.1326],
      [-0.0457, -0.3208],
      [0.1452, -0.3187],
      [0.1875, -0.2731],
      [0.1882, 0.2744],
      [0.1432, 0.3208],
      [-0.043, 0.3208],
      [-0.1889, 0.1278],
    ]),
  },
  rod: {
    footprint: {
      x: -0.6256,
      y: -0.031831267765776015,
      width: 0.6256,
      height: 0.06366253553155203,
    },
  },
  homeOffset: { x: 0.254, y: 0 },
  travel: 0.414,
} as const;

const BALL_RADIUS = 0.3;

export const ballGeometry = {
  radius: BALL_RADIUS,
  footprint: centeredRect(2 * BALL_RADIUS, 2 * BALL_RADIUS),
} as const;

export const basketGeometry = {
  footprint: centeredRect(1.5, 1.1),
} as const;

const BEAM_THICKNESS = 0.25;

export const beamGeometry = {
  thickness: BEAM_THICKNESS,
  footprints: {
    short: centeredRect(2, BEAM_THICKNESS),
    medium: centeredRect(4, BEAM_THICKNESS),
    long: centeredRect(6, BEAM_THICKNESS),
  },
} as const;

const SEESAW_BOARD_HALF_LENGTH = 1.5;
const SEESAW_BOARD_HALF_THICKNESS = 0.12;
/** The fulcrum stands right under the board and ends 0,70 below the pivot (A4). */
const SEESAW_FULCRUM_BOTTOM = 0.7;
const SEESAW_FULCRUM_WIDTH = 0.5929;

/**
 * The seesaw's origin is its pivot. The board is centred on it; the fulcrum
 * is a separate static piece standing under the board and never rotates.
 */
export const seesawGeometry = {
  board: {
    halfLength: SEESAW_BOARD_HALF_LENGTH,
    halfThickness: SEESAW_BOARD_HALF_THICKNESS,
    footprint: centeredRect(2 * SEESAW_BOARD_HALF_LENGTH, 2 * SEESAW_BOARD_HALF_THICKNESS),
  },
  fulcrum: {
    footprint: {
      x: -SEESAW_FULCRUM_WIDTH / 2,
      y: SEESAW_BOARD_HALF_THICKNESS,
      width: SEESAW_FULCRUM_WIDTH,
      height: SEESAW_FULCRUM_BOTTOM - SEESAW_BOARD_HALF_THICKNESS,
    },
    polygon: polygon([
      [-0.2907, 0.5611],
      [-0.0874, 0.1687],
      [0.0158, 0.1214],
      [0.0888, 0.173],
      [0.2893, 0.5611],
      [0.2549, 0.6986],
      [-0.2563, 0.6986],
      [-0.295, 0.6642],
    ]),
  },
  /** Union of both pieces, used to select and frame the seesaw as one object. */
  footprint: {
    x: -SEESAW_BOARD_HALF_LENGTH,
    y: -SEESAW_BOARD_HALF_THICKNESS,
    width: 2 * SEESAW_BOARD_HALF_LENGTH,
    height: SEESAW_FULCRUM_BOTTOM + SEESAW_BOARD_HALF_THICKNESS,
  },
} as const;

const MASS_WIDTH = 0.8;
const MASS_HEIGHT = 0.5052;

/**
 * A free weight; its origin is the centre of its footprint. Its collider is
 * the trapezoid body plus the lifting ring, a circle: a single convex hull
 * would turn the ring into a spike.
 */
export const massGeometry = {
  footprint: centeredRect(MASS_WIDTH, MASS_HEIGHT),
  polygon: polygon([
    [-0.3931, 0.2035],
    [-0.2505, -0.0519],
    [-0.2152, -0.0768],
    [0.2235, -0.0768],
    [0.245, -0.0623],
    [0.3979, 0.2145],
    [0.3246, 0.2519],
    [-0.3785, 0.2512],
  ]),
  ring: { center: { x: 0.0014, y: -0.1439 }, radius: 0.1087 },
} as const;

export type LeverPosition = 'left' | 'center' | 'right';

/** The handle tilts a quarter of a right angle either side, as drawn in the source art. */
const LEVER_TILT = Math.PI / 4;

const rotatePoint = ({ x, y }: WorldPoint, angle: number): WorldPoint => ({
  x: x * Math.cos(angle) - y * Math.sin(angle),
  y: x * Math.sin(angle) + y * Math.cos(angle),
});

const rectCorners = ({ x, y, width, height }: WorldRect): WorldPolygon => [
  { x, y },
  { x: x + width, y },
  { x: x + width, y: y + height },
  { x, y: y + height },
];

const boundingRect = (points: WorldPolygon): WorldRect => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

const LEVER_BASE_FOOTPRINT: WorldRect = { x: -0.4, y: -0.2825, width: 0.8, height: 0.414 };
/** The handle drawn upright; its origin is the pivot, like the lever's. */
const LEVER_HANDLE_FOOTPRINT: WorldRect = { x: -0.1747, y: -0.8804, width: 0.3494, height: 0.9997 };

/**
 * The lever's origin is its pivot. The base never moves; the handle turns
 * around the pivot and its angle, not the document, says where it stands
 * once the simulation runs.
 */
export const leverGeometry = {
  tilt: LEVER_TILT,
  base: {
    footprint: LEVER_BASE_FOOTPRINT,
    polygon: polygon([
      [-0.3988, 0.017],
      [-0.1443, -0.2265],
      [-0.0749, -0.2679],
      [0.0542, -0.2764],
      [0.1504, -0.224],
      [0.3976, 0.0183],
      [0.372, 0.1291],
      [-0.3732, 0.1291],
    ]),
  },
  handle: {
    footprint: LEVER_HANDLE_FOOTPRINT,
    stickHalfWidth: 0.04,
    knobCenterY: -0.7043,
    knobRadius: 0.1534,
  },
} as const;

export const leverAngle = (position: LeverPosition): number =>
  position === 'left' ? -LEVER_TILT : position === 'right' ? LEVER_TILT : 0;

/** Base and handle together, with the handle at `position`: what the editor selects. */
export const leverFootprint = (position: LeverPosition): WorldRect =>
  boundingRect([
    ...rectCorners(LEVER_BASE_FOOTPRINT),
    ...rectCorners(LEVER_HANDLE_FOOTPRINT).map((corner) =>
      rotatePoint(corner, leverAngle(position)),
    ),
  ]);

/** A three-unit belt; its origin is the centre of its frame. */
export const conveyorGeometry = {
  footprint: centeredRect(3, 0.5799),
} as const;

/**
 * A pressure button; its origin is the centre of its footprint, cap up. The
 * base never moves; the cap sinks by `travel` while something weighs on it.
 */
export const buttonGeometry = {
  footprint: { x: -0.4, y: -0.2402, width: 0.8, height: 0.4804 },
  base: {
    footprint: { x: -0.4, y: -0.1063, width: 0.8, height: 0.3464 },
    polygon: polygon([
      [-0.3929, 0.1384],
      [-0.1116, -0.0884],
      [-0.0071, -0.1063],
      [0.1116, -0.0893],
      [0.3179, 0.0634],
      [0.3991, 0.1563],
      [0.3688, 0.2393],
      [-0.367, 0.2393],
    ]),
  },
  cap: {
    footprint: { x: -0.1875, y: -0.2402, width: 0.375, height: 0.2672 },
    /** The red dome without the stem that sinks into the base. */
    body: { x: -0.1875, y: -0.2402, width: 0.375, height: 0.2171 },
    travel: 0.06,
  },
} as const;

/**
 * A trampoline; its origin is the centre of its footprint. The platform
 * sits on the spring, which sits in the base; only the drawing compresses.
 */
export const springboardGeometry = {
  footprint: { x: -0.5, y: -0.4654, width: 1, height: 0.9308 },
  base: {
    footprint: { x: -0.5, y: 0.0624, width: 1, height: 0.403 },
    polygon: polygon([
      [-0.4913, 0.3186],
      [-0.2214, 0.0637],
      [0.2139, 0.0624],
      [0.4888, 0.3174],
      [0.4988, 0.4443],
      [0.4789, 0.4642],
      [-0.4789, 0.4642],
      [-0.5, 0.443],
    ]),
  },
  spring: { footprint: { x: -0.1803, y: -0.2162, width: 0.3607, height: 0.3035 } },
  platform: {
    footprint: { x: -0.5, y: -0.4654, width: 1, height: 0.2617 },
    /** How far the platform may sink, drawn only, when something lands on it. */
    maxCompression: 0.12,
  },
} as const;

type BarrierState = 'closed' | 'open';

const BARRIER_PILLAR_FOOTPRINT: WorldRect = { x: -0.45, y: -0.4779, width: 0.9, height: 0.9558 };
const BARRIER_BAR_LENGTH = 1.7013;
const BARRIER_BAR_THICKNESS = 0.38;
const BARRIER_BAR_CENTER_Y = -0.0414;

/**
 * A sliding barrier; its origin is the centre of its pillar. Closed, the bar
 * runs from the pillar's axis to `length` on its right, as drawn; opening, it slides
 * into the pillar until its tip is flush with the barrel.
 */
export const barrierGeometry = {
  pillar: {
    footprint: BARRIER_PILLAR_FOOTPRINT,
    polygon: polygon([
      [-0.45, 0.3361],
      [-0.3385, -0.3855],
      [-0.3035, -0.4365],
      [0.0374, -0.4779],
      [0.313, -0.3887],
      [0.4468, 0.2628],
      [0.4054, 0.4763],
      [-0.4006, 0.4763],
    ]),
    barrelHalfWidth: 0.3226,
  },
  bar: {
    length: BARRIER_BAR_LENGTH,
    thickness: BARRIER_BAR_THICKNESS,
    centerY: BARRIER_BAR_CENTER_Y,
  },
} as const;

/** Pillar and bar together, as the editor shows them (bar to the right): what it selects. */
export const barrierFootprint = (state: BarrierState): WorldRect =>
  state === 'open'
    ? BARRIER_PILLAR_FOOTPRINT
    : { ...BARRIER_PILLAR_FOOTPRINT, width: BARRIER_BAR_LENGTH - BARRIER_PILLAR_FOOTPRINT.x };

const FAN_FOOTPRINT: WorldRect = { x: -0.6, y: -0.4683, width: 1.2, height: 0.9367 };

/**
 * A fan, drawn blowing right; its origin is the centre of its footprint. Its
 * rotation says where it blows (see `facingPose`).
 * The blades turn behind the body, seen through the ring's opening and
 * squashed horizontally because the ring is seen at an angle.
 */
export const fanGeometry = {
  body: {
    footprint: FAN_FOOTPRINT,
    polygon: polygon([
      [-0.6, -0.0905],
      [-0.5732, -0.175],
      [-0.2574, -0.464],
      [0.2874, -0.4426],
      [0.5154, -0.2628],
      [0.5989, 0.3292],
      [0.5764, 0.4673],
      [-0.5775, 0.4662],
    ]),
  },
  blades: {
    center: { x: 0.1986, y: -0.0765 },
    footprint: centeredRect(0.5938, 0.5547),
    squash: 0.53,
  },
  /** Where the air leaves the ring: the blow zone starts there. */
  mouth: { x: 0.55, y: -0.0765, halfWidth: 0.27 },
} as const;

/** Below this, `cos(rotation)` is a rounding residue of a vertical turn (±90°). */
const FACING_TOLERANCE = 1e-9;

/**
 * How a family drawn facing right (fan, barrier) is laid out for any
 * rotation: pointing left of the vertical, it is drawn mirrored and turned
 * the other way, so a fan blowing left keeps its feet down and a barrier its
 * plinth. Its rotation is thus the direction it faces.
 */
export const facingPose = (
  rotation: number,
): Readonly<{ readonly angle: number; readonly mirrored: boolean }> =>
  Math.cos(rotation) < -FACING_TOLERANCE
    ? { angle: rotation - Math.PI, mirrored: true }
    : { angle: rotation, mirrored: false };

/**
 * « Retourner »: the rotation that faces the other side, tilted the other
 * way — a left-right mirror. Kept within (−π, π].
 */
export const mirroredRotation = (rotation: number): number => {
  const turned = (Math.PI - rotation) % (2 * Math.PI);
  if (turned > Math.PI) return turned - 2 * Math.PI;
  return turned <= -Math.PI ? turned + 2 * Math.PI : turned;
};
