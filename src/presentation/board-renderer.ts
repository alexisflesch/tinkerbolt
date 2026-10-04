import {
  ballGeometry,
  boxGeometry,
  electroMagnetGeometry,
  barrierFootprint,
  barrierGeometry,
  basketGeometry,
  beamGeometry,
  buttonGeometry,
  conveyorGeometry,
  fanGeometry,
  leverAngle,
  leverFootprint,
  leverGeometry,
  massGeometry,
  facingPose,
  pistonGeometry,
  seesawGeometry,
  springboardGeometry,
} from '../domain/family-geometry';
import {
  isPlacementUnconstrained,
  rotationMode,
  type LevelDocument,
} from '../domain/level-document';
import { projectWires, type ProjectedWire } from './control-wires';
import { drawWireLabels, drawWires, type WireCanvas } from './wire-renderer';
import {
  ROTATION_HANDLE_GAP_CSS_PIXELS,
  ROTATION_HANDLE_KNOB_RADIUS_CSS_PIXELS,
  ROTATION_HANDLE_SIZE_CSS_PIXELS,
} from './rotation-handle-metrics';
import {
  spriteAssetPath,
  spriteAssetsForFamily,
  type SpriteAsset,
  type SpriteFamily,
  type SpriteLoader,
} from './sprite-loader';

type BoardPoint = Readonly<{
  readonly x: number;
  readonly y: number;
}>;

export type BoardViewport = Readonly<{
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly origin: BoardPoint;
  readonly pixelsPerWorldUnit: number;
  readonly devicePixelRatio: number;
}>;

type BoardCanvas = {
  width: number;
  height: number;
};

/** The renderer only depends on the Canvas 2D operations it actually uses. */
export type BoardCanvasContext = {
  /** Allows richer Canvas test doubles without widening the renderer's API. */
  readonly [additionalCanvasOperation: string]: unknown;
  readonly save: () => void;
  readonly restore: () => void;
  readonly setTransform: (
    horizontalScale: number,
    verticalSkew: number,
    horizontalSkew: number,
    verticalScale: number,
    horizontalTranslation: number,
    verticalTranslation: number,
  ) => void;
  readonly translate: (x: number, y: number) => void;
  readonly rotate: (radians: number) => void;
  readonly scale: (x: number, y: number) => void;
  fillStyle?: string | CanvasGradient;
  readonly createRadialGradient?: (
    startX: number,
    startY: number,
    startRadius: number,
    endX: number,
    endY: number,
    endRadius: number,
  ) => CanvasGradient;
  readonly ellipse?: (
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
  ) => void;
  lineWidth?: number;
  readonly setLineDash?: (segments: readonly number[]) => void;
  readonly fillRect?: (
    destinationX: number,
    destinationY: number,
    destinationWidth: number,
    destinationHeight: number,
  ) => void;
  readonly strokeRect?: (
    destinationX: number,
    destinationY: number,
    destinationWidth: number,
    destinationHeight: number,
  ) => void;
  readonly drawImage: (
    source: unknown,
    destinationX: number,
    destinationY: number,
    destinationWidth: number,
    destinationHeight: number,
  ) => void;
  /** `drawImage` with a source rectangle, for a sprite that slides behind a window. */
  readonly drawImageRegion: (
    source: unknown,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    destinationX: number,
    destinationY: number,
    destinationWidth: number,
    destinationHeight: number,
  ) => void;
} & Partial<Omit<WireCanvas, 'save' | 'restore' | 'lineWidth' | 'fillStyle'>>;

/** A context able to draw wires: every optional path and text operation is there. */
const canDrawWires = (context: BoardCanvasContext): context is BoardCanvasContext & WireCanvas =>
  context.lineWidth !== undefined &&
  context.globalAlpha !== undefined &&
  typeof context.beginPath === 'function' &&
  typeof context.moveTo === 'function' &&
  typeof context.lineTo === 'function' &&
  typeof context.arc === 'function' &&
  typeof context.stroke === 'function' &&
  typeof context.fill === 'function' &&
  typeof context.fillText === 'function';

type BoardDestination = Readonly<{
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}>;

export type BoardPose = Readonly<{
  readonly position: BoardPoint;
  readonly rotation: number;
}>;

/**
 * Pose of each placement's moving body while a simulation runs, keyed by
 * placement id: the ball, the seesaw's board. Absent, a body rests at its
 * placement.
 */
type BoardBodyPoses = ReadonlyMap<string, BoardPose>;

export type BoardConveyorBelt = Readonly<{
  /** Signed distance the belt has travelled, in world units. */
  readonly offset: number;
  /** Which way the chevrons point: the belt's last direction of travel. */
  readonly facing: -1 | 1;
}>;

/** The drawn-only state of a device with no moving body of its own. */
export type BoardDeviceView =
  | Readonly<{ readonly kind: 'button'; readonly pressed: boolean }>
  | Readonly<{ readonly kind: 'fan'; readonly bladeAngle: number }>
  | Readonly<{ readonly kind: 'electro-magnet'; readonly active: boolean }>
  | Readonly<{ readonly kind: 'barrier'; readonly retraction: number }>
  | Readonly<{ readonly kind: 'springboard'; readonly compression: number }>;

/** What a running simulation adds to the document when it is drawn. */
export type BoardSimulationView = Readonly<{
  readonly bodyPoses: BoardBodyPoses;
  readonly conveyorBelts: ReadonlyMap<string, BoardConveyorBelt>;
  readonly devices: ReadonlyMap<string, BoardDeviceView>;
}>;

/** One sprite layer of a placement, as it is drawn. */
type ProjectedLayer = Readonly<{
  readonly position: BoardPoint;
  readonly rotation: number;
  /** Sprite bounds in world units, relative to the layer's position and rotation. */
  readonly destination: BoardDestination;
  /** Part of the sprite to draw, in sprite pixels; the whole sprite when absent. */
  readonly source?: BoardDestination;
  /** Mirrored across the layer's vertical axis, after `rotation`: a fan blowing left. */
  readonly mirrored?: boolean;
  /** Squashed horizontally, then turned by `angle` within that squash: a fan's blades. */
  readonly spin?: Readonly<{ readonly angle: number; readonly squash: number }>;
}>;

/**
 * How an object is drawn: `solid` for every placed object, `ghost-valid` and
 * `ghost-invalid` for the placement a gesture is projecting (C1, U1).
 */
type BoardAppearance = 'solid' | 'ghost-valid' | 'ghost-invalid';

/** The placement to draw as a ghost, and whether its position can be committed. */
export type BoardGhost = Readonly<{
  readonly ghostPlacementId: string;
  readonly isGhostValid: boolean;
}>;

export type ProjectedBoardObject = Readonly<{
  readonly id: string;
  readonly family: SpriteFamily;
  readonly assetKey: SpriteAsset;
  readonly assetPath: string;
  /** Placement pose, which selection and hit-testing follow. */
  readonly position: BoardPoint;
  readonly rotation: number;
  /** Document order, retained for deterministic presentation interactions. */
  readonly placementOrder: number;
  /** Permission projected for presentation-only affordances. */
  readonly rotatable: boolean;
  /** Whole-object footprint in world units, relative to `position`, for selection and framing. */
  readonly destination: BoardDestination;
  readonly layer: ProjectedLayer;
  /** Presentation only: a ghost is the placement being projected, never a document state. */
  readonly appearance: BoardAppearance;
}>;

type BoardProjection = Readonly<{
  readonly scene: BoardZone;
  readonly objects: readonly ProjectedBoardObject[];
  /** Derived segments of the control wires (ADR 0009), drawn under the objects. */
  readonly wires: readonly ProjectedWire[];
  /** While a simulation runs, wires almost vanish so they do not clutter the machine. */
  readonly wiresDimmed: boolean;
  /** U22: workshop objects the player will have to place, outlined with dashes while building. */
  readonly toPlaceIds: readonly string[];
  /** Ephemeral selection state; it is never part of `LevelDocument`. */
  readonly selectedPlacementId?: string;
  /** Build zones to highlight while the player constructs; view state, like the selection. */
  readonly buildZones?: readonly BoardZone[];
}>;

export type BoardZone = Readonly<{ readonly min: BoardPoint; readonly max: BoardPoint }>;

type Placement = LevelDocument['objects'][number];

/**
 * How a layer follows its placement: `placement` never moves (the seesaw's
 * fulcrum), `body` follows the simulated body, and `upright-body` follows its
 * position only, so shading and highlights keep facing the light while the
 * ball rolls.
 */
type LayerPoseSource = 'placement' | 'body' | 'upright-body';

const layerPoseSources: Record<SpriteAsset, LayerPoseSource> = {
  'ball-base': 'upright-body',
  'ball-spin': 'body',
  'ball-highlight': 'upright-body',
  'second-ball-base': 'upright-body',
  'second-ball-spin': 'body',
  'second-ball-highlight': 'upright-body',
  'basket-back': 'body',
  'basket-front': 'body',
  'beam-short': 'body',
  'beam-medium': 'body',
  'beam-long': 'body',
  'seesaw-fulcrum': 'placement',
  'seesaw-beam': 'body',
  'mass-10kg': 'body',
  'box-wood': 'body',
  'box-metal': 'body',
  'electro-magnet-off': 'body',
  'electro-magnet-on': 'body',
  'piston-rod': 'body',
  'piston-housing': 'placement',
  'piston-plate': 'body',
  'lever-base': 'placement',
  'lever-handle': 'body',
  'conveyor-belt': 'placement',
  'conveyor-belt-left': 'placement',
  'conveyor-frame': 'placement',
  'button-base': 'placement',
  'button-cap': 'placement',
  'fan-blades': 'placement',
  'fan-body': 'placement',
  'barrier-bar': 'placement',
  'barrier-pillar': 'placement',
  'springboard-spring': 'placement',
  'springboard-base': 'placement',
  'springboard-platform': 'placement',
};

/**
 * The conveyor's belt shows through the frame's window (measured on the art
 * by `art/build-sprites.py`). Its sprite is the window plus one period of
 * chevrons, so scrolling is only a matter of sliding the source rectangle.
 */
const CONVEYOR_BELT_WINDOW: BoardDestination = {
  x: -0.9614,
  y: -0.1306,
  width: 1.9243,
  height: 0.2007,
};
const CONVEYOR_BELT_PERIOD = 0.6006;
const CONVEYOR_BELT_SPRITE = { windowWidth: 247, period: 77, height: 26 } as const;

const conveyorBeltSource = (offset: number): BoardDestination => {
  // A belt moving right carries its pattern right, so the window slides left.
  const phase = ((-offset % CONVEYOR_BELT_PERIOD) + CONVEYOR_BELT_PERIOD) % CONVEYOR_BELT_PERIOD;
  return {
    x: (phase / CONVEYOR_BELT_PERIOD) * CONVEYOR_BELT_SPRITE.period,
    y: 0,
    width: CONVEYOR_BELT_SPRITE.windowWidth,
    height: CONVEYOR_BELT_SPRITE.height,
  };
};

const conveyorBeltAt = (
  object: Placement,
  view: BoardSimulationView | undefined,
): BoardConveyorBelt =>
  view?.conveyorBelts.get(object.id) ?? {
    offset: 0,
    facing: object.type === 'conveyor' && object.props.direction === 'left' ? -1 : 1,
  };

const GOAL_BALL_LAYERS = ['ball-base', 'ball-spin', 'ball-highlight'] as const;
const OTHER_BALL_LAYERS = [
  'second-ball-base',
  'second-ball-spin',
  'second-ball-highlight',
] as const;

const BEAM_LAYERS = {
  short: 'beam-short',
  medium: 'beam-medium',
  long: 'beam-long',
} as const;

/**
 * The layers an object shows now. Both belts are loaded, one is drawn; both
 * balls are loaded, and only the goal's ball is red; the three beam lengths
 * are loaded, and a beam shows the drawing of its own length.
 */
const layerAssetsFor = (
  object: Placement,
  goalBallId: string,
  view: BoardSimulationView | undefined,
): readonly SpriteAsset[] => {
  if (object.type === 'ball') {
    return object.id === goalBallId ? GOAL_BALL_LAYERS : OTHER_BALL_LAYERS;
  }
  if (object.type === 'electro-magnet') {
    const device = deviceAt(object, view);
    const active = device?.kind === 'electro-magnet' ? device.active : object.props.state === 'on';
    return [active ? 'electro-magnet-on' : 'electro-magnet-off'];
  }
  if (object.type === 'box') return [object.props.material === 'wood' ? 'box-wood' : 'box-metal'];
  if (object.type === 'beam') return [BEAM_LAYERS[object.props.size]];
  if (object.type !== 'conveyor') return spriteAssetsForFamily(object.type);
  const belt = conveyorBeltAt(object, view).facing === -1 ? 'conveyor-belt-left' : 'conveyor-belt';
  return [belt, 'conveyor-frame'];
};

/** Whole-object footprint (ADR 0007), shared with the colliders through `family-geometry`. */
const footprintForObject = (object: Placement): BoardDestination => {
  switch (object.type) {
    case 'ball':
      return ballGeometry.footprint;
    case 'basket':
      return basketGeometry.footprint;
    case 'beam':
      return beamGeometry.footprints[object.props.size];
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
      return leverFootprint(object.props.position);
    case 'conveyor':
      return conveyorGeometry.footprint;
    case 'button':
      return buttonGeometry.footprint;
    case 'fan':
      return fanGeometry.body.footprint;
    case 'barrier':
      return barrierFootprint(object.props.state);
    case 'springboard':
      return springboardGeometry.footprint;
  }
};

/** Layers that do not fill the whole footprint; every other layer does. */
const partialLayerDestinations: Partial<Record<SpriteAsset, BoardDestination>> = {
  'seesaw-fulcrum': seesawGeometry.fulcrum.footprint,
  'seesaw-beam': seesawGeometry.board.footprint,
  'lever-base': leverGeometry.base.footprint,
  'lever-handle': leverGeometry.handle.footprint,
  'conveyor-belt': CONVEYOR_BELT_WINDOW,
  'conveyor-belt-left': CONVEYOR_BELT_WINDOW,
  'button-base': buttonGeometry.base.footprint,
  'button-cap': buttonGeometry.cap.footprint,
  'fan-blades': fanGeometry.blades.footprint,
  'fan-body': fanGeometry.body.footprint,
  'barrier-pillar': barrierGeometry.pillar.footprint,
  'springboard-spring': springboardGeometry.spring.footprint,
  'springboard-base': springboardGeometry.base.footprint,
  'springboard-platform': springboardGeometry.platform.footprint,
  'piston-rod': pistonGeometry.rod.footprint,
  'piston-housing': pistonGeometry.housing.footprint,
  'piston-plate': pistonGeometry.plate.footprint,
};

/** The bar's sprite, in pixels: the renderer shows only the part out of the pillar. */
const BARRIER_BAR_SPRITE = { width: 160, height: 36 } as const;
const BARRIER_BAR_TRAVEL = barrierGeometry.bar.length - barrierGeometry.pillar.barrelHalfWidth;

const deviceAt = (object: Placement, view: BoardSimulationView | undefined) =>
  view?.devices.get(object.id);

/**
 * The bar runs from the pillar's axis to its tip on its side. Sliding in,
 * it passes behind the pillar: only its tip end is drawn, never a stub out
 * of the pillar's other side.
 */
const barrierBarLayer = (
  object: Placement & { readonly type: 'barrier' },
  view: BoardSimulationView | undefined,
): Pick<ProjectedLayer, 'destination' | 'source'> => {
  const device = deviceAt(object, view);
  const retraction =
    device?.kind === 'barrier' ? device.retraction : object.props.state === 'open' ? 1 : 0;
  const { length, thickness, centerY } = barrierGeometry.bar;
  const tip = length - retraction * BARRIER_BAR_TRAVEL;
  // Drawn to the right; a half-turned barrier is mirrored as a whole.
  const destination = {
    x: 0,
    y: centerY - thickness / 2,
    width: tip,
    height: thickness,
  };
  if (tip >= length) return { destination };

  const shown = (tip / length) * BARRIER_BAR_SPRITE.width;
  return {
    destination,
    source: {
      x: BARRIER_BAR_SPRITE.width - shown,
      y: 0,
      width: shown,
      height: BARRIER_BAR_SPRITE.height,
    },
  };
};

/** A fan's layers: turned a quarter to blow up or down, mirrored to blow left, blades spinning. */
const fanLayer = (
  object: Placement & { readonly type: 'fan' },
  asset: SpriteAsset,
  view: BoardSimulationView | undefined,
  destination: BoardDestination,
): ProjectedLayer => {
  const { angle: rotation, mirrored } = facingPose(object.transform.rotation);
  const { position } = object.transform;
  if (asset !== 'fan-blades') {
    return { position: { x: position.x, y: position.y }, rotation, destination, mirrored };
  }

  const { center, squash } = fanGeometry.blades;
  const local = { x: mirrored ? -center.x : center.x, y: center.y };
  const device = deviceAt(object, view);
  return {
    position: {
      x: position.x + local.x * Math.cos(rotation) - local.y * Math.sin(rotation),
      y: position.y + local.x * Math.sin(rotation) + local.y * Math.cos(rotation),
    },
    rotation,
    destination,
    mirrored,
    spin: { angle: device?.kind === 'fan' ? device.bladeAngle : 0, squash },
  };
};

/** How far a pressed cap or a landing platform sinks, in world units. */
const sinkOf = (object: Placement, view: BoardSimulationView | undefined): number => {
  const device = deviceAt(object, view);
  if (device?.kind === 'button') return device.pressed ? buttonGeometry.cap.travel : 0;
  if (device?.kind === 'springboard') {
    return device.compression * springboardGeometry.platform.maxCompression;
  }
  return 0;
};

/** Sinks the cap and the platform, and squashes the spring under the platform. */
const sunkDestination = (
  asset: SpriteAsset,
  destination: BoardDestination,
  sink: number,
): BoardDestination => {
  if (sink === 0) return destination;
  if (asset === 'button-cap' || asset === 'springboard-platform') {
    return { ...destination, y: destination.y + sink };
  }
  if (asset === 'springboard-spring') {
    return { ...destination, y: destination.y + sink, height: destination.height - sink };
  }
  return destination;
};

const layerDestination = (object: Placement, asset: SpriteAsset): BoardDestination =>
  partialLayerDestinations[asset] ?? footprintForObject(object);

/** Where a moving body rests before the simulation: a lever's handle leans to its start. */
const restingBodyRotation = (object: Placement): number =>
  object.transform.rotation + (object.type === 'lever' ? leverAngle(object.props.position) : 0);

/** The piston plate starts at the end of its fixed housing, already retracted. */
const restingBodyPosition = (object: Placement): BoardPoint => {
  const { position } = object.transform;
  if (object.type !== 'piston') return { x: position.x, y: position.y };
  const rotation = object.transform.rotation;
  return {
    x:
      position.x +
      pistonGeometry.homeOffset.x * Math.cos(rotation) -
      pistonGeometry.homeOffset.y * Math.sin(rotation),
    y:
      position.y +
      pistonGeometry.homeOffset.x * Math.sin(rotation) +
      pistonGeometry.homeOffset.y * Math.cos(rotation),
  };
};

const projectLayer = (
  object: Placement,
  asset: SpriteAsset,
  view: BoardSimulationView | undefined,
): ProjectedLayer => {
  const placementPose = {
    position: { x: object.transform.position.x, y: object.transform.position.y },
    rotation: object.transform.rotation,
  };
  const body = view?.bodyPoses.get(object.id) ?? {
    position: restingBodyPosition(object),
    rotation: restingBodyRotation(object),
  };
  const source = layerPoseSources[asset];
  const pose =
    source === 'placement'
      ? placementPose
      : source === 'body'
        ? body
        : { position: body.position, rotation: 0 };

  const projected = {
    position: { x: pose.position.x, y: pose.position.y },
    rotation: pose.rotation,
    destination: sunkDestination(asset, layerDestination(object, asset), sinkOf(object, view)),
  };
  if (object.type === 'fan') return fanLayer(object, asset, view, projected.destination);
  if (object.type === 'barrier') {
    const { angle, mirrored } = facingPose(object.transform.rotation);
    const turned = { ...projected, rotation: angle, mirrored };
    return asset === 'barrier-bar' ? { ...turned, ...barrierBarLayer(object, view) } : turned;
  }
  return asset === 'conveyor-belt' || asset === 'conveyor-belt-left'
    ? { ...projected, source: conveyorBeltSource(conveyorBeltAt(object, view).offset) }
    : projected;
};

/**
 * Presentation-only draw order (B4/ADR 0007): higher draws later, i.e. on
 * top. The basket is split into a rear layer and a front lip so a ball can be
 * visibly nested inside it. Ranking visual assets explicitly keeps the rule
 * exhaustive: adding a fifth family or layer forces a decision here instead
 * of silently inheriting document order. This never touches `document.objects`
 * or `LevelDocument`; the domain stays unaware that a draw order exists.
 */
const drawOrderByAsset: Record<SpriteAsset, number> = {
  'basket-back': 0,
  'beam-short': 0,
  'beam-medium': 0,
  'beam-long': 0,
  'seesaw-fulcrum': 0,
  'seesaw-beam': 0,
  'mass-10kg': 0,
  'box-wood': 0,
  'box-metal': 0,
  'electro-magnet-off': 0,
  'electro-magnet-on': 0,
  'piston-rod': 0,
  'piston-housing': 1,
  'piston-plate': 2,
  'lever-base': 0,
  'lever-handle': 0,
  'conveyor-belt': 0,
  'conveyor-belt-left': 0,
  'conveyor-frame': 0,
  'button-base': 0,
  'button-cap': 0,
  'fan-blades': 0,
  'fan-body': 0,
  'barrier-bar': 0,
  'barrier-pillar': 0,
  'springboard-spring': 0,
  'springboard-base': 0,
  'springboard-platform': 0,
  'ball-base': 1,
  'ball-spin': 1,
  'ball-highlight': 1,
  'second-ball-base': 1,
  'second-ball-spin': 1,
  'second-ball-highlight': 1,
  'basket-front': 2,
};

const byDrawOrderThenDocumentOrder = (
  a: {
    readonly assetKey: SpriteAsset;
    readonly documentIndex: number;
    readonly layerIndex: number;
  },
  b: {
    readonly assetKey: SpriteAsset;
    readonly documentIndex: number;
    readonly layerIndex: number;
  },
): number => {
  const orderDelta = drawOrderByAsset[a.assetKey] - drawOrderByAsset[b.assetKey];
  if (orderDelta !== 0) return orderDelta;

  const documentDelta = a.documentIndex - b.documentIndex;
  return documentDelta !== 0 ? documentDelta : a.layerIndex - b.layerIndex;
};

/**
 * The author may turn any object whose family turns, whatever its saved
 * permissions say (those bind the player): the projection used for the
 * creation mode's handle and hit tests.
 */
export const withAuthorRotation = (
  objects: readonly ProjectedBoardObject[],
): readonly ProjectedBoardObject[] =>
  objects.map((object) =>
    rotationMode(object.family) === 'fixed' ? object : { ...object, rotatable: true },
  );

/**
 * Build zones worth highlighting: none when one zone covers the whole scene,
 * since placement is then unconstrained and a tint over the board says nothing.
 */
export const constrainingBuildZones = (document: LevelDocument): readonly BoardZone[] =>
  isPlacementUnconstrained(document) ? [] : document.buildZones;

const appearanceOf = (id: string, ghost: BoardGhost | undefined): BoardAppearance => {
  if (ghost?.ghostPlacementId !== id) return 'solid';
  return ghost.isGhostValid ? 'ghost-valid' : 'ghost-invalid';
};

/**
 * Projects a document on the board. `simulation` is given while a
 * simulation runs: moving bodies, belts and wires then follow it, while the
 * document itself is never rewritten. `ghost` names the placement a gesture
 * is projecting, drawn translucent (C1).
 */
export const projectLevel = (
  document: LevelDocument,
  simulation?: BoardSimulationView,
  ghost?: BoardGhost,
): BoardProjection => {
  const objects = document.objects
    .flatMap((object, documentIndex) =>
      layerAssetsFor(object, document.goal.ballId, simulation).map((assetKey, layerIndex) => ({
        documentIndex,
        layerIndex,
        projected: {
          id: object.id,
          family: object.type,
          assetKey,
          assetPath: spriteAssetPath(assetKey, 2),
          position: {
            x: object.transform.position.x,
            y: object.transform.position.y,
          },
          rotation: object.transform.rotation,
          placementOrder: documentIndex,
          rotatable: object.permissions.rotate,
          destination: footprintForObject(object),
          layer: projectLayer(object, assetKey, simulation),
          appearance: appearanceOf(object.id, ghost),
        },
      })),
    )
    .sort((a, b) =>
      byDrawOrderThenDocumentOrder(
        {
          assetKey: a.projected.assetKey,
          documentIndex: a.documentIndex,
          layerIndex: a.layerIndex,
        },
        {
          assetKey: b.projected.assetKey,
          documentIndex: b.documentIndex,
          layerIndex: b.layerIndex,
        },
      ),
    )
    .map(({ projected }) => projected);

  return {
    scene: document.scene,
    objects,
    wires: projectWires(document),
    wiresDimmed: simulation !== undefined,
    // The outline follows the placement pose: a running machine moves away from it.
    toPlaceIds:
      simulation === undefined
        ? document.objects.filter(({ toPlace }) => toPlace === true).map(({ id }) => id)
        : [],
  };
};

export const worldToPixels = (position: BoardPoint, viewport: BoardViewport): BoardPoint => ({
  x: (position.x - viewport.origin.x) * viewport.pixelsPerWorldUnit,
  y: (position.y - viewport.origin.y) * viewport.pixelsPerWorldUnit,
});

const worldLengthToPixels = (length: number, viewport: BoardViewport): number =>
  length * viewport.pixelsPerWorldUnit;

const destinationToPixels = (
  destination: BoardDestination,
  viewport: BoardViewport,
): BoardDestination => ({
  x: worldLengthToPixels(destination.x, viewport),
  y: worldLengthToPixels(destination.y, viewport),
  width: worldLengthToPixels(destination.width, viewport),
  height: worldLengthToPixels(destination.height, viewport),
});

type BoardRenderer = Readonly<{
  readonly render: (projection: BoardProjection) => Promise<void>;
}>;

type BoardRendererOptions = Readonly<{
  readonly canvas: BoardCanvas;
  readonly context: BoardCanvasContext;
  readonly viewport: BoardViewport;
  readonly spriteLoader: SpriteLoader;
  /** U3 was abandoned by the author: kept for experiments, disabled in the app (ADR 0006). */
  readonly objectShadows?: boolean;
}>;

const requiredFamilies = (projection: BoardProjection): readonly SpriteFamily[] => [
  ...new Set(projection.objects.map((object) => object.family)),
];

const SELECTION_LINE_WIDTH_CSS_PIXELS = 2;
const ROTATION_HANDLE_COLOUR = '#1e88e5';
const ROTATION_HANDLE_FILL = '#ffffff';
const ROTATION_HANDLE_ARROW_WIDTH_CSS_PIXELS = 2.5;
const ZONE_FILL = 'rgba(30, 136, 229, 0.1)';
const ZONE_OUTLINE = 'rgba(30, 136, 229, 0.65)';
const ZONE_DASH_CSS_PIXELS = [8, 6];
const INVALID_OUTLINE = '#e53935';
/** Neither the goal's red nor the build zones' blue (U19, U13). */
const TO_PLACE_OUTLINE = '#6a1b9a';
const TO_PLACE_DASH_CSS_PIXELS = [6, 4];
/** C1: a ghost shows the object it will become, see-through; a refused one fades further. */
const GHOST_ALPHA: Record<BoardAppearance, number> = {
  solid: 1,
  'ghost-valid': 0.55,
  'ghost-invalid': 0.35,
};
/** The selection and rotation handle's blue: a valid ghost is outlined like a selection. */
const GHOST_VALID_OUTLINE = '#1e88e5';
const GHOST_INVALID_DASH_CSS_PIXELS = [6, 4];

/** V2b: one plain parchment over the whole viewport; nothing marks where the scene ends. */
const BOARD_PAPER_COLOUR = '#f6ead3';
const GRID_LINE_WIDTH_CSS_PIXELS = 1;
const GRID_FULL_OPACITY_ZOOM = 64;
/** C2/U3: a soft ellipse under the whole object, never baked into its sprite. */
const OBJECT_SHADOW_OFFSET = 0.08;
const OBJECT_SHADOW_WIDTH_RATIO = 0.9;
const OBJECT_SHADOW_HEIGHT_RATIO = 0.35;
const OBJECT_SHADOW_ALPHA = 0.18;

const drawObjectShadow = (
  context: BoardCanvasContext,
  object: ProjectedBoardObject,
  viewport: BoardViewport,
): void => {
  if (
    object.appearance === 'ghost-invalid' ||
    context.createRadialGradient === undefined ||
    context.ellipse === undefined ||
    context.beginPath === undefined ||
    context.fill === undefined
  ) {
    return;
  }

  // The first layer follows the body or the articulated object's fixed base.
  // A fan starts with its offset blades; its shadow belongs to the whole fan.
  const position = object.family === 'fan' ? object.position : object.layer.position;
  const { rotation, mirrored } = object.layer;
  const { x, y, width, height } = object.destination;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const centreX = (x + width / 2) * (mirrored === true ? -1 : 1);
  const centreY = y + height / 2;
  const projectedWidth = Math.abs(cos) * width + Math.abs(sin) * height;
  const projectedHeight = Math.abs(sin) * width + Math.abs(cos) * height;
  const centre = worldToPixels(
    {
      x: position.x + centreX * cos - centreY * sin,
      y: position.y + centreX * sin + centreY * cos + projectedHeight / 2 + OBJECT_SHADOW_OFFSET,
    },
    viewport,
  );

  context.save();
  context.globalAlpha = OBJECT_SHADOW_ALPHA;
  context.translate(centre.x, centre.y);
  context.scale(
    worldLengthToPixels((projectedWidth * OBJECT_SHADOW_WIDTH_RATIO) / 2, viewport),
    worldLengthToPixels((projectedHeight * OBJECT_SHADOW_HEIGHT_RATIO) / 2, viewport),
  );
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, '#30291f');
  gradient.addColorStop(1, 'rgba(48, 41, 31, 0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(0, 0, 1, 1, 0, 0, 2 * Math.PI);
  context.fill();
  context.restore();
};

const drawPaper = (context: BoardCanvasContext, viewport: BoardViewport): void => {
  context.save();
  context.fillStyle = BOARD_PAPER_COLOUR;
  context.fillRect?.(0, 0, viewport.cssWidth, viewport.cssHeight);
  context.restore();
};

/**
 * One metre per line over the whole viewport (V2b), so the world reads the same
 * inside and outside the scene; strokes are in CSS pixels, and only the visible
 * lines are visited.
 */
const drawWorldGrid = (context: BoardCanvasContext, viewport: BoardViewport): void => {
  if (!canDrawWires(context)) return;
  const zoom = viewport.pixelsPerWorldUnit;
  const maxX = viewport.origin.x + viewport.cssWidth / zoom;
  const maxY = viewport.origin.y + viewport.cssHeight / zoom;
  context.save();
  context.lineWidth = GRID_LINE_WIDTH_CSS_PIXELS;
  context.strokeStyle = `rgba(78, 68, 51, ${String(0.16 * Math.min(1, zoom / GRID_FULL_OPACITY_ZOOM))})`;
  context.beginPath();
  for (let x = Math.ceil(viewport.origin.x); x < maxX; x += 1) {
    const pixelX = worldToPixels({ x, y: 0 }, viewport).x;
    context.moveTo(pixelX, 0);
    context.lineTo(pixelX, viewport.cssHeight);
  }
  for (let y = Math.ceil(viewport.origin.y); y < maxY; y += 1) {
    const pixelY = worldToPixels({ x: 0, y }, viewport).y;
    context.moveTo(0, pixelY);
    context.lineTo(viewport.cssWidth, pixelY);
  }
  context.stroke();
  context.restore();
};

const drawBuildZones = (
  context: BoardCanvasContext,
  zones: readonly BoardZone[],
  viewport: BoardViewport,
): void => {
  if (context.fillRect === undefined) return;

  context.save();
  context.fillStyle = ZONE_FILL;
  context.strokeStyle = ZONE_OUTLINE;
  if (context.lineWidth !== undefined) context.lineWidth = SELECTION_LINE_WIDTH_CSS_PIXELS;
  context.setLineDash?.(ZONE_DASH_CSS_PIXELS);
  for (const zone of zones) {
    const topLeft = worldToPixels(zone.min, viewport);
    const bottomRight = worldToPixels(zone.max, viewport);
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;
    context.fillRect(topLeft.x, topLeft.y, width, height);
    context.strokeRect?.(topLeft.x, topLeft.y, width, height);
  }
  context.restore();
};

/**
 * A point `distance` CSS pixels above the object's top edge, in its own
 * frame: it turns with the object, so the handle never jumps while turning.
 */
const pointAboveObject = (
  object: ProjectedBoardObject,
  viewport: BoardViewport,
  distance: number,
): BoardPoint => {
  const center = worldToPixels(object.position, viewport);
  const offset = -destinationToPixels(object.destination, viewport).y + distance;
  return {
    x: center.x + offset * Math.sin(object.rotation),
    y: center.y - offset * Math.cos(object.rotation),
  };
};

/** The knob's centre, a stem above the object's top edge, in CSS pixels. */
const rotationHandleCenter = (object: ProjectedBoardObject, viewport: BoardViewport): BoardPoint =>
  pointAboveObject(
    object,
    viewport,
    ROTATION_HANDLE_GAP_CSS_PIXELS + ROTATION_HANDLE_KNOB_RADIUS_CSS_PIXELS,
  );

export const rotationHandleBounds = (
  object: ProjectedBoardObject,
  viewport: BoardViewport,
): BoardDestination => {
  const center = rotationHandleCenter(object, viewport);

  return {
    x: center.x - ROTATION_HANDLE_SIZE_CSS_PIXELS / 2,
    y: center.y - ROTATION_HANDLE_SIZE_CSS_PIXELS / 2,
    width: ROTATION_HANDLE_SIZE_CSS_PIXELS,
    height: ROTATION_HANDLE_SIZE_CSS_PIXELS,
  };
};

const selectedObject = (projection: BoardProjection): ProjectedBoardObject | undefined => {
  if (projection.selectedPlacementId === undefined) return undefined;

  return projection.objects.find((object) => object.id === projection.selectedPlacementId);
};

const drawFootprintOutline = (
  context: BoardCanvasContext,
  object: ProjectedBoardObject,
  viewport: BoardViewport,
  colour?: string,
): void => {
  if (context.strokeRect === undefined) return;

  const position = worldToPixels(object.position, viewport);
  const destination = destinationToPixels(object.destination, viewport);

  context.save();
  context.translate(position.x, position.y);
  context.rotate(object.rotation);
  if (context.lineWidth !== undefined) {
    context.lineWidth = SELECTION_LINE_WIDTH_CSS_PIXELS;
  }
  if (colour !== undefined) context.strokeStyle = colour;
  context.strokeRect(destination.x, destination.y, destination.width, destination.height);
  context.restore();
};

/** U22: a dashed footprint around each object the player will have to place. */
const drawToPlaceOutlines = (
  context: BoardCanvasContext,
  projection: BoardProjection,
  viewport: BoardViewport,
): void => {
  if (context.setLineDash === undefined) return;
  for (const id of projection.toPlaceIds) {
    const object = projection.objects.find((candidate) => candidate.id === id);
    if (object === undefined) continue;
    context.save();
    context.setLineDash(TO_PLACE_DASH_CSS_PIXELS);
    drawFootprintOutline(context, object, viewport, TO_PLACE_OUTLINE);
    context.restore();
  }
};

/**
 * The rotation handle: a white knob carrying a turning arrow, joined to the
 * object's top edge by a short stem, so it reads as « tourner » at a glance.
 * Knob and stem turn with the object; the arrow inside stays upright.
 */
const drawRotationHandle = (
  context: BoardCanvasContext & WireCanvas,
  object: ProjectedBoardObject,
  viewport: BoardViewport,
): void => {
  const knob = rotationHandleCenter(object, viewport);
  const radius = ROTATION_HANDLE_KNOB_RADIUS_CSS_PIXELS;
  const stemStart = pointAboveObject(object, viewport, 0);
  const stemEnd = pointAboveObject(object, viewport, ROTATION_HANDLE_GAP_CSS_PIXELS);

  context.save();
  context.lineCap = 'round';
  context.strokeStyle = ROTATION_HANDLE_COLOUR;
  context.lineWidth = SELECTION_LINE_WIDTH_CSS_PIXELS;
  context.beginPath();
  context.moveTo(stemStart.x, stemStart.y);
  context.lineTo(stemEnd.x, stemEnd.y);
  context.stroke();

  context.fillStyle = ROTATION_HANDLE_FILL;
  context.beginPath();
  context.arc(knob.x, knob.y, radius, 0, 2 * Math.PI);
  context.fill();
  context.stroke();

  // A three-quarter turn ending in an arrowhead, clockwise.
  const arrowRadius = radius * 0.5;
  const start = -0.8 * Math.PI;
  const end = 0.45 * Math.PI;
  context.lineWidth = ROTATION_HANDLE_ARROW_WIDTH_CSS_PIXELS;
  context.beginPath();
  context.arc(knob.x, knob.y, arrowRadius, start, end);
  context.stroke();
  const tip = {
    x: knob.x + arrowRadius * Math.cos(end),
    y: knob.y + arrowRadius * Math.sin(end),
  };
  const head = radius * 0.32;
  // The tangent at `end`, clockwise, points along (−sin, cos).
  const along = { x: -Math.sin(end), y: Math.cos(end) };
  const across = { x: Math.cos(end), y: Math.sin(end) };
  context.fillStyle = ROTATION_HANDLE_COLOUR;
  context.beginPath();
  context.moveTo(tip.x + along.x * head, tip.y + along.y * head);
  context.lineTo(tip.x - across.x * head, tip.y - across.y * head);
  context.lineTo(tip.x + across.x * head, tip.y + across.y * head);
  context.fill();
  context.restore();
};

const drawSelection = (
  context: BoardCanvasContext,
  object: ProjectedBoardObject,
  viewport: BoardViewport,
): void => {
  if (context.strokeRect === undefined) return;

  // A ghost (U13: a refused move or turn) is framed by its own outline only.
  // A ball's name and properties identify its selection without boxing its sprite.
  if (object.appearance === 'solid' && object.family !== 'ball') {
    drawFootprintOutline(context, object, viewport, ROTATION_HANDLE_COLOUR);
  }

  if (!object.rotatable || !canDrawWires(context)) return;
  drawRotationHandle(context, object, viewport);
};

/**
 * C1: the ghost's footprint, outlined in CSS pixels so the stroke keeps its
 * width at any zoom; solid when the position is valid, dashed in the warning
 * colour when it is refused, so the two states differ by more than colour.
 */
const drawGhostOutline = (
  context: BoardCanvasContext,
  projection: BoardProjection,
  viewport: BoardViewport,
): void => {
  const ghost = projection.objects.find(({ appearance }) => appearance !== 'solid');
  if (ghost === undefined) return;

  context.save();
  if (ghost.appearance === 'ghost-invalid') {
    context.setLineDash?.(GHOST_INVALID_DASH_CSS_PIXELS);
    drawFootprintOutline(context, ghost, viewport, INVALID_OUTLINE);
  } else {
    drawFootprintOutline(context, ghost, viewport, GHOST_VALID_OUTLINE);
  }
  context.restore();
};

export const createBoardRenderer = ({
  canvas,
  context,
  viewport,
  spriteLoader,
  objectShadows = false,
}: BoardRendererOptions): BoardRenderer => ({
  render: async (projection): Promise<void> => {
    await spriteLoader.loadForFamilies(requiredFamilies(projection));

    canvas.width = Math.round(viewport.cssWidth * viewport.devicePixelRatio);
    canvas.height = Math.round(viewport.cssHeight * viewport.devicePixelRatio);
    context.setTransform(viewport.devicePixelRatio, 0, 0, viewport.devicePixelRatio, 0, 0);

    drawPaper(context, viewport);
    drawWorldGrid(context, viewport);

    if (projection.buildZones !== undefined) {
      drawBuildZones(context, projection.buildZones, viewport);
    }

    const wireContext = canDrawWires(context) ? context : undefined;
    const toScreen = (point: BoardPoint): BoardPoint => worldToPixels(point, viewport);
    const wireOptions = {
      dimmed: projection.wiresDimmed,
      focusId: projection.selectedPlacementId,
    };
    if (wireContext !== undefined) {
      drawWires(wireContext, projection.wires, toScreen, wireOptions);
    }

    if (objectShadows) {
      const shadowedIds = new Set<string>();
      for (const object of projection.objects) {
        if (shadowedIds.has(object.id)) continue;
        shadowedIds.add(object.id);
        drawObjectShadow(context, object, viewport);
      }
    }

    for (const object of projection.objects) {
      const sprite = spriteLoader.getSprite(object.assetKey);
      if (sprite === undefined) {
        throw new Error(`Le sprite « ${object.assetKey} » n’est pas disponible après chargement.`);
      }

      const position = worldToPixels(object.layer.position, viewport);
      const { x, y, width, height } = destinationToPixels(object.layer.destination, viewport);

      context.save();
      if (object.appearance !== 'solid') context.globalAlpha = GHOST_ALPHA[object.appearance];
      context.translate(position.x, position.y);
      context.rotate(object.layer.rotation);
      if (object.layer.mirrored === true) context.scale(-1, 1);
      const { spin } = object.layer;
      if (spin !== undefined) {
        context.scale(spin.squash, 1);
        context.rotate(spin.angle);
      }
      const image = sprite.source;
      const region = object.layer.source;
      if (region === undefined) {
        context.drawImage(image, x, y, width, height);
      } else {
        context.drawImageRegion(
          image,
          region.x,
          region.y,
          region.width,
          region.height,
          x,
          y,
          width,
          height,
        );
      }
      context.restore();
    }

    if (wireContext !== undefined) {
      drawWireLabels(wireContext, projection.wires, toScreen, wireOptions);
    }

    drawToPlaceOutlines(context, projection, viewport);

    const selection = selectedObject(projection);
    if (selection !== undefined) {
      drawSelection(context, selection, viewport);
    }

    drawGhostOutline(context, projection, viewport);
  },
});
