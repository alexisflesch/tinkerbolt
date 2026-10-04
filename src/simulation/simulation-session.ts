import {
  Box,
  Circle,
  Polygon,
  RevoluteJoint,
  Vec2,
  World,
  type Body,
  type Contact,
  type Fixture,
  type FixtureDef,
  type Joint,
  type Vec2Value,
} from 'planck';

import {
  ballGeometry,
  boxGeometry,
  electroMagnetGeometry,
  barrierGeometry,
  basketGeometry,
  beamGeometry,
  buttonGeometry,
  conveyorGeometry,
  fanGeometry,
  leverAngle,
  leverGeometry,
  massGeometry,
  facingPose,
  pistonGeometry,
  seesawGeometry,
  springboardGeometry,
  type LeverPosition,
  type WorldPolygon,
  type WorldRect,
} from '../domain/family-geometry';
import type { LevelDocument } from '../domain/level-document';
import {
  advanceAttemptFailureEvaluation,
  applyAttemptFailureFacts,
  createAttemptFailureEvaluation,
  resetAttemptFailureEvaluation,
  type AttemptFailureEvaluation,
  type AttemptFailureRule,
  type BallPositionFact,
} from '../domain/attempt-failure-evaluator';
import {
  advanceBasketGoalEvaluation,
  applyBasketGoalFacts,
  createBasketGoalEvaluation,
  resetBasketGoalEvaluation,
  type BasketGoalEvaluation,
  type BasketGoalRule,
} from '../domain/basket-goal-evaluator';

interface SimulationVector {
  readonly x: number;
  readonly y: number;
}

type SimulationBodyRole = 'primary' | 'base' | 'board' | 'handle' | 'piston';
type SimulationBodyType = 'static' | 'kinematic' | 'dynamic';

export interface SimulationBodyState {
  readonly placementId: string;
  readonly role: SimulationBodyRole;
  readonly bodyType: SimulationBodyType;
  readonly position: SimulationVector;
  readonly rotation: number;
  readonly linearVelocity: SimulationVector;
  readonly angularVelocity: number;
}

interface SimulationJointState {
  readonly placementId: string;
  readonly type: 'revolute';
  readonly bodyARole: 'base';
  readonly bodyBRole: 'board' | 'handle';
  readonly anchor: SimulationVector;
}

type ConveyorDirection = -1 | 0 | 1;
type ControllerSignal =
  | { readonly kind: 'lever'; readonly position: LeverPosition }
  | { readonly kind: 'button'; readonly pressed: boolean };

interface DelayedSignal {
  readonly dueStep: number;
  readonly signal: ControllerSignal;
}

/**
 * ADR 0009: the observable state of controllers and devices after a step.
 * A lever's position is read from its handle's angle; a conveyor's
 * direction comes from its lever if wired, from its own property otherwise.
 */
type SimulationDeviceState =
  | {
      readonly placementId: string;
      readonly kind: 'lever';
      readonly position: LeverPosition;
    }
  | {
      readonly placementId: string;
      readonly kind: 'conveyor';
      readonly direction: ConveyorDirection;
      /** Last non-zero direction, so a stopped belt keeps facing where it went. */
      readonly facing: -1 | 1;
      /** Signed distance travelled by the belt since the start, in world units. */
      readonly beltOffset: number;
    }
  | {
      readonly placementId: string;
      readonly kind: 'button';
      readonly pressed: boolean;
    }
  | {
      readonly placementId: string;
      readonly kind: 'electro-magnet';
      readonly active: boolean;
    }
  | {
      readonly placementId: string;
      readonly kind: 'fan';
      readonly running: boolean;
      /** Angle the blades have turned since the start, in radians; drawn only. */
      readonly bladeAngle: number;
    }
  | {
      readonly placementId: string;
      readonly kind: 'barrier';
      /** 0 with the bar fully out, 1 with it fully slid into the pillar. */
      readonly retraction: number;
    }
  | {
      readonly placementId: string;
      readonly kind: 'springboard';
      /** 0 at rest, 1 fully squashed by a landing; drawn only. */
      readonly compression: number;
    }
  | {
      readonly placementId: string;
      readonly kind: 'piston';
      /** 0 retracted, 1 fully extended. */
      readonly extension: number;
    }
  | {
      readonly placementId: string;
      readonly kind: 'timer';
      readonly delaySeconds: number;
      /** Time remaining before the next delayed signal change, or null when idle. */
      readonly remainingSeconds: number | null;
      /** The hand turns at one revolution per second while a change is queued. */
      readonly handAngle: number;
    };

interface SimulationSensorEventFields {
  readonly placementId: string;
  readonly targetId: string;
  readonly fixedStep: number;
  readonly order: number;
}

export interface SimulationSensorEntryEvent extends SimulationSensorEventFields {
  readonly type: 'object-entered-sensor';
}

interface SimulationSensorExitEvent extends SimulationSensorEventFields {
  readonly type: 'object-left-sensor';
}

export type SimulationSensorEvent = SimulationSensorEntryEvent | SimulationSensorExitEvent;

export interface SimulationSnapshot {
  readonly fixedStep: number;
  readonly fixedStepSeconds: number;
  readonly bodies: readonly SimulationBodyState[];
  readonly joints: readonly SimulationJointState[];
  readonly events: readonly SimulationSensorEvent[];
  readonly devices: readonly SimulationDeviceState[];
}

interface SimulationResources {
  readonly bodies: number;
  readonly colliders: number;
  readonly joints: number;
  readonly sensors: number;
}

interface SimulationSessionOptions {
  readonly fixedStepSeconds: number;
  /** Budget of one attempt, in simulated seconds. Defaults to `DEFAULT_ATTEMPT_TIMEOUT_SECONDS`. */
  readonly attemptTimeoutSeconds?: number;
}

export interface SimulationSession {
  readState(): SimulationSnapshot;
  readResources(): SimulationResources;
  readGoalEvaluation(): BasketGoalEvaluation;
  readFailureEvaluation(): AttemptFailureEvaluation;
  advanceFixedSteps(count: number): void;
  advanceElapsedSeconds(elapsedSeconds: number): number;
  reset(): void;
  destroy(): boolean;
}

interface BodyRecord {
  readonly placementId: string;
  readonly role: SimulationBodyRole;
  readonly handle: Body;
}

interface RevoluteJointRecord {
  readonly placementId: string;
  readonly handle: Joint;
  readonly moving: 'board' | 'handle';
}

/** The one joint operation a lever's notches need. */
interface LeverJoint {
  readonly setMotorSpeed: (speed: number) => void;
}

interface LeverRecord {
  readonly placementId: string;
  readonly base: Body;
  readonly handle: Body;
  readonly joint: LeverJoint;
}

interface ConveyorRecord {
  readonly placementId: string;
  readonly body: Body;
  readonly ownDirection: ConveyorDirection;
  readonly leverId: string | undefined;
  direction: ConveyorDirection;
  facing: -1 | 1;
  beltOffset: number;
}

interface ButtonRecord {
  readonly placementId: string;
  readonly body: Body;
  /** Dynamic fixtures overlapping the sensor above the cap. */
  contacts: number;
  /** Whether the cap's collider currently stands sunk. */
  sunk: boolean;
  cap: Fixture;
}

interface ElectroMagnetRecord {
  readonly ownActive: boolean;
  readonly placementId: string;
  readonly body: Body;
  readonly sourceId: string | undefined;
  active: boolean;
}

interface FanRecord {
  readonly placementId: string;
  readonly body: Body;
  /** Centre of the ring's mouth, in world units. */
  readonly mouth: SimulationVector;
  /** Unit vector the air flows along. */
  readonly axis: SimulationVector;
  readonly ownRunning: boolean;
  readonly sourceId: string | undefined;
  running: boolean;
  spin: number;
  bladeAngle: number;
}

interface BarrierRecord {
  readonly placementId: string;
  readonly body: Body;
  /** +1 when the bar closes to the right of the pillar, -1 when mirrored to the left. */
  readonly side: -1 | 1;
  readonly ownOpen: boolean;
  readonly sourceId: string | undefined;
  open: boolean;
  retraction: number;
  bar: Fixture | null;
}

interface SpringboardRecord {
  readonly placementId: string;
  compression: number;
}

interface PistonRecord {
  readonly placementId: string;
  readonly body: Body;
  readonly sourceId: string | undefined;
  readonly homePosition: Vec2Value;
  readonly axis: Vec2Value;
  buttonPressed: boolean;
  phase: 'retracted' | 'extending' | 'extended' | 'retracting';
  extension: number;
}

interface TimerRecord {
  readonly placementId: string;
  readonly delaySeconds: number;
  readonly delaySteps: number;
  readonly sourceId: string | undefined;
  observedSignal: ControllerSignal | undefined;
  outputSignal: ControllerSignal | undefined;
  readonly pending: DelayedSignal[];
}

interface SensorRecord {
  readonly targetId: string;
}

/* ADR 0007 - Repère du monde : `y` croît vers le bas, comme à l'écran. Tout
 * offset de collider se lit donc « vers le bas quand il est positif ». Une
 * géométrie écrite en `y` vers le haut est un bug, et se corrige ici, jamais
 * par une rotation compensatoire dans le contenu. */

const GRAVITY = 9.81;
const BALL_RADIUS = ballGeometry.radius;
const BEAM_HALF_THICKNESS = beamGeometry.thickness / 2;
/** Half of the frozen 1,5 × 1,1 basket footprint (ADR 0007), walls included. */
const BASKET_HALF_WIDTH = basketGeometry.footprint.width / 2;
const BASKET_WALL_HALF_HEIGHT = basketGeometry.footprint.height / 2;
const BASKET_SENSOR_HALF_HEIGHT = 0.5;
const BASKET_WALL_HALF_THICKNESS = 0.08;
/**
 * Walls and floor are inset by their own half thickness so that their outer
 * faces land exactly on the frozen footprint: the sprite drawn by the board
 * renderer and the collider then cover the same rectangle, with no per-asset
 * correction factor.
 */
const BASKET_WALL_OFFSET_X = BASKET_HALF_WIDTH - BASKET_WALL_HALF_THICKNESS;
const BASKET_FLOOR_OFFSET_Y = BASKET_WALL_HALF_HEIGHT - BASKET_WALL_HALF_THICKNESS;
/** The fulcrum stands under the pivot, which is where the board is hinged. */
const SEESAW_FULCRUM_VERTICES = seesawGeometry.fulcrum.polygon.map(({ x, y }) => new Vec2(x, y));
const SEESAW_ANGLE_LIMIT = Math.PI / 6;
/**
 * Box2D has friction but no rolling resistance: a ball rolling without
 * slipping keeps its energy forever, and on a belt friction mostly spins it
 * in place. A resisting torque of `coefficient × m × g × r`, applied while
 * the ball touches something, lets it come to rest and be carried along.
 * The coefficient is a game value, higher than a real ball on wood, so that
 * stops are readable on a small screen.
 */
const ROLLING_RESISTANCE_COEFFICIENT = 0.1;

/** The printed weight is the physical mass, in kilograms (the ball weighs about 0,28). */
const MASS_KILOGRAMS = { '10kg': 10 } as const;
const MASS_VERTICES = massGeometry.polygon.map(({ x, y }) => new Vec2(x, y));

type ObjectPlacement = LevelDocument['objects'][number];

/** What a placement is, ids aside: two placements with the same key are the same piece. */
const machineKey = ({ type, transform, props }: ObjectPlacement): readonly (string | number)[] => [
  type,
  transform.position.x,
  transform.position.y,
  transform.rotation,
  JSON.stringify(Object.entries(props).sort(([a], [b]) => a.localeCompare(b))),
];

const compareKeys = (
  left: readonly (string | number)[],
  right: readonly (string | number)[],
): number => {
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === b) continue;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a) < String(b) ? -1 : 1;
  }
  return 0;
};

/**
 * Bodies are created in an order fixed by the machine itself, never by the
 * document's order or ids: Box2D solves contacts in creation order, so a
 * player laying the same pieces in another order, or an exported puzzle that
 * renames them, would otherwise see the same machine end differently.
 */
const inMachineOrder = (objects: readonly ObjectPlacement[]): readonly ObjectPlacement[] =>
  [...objects].sort((left, right) => compareKeys(machineKey(left), machineKey(right)));

/** Drops the 1e-17 residues of cos(π/2), so a vertical fan blows exactly as before. */
const withoutResidue = (value: number): number => (Math.abs(value) < 1e-12 ? 0 : value);

const polygonArea = (polygon: WorldPolygon): number =>
  Math.abs(
    polygon.reduce((sum, point, index) => {
      const next = polygon[(index + 1) % polygon.length] ?? point;
      return sum + point.x * next.y - next.x * point.y;
    }, 0),
  ) / 2;

const MASS_AREA = polygonArea(massGeometry.polygon);

const LEVER_BASE_VERTICES = leverGeometry.base.polygon.map(({ x, y }) => new Vec2(x, y));
/**
 * The lever has three notches. A torque-limited motor pulls the handle to
 * the notch it is closest to: enough to hold it upright against gravity
 * (under 0,3 N·m this close to vertical), far too little to resist a ball.
 * The side notches rest against the joint's limits.
 */
const LEVER_NOTCH_TORQUE = 0.35;
/** Motor speed per radian away from the notch, in s⁻¹. */
const LEVER_NOTCH_STIFFNESS = 12;
/** Past this angle either side of upright, the lever reads as left or right. */
const LEVER_SWITCH_ANGLE = leverGeometry.tilt / 2;
const CONVEYOR_SPEED = 1.5;
const TIMER_HAND_SPEED = 2 * Math.PI;

const shortestAngleDifference = (angle: number, reference: number): number =>
  Math.atan2(Math.sin(angle - reference), Math.cos(angle - reference));
const conveyorDirections = { left: -1, stopped: 0, right: 1 } as const;

const MASS_RING = new Circle(
  new Vec2(massGeometry.ring.center.x, massGeometry.ring.center.y),
  massGeometry.ring.radius,
);
const MASS_RING_AREA = Math.PI * massGeometry.ring.radius ** 2;

const BUTTON_BASE_VERTICES = buttonGeometry.base.polygon.map(({ x, y }) => new Vec2(x, y));
/** How far above the cap an object still counts as pressing it. */
const BUTTON_SENSOR_REACH = 0.05;

/**
 * Air blows along the fan's axis from its mouth, in a cone that widens by
 * `FAN_SPREAD` per unit and fades linearly to nothing at `FAN_RANGE`. The
 * push is proportional to the width a body shows the air, not to its mass:
 * at the mouth it holds a ball well above its weight, and barely nudges ten
 * kilograms. Game values, tuned for readability.
 */
const FAN_RANGE = 3;
const FAN_SPREAD = Math.tan(Math.PI / 12);
const FAN_PRESSURE = 9;
/** Blade speed at full run, a turn every quarter second, and how fast it is reached. */
const FAN_BLADE_SPEED = 8 * Math.PI;
const FAN_BLADE_ACCELERATION = 20 * Math.PI;

/** The bar slides at this speed, in world units per second. */
const BARRIER_SPEED = 2.5;
const BARRIER_TRAVEL = barrierGeometry.bar.length - barrierGeometry.pillar.barrelHalfWidth;
/** Under this length out of the barrel, the bar has no collider any more. */
const BARRIER_MIN_BAR = 0.02;

const SPRINGBOARD_BASE_VERTICES = springboardGeometry.base.polygon.map(
  ({ x, y }) => new Vec2(x, y),
);
/**
 * The platform gives back all the speed an object lands with. Box2D keeps
 * the larger restitution of a pair, and ignores it under 1 m/s, so whatever
 * rests on the platform stays at rest.
 */
const SPRINGBOARD_RESTITUTION = 1;
/** Landing speed that squashes the spring fully, and how fast it relaxes, per second. */
const SPRINGBOARD_FULL_SQUASH_SPEED = 8;
const SPRINGBOARD_RELAX_RATE = 5;

/** A short, forceful stroke that can launch a ball across the visible scene. */
const PISTON_SPEED = 18;

/** A box fixture covering a footprint given relative to the body's origin. */
const rectBox = ({ x, y, width, height }: WorldRect) =>
  new Box(width / 2, height / 2, new Vec2(x + width / 2, y + height / 2), 0);

/** The cap's collider, raised or sunk by the cap's travel. */
const buttonCapShape = (sunk: boolean) =>
  rectBox({
    ...buttonGeometry.cap.body,
    y: buttonGeometry.cap.body.y + (sunk ? buttonGeometry.cap.travel : 0),
  });

/** A polygon mirrored across the local vertical axis; Box2D rebuilds its hull, winding aside. */
const mirroredVertices = (polygon: WorldPolygon, mirrored: boolean) =>
  polygon.map(({ x, y }) => new Vec2(mirrored ? -x : x, y));

const leverPositionFromAngle = (angle: number): LeverPosition =>
  angle <= -LEVER_SWITCH_ANGLE ? 'left' : angle >= LEVER_SWITCH_ANGLE ? 'right' : 'center';
/**
 * Global game rule: the target ball must remain in its basket for thirty
 * complete fixed steps, half a second at 60 Hz. A ball merely crossing the
 * sensor must not win.
 */
const BASKET_GOAL_HOLD_DURATION_IN_FIXED_STEPS = 30;
/**
 * Global game rule (B2, plan-remise-en-jeu.md § 4): the attempt is lost as
 * soon as the target ball's centre leaves the level's scene rectangle widened
 * by this margin on every side. The world has no implicit walls — a level that
 * wants a floor lays a static beam — so this is what ends a fall into nothing.
 */
const OUT_OF_SCENE_MARGIN_IN_WORLD_UNITS = 2;
/**
 * Global game rule (B2): an attempt that neither wins nor leaves the scene is
 * given twenty simulated seconds. Converted to fixed steps below, because the
 * domain evaluator counts steps and never seconds.
 */
const DEFAULT_ATTEMPT_TIMEOUT_SECONDS = 20;

const createPhysicsWorld = () =>
  // Sleeping is what stops a settled ball from vibrating forever.
  new World({ gravity: new Vec2(0, GRAVITY), allowSleep: true });

const assertPositiveFinite = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} doit être un nombre fini strictement positif.`);
  }
};

const assertNonNegativeFinite = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} doit être un nombre fini positif ou nul.`);
  }
};

const assertNonNegativeSafeInteger = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} doit être un entier sûr positif ou nul.`);
  }
};

const assertPositiveSafeInteger = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} doit être un entier sûr strictement positif.`);
  }
};

const bodyType = (body: Body): SimulationBodyType => {
  if (body.isStatic()) return 'static';
  if (body.isKinematic()) return 'kinematic';
  if (body.isDynamic()) return 'dynamic';
  throw new Error('Type de corps physique non exposable.');
};

class PlanckSimulationSession implements SimulationSession {
  readonly #level: LevelDocument;
  readonly #fixedStepSeconds: number;
  readonly #goalRule: BasketGoalRule;
  readonly #failureRule: AttemptFailureRule;

  #world: ReturnType<typeof createPhysicsWorld> | null = null;
  #bodies: BodyRecord[] = [];
  #colliders = new Set<Fixture>();
  #joints: RevoluteJointRecord[] = [];
  #balls: Body[] = [];
  #levers: LeverRecord[] = [];
  #conveyors: ConveyorRecord[] = [];
  #conveyorFixtures = new Map<Fixture, ConveyorRecord>();
  #buttons: ButtonRecord[] = [];
  #buttonSensors = new Map<Fixture, ButtonRecord>();
  #fans: FanRecord[] = [];
  #electroMagnets: ElectroMagnetRecord[] = [];
  #metalBoxes: Body[] = [];
  #barriers: BarrierRecord[] = [];
  #springboards: SpringboardRecord[] = [];
  #springboardPlatforms = new Map<Fixture, SpringboardRecord>();
  #pistons: PistonRecord[] = [];
  #timers: TimerRecord[] = [];
  #sensors = new Map<Fixture, SensorRecord>();
  #activeSensorContacts = new Map<string, number>();
  #events: SimulationSensorEvent[] = [];
  #goalEvaluation = createBasketGoalEvaluation();
  #failureEvaluation = createAttemptFailureEvaluation();
  #fixedStep = 0;
  #accumulatedSeconds = 0;
  #destroyed = false;

  readonly #onBeginContact = (contact: Contact): void => {
    this.#updateSensorContact(contact, 1);
    this.#updateButtonContact(contact, 1);
    this.#squashSpringboard(contact);
  };

  readonly #onEndContact = (contact: Contact): void => {
    this.#updateSensorContact(contact, -1);
    this.#updateButtonContact(contact, -1);
  };

  /**
   * A running belt is a surface speed: Box2D's tangent speed drives what
   * touches it without moving the static frame. The solver aims the
   * velocity of B relative to A, along the tangent (normal.y, -normal.x), at
   * that speed; only the belt's horizontal component is kept, so the frame's
   * ends and underside do not drive anything.
   */
  readonly #onPreSolve = (contact: Contact): void => {
    const onA = this.#conveyorFixtures.get(contact.getFixtureA());
    const conveyor = onA ?? this.#conveyorFixtures.get(contact.getFixtureB());
    if (conveyor === undefined || conveyor.direction === 0) return;

    const normal = contact.getWorldManifold(null)?.normal;
    if (normal === undefined) return;
    const belt = conveyor.direction * CONVEYOR_SPEED;
    contact.setTangentSpeed((onA === undefined ? -1 : 1) * belt * normal.y);
  };

  constructor(level: LevelDocument, fixedStepSeconds: number, attemptTimeoutSeconds: number) {
    this.#level = structuredClone(level);
    this.#fixedStepSeconds = fixedStepSeconds;
    this.#goalRule = {
      ballId: this.#level.goal.ballId,
      basketId: this.#level.goal.basketId,
      holdDurationInFixedSteps: BASKET_GOAL_HOLD_DURATION_IN_FIXED_STEPS,
    };
    // The budget crosses into the domain as a step count: seconds stop here.
    const timeoutInFixedSteps = Math.round(attemptTimeoutSeconds / fixedStepSeconds);
    assertPositiveSafeInteger(timeoutInFixedSteps, 'La limite de temps en pas fixes');
    this.#failureRule = {
      ballId: this.#level.goal.ballId,
      scene: this.#level.scene,
      outOfSceneMarginInWorldUnits: OUT_OF_SCENE_MARGIN_IN_WORLD_UNITS,
      timeoutInFixedSteps,
    };
    this.#buildWorld();
  }

  readState(): SimulationSnapshot {
    return {
      fixedStep: this.#fixedStep,
      fixedStepSeconds: this.#fixedStepSeconds,
      bodies: this.#bodies.map(({ placementId, role, handle }) => {
        const position = handle.getPosition();
        const velocity = handle.getLinearVelocity();
        return {
          placementId,
          role,
          bodyType: bodyType(handle),
          position: { x: position.x, y: position.y },
          rotation: handle.getAngle(),
          linearVelocity: { x: velocity.x, y: velocity.y },
          angularVelocity: handle.getAngularVelocity(),
        };
      }),
      joints: this.#joints.map(({ placementId, handle, moving }) => {
        const anchor = handle.getAnchorA();
        return {
          placementId,
          type: 'revolute',
          bodyARole: 'base',
          bodyBRole: moving,
          anchor: { x: anchor.x, y: anchor.y },
        };
      }),
      events: this.#events.map((event) => ({ ...event })),
      devices: [
        ...this.#levers.map(
          (lever): SimulationDeviceState => ({
            placementId: lever.placementId,
            kind: 'lever',
            position: this.#leverPosition(lever),
          }),
        ),
        ...this.#conveyors.map(
          ({ placementId, direction, facing, beltOffset }): SimulationDeviceState => ({
            placementId,
            kind: 'conveyor',
            direction,
            facing,
            beltOffset,
          }),
        ),
        ...this.#buttons.map(
          ({ placementId, contacts }): SimulationDeviceState => ({
            placementId,
            kind: 'button',
            pressed: contacts > 0,
          }),
        ),
        ...this.#electroMagnets.map(
          ({ placementId, active }): SimulationDeviceState => ({
            placementId,
            kind: 'electro-magnet',
            active,
          }),
        ),
        ...this.#fans.map(
          ({ placementId, running, bladeAngle }): SimulationDeviceState => ({
            placementId,
            kind: 'fan',
            running,
            bladeAngle,
          }),
        ),
        ...this.#barriers.map(
          ({ placementId, retraction }): SimulationDeviceState => ({
            placementId,
            kind: 'barrier',
            retraction,
          }),
        ),
        ...this.#springboards.map(
          ({ placementId, compression }): SimulationDeviceState => ({
            placementId,
            kind: 'springboard',
            compression,
          }),
        ),
        ...this.#pistons.map(
          ({ placementId, extension }): SimulationDeviceState => ({
            placementId,
            kind: 'piston',
            extension,
          }),
        ),
        ...this.#timers.map(({ placementId, delaySeconds, pending }): SimulationDeviceState => {
          const next = pending[0];
          const remainingSeconds =
            next === undefined
              ? null
              : Math.max(0, next.dueStep - this.#fixedStep) * this.#fixedStepSeconds;
          const elapsedSeconds = remainingSeconds === null ? 0 : delaySeconds - remainingSeconds;
          return {
            placementId,
            kind: 'timer',
            delaySeconds,
            remainingSeconds,
            handAngle:
              remainingSeconds === null
                ? 0
                : (((elapsedSeconds * TIMER_HAND_SPEED) % TIMER_HAND_SPEED) + TIMER_HAND_SPEED) %
                  TIMER_HAND_SPEED,
          };
        }),
      ],
    };
  }

  readResources(): SimulationResources {
    const world = this.#world;
    if (world === null) {
      return { bodies: 0, colliders: 0, joints: 0, sensors: 0 };
    }

    let colliders = 0;
    let sensors = 0;
    for (let body = world.getBodyList(); body !== null; body = body.getNext()) {
      for (let fixture = body.getFixtureList(); fixture !== null; fixture = fixture.getNext()) {
        colliders += 1;
        if (fixture.isSensor()) sensors += 1;
      }
    }

    return {
      bodies: world.getBodyCount(),
      colliders,
      joints: world.getJointCount(),
      sensors,
    };
  }

  readGoalEvaluation(): BasketGoalEvaluation {
    return { ...this.#goalEvaluation };
  }

  readFailureEvaluation(): AttemptFailureEvaluation {
    return { ...this.#failureEvaluation };
  }

  advanceFixedSteps(count: number): void {
    assertNonNegativeSafeInteger(count, 'Le nombre de pas fixes');
    if (this.#destroyed || count === 0) return;
    assertNonNegativeSafeInteger(this.#fixedStep + count, 'Le numéro de pas fixe résultant');

    for (let index = 0; index < count; index += 1) {
      this.#step();
    }
  }

  advanceElapsedSeconds(elapsedSeconds: number): number {
    assertNonNegativeFinite(elapsedSeconds, 'La durée écoulée');
    if (this.#destroyed || elapsedSeconds === 0) return 0;

    this.#accumulatedSeconds += elapsedSeconds;
    if (!Number.isFinite(this.#accumulatedSeconds)) {
      throw new RangeError('La durée accumulée doit rester finie.');
    }

    const steps = Math.floor(
      (this.#accumulatedSeconds + Number.EPSILON * this.#fixedStepSeconds) / this.#fixedStepSeconds,
    );
    assertNonNegativeSafeInteger(steps, 'Le nombre de pas fixes accumulés');
    this.advanceFixedSteps(steps);
    this.#accumulatedSeconds -= steps * this.#fixedStepSeconds;
    if (Math.abs(this.#accumulatedSeconds) < Number.EPSILON * this.#fixedStepSeconds) {
      this.#accumulatedSeconds = 0;
    }
    return steps;
  }

  reset(): void {
    if (this.#destroyed) return;
    this.#releaseWorld();
    this.#fixedStep = 0;
    this.#accumulatedSeconds = 0;
    this.#events = [];
    this.#goalEvaluation = resetBasketGoalEvaluation();
    this.#failureEvaluation = resetAttemptFailureEvaluation();
    this.#buildWorld();
  }

  destroy(): boolean {
    if (this.#destroyed) return false;
    this.#releaseWorld();
    this.#destroyed = true;
    this.#events = [];
    return true;
  }

  #buildWorld(): void {
    const world = createPhysicsWorld();
    this.#world = world;
    world.on('begin-contact', this.#onBeginContact);
    world.on('end-contact', this.#onEndContact);
    world.on('pre-solve', this.#onPreSolve);

    for (const placement of inMachineOrder(this.#level.objects)) {
      switch (placement.type) {
        case 'ball':
          this.#createBall(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
          );
          break;
        case 'basket':
          this.#createBasket(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
          );
          break;
        case 'beam':
          this.#createBeam(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
            placement.props.size,
          );
          break;
        case 'seesaw':
          this.#createSeesaw(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
          );
          break;
        case 'box':
          this.#createBox(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
            placement.props.material,
          );
          break;
        case 'mass':
          this.#createMass(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
            MASS_KILOGRAMS[placement.props.weight],
          );
          break;
        case 'lever':
          this.#createLever(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
            placement.props.position,
          );
          break;
        case 'conveyor':
          this.#createConveyor(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
            conveyorDirections[placement.props.direction],
          );
          break;
        case 'button':
          this.#createButton(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
          );
          break;
        case 'electro-magnet':
          this.#createElectroMagnet(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
            placement.props.state === 'on',
          );
          break;
        case 'fan':
          this.#createFan(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
            placement.props.state === 'on',
          );
          break;
        case 'barrier':
          this.#createBarrier(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
            placement.props.state === 'open',
          );
          break;
        case 'springboard':
          this.#createSpringboard(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
          );
          break;
        case 'piston':
          this.#createPiston(
            placement.id,
            placement.transform.position,
            placement.transform.rotation,
          );
          break;
        case 'timer':
          this.#createTimer(placement.id, placement.props.delaySeconds);
          break;
      }
    }
    this.#commandDevices();
    // A barrier starts where the level puts it, without sliding there.
    for (const barrier of this.#barriers) {
      barrier.retraction = barrier.open ? 1 : 0;
      this.#shapeBarrierBar(barrier);
    }
  }

  /** Brakes each ball's spin while it rests on a surface, never past a standstill. */
  #applyRollingResistance(): void {
    for (const ball of this.#balls) {
      const spin = ball.getAngularVelocity();
      if (spin === 0 || !this.#isTouchingSomething(ball)) continue;

      const available = ROLLING_RESISTANCE_COEFFICIENT * ball.getMass() * GRAVITY * BALL_RADIUS;
      const stopping = (ball.getInertia() * Math.abs(spin)) / this.#fixedStepSeconds;
      ball.applyTorque(-Math.sign(spin) * Math.min(available, stopping), false);
    }
  }

  #isTouchingSomething(body: Body): boolean {
    for (let edge = body.getContactList(); edge !== null; edge = edge.next ?? null) {
      if (
        edge.contact.isTouching() &&
        !edge.contact.getFixtureA().isSensor() &&
        !edge.contact.getFixtureB().isSensor()
      ) {
        return true;
      }
    }
    return false;
  }

  #createBall(placementId: string, position: SimulationVector, rotation: number): void {
    const body = this.#requireWorld().createBody({
      type: 'dynamic',
      position: new Vec2(position.x, position.y),
      angle: rotation,
      // The ball is the only fast body of the game: continuous collision keeps
      // it from tunnelling through a 0,25 unit beam or a 0,24 unit seesaw board.
      bullet: true,
      allowSleep: true,
    });
    this.#bodies.push({ placementId, role: 'primary', handle: body });
    this.#balls.push(body);
    this.#createFixture(body, {
      shape: new Circle(BALL_RADIUS),
      density: 1,
      friction: 0.35,
      restitution: 0.25,
    });
  }

  #createBasket(placementId: string, position: SimulationVector, rotation: number): void {
    const body = this.#requireWorld().createBody({
      type: 'static',
      position: new Vec2(position.x, position.y),
      angle: rotation,
    });
    this.#bodies.push({ placementId, role: 'primary', handle: body });

    // Floor at the bottom, walls rising on both sides, mouth open upwards:
    // in a `y`-down world the floor offset is positive.
    this.#createFixture(body, {
      shape: new Box(
        BASKET_HALF_WIDTH,
        BASKET_WALL_HALF_THICKNESS,
        new Vec2(0, BASKET_FLOOR_OFFSET_Y),
        0,
      ),
      friction: 0.4,
    });
    this.#createFixture(body, {
      shape: new Box(
        BASKET_WALL_HALF_THICKNESS,
        BASKET_WALL_HALF_HEIGHT,
        new Vec2(-BASKET_WALL_OFFSET_X, 0),
        0,
      ),
      friction: 0.4,
    });
    this.#createFixture(body, {
      shape: new Box(
        BASKET_WALL_HALF_THICKNESS,
        BASKET_WALL_HALF_HEIGHT,
        new Vec2(BASKET_WALL_OFFSET_X, 0),
        0,
      ),
      friction: 0.4,
    });
    const sensor = this.#createFixture(body, {
      shape: new Box(BASKET_HALF_WIDTH, BASKET_SENSOR_HALF_HEIGHT),
      isSensor: true,
    });
    this.#sensors.set(sensor, { targetId: placementId });
  }

  #createBeam(
    placementId: string,
    position: SimulationVector,
    rotation: number,
    size: keyof typeof beamGeometry.footprints,
  ): void {
    const body = this.#requireWorld().createBody({
      type: 'static',
      position: new Vec2(position.x, position.y),
      angle: rotation,
    });
    this.#bodies.push({ placementId, role: 'primary', handle: body });
    this.#createFixture(body, {
      shape: new Box(beamGeometry.footprints[size].width / 2, BEAM_HALF_THICKNESS),
      friction: 0.45,
    });
  }

  #createBox(
    placementId: string,
    position: SimulationVector,
    rotation: number,
    material: 'wood' | 'metal',
  ): void {
    const body = this.#requireWorld().createBody({
      type: 'dynamic',
      position: new Vec2(position.x, position.y),
      angle: rotation,
      allowSleep: true,
    });
    this.#bodies.push({ placementId, role: 'primary', handle: body });
    const { width, height } = boxGeometry.footprint;
    // Gameplay masses, balanced independently of the source illustrations.
    if (material === 'metal') this.#metalBoxes.push(body);
    const kilograms = material === 'wood' ? 1 : 3;
    this.#createFixture(body, {
      shape: new Box(width / 2, height / 2),
      density: kilograms / (width * height),
      friction: 0.6,
      restitution: 0.05,
    });
  }

  #createMass(
    placementId: string,
    position: SimulationVector,
    rotation: number,
    kilograms: number,
  ): void {
    const body = this.#requireWorld().createBody({
      type: 'dynamic',
      position: new Vec2(position.x, position.y),
      angle: rotation,
      allowSleep: true,
    });
    this.#bodies.push({ placementId, role: 'primary', handle: body });
    // Box2D sums each fixture's area: the overlap of ring and body is counted
    // twice, which is what makes the total exactly the printed weight.
    const density = kilograms / (MASS_AREA + MASS_RING_AREA);
    this.#createFixture(body, {
      shape: new Polygon(MASS_VERTICES),
      density,
      friction: 0.6,
      restitution: 0.05,
    });
    this.#createFixture(body, { shape: MASS_RING, density, friction: 0.6, restitution: 0.05 });
  }

  #createLever(
    placementId: string,
    position: SimulationVector,
    rotation: number,
    startPosition: LeverPosition,
  ): void {
    const world = this.#requireWorld();
    const pivot = new Vec2(position.x, position.y);
    const base = world.createBody({ type: 'static', position: pivot, angle: rotation });
    // The handle's origin is the pivot too, so its angle is the lever's
    // reading. It starts on its notch.
    const startAngle = leverAngle(startPosition);
    const handle = world.createBody({
      type: 'dynamic',
      position: pivot,
      angle: rotation + startAngle,
      allowSleep: true,
    });
    this.#bodies.push(
      { placementId, role: 'base', handle: base },
      { placementId, role: 'handle', handle },
    );
    this.#createFixture(base, { shape: new Polygon(LEVER_BASE_VERTICES), friction: 0.5 });

    const { stickHalfWidth, knobCenterY, knobRadius } = leverGeometry.handle;
    this.#createFixture(handle, {
      shape: new Box(stickHalfWidth, -knobCenterY / 2, new Vec2(0, knobCenterY / 2), 0),
      density: 1,
      friction: 0.4,
    });
    this.#createFixture(handle, {
      shape: new Circle(new Vec2(0, knobCenterY), knobRadius),
      density: 1,
      friction: 0.4,
    });

    const joint = world.createJoint(
      new RevoluteJoint({
        enableLimit: true,
        lowerAngle: -leverGeometry.tilt,
        upperAngle: leverGeometry.tilt,
        enableMotor: true,
        motorSpeed: 0,
        maxMotorTorque: LEVER_NOTCH_TORQUE,
        collideConnected: false,
        // Planck stores a body's starting angle within ±π: near a half turn,
        // base and handle may land a whole turn apart. The reference is taken
        // from the stored angles, so the limits still frame the vertical.
        referenceAngle: handle.getAngle() - base.getAngle() - startAngle,
        // Both bodies have their origin on the pivot.
        bodyA: base,
        bodyB: handle,
        localAnchorA: new Vec2(0, 0),
        localAnchorB: new Vec2(0, 0),
      }),
    );
    if (joint === null) {
      throw new Error(`Impossible de créer le pivot du levier « ${placementId} ».`);
    }
    this.#joints.push({ placementId, handle: joint, moving: 'handle' });
    this.#levers.push({ placementId, base, handle, joint });
  }

  #createConveyor(
    placementId: string,
    position: SimulationVector,
    rotation: number,
    ownDirection: ConveyorDirection,
  ): void {
    const body = this.#requireWorld().createBody({
      type: 'static',
      position: new Vec2(position.x, position.y),
      angle: rotation,
    });
    this.#bodies.push({ placementId, role: 'primary', handle: body });
    const { width, height } = conveyorGeometry.footprint;
    const fixture = this.#createFixture(body, {
      shape: new Box(width / 2, height / 2),
      friction: 0.8,
    });
    const record: ConveyorRecord = {
      placementId,
      body,
      ownDirection,
      leverId: this.#level.wires.find(({ targetId }) => targetId === placementId)?.sourceId,
      direction: ownDirection,
      facing: ownDirection === -1 ? -1 : 1,
      beltOffset: 0,
    };
    this.#conveyors.push(record);
    this.#conveyorFixtures.set(fixture, record);
  }

  #leverPosition({ base, handle }: LeverRecord): LeverPosition {
    return leverPositionFromAngle(shortestAngleDifference(handle.getAngle(), base.getAngle()));
  }

  /** Aims each lever's motor at its nearest notch before the step. */
  #pullLeversToNotches(): void {
    for (const lever of this.#levers) {
      const angle = shortestAngleDifference(lever.handle.getAngle(), lever.base.getAngle());
      const notch = leverAngle(leverPositionFromAngle(angle));
      lever.joint.setMotorSpeed((notch - angle) * LEVER_NOTCH_STIFFNESS);

      // Preserve the same notch torque when the whole lever is rotated. Gravity
      // acts on the handle in world coordinates; cancel only the difference
      // between that torque and the torque it would exert on an upright lever.
      const pivot = lever.base.getPosition();
      const centre = lever.handle.getWorldCenter();
      const rx = centre.x - pivot.x;
      const ry = centre.y - pivot.y;
      const baseAngle = lever.base.getAngle();
      const uprightX = rx * Math.cos(-baseAngle) - ry * Math.sin(-baseAngle);
      lever.handle.applyTorque(-(rx - uprightX) * lever.handle.getMass() * GRAVITY, true);
    }
  }

  #controllerSignal(sourceId: string): ControllerSignal | undefined {
    const lever = this.#levers.find(({ placementId }) => placementId === sourceId);
    if (lever !== undefined) return { kind: 'lever', position: this.#leverPosition(lever) };
    const button = this.#buttons.find(({ placementId }) => placementId === sourceId);
    return button === undefined ? undefined : { kind: 'button', pressed: button.contacts > 0 };
  }

  #signalForTarget(targetId: string): ControllerSignal | undefined {
    const wire = this.#level.wires.find(
      ({ targetId: wiredTargetId }) => wiredTargetId === targetId,
    );
    if (wire === undefined) return undefined;
    if (wire.timerId !== undefined) {
      return this.#timers.find(({ placementId }) => placementId === wire.timerId)?.outputSignal;
    }
    return this.#controllerSignal(wire.sourceId);
  }

  #signalIsActive(signal: ControllerSignal | undefined): boolean {
    return signal?.kind === 'button'
      ? signal.pressed
      : signal?.kind === 'lever' && signal.position !== 'center';
  }

  #commandTimers(): void {
    for (const timer of this.#timers) {
      if (timer.sourceId === undefined) continue;
      const signal = this.#controllerSignal(timer.sourceId);
      if (signal === undefined) continue;
      if (timer.observedSignal === undefined) {
        timer.observedSignal =
          signal.kind === 'lever'
            ? { kind: 'lever', position: 'center' }
            : { kind: 'button', pressed: false };
        timer.outputSignal = timer.observedSignal;
      }
      if (!this.#sameSignal(timer.observedSignal, signal)) {
        timer.observedSignal = signal;
        timer.pending.push({ dueStep: this.#fixedStep + timer.delaySteps, signal });
      }
      while (timer.pending[0] !== undefined && timer.pending[0].dueStep <= this.#fixedStep) {
        const due = timer.pending.shift();
        if (due !== undefined) timer.outputSignal = due.signal;
      }
    }
  }

  #sameSignal(left: ControllerSignal | undefined, right: ControllerSignal): boolean {
    if (left === undefined) return false;
    return left.kind === 'lever'
      ? right.kind === 'lever' && left.position === right.position
      : right.kind === 'button' && left.pressed === right.pressed;
  }

  /** Reads every controller and sets the state of the devices it commands. */
  #commandDevices(): void {
    this.#commandTimers();
    this.#commandConveyors();
    this.#commandPistons();
    for (const magnet of this.#electroMagnets) {
      const signal = this.#signalForTarget(magnet.placementId);
      const active = signal?.kind === 'button' && signal.pressed;
      magnet.active = magnet.ownActive !== active;
    }
    // A commanded device starts in its own state and switches to the other
    // while its controller is active (decision of 1st October 2026).
    for (const fan of this.#fans) {
      const active = this.#signalIsActive(this.#signalForTarget(fan.placementId));
      fan.running = fan.ownRunning !== active;
    }
    for (const barrier of this.#barriers) {
      const active = this.#signalIsActive(this.#signalForTarget(barrier.placementId));
      barrier.open = barrier.ownOpen !== active;
    }
  }

  /** A piston follows its button while pressed and retracts as soon as it is released. */
  #commandPistons(): void {
    for (const piston of this.#pistons) {
      const signal = this.#signalForTarget(piston.placementId);
      const pressed = signal?.kind === 'button' && signal.pressed;
      const risingEdge = pressed && !piston.buttonPressed;
      piston.buttonPressed = pressed;

      // A momentary press completes its outward stroke before auto-retracting.
      // A sustained press holds the plate out, and a new press can reverse a return.
      if (risingEdge && (piston.phase === 'retracted' || piston.phase === 'retracting')) {
        piston.phase = 'extending';
      }
      if (piston.phase === 'extended' && !pressed) piston.phase = 'retracting';

      const target = piston.phase === 'extending' || piston.phase === 'extended' ? 1 : 0;
      const distance = piston.extension * pistonGeometry.travel;
      const remaining = target * pistonGeometry.travel - distance;
      if (Math.abs(remaining) < 1e-6) {
        piston.body.setLinearVelocity(new Vec2(0, 0));
        continue;
      }
      const speed =
        Math.sign(remaining) * Math.min(PISTON_SPEED, Math.abs(remaining) / this.#fixedStepSeconds);
      piston.body.setLinearVelocity(new Vec2(piston.axis.x * speed, piston.axis.y * speed));
    }
  }

  /** Reads the kinematic slider's progress after the fixed physics step. */
  #trackPistons(): void {
    for (const piston of this.#pistons) {
      const position = piston.body.getPosition();
      const dx = position.x - piston.homePosition.x;
      const dy = position.y - piston.homePosition.y;
      const travelled = dx * piston.axis.x + dy * piston.axis.y;
      piston.extension = Math.max(0, Math.min(1, travelled / pistonGeometry.travel));
      if (piston.extension >= 1 - 1e-6) {
        piston.extension = 1;
      } else if (piston.extension <= 1e-6) {
        piston.extension = 0;
      }
      if (piston.phase === 'extending' && piston.extension === 1) {
        piston.phase = 'extended';
        if (!piston.buttonPressed) piston.phase = 'retracting';
      } else if (piston.phase === 'retracting' && piston.extension === 0) {
        piston.phase = 'retracted';
      }
    }
  }

  /** Reads every lever and sets the direction of the conveyors it commands. */
  #commandConveyors(): void {
    for (const conveyor of this.#conveyors) {
      const signal = this.#signalForTarget(conveyor.placementId);
      const direction =
        signal?.kind !== 'lever'
          ? conveyor.ownDirection
          : conveyorDirections[
              ({ left: 'left', center: 'stopped', right: 'right' } as const)[signal.position]
            ];
      conveyor.direction = direction;
      if (direction !== 0) {
        conveyor.facing = direction;
        this.#wakeBodiesOn(conveyor.body);
      }
    }
  }

  /** A body asleep on a stopped belt would otherwise ignore it starting. */
  #wakeBodiesOn(body: Body): void {
    for (let edge = body.getContactList(); edge !== null; edge = edge.next ?? null) {
      edge.other?.setAwake(true);
    }
  }

  #createButton(placementId: string, position: SimulationVector, rotation: number): void {
    const body = this.#requireWorld().createBody({
      type: 'static',
      position: new Vec2(position.x, position.y),
      angle: rotation,
    });
    this.#bodies.push({ placementId, role: 'primary', handle: body });
    this.#createFixture(body, { shape: new Polygon(BUTTON_BASE_VERTICES), friction: 0.5 });
    const { body: cap, travel } = buttonGeometry.cap;
    const capFixture = this.#createFixture(body, { shape: buttonCapShape(false), friction: 0.5 });
    // The sensor spans the whole travel: what sinks with the cap keeps it pressed.
    const sensor = this.#createFixture(body, {
      shape: rectBox({
        ...cap,
        y: cap.y - BUTTON_SENSOR_REACH,
        height: travel + 2 * BUTTON_SENSOR_REACH,
      }),
      isSensor: true,
    });
    const record: ButtonRecord = { placementId, body, contacts: 0, sunk: false, cap: capFixture };
    this.#buttons.push(record);
    this.#buttonSensors.set(sensor, record);
  }

  /**
   * A pressed cap really sinks: its collider is rebuilt lower, so what
   * weighs on it rests on the drawn cap, and rises again once released.
   */
  #sinkButtons(): void {
    for (const button of this.#buttons) {
      const pressed = button.contacts > 0;
      if (pressed === button.sunk) continue;
      button.sunk = pressed;
      this.#wakeBodiesOn(button.body);
      button.body.destroyFixture(button.cap);
      this.#colliders.delete(button.cap);
      button.cap = this.#createFixture(button.body, {
        shape: buttonCapShape(pressed),
        friction: 0.5,
      });
    }
  }

  #createElectroMagnet(
    placementId: string,
    position: SimulationVector,
    rotation: number,
    ownActive: boolean,
  ): void {
    const body = this.#requireWorld().createBody({
      type: 'static',
      position: new Vec2(position.x, position.y),
      angle: rotation,
    });
    this.#bodies.push({ placementId, role: 'primary', handle: body });
    const { width, height } = electroMagnetGeometry.footprint;
    this.#createFixture(body, { shape: new Box(width / 2, height / 2), friction: 0.5 });
    this.#electroMagnets.push({
      placementId,
      body,
      sourceId: this.#level.wires.find(({ targetId }) => targetId === placementId)?.sourceId,
      ownActive,
      active: ownActive,
    });
  }

  #createFan(
    placementId: string,
    position: SimulationVector,
    rotation: number,
    ownRunning: boolean,
  ): void {
    const { angle, mirrored } = facingPose(rotation);
    const body = this.#requireWorld().createBody({
      type: 'static',
      position: new Vec2(position.x, position.y),
      angle,
    });
    this.#bodies.push({ placementId, role: 'primary', handle: body });
    const flip = mirrored ? -1 : 1;
    this.#createFixture(body, {
      shape: new Polygon(mirroredVertices(fanGeometry.body.polygon, mirrored)),
      friction: 0.5,
    });
    const mouth = body.getWorldPoint(new Vec2(flip * fanGeometry.mouth.x, fanGeometry.mouth.y));
    const axis = body.getWorldVector(new Vec2(flip, 0));
    this.#fans.push({
      placementId,
      body,
      mouth: { x: mouth.x, y: mouth.y },
      axis: { x: withoutResidue(axis.x), y: withoutResidue(axis.y) },
      ownRunning,
      sourceId: this.#level.wires.find(({ targetId }) => targetId === placementId)?.sourceId,
      running: ownRunning,
      spin: 0,
      bladeAngle: 0,
    });
  }

  #createBarrier(
    placementId: string,
    position: SimulationVector,
    rotation: number,
    ownOpen: boolean,
  ): void {
    const { angle, mirrored } = facingPose(rotation);
    const body = this.#requireWorld().createBody({
      type: 'static',
      position: new Vec2(position.x, position.y),
      angle,
    });
    this.#bodies.push({ placementId, role: 'primary', handle: body });
    this.#createFixture(body, {
      shape: new Polygon(mirroredVertices(barrierGeometry.pillar.polygon, mirrored)),
      friction: 0.5,
    });
    this.#barriers.push({
      placementId,
      body,
      side: mirrored ? -1 : 1,
      ownOpen,
      sourceId: this.#level.wires.find(({ targetId }) => targetId === placementId)?.sourceId,
      open: ownOpen,
      retraction: ownOpen ? 1 : 0,
      bar: null,
    });
  }

  /**
   * The bar's collider is only the part out of the barrel: a sliding body
   * would poke out of the pillar's other side. It is rebuilt whenever the
   * bar moves, and whatever rests on it is woken to fall or be pushed.
   */
  #shapeBarrierBar(barrier: BarrierRecord): void {
    if (barrier.bar !== null) {
      this.#wakeBodiesOn(barrier.body);
      barrier.body.destroyFixture(barrier.bar);
      this.#colliders.delete(barrier.bar);
      barrier.bar = null;
    }
    const out = (1 - barrier.retraction) * BARRIER_TRAVEL;
    if (out < BARRIER_MIN_BAR) return;

    const { barrelHalfWidth } = barrierGeometry.pillar;
    const { thickness, centerY } = barrierGeometry.bar;
    barrier.bar = this.#createFixture(barrier.body, {
      shape: new Box(
        out / 2,
        thickness / 2,
        new Vec2(barrier.side * (barrelHalfWidth + out / 2), centerY),
        0,
      ),
      friction: 0.45,
    });
  }

  /** Slides each barrier's bar toward the state it is commanded to. */
  #moveBarriers(): void {
    const stepRetraction = (BARRIER_SPEED * this.#fixedStepSeconds) / BARRIER_TRAVEL;
    for (const barrier of this.#barriers) {
      const target = barrier.open ? 1 : 0;
      if (barrier.retraction === target) continue;
      barrier.retraction =
        target > barrier.retraction
          ? Math.min(target, barrier.retraction + stepRetraction)
          : Math.max(target, barrier.retraction - stepRetraction);
      this.#shapeBarrierBar(barrier);
    }
  }

  #createSpringboard(placementId: string, position: SimulationVector, rotation: number): void {
    const body = this.#requireWorld().createBody({
      type: 'static',
      position: new Vec2(position.x, position.y),
      angle: rotation,
    });
    this.#bodies.push({ placementId, role: 'primary', handle: body });
    this.#createFixture(body, { shape: new Polygon(SPRINGBOARD_BASE_VERTICES), friction: 0.5 });
    this.#createFixture(body, {
      shape: rectBox(springboardGeometry.spring.footprint),
      friction: 0.3,
    });
    const platform = this.#createFixture(body, {
      shape: rectBox(springboardGeometry.platform.footprint),
      friction: 0.5,
      restitution: SPRINGBOARD_RESTITUTION,
    });
    const record: SpringboardRecord = { placementId, compression: 0 };
    this.#springboards.push(record);
    this.#springboardPlatforms.set(platform, record);
  }

  #createPiston(placementId: string, position: SimulationVector, rotation: number): void {
    const world = this.#requireWorld();
    const axis = new Vec2(Math.cos(rotation), Math.sin(rotation));
    const homePosition = new Vec2(
      position.x + pistonGeometry.homeOffset.x * axis.x,
      position.y + pistonGeometry.homeOffset.x * axis.y,
    );
    const housing = world.createBody({
      type: 'static',
      position: new Vec2(position.x, position.y),
      angle: rotation,
    });
    this.#bodies.push({ placementId, role: 'base', handle: housing });
    this.#createFixture(housing, {
      shape: new Polygon(pistonGeometry.housing.polygon.map(({ x, y }) => new Vec2(x, y))),
      friction: 0.5,
    });

    const slider = world.createBody({
      type: 'kinematic',
      position: homePosition,
      angle: rotation,
      bullet: true,
    });
    this.#bodies.push({ placementId, role: 'piston', handle: slider });
    this.#createFixture(slider, {
      shape: new Polygon(pistonGeometry.plate.polygon.map(({ x, y }) => new Vec2(x, y))),
      friction: 0.5,
    });
    this.#createFixture(slider, { shape: rectBox(pistonGeometry.rod.footprint), friction: 0.5 });
    this.#pistons.push({
      placementId,
      body: slider,
      sourceId: this.#level.wires.find(({ targetId }) => targetId === placementId)?.sourceId,
      homePosition,
      axis,
      buttonPressed: false,
      phase: 'retracted',
      extension: 0,
    });
  }

  #createTimer(placementId: string, delaySeconds: number): void {
    const delaySteps = Math.max(1, Math.round(delaySeconds / this.#fixedStepSeconds));
    assertPositiveSafeInteger(delaySteps, 'Le délai du minuteur en pas fixes');
    const wire = this.#level.wires.find(({ timerId }) => timerId === placementId);
    this.#timers.push({
      placementId,
      delaySeconds,
      delaySteps,
      sourceId: wire?.sourceId,
      observedSignal: undefined,
      outputSignal: undefined,
      pending: [],
    });
  }

  /** A landing squashes the spring in proportion to its speed; drawn only. */
  #squashSpringboard(contact: Contact): void {
    const onA = this.#springboardPlatforms.get(contact.getFixtureA());
    const springboard = onA ?? this.#springboardPlatforms.get(contact.getFixtureB());
    if (springboard === undefined) return;

    const other = (onA === undefined ? contact.getFixtureA() : contact.getFixtureB()).getBody();
    const speed = other.getLinearVelocity().length();
    springboard.compression = Math.max(
      springboard.compression,
      Math.min(1, speed / SPRINGBOARD_FULL_SQUASH_SPEED),
    );
  }

  #relaxSpringboards(): void {
    for (const springboard of this.#springboards) {
      springboard.compression = Math.max(
        0,
        springboard.compression - SPRINGBOARD_RELAX_RATE * this.#fixedStepSeconds,
      );
    }
  }

  /** Central force, in newtons, falling linearly to zero at the radial boundary. */
  #attractMetalBoxes(): void {
    for (const magnet of this.#electroMagnets) {
      if (!magnet.active) continue;
      const centre = magnet.body.getPosition();
      for (const box of this.#metalBoxes) {
        const position = box.getWorldCenter();
        const dx = centre.x - position.x;
        const dy = centre.y - position.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1e-6 || distance >= electroMagnetGeometry.range) continue;
        const force = 90 * (1 - distance / electroMagnetGeometry.range);
        box.applyForceToCenter(new Vec2((force * dx) / distance, (force * dy) / distance), true);
      }
    }
  }

  /** Pushes every dynamic body inside a running fan's cone of air. */
  #blowFans(): void {
    const world = this.#requireWorld();
    for (const fan of this.#fans) {
      if (!fan.running) continue;
      for (let body = world.getBodyList(); body !== null; body = body.getNext()) {
        if (body.getType() !== 'dynamic') continue;

        const center = body.getWorldCenter();
        const offset = { x: center.x - fan.mouth.x, y: center.y - fan.mouth.y };
        const distance = offset.x * fan.axis.x + offset.y * fan.axis.y;
        if (distance < 0 || distance > FAN_RANGE) continue;
        const across = Math.abs(offset.x * fan.axis.y - offset.y * fan.axis.x);
        if (across > fanGeometry.mouth.halfWidth + distance * FAN_SPREAD) continue;
        if (this.#airBlocked(fan, body)) continue;

        const push = FAN_PRESSURE * this.#exposedWidth(body, fan.axis) * (1 - distance / FAN_RANGE);
        body.applyForceToCenter(new Vec2(fan.axis.x * push, fan.axis.y * push), true);
      }
    }
  }

  /**
   * Whether a solid of another body cuts the air between the fan and `target`.
   * The ray starts on the mouth, at the point level with the target's centre
   * across the axis (clamped to the mouth's width), and ends at that centre.
   */
  #airBlocked(fan: FanRecord, target: Body): boolean {
    const center = target.getWorldCenter();
    const offset = { x: center.x - fan.mouth.x, y: center.y - fan.mouth.y };
    const halfWidth = fanGeometry.mouth.halfWidth;
    const lateral = Math.max(
      -halfWidth,
      Math.min(halfWidth, offset.x * -fan.axis.y + offset.y * fan.axis.x),
    );
    const start = new Vec2(fan.mouth.x - fan.axis.y * lateral, fan.mouth.y + fan.axis.x * lateral);
    if (start.x === center.x && start.y === center.y) return false;
    let blocked = false;
    this.#requireWorld().rayCast(start, center, (fixture) => {
      const owner = fixture.getBody();
      if (fixture.isSensor() || owner === fan.body || owner === target) return -1;
      blocked = true;
      return 0;
    });
    return blocked;
  }

  /** Width of a body seen along `axis`, from its bounding box (fans blow along x or y). */
  #exposedWidth(body: Body, axis: SimulationVector): number {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let fixture = body.getFixtureList(); fixture !== null; fixture = fixture.getNext()) {
      if (fixture.isSensor()) continue;
      const box = fixture.getAABB(0);
      const [low, high] =
        axis.x === 0 ? [box.lowerBound.x, box.upperBound.x] : [box.lowerBound.y, box.upperBound.y];
      min = Math.min(min, low);
      max = Math.max(max, high);
    }
    return max > min ? max - min : 0;
  }

  #spinFans(): void {
    const change = FAN_BLADE_ACCELERATION * this.#fixedStepSeconds;
    for (const fan of this.#fans) {
      const target = fan.running ? FAN_BLADE_SPEED : 0;
      fan.spin =
        target > fan.spin
          ? Math.min(target, fan.spin + change)
          : Math.max(target, fan.spin - change);
      fan.bladeAngle += fan.spin * this.#fixedStepSeconds;
    }
  }

  #updateButtonContact(contact: Contact, delta: 1 | -1): void {
    for (const [sensor, other] of [
      [contact.getFixtureA(), contact.getFixtureB()],
      [contact.getFixtureB(), contact.getFixtureA()],
    ] as const) {
      const button = this.#buttonSensors.get(sensor);
      if (button === undefined || other.isSensor() || other.getBody().getType() !== 'dynamic') {
        continue;
      }
      button.contacts = Math.max(0, button.contacts + delta);
    }
  }

  #createSeesaw(placementId: string, position: SimulationVector, rotation: number): void {
    const world = this.#requireWorld();
    const base = world.createBody({
      type: 'static',
      position: new Vec2(position.x, position.y),
      angle: rotation,
    });
    const board = world.createBody({
      type: 'dynamic',
      position: new Vec2(position.x, position.y),
      angle: rotation,
    });
    this.#bodies.push(
      { placementId, role: 'base', handle: base },
      { placementId, role: 'board', handle: board },
    );
    this.#createFixture(base, {
      shape: new Polygon(SEESAW_FULCRUM_VERTICES),
      friction: 0.5,
    });
    this.#createFixture(board, {
      shape: new Box(seesawGeometry.board.halfLength, seesawGeometry.board.halfThickness),
      density: 1,
      friction: 0.4,
    });

    const anchor = new Vec2(position.x, position.y);
    const joint = world.createJoint(
      new RevoluteJoint(
        {
          enableLimit: true,
          lowerAngle: -SEESAW_ANGLE_LIMIT,
          upperAngle: SEESAW_ANGLE_LIMIT,
          collideConnected: false,
        },
        base,
        board,
        anchor,
      ),
    );
    if (joint === null) {
      throw new Error(`Impossible de créer le pivot de la bascule « ${placementId} ».`);
    }
    this.#joints.push({ placementId, handle: joint, moving: 'board' });
  }

  #createFixture(body: Body, definition: FixtureDef): Fixture {
    const fixture = body.createFixture(definition);
    this.#colliders.add(fixture);
    return fixture;
  }

  #step(): void {
    const world = this.#requireWorld();
    this.#fixedStep += 1;
    this.#events = [];
    this.#pullLeversToNotches();
    this.#applyRollingResistance();
    this.#blowFans();
    this.#attractMetalBoxes();
    world.step(this.#fixedStepSeconds);
    for (const conveyor of this.#conveyors) {
      conveyor.beltOffset += conveyor.direction * CONVEYOR_SPEED * this.#fixedStepSeconds;
    }
    this.#relaxSpringboards();
    this.#sinkButtons();
    this.#trackPistons();
    this.#commandDevices();
    this.#moveBarriers();
    this.#spinFans();
    this.#goalEvaluation = applyBasketGoalFacts(this.#goalEvaluation, this.#goalRule, this.#events);
    this.#goalEvaluation = advanceBasketGoalEvaluation(
      this.#goalEvaluation,
      this.#goalRule,
      this.#fixedStep,
    );
    this.#failureEvaluation = applyAttemptFailureFacts(
      this.#failureEvaluation,
      this.#failureRule,
      this.#readTargetBallPositionFacts(),
    );
    this.#failureEvaluation = advanceAttemptFailureEvaluation(
      this.#failureEvaluation,
      this.#failureRule,
      this.#fixedStep,
    );
  }

  /**
   * The target ball's position after the step, turned into the ordered fact
   * the domain evaluator consumes. A step produces at most one such fact, so
   * its order is always zero.
   */
  #readTargetBallPositionFacts(): readonly BallPositionFact[] {
    const ball = this.#bodies.find(
      (record) => record.placementId === this.#failureRule.ballId && record.role === 'primary',
    );
    if (ball === undefined) return [];

    const position = ball.handle.getPosition();
    return [
      {
        placementId: ball.placementId,
        position: { x: position.x, y: position.y },
        fixedStep: this.#fixedStep,
        order: 0,
      },
    ];
  }

  #updateSensorContact(contact: Contact, delta: 1 | -1): void {
    const fixtureA = contact.getFixtureA();
    const fixtureB = contact.getFixtureB();
    const sensorA = this.#sensors.get(fixtureA);
    const sensorB = this.#sensors.get(fixtureB);

    if (sensorA !== undefined) {
      this.#updateSensorPair(sensorA, fixtureB.getBody(), delta);
    }
    if (sensorB !== undefined) {
      this.#updateSensorPair(sensorB, fixtureA.getBody(), delta);
    }
  }

  #updateSensorPair(sensor: SensorRecord, body: Body, delta: 1 | -1): void {
    const other = this.#bodies.find((record) => record.handle === body);
    if (other === undefined || other.placementId === sensor.targetId) return;

    const key = `${other.placementId}\u0000${sensor.targetId}`;
    const previousCount = this.#activeSensorContacts.get(key) ?? 0;
    const nextCount = Math.max(0, previousCount + delta);

    if (nextCount === 0) {
      this.#activeSensorContacts.delete(key);
    } else {
      this.#activeSensorContacts.set(key, nextCount);
    }

    if (delta === 1 && previousCount === 0) {
      this.#events.push({
        type: 'object-entered-sensor',
        placementId: other.placementId,
        targetId: sensor.targetId,
        fixedStep: this.#fixedStep,
        order: this.#events.length,
      });
    } else if (delta === -1 && previousCount > 0 && nextCount === 0) {
      this.#events.push({
        type: 'object-left-sensor',
        placementId: other.placementId,
        targetId: sensor.targetId,
        fixedStep: this.#fixedStep,
        order: this.#events.length,
      });
    }
  }

  #releaseWorld(): void {
    const world = this.#world;
    if (world === null) return;

    world.off('begin-contact', this.#onBeginContact);
    world.off('end-contact', this.#onEndContact);
    world.off('pre-solve', this.#onPreSolve);
    for (const { handle } of [...this.#joints].reverse()) {
      world.destroyJoint(handle);
    }
    for (const { handle } of [...this.#bodies].reverse()) {
      world.destroyBody(handle);
    }

    this.#world = null;
    this.#bodies = [];
    this.#colliders.clear();
    this.#joints = [];
    this.#balls = [];
    this.#levers = [];
    this.#conveyors = [];
    this.#conveyorFixtures.clear();
    this.#buttons = [];
    this.#buttonSensors.clear();
    this.#fans = [];
    this.#electroMagnets = [];
    this.#metalBoxes = [];
    this.#barriers = [];
    this.#springboards = [];
    this.#springboardPlatforms.clear();
    this.#pistons = [];
    this.#timers = [];
    this.#sensors.clear();
    this.#activeSensorContacts.clear();
  }

  #requireWorld(): ReturnType<typeof createPhysicsWorld> {
    if (this.#world === null) {
      throw new Error('La session de simulation est détruite.');
    }
    return this.#world;
  }
}

export const createSimulationSession = (
  level: LevelDocument,
  options: SimulationSessionOptions,
): SimulationSession => {
  assertPositiveFinite(options.fixedStepSeconds, 'Le pas fixe');
  const attemptTimeoutSeconds = options.attemptTimeoutSeconds ?? DEFAULT_ATTEMPT_TIMEOUT_SECONDS;
  assertPositiveFinite(attemptTimeoutSeconds, 'La durée maximale d’une tentative');
  return new PlanckSimulationSession(level, options.fixedStepSeconds, attemptTimeoutSeconds);
};
