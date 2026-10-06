import { describe, expect, it } from 'vitest';

import { sketchLevels as embeddedLevels } from '../../test/fixtures/sketch-campaign';
import { completeGoalOf, levelDocumentSchema, type LevelDocument } from '../domain/level-document';
import {
  createSimulationSession,
  type SimulationBodyState,
  type SimulationSensorEvent,
  type SimulationSensorEntryEvent,
  type SimulationSession,
  type SimulationSnapshot,
} from './simulation-session';

const FIXED_STEP_SECONDS = 1 / 60;

/**
 * ADR 0007 - Repère du monde : `y` croît vers le bas. Les valeurs ci-dessous
 * décrivent la géométrie attendue vue du domaine, en unités monde, sans jamais
 * importer les constantes de l'adaptateur physique : un test qui relirait les
 * constantes de production ne prouverait rien.
 */
/** ADR 0007 - empreinte figée du panier : 1,5 × 1,1, colliders compris. */
const BASKET_HALF_FOOTPRINT_WIDTH = 0.75;
const BASKET_HALF_FOOTPRINT_HEIGHT = 0.55;
/** Face intérieure du fond du panier, sous l'origine du corps. */
const BASKET_INTERIOR_FLOOR_OFFSET_Y = 0.39;
const BALL_RADIUS = 0.3;
const BEAM_HALF_THICKNESS = 0.125;
const SEESAW_BOARD_HALF_THICKNESS = 0.12;
/** ADR 0007 : empreinte de la masse, 0,8 × 0,505, centrée sur son origine. */
const MASS_HALF_FOOTPRINT_HEIGHT = 0.2526;
/** Dessus du capuchon du bouton relâché, au-dessus de son origine, et sa course. */
const BUTTON_CAP_TOP = -0.2402;
const BUTTON_CAP_TRAVEL = 0.06;
/** La barre fermée : de l'axe du poteau à 1,25 de son côté, centrée 0,037 au-dessus de l'origine. */
const BARRIER_BAR_CENTER_Y = -0.0414;
const BARRIER_BAR_HALF_THICKNESS = 0.19;
/** Vitesse du tapis d'un convoyeur en marche, en unités monde par seconde. */
const CONVEYOR_SPEED = 1.5;
/** Hauteur totale du socle de la bascule, posé sous le pivot. */
const SEESAW_BASE_HEIGHT = 0.7;
/** Un corps au repos s'enfonce du « linear slop » de Planck avant de se stabiliser. */
const CONTACT_TOLERANCE = 0.02;
/** Assez de pas pour qu'une chute d'environ trois unités se stabilise complètement. */
const SETTLING_FIXED_STEPS = 300;
/**
 * Game rules (docs/levels/conception-niveaux.md § 1) : budget par défaut d'une tentative, vingt
 * secondes simulées. Recalculé ici depuis le pas fixe, comme la simulation
 * doit le faire, plutôt que lu dans une constante de production.
 */
const DEFAULT_ATTEMPT_TIMEOUT_FIXED_STEPS = Math.round(20 / FIXED_STEP_SECONDS);

const expectCloseTo = (actual: number, expected: number, tolerance = CONTACT_TOLERANCE): void => {
  expect(
    Math.abs(actual - expected),
    `attendu ${String(expected)} à ${String(tolerance)} près, obtenu ${String(actual)}`,
  ).toBeLessThanOrEqual(tolerance);
};

const permissions = { move: false, rotate: false, remove: false } as const;

const createLevelDocument = (ballY = 8): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-contract',
    metadata: { title: 'Contrat du port physique' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: 0, y: ballY }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 0, y: -6 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'beam-1',
        type: 'beam',
        transform: { position: { x: 0, y: 0 }, rotation: 0.25 },
        props: { size: 'medium' },
        permissions,
      },
      {
        id: 'seesaw-1',
        type: 'seesaw',
        transform: { position: { x: 4, y: 1 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [{ min: { x: -10, y: -10 }, max: { x: 10, y: 12 } }],
    scene: { min: { x: -10, y: -10 }, max: { x: 10, y: 12 } },
  });

const createFreeBallLevelDocument = (): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-downward-gravity',
    metadata: { title: 'Contrat de gravité orientée vers le bas' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: 0, y: 2 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 8, y: -8 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [{ min: { x: -10, y: -10 }, max: { x: 10, y: 10 } }],
    scene: { min: { x: -10, y: -10 }, max: { x: 10, y: 10 } },
  });

const createBasketSensorLevelDocument = (): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-basket-sensor',
    metadata: { title: 'Contrat du capteur panier' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        // The ball starts above the basket mouth and falls into its sensor.
        transform: { position: { x: 0, y: -7.2 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 0, y: -6 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [{ min: { x: -10, y: -10 }, max: { x: 10, y: 12 } }],
    scene: { min: { x: -10, y: -10 }, max: { x: 10, y: 12 } },
  });

/**
 * The ball is released just above the basket mouth: it crosses the sensor
 * volume for several fixed steps before its first solid contact with the
 * basket floor. That window is what proves a sensor bends no trajectory.
 */
const createSensorOnlyContactLevelDocument = (basketX = 0): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-sensor-only-contact',
    metadata: { title: 'Contrat de contact capteur seul' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: 0, y: -7.1 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: basketX, y: -6 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [{ min: { x: -10, y: -10 }, max: { x: 10, y: 12 } }],
    scene: { min: { x: -10, y: -10 }, max: { x: 10, y: 12 } },
  });

/**
 * A basket tilted well past the friction angle: the ball enters its sensor,
 * bounces on the inner face and is expelled through the mouth. It only ever
 * crosses the sensor, so the goal must stay pending.
 */
const createTiltedBasketLevelDocument = (): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-tilted-basket',
    metadata: { title: 'Contrat de traversée du capteur' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: 0, y: -3 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 0, y: 0 }, rotation: Math.PI / 3 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: -6, y: -6 }, max: { x: 6, y: 6 } },
  });

/**
 * Drops a ball onto a basket rotated by `rotation`. Turning the basket and
 * letting the ball settle on whatever face now points up measures that face's
 * distance to the basket origin, which is how the frozen footprint is checked
 * without reading a single production constant.
 */
const createBasketDropLevelDocument = (
  rotation: number,
  ball: { readonly x: number; readonly y: number } = { x: 0, y: -3 },
): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-basket-drop',
    metadata: { title: 'Contrat de chute sur le panier' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: ball.x, y: ball.y }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 0, y: 0 }, rotation },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: -6, y: -6 }, max: { x: 6, y: 6 } },
  });

/** Same probe, applied to the seesaw: the basket only carries the goal. */
const createSeesawDropLevelDocument = (rotation: number, ballX = 0): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-seesaw-drop',
    metadata: { title: 'Contrat de chute sur la bascule' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: ballX, y: -3 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'seesaw-1',
        type: 'seesaw',
        transform: { position: { x: 0, y: 0 }, rotation },
        props: {},
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 8, y: 0 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: -10, y: -10 }, max: { x: 10, y: 10 } },
  });

/**
 * A free fall of about 32 units reaches 25 m/s, which covers 0,42 unité par pas
 * fixe — bien plus que l'épaisseur de 0,25 d'une poutre.
 */
const createHighSpeedBeamLevelDocument = (): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-high-speed-beam',
    metadata: { title: 'Contrat de non-traversée de poutre' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: 0, y: -33 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'beam-1',
        type: 'beam',
        transform: { position: { x: 0, y: 0 }, rotation: 0 },
        props: { size: 'medium' },
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 8, y: 0 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: -10, y: -35 }, max: { x: 10, y: 5 } },
  });

const createSeesawImpactLevelDocument = (): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-seesaw-impact',
    metadata: { title: 'Contrat de l’impact sur la bascule' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: -1, y: 3 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 10, y: -10 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'seesaw-1',
        type: 'seesaw',
        transform: { position: { x: 0, y: 6 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [{ min: { x: -10, y: -12 }, max: { x: 12, y: 12 } }],
    scene: { min: { x: -10, y: -12 }, max: { x: 12, y: 12 } },
  });

const createBeamImpactLevelDocument = (beamX: number): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: `physics-port-beam-impact-${String(beamX)}`,
    metadata: { title: 'Contrat de l’impact sur la poutre' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: 0, y: 4 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 10, y: -10 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'beam-1',
        type: 'beam',
        transform: { position: { x: beamX, y: 8 }, rotation: 0 },
        props: { size: 'medium' },
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [{ min: { x: -12, y: -12 }, max: { x: 12, y: 12 } }],
    scene: { min: { x: -12, y: -12 }, max: { x: 12, y: 12 } },
  });

/**
 * Game rules (docs/levels/conception-niveaux.md § 1) : la balle tombe à côté du panier, dans le
 * vide. Aucun mur implicite ne la retient — un niveau qui veut un sol le pose
 * avec une poutre statique — donc elle finit par franchir le rectangle de
 * scène élargi.
 */
const createUnreachableBasketLevelDocument = (): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-unreachable-basket',
    metadata: { title: 'Contrat de sortie de scène' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: 2, y: 1 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 8, y: 5 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 10, y: 6 } },
  });

/**
 * B2 : la balle se pose sur une poutre statique, à l'intérieur de la scène, et
 * n'en bouge plus. Rien ne la fera jamais entrer dans le panier : seule la
 * limite de temps peut clore la tentative.
 */
const createRestingBallLevelDocument = (): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-resting-ball',
    metadata: { title: 'Contrat de temps écoulé' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: 5, y: 1 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'beam-1',
        type: 'beam',
        transform: { position: { x: 5, y: 4 }, rotation: 0 },
        props: { size: 'medium' },
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 9, y: 5 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 10, y: 6 } },
  });

/** Steps one at a time until the attempt fails, or gives up after `maxSteps`. */
const advanceUntilFailure = (session: SimulationSession, maxSteps: number): void => {
  for (let step = 0; step < maxSteps; step += 1) {
    if (session.readFailureEvaluation().status === 'failed') return;
    session.advanceFixedSteps(1);
  }
};

const isEventType = (event: { readonly type: string }, type: string): boolean =>
  event.type === type;

const isSensorEntryEvent = (event: SimulationSensorEvent): event is SimulationSensorEntryEvent =>
  event.type === 'object-entered-sensor';

type GoalEvaluationReader = SimulationSession & {
  readonly readGoalEvaluation: () => unknown;
};

const hasGoalEvaluation = (session: SimulationSession): session is GoalEvaluationReader =>
  'readGoalEvaluation' in session && typeof session.readGoalEvaluation === 'function';

const readGoalEvaluation = (session: SimulationSession): unknown => {
  if (!hasGoalEvaluation(session)) {
    throw new Error('L’API publique readGoalEvaluation est absente.');
  }
  return session.readGoalEvaluation();
};

const body = (
  snapshot: SimulationSnapshot,
  placementId: string,
  role: SimulationBodyState['role'],
): SimulationBodyState => {
  const found = snapshot.bodies.find(
    (candidate) => candidate.placementId === placementId && candidate.role === role,
  );
  if (found === undefined) {
    throw new Error(`Corps absent de l’état : ${placementId}/${role}`);
  }
  return found;
};

const mass = (id: string, position: { readonly x: number; readonly y: number }) => ({
  id,
  type: 'mass',
  transform: { position, rotation: 0 },
  props: { weight: '10kg' },
  permissions,
});

/** A mass dropped on a long beam, and a ball resting on a seesaw that a mass falls onto. */
const createMassLevelDocument = (): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-mass',
    metadata: { title: 'Contrat de la masse' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: -1.3, y: -0.5 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'seesaw-1',
        type: 'seesaw',
        transform: { position: { x: 0, y: 0 }, rotation: 0 },
        props: {},
        permissions,
      },
      // Lâchée de peu : sur la planche inclinée, la balle roulerait hors du
      // bout avant l'impact d'une masse tombée de plus haut.
      mass('mass-catapult', { x: 1.3, y: -1.5 }),
      {
        id: 'beam-1',
        type: 'beam',
        transform: { position: { x: 20, y: 0 }, rotation: 0 },
        props: { size: 'long' },
        permissions,
      },
      mass('mass-resting', { x: 20, y: -2 }),
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: -20, y: 0 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: -30, y: -30 }, max: { x: 30, y: 30 } },
  });

type LeverPosition = 'left' | 'center' | 'right';
type ConveyorDirection = 'left' | 'stopped' | 'right';

interface WiringScene {
  readonly conveyor: ConveyorDirection;
  readonly lever?: LeverPosition;
  readonly leverRotation?: number;
  /** Where a ball is dropped from, if any; otherwise it waits far away. */
  readonly ballDrop?: { readonly x: number; readonly y: number };
  readonly timerDelaySeconds?: number;
}

/**
 * A conveyor at the origin carrying a mass, and a lever at (6, 0) wired to it
 * when `lever` is given. The goal ball and basket sit out of the way unless
 * the ball is dropped on the lever.
 */
const createWiringLevelDocument = ({
  conveyor,
  lever,
  leverRotation = 0,
  ballDrop,
  timerDelaySeconds,
}: WiringScene): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-wiring',
    metadata: { title: 'Contrat du levier et du convoyeur' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: ballDrop ?? { x: -20, y: 20 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: -20, y: 22 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'conveyor-1',
        type: 'conveyor',
        transform: { position: { x: 0, y: 0 }, rotation: 0 },
        props: { direction: conveyor },
        permissions,
      },
      mass('mass-1', { x: 0, y: -0.7 }),
      ...(lever === undefined
        ? []
        : [
            {
              id: 'lever-1',
              type: 'lever',
              transform: { position: { x: 6, y: 0 }, rotation: leverRotation },
              props: { position: lever },
              permissions,
            },
          ]),
      ...(timerDelaySeconds === undefined
        ? []
        : [
            {
              id: 'timer-1',
              type: 'timer',
              transform: { position: { x: 8, y: 0 }, rotation: 0 },
              props: { delaySeconds: timerDelaySeconds },
              permissions,
            },
          ]),
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: -30, y: -30 }, max: { x: 30, y: 30 } },
    wires:
      lever === undefined
        ? []
        : [
            {
              id: 'wire-1',
              sourceId: 'lever-1',
              ...(timerDelaySeconds === undefined ? {} : { timerId: 'timer-1' }),
              targetId: 'conveyor-1',
            },
          ],
  });

const massXAfter = (scene: WiringScene, steps: number): number => {
  const session = createSimulationSession(createWiringLevelDocument(scene), {
    fixedStepSeconds: FIXED_STEP_SECONDS,
  });
  try {
    session.advanceFixedSteps(steps);
    return body(session.readState(), 'mass-1', 'primary').position.x;
  } finally {
    session.destroy();
  }
};

const device = (snapshot: SimulationSnapshot, placementId: string) => {
  const found = snapshot.devices.find((candidate) => candidate.placementId === placementId);
  if (found === undefined) throw new Error(`Dispositif absent de l’état : ${placementId}`);
  return found;
};

/**
 * A running conveyor, then a flat long beam level with its top: the belt
 * hands the ball over to the beam with some speed.
 */
const createRollingLevelDocument = (): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-rolling',
    metadata: { title: 'Contrat du roulement' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: -4.2, y: -1 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'conveyor-1',
        type: 'conveyor',
        transform: { position: { x: -3, y: 0 }, rotation: 0 },
        props: { direction: 'right' },
        permissions,
      },
      {
        id: 'beam-1',
        type: 'beam',
        // Top flush with the belt: 0,29 above the conveyor's centre.
        transform: { position: { x: 1.5, y: -0.165 }, rotation: 0 },
        props: { size: 'long' },
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 20, y: 20 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: -30, y: -30 }, max: { x: 30, y: 30 } },
  });

/** A short ramp that launches the ball onto a long flat beam at the origin. */
const createRampLevelDocument = (): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-ramp',
    metadata: { title: 'Contrat de la pente' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: -4.6, y: -1.5 }, rotation: 0 },
        props: {},
        permissions,
      },
      {
        id: 'ramp',
        type: 'beam',
        // Right end resting on the flat beam's left end.
        transform: { position: { x: -3.95, y: -0.42 }, rotation: 0.3 },
        props: { size: 'short' },
        permissions,
      },
      {
        id: 'floor',
        type: 'beam',
        transform: { position: { x: 0, y: 0 }, rotation: 0 },
        props: { size: 'long' },
        permissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 20, y: 20 }, rotation: 0 },
        props: {},
        permissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: -30, y: -30 }, max: { x: 30, y: 30 } },
  });

/** Runs a level until everything has come to rest, then reads the ball back. */
const settledBall = (level: LevelDocument): SimulationBodyState => {
  const session = createSimulationSession(level, { fixedStepSeconds: FIXED_STEP_SECONDS });
  try {
    session.advanceFixedSteps(SETTLING_FIXED_STEPS);
    return body(session.readState(), 'ball-1', 'primary');
  } finally {
    session.destroy();
  }
};

const withSession = (
  level: LevelDocument,
  callback: (session: SimulationSession) => void,
): void => {
  const session = createSimulationSession(level, { fixedStepSeconds: FIXED_STEP_SECONDS });
  try {
    callback(session);
  } finally {
    session.destroy();
  }
};

/** Any mix of objects, with a goal ball and basket parked far away unless given. */
const createDeviceLevelDocument = (
  objects: readonly unknown[],
  wires: readonly unknown[] = [],
): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'physics-port-devices',
    metadata: { title: 'Contrat des dispositifs' },
    objects: [
      ...(objects.some((object) => (object as { id?: unknown }).id === 'ball-1')
        ? []
        : [
            {
              id: 'ball-1',
              type: 'ball',
              transform: { position: { x: -20, y: 20 }, rotation: 0 },
              props: {},
              permissions,
            },
          ]),
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: -20, y: 22 }, rotation: 0 },
        props: {},
        permissions,
      },
      ...objects,
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: -30, y: -30 }, max: { x: 30, y: 30 } },
    wires,
  });

const placed = (
  id: string,
  type: string,
  position: { readonly x: number; readonly y: number },
  props: Readonly<Record<string, unknown>> = {},
  rotation = 0,
) => ({ id, type, transform: { position, rotation }, props, permissions });

const ball = (position: { readonly x: number; readonly y: number }) =>
  placed('ball-1', 'ball', position);

/** Drawn blowing right; a quarter turn back blows up, a half turn blows left. */
const fan = (rotation: number, state: string, position = { x: 0, y: 0 }) =>
  placed('fan-1', 'fan', position, { state }, rotation);

/** Bar to the right when not turned, to the left after a half turn. */
const barrier = (state: string, rotation = 0) =>
  placed('barrier-1', 'barrier', { x: 0, y: 0 }, { state }, rotation);

const piston = (rotation = 0, position = { x: 0, y: 0 }) =>
  placed('piston-1', 'piston', position, {}, rotation);

describe('port physique candidat-neutre', () => {
  it('construit une projection éphémère avec les corps et le pivot attendus', () => {
    const level = createLevelDocument();
    const levelBeforeSimulation = structuredClone(level);

    withSession(level, (session) => {
      const initial = session.readState();

      expect(initial.fixedStep).toBe(0);
      expect(initial.fixedStepSeconds).toBe(FIXED_STEP_SECONDS);
      expect(body(initial, 'ball-1', 'primary')).toMatchObject({
        position: { x: 0, y: 8 },
        rotation: 0,
        linearVelocity: { x: 0, y: 0 },
        angularVelocity: 0,
      });
      expect(body(initial, 'beam-1', 'primary')).toMatchObject({
        position: { x: 0, y: 0 },
        rotation: 0.25,
      });
      expect(body(initial, 'seesaw-1', 'base').role).toBe('base');
      expect(body(initial, 'seesaw-1', 'board').role).toBe('board');
      expect(initial.joints).toEqual([
        expect.objectContaining({ placementId: 'seesaw-1', type: 'revolute' }),
      ]);
      expect(level).toEqual(levelBeforeSimulation);
    });
  });

  it('joue la même machine de la même façon, quels que soient l’ordre des objets et leurs identifiants', () => {
    // The player lays the inventory in any order, and an exported puzzle renames
    // the objects to place: the outcome must depend on the machine alone.
    const level = embeddedLevels.find(({ id }) => id === 'campaign-17-la-grande-machine');
    if (level === undefined) throw new Error('Niveau 17 embarqué introuvable.');
    const { solution: ignoredSolution, ...machine } = level;
    void ignoredSolution;
    const goal = completeGoalOf(machine);
    if (goal === null) throw new Error('Le niveau 17 embarqué n’a pas d’objectif complet.');
    const goalIds = new Set([goal.ballId, goal.basketId]);
    const reordered: LevelDocument = {
      ...machine,
      objects: [...machine.objects].reverse(),
    };
    const renamed: LevelDocument = {
      ...machine,
      objects: machine.objects.map((object) =>
        goalIds.has(object.id) ? object : { ...object, id: `zz-${object.id}` },
      ),
      wires: machine.wires.map((wire) => ({
        ...wire,
        sourceId: goalIds.has(wire.sourceId) ? wire.sourceId : `zz-${wire.sourceId}`,
        targetId: goalIds.has(wire.targetId) ? wire.targetId : `zz-${wire.targetId}`,
      })),
    };
    const ballAfter = (document: LevelDocument) => {
      let ballState: SimulationBodyState | undefined;
      withSession(document, (session) => {
        session.advanceFixedSteps(600);
        ballState = body(session.readState(), goal.ballId, 'primary');
      });
      return ballState;
    };

    const reference = ballAfter(machine);
    expect(ballAfter(reordered)).toEqual(reference);
    expect(ballAfter(renamed)).toEqual(reference);
  });

  it('progresse par nombre de pas fixes et reste déterministe sans horloge implicite', () => {
    const level = createLevelDocument();
    const first = createSimulationSession(level, { fixedStepSeconds: FIXED_STEP_SECONDS });
    const second = createSimulationSession(level, { fixedStepSeconds: FIXED_STEP_SECONDS });

    try {
      first.advanceFixedSteps(120);
      second.advanceFixedSteps(120);

      expect(first.readState().fixedStep).toBe(120);
      expect(first.readState()).toEqual(second.readState());
    } finally {
      first.destroy();
      second.destroy();
    }
  });

  it('fait tomber la balle, conserve la poutre statique et réinitialise la projection', () => {
    const level = createLevelDocument();
    const levelBeforeSimulation = structuredClone(level);

    withSession(level, (session) => {
      const initial = session.readState();
      const initialBeam = body(initial, 'beam-1', 'primary');
      const initialSeesawBase = body(initial, 'seesaw-1', 'base');
      const initialSeesawBoard = body(initial, 'seesaw-1', 'board');

      session.advanceFixedSteps(60);

      const advanced = session.readState();
      const advancedBall = body(advanced, 'ball-1', 'primary');
      const advancedBeam = body(advanced, 'beam-1', 'primary');
      const advancedSeesawBase = body(advanced, 'seesaw-1', 'base');
      const advancedSeesawBoard = body(advanced, 'seesaw-1', 'board');

      expect(advancedBall.position.y).toBeGreaterThan(
        body(initial, 'ball-1', 'primary').position.y,
      );
      expect(advancedBall.linearVelocity.y).toBeGreaterThan(0);
      expect(advancedBeam).toEqual(initialBeam);
      expect(advancedSeesawBase).toEqual(initialSeesawBase);
      expect(initialSeesawBoard.bodyType).toBe('dynamic');
      expect(advancedSeesawBoard.bodyType).toBe('dynamic');
      expect(level).toEqual(levelBeforeSimulation);

      session.reset();

      expect(session.readState()).toEqual(initial);
      expect(level).toEqual(levelBeforeSimulation);

      session.destroy();

      expect(level).toEqual(levelBeforeSimulation);
    });
  });

  it('fait augmenter y d’une balle libre avec la gravité écran vers le bas', () => {
    const session = createSimulationSession(createFreeBallLevelDocument(), {
      fixedStepSeconds: FIXED_STEP_SECONDS,
    });
    const measuredSteps = 4;

    try {
      const initialBall = body(session.readState(), 'ball-1', 'primary');

      session.advanceFixedSteps(measuredSteps);

      const advancedBall = body(session.readState(), 'ball-1', 'primary');
      const observedVerticalAcceleration =
        (advancedBall.linearVelocity.y - initialBall.linearVelocity.y) /
        (measuredSteps * FIXED_STEP_SECONDS);

      expect(observedVerticalAcceleration).toBeGreaterThan(0);
      expect(advancedBall.position.y).toBeGreaterThan(initialBall.position.y);
      expect(advancedBall.position.y).toBeGreaterThanOrEqual(0);
    } finally {
      session.destroy();
    }
  });

  it('isole défensivement le document source après sa création', () => {
    const level = createLevelDocument();
    const ball = level.objects.find((object) => object.id === 'ball-1');
    if (ball === undefined) {
      throw new Error('La fixture doit contenir ball-1.');
    }

    const session = createSimulationSession(level, { fixedStepSeconds: FIXED_STEP_SECONDS });
    try {
      ball.transform.position.y = 100;
      const levelAfterSourceMutation = structuredClone(level);

      expect(body(session.readState(), 'ball-1', 'primary').position.y).toBe(8);

      session.advanceFixedSteps(1);

      expect(body(session.readState(), 'ball-1', 'primary').position.y).toBeGreaterThan(8);
      expect(level).toEqual(levelAfterSourceMutation);

      session.reset();

      expect(body(session.readState(), 'ball-1', 'primary').position.y).toBe(8);
      expect(level).toEqual(levelAfterSourceMutation);

      session.destroy();

      expect(level).toEqual(levelAfterSourceMutation);
    } finally {
      session.destroy();
    }
  });

  it('expose seulement les événements nouvellement produits par le dernier pas', () => {
    const level = createBasketSensorLevelDocument();
    const levelBeforeSimulation = structuredClone(level);

    withSession(level, (session) => {
      // `events` is a per-step batch, not a cumulative history.
      expect(session.readState().events).toEqual([]);

      let enteredEvent: SimulationSensorEntryEvent | undefined;

      for (let step = 0; step < 30 && enteredEvent === undefined; step += 1) {
        session.advanceFixedSteps(1);
        const state = session.readState();

        expect(state.events.every((event) => event.fixedStep === state.fixedStep)).toBe(true);
        enteredEvent = state.events.find(
          (event): event is SimulationSensorEntryEvent =>
            isSensorEntryEvent(event) &&
            event.placementId === 'ball-1' &&
            event.targetId === 'basket-1',
        );
      }

      if (enteredEvent === undefined) {
        throw new Error('Aucun événement d’entrée du panier n’a été produit.');
      }
      expect(Number.isFinite(enteredEvent.fixedStep)).toBe(true);
      expect(Number.isSafeInteger(enteredEvent.fixedStep)).toBe(true);
      expect(enteredEvent).toEqual({
        type: 'object-entered-sensor',
        placementId: 'ball-1',
        targetId: 'basket-1',
        fixedStep: enteredEvent.fixedStep,
        order: 0,
      });

      session.advanceFixedSteps(1);

      expect(session.readState().events).not.toContainEqual(enteredEvent);
      expect(level).toEqual(levelBeforeSimulation);
    });
  });

  it('expose la sortie du capteur comme un événement du dernier pas', () => {
    const level = createTiltedBasketLevelDocument();

    withSession(level, (session) => {
      let leftEvent: SimulationSensorEvent | undefined;

      for (let step = 0; step < 200 && leftEvent === undefined; step += 1) {
        session.advanceFixedSteps(1);
        const state = session.readState();

        expect(state.events.every((event) => event.fixedStep === state.fixedStep)).toBe(true);
        leftEvent = state.events.find(
          (event) =>
            isEventType(event, 'object-left-sensor') &&
            event.placementId === 'ball-1' &&
            event.targetId === 'basket-1',
        );
      }

      if (leftEvent === undefined) {
        throw new Error('Aucun événement de sortie du panier n’a été produit.');
      }
      expect(Number.isFinite(leftEvent.fixedStep)).toBe(true);
      expect(Number.isSafeInteger(leftEvent.fixedStep)).toBe(true);
      expect(leftEvent).toEqual({
        type: 'object-left-sensor',
        placementId: 'ball-1',
        targetId: 'basket-1',
        fixedStep: leftEvent.fixedStep,
        order: 0,
      });

      session.advanceFixedSteps(1);

      expect(
        session.readState().events.find((event) => isEventType(event, 'object-left-sensor')),
      ).toBeUndefined();
    });
  });

  it('évalue réellement la réussite du panier après maintien suffisant', () => {
    const level = createBasketSensorLevelDocument();

    withSession(level, (session) => {
      let entryFixedStep: number | undefined;

      for (let step = 0; step < 60 && entryFixedStep === undefined; step += 1) {
        session.advanceFixedSteps(1);
        const entryEvent = session
          .readState()
          .events.find(
            (event) =>
              event.type === 'object-entered-sensor' &&
              event.placementId === 'ball-1' &&
              event.targetId === 'basket-1',
          );
        if (entryEvent !== undefined) {
          entryFixedStep = entryEvent.fixedStep;
        }
      }

      if (entryFixedStep === undefined) {
        throw new Error('Aucun événement d’entrée du panier n’a été produit.');
      }

      session.advanceFixedSteps(120);

      expect(readGoalEvaluation(session)).toEqual({
        status: 'succeeded',
        enteredAtFixedStep: entryFixedStep,
      });
    });
  });

  it('accumule une durée injectée sans avancer avant une période complète', () => {
    const level = createLevelDocument();

    withSession(level, (session) => {
      const halfPeriod = FIXED_STEP_SECONDS / 2;

      expect(session.advanceElapsedSeconds(halfPeriod)).toBe(0);
      expect(session.readState().fixedStep).toBe(0);

      expect(session.advanceElapsedSeconds(halfPeriod)).toBe(1);
      expect(session.readState().fixedStep).toBe(1);
    });
  });

  it('modifie la trajectoire après un impact sur une poutre statique', () => {
    const impactedSession = createSimulationSession(createBeamImpactLevelDocument(0), {
      fixedStepSeconds: FIXED_STEP_SECONDS,
    });
    const unobstructedSession = createSimulationSession(createBeamImpactLevelDocument(10), {
      fixedStepSeconds: FIXED_STEP_SECONDS,
    });

    try {
      const initialBeam = body(impactedSession.readState(), 'beam-1', 'primary');

      impactedSession.advanceFixedSteps(120);
      unobstructedSession.advanceFixedSteps(120);

      const impactedState = impactedSession.readState();
      const unobstructedState = unobstructedSession.readState();
      const impactedBall = body(impactedState, 'ball-1', 'primary');
      const unobstructedBall = body(unobstructedState, 'ball-1', 'primary');
      const impactedBeam = body(impactedState, 'beam-1', 'primary');

      expect(Math.abs(impactedBall.position.y - unobstructedBall.position.y)).toBeGreaterThan(0.25);
      expect(impactedBeam).toEqual(initialBeam);
    } finally {
      impactedSession.destroy();
      unobstructedSession.destroy();
    }
  });

  it('ne modifie pas la trajectoire lors d’un contact avec un capteur seul', () => {
    const sensorSession = createSimulationSession(createSensorOnlyContactLevelDocument(), {
      fixedStepSeconds: FIXED_STEP_SECONDS,
    });
    const unobstructedSession = createSimulationSession(createSensorOnlyContactLevelDocument(10), {
      fixedStepSeconds: FIXED_STEP_SECONDS,
    });
    let sensorEventObserved = false;
    let unobstructedEventObserved = false;

    try {
      // The window stops before the ball reaches the basket floor: past that
      // first solid contact the trajectories legitimately diverge.
      for (let step = 0; step < 24; step += 1) {
        sensorSession.advanceFixedSteps(1);
        unobstructedSession.advanceFixedSteps(1);

        const sensorState = sensorSession.readState();
        const unobstructedState = unobstructedSession.readState();
        sensorEventObserved ||= sensorState.events.length > 0;
        unobstructedEventObserved ||= unobstructedState.events.length > 0;

        expect(sensorState.events.every((event) => event.fixedStep === sensorState.fixedStep)).toBe(
          true,
        );
        expect(unobstructedState.events).toEqual([]);
      }

      const sensorBall = body(sensorSession.readState(), 'ball-1', 'primary');
      const unobstructedBall = body(unobstructedSession.readState(), 'ball-1', 'primary');

      expect(sensorBall.position.x).toBeCloseTo(unobstructedBall.position.x, 9);
      expect(sensorBall.position.y).toBeCloseTo(unobstructedBall.position.y, 9);
      expect(sensorBall.linearVelocity.x).toBeCloseTo(unobstructedBall.linearVelocity.x, 9);
      expect(sensorBall.linearVelocity.y).toBeCloseTo(unobstructedBall.linearVelocity.y, 9);
      expect(sensorEventObserved).toBe(true);
      expect(unobstructedEventObserved).toBe(false);
    } finally {
      sensorSession.destroy();
      unobstructedSession.destroy();
    }
  });

  it('libère ses ressources et accepte une destruction répétée', () => {
    const session = createSimulationSession(createLevelDocument(), {
      fixedStepSeconds: FIXED_STEP_SECONDS,
    });

    expect(session.readResources()).toEqual({
      bodies: 5,
      colliders: 8,
      joints: 1,
      sensors: 1,
    });

    session.destroy();

    expect(session.readResources()).toEqual({
      bodies: 0,
      colliders: 0,
      joints: 0,
      sensors: 0,
    });
    expect(session.readState().bodies).toEqual([]);
    expect(() => session.destroy()).not.toThrow();
    expect(session.readResources()).toEqual({
      bodies: 0,
      colliders: 0,
      joints: 0,
      sensors: 0,
    });
  });

  it('fait tomber la balle dans le panier au lieu de la laisser rouler sur son couvercle', () => {
    // Symptôme observé à l'écran : la balle roulait sur le panier. Le fond
    // était posé au-dessus du centre, donc dans le repère y-bas le panier
    // était un U retourné, couvercle plein vers le haut.
    const ball = settledBall(createBasketDropLevelDocument(0));

    expect(ball.position.y).toBeGreaterThan(-BASKET_HALF_FOOTPRINT_HEIGHT);
    expect(ball.position.y).toBeLessThan(BASKET_HALF_FOOTPRINT_HEIGHT);
    expectCloseTo(ball.position.y, BASKET_INTERIOR_FLOOR_OFFSET_Y - BALL_RADIUS);
    expect(Math.abs(ball.position.x)).toBeLessThan(BASKET_HALF_FOOTPRINT_WIDTH - BALL_RADIUS);
  });

  it('tient dans l’empreinte figée du panier, 1,5 × 1,1 unités monde', () => {
    // Le panier est tourné face par face : la balle se pose sur celle qui
    // regarde le haut de l'écran, et sa hauteur de repos mesure la distance
    // de cette face à l'origine du corps.
    const restingHeightAgainstFace = (rotation: number): number =>
      settledBall(createBasketDropLevelDocument(rotation)).position.y;

    expectCloseTo(
      restingHeightAgainstFace(Math.PI / 2),
      -(BASKET_HALF_FOOTPRINT_WIDTH + BALL_RADIUS),
    );
    expectCloseTo(
      restingHeightAgainstFace(-Math.PI / 2),
      -(BASKET_HALF_FOOTPRINT_WIDTH + BALL_RADIUS),
    );
    expectCloseTo(restingHeightAgainstFace(Math.PI), -(BASKET_HALF_FOOTPRINT_HEIGHT + BALL_RADIUS));

    // Le bord du panier n'est atteignable qu'en posant la balle sur le haut
    // d'une paroi : à l'endroit, la balle lâchée au centre tombe dedans.
    const restingOnRim = settledBall(
      createBasketDropLevelDocument(0, {
        x: 0.7,
        y: -(BASKET_HALF_FOOTPRINT_HEIGHT + BALL_RADIUS),
      }),
    );
    expectCloseTo(restingOnRim.position.y, -(BASKET_HALF_FOOTPRINT_HEIGHT + BALL_RADIUS));
  });

  it('pose le socle de la bascule sous son pivot, jamais au travers du tablier', () => {
    const restingOnBoard = settledBall(createSeesawDropLevelDocument(0));
    expectCloseTo(restingOnBoard.position.y, -(SEESAW_BOARD_HALF_THICKNESS + BALL_RADIUS));

    // Bascule retournée : le socle passe au-dessus du pivot et arrête la balle
    // à sa hauteur totale, ce qui mesure de combien il descend à l'endroit.
    const restingOnBase = settledBall(createSeesawDropLevelDocument(Math.PI));
    expectCloseTo(restingOnBase.position.y, -(SEESAW_BASE_HEIGHT + BALL_RADIUS));
  });

  it('donne au pied de la bascule la silhouette effilée de son sprite', () => {
    // Couchée d'un quart de tour, la bascule présente le flanc de son pied
    // vers le haut. Une boîte offrirait un palier plat où la balle resterait ;
    // le pied effilé la fait glisser vers le tablier.
    const ball = settledBall(createSeesawDropLevelDocument(Math.PI / 2, -0.62));

    expect(ball.position.x).toBeGreaterThan(-0.5);
  });

  it('ne laisse pas une balle lancée à 25 m/s traverser une poutre', () => {
    withSession(createHighSpeedBeamLevelDocument(), (session) => {
      let maximumFallSpeed = 0;

      for (let step = 0; step < SETTLING_FIXED_STEPS; step += 1) {
        session.advanceFixedSteps(1);
        const ball = body(session.readState(), 'ball-1', 'primary');
        maximumFallSpeed = Math.max(maximumFallSpeed, ball.linearVelocity.y);
        expect(ball.position.y).toBeLessThan(-BEAM_HALF_THICKNESS);
      }

      expect(maximumFallSpeed).toBeGreaterThanOrEqual(25);
      expectCloseTo(
        body(session.readState(), 'ball-1', 'primary').position.y,
        -(BEAM_HALF_THICKNESS + BALL_RADIUS),
      );
    });
  });

  it('n’accorde aucun succès à une balle qui ne fait que traverser le capteur', () => {
    withSession(createTiltedBasketLevelDocument(), (session) => {
      let enteredSensor = false;
      let leftSensor = false;

      for (let step = 0; step < 600; step += 1) {
        session.advanceFixedSteps(1);
        for (const event of session.readState().events) {
          if (event.placementId !== 'ball-1' || event.targetId !== 'basket-1') continue;
          enteredSensor ||= event.type === 'object-entered-sensor';
          leftSensor ||= event.type === 'object-left-sensor';
        }
        expect(session.readGoalEvaluation().status).toBe('pending');
      }

      expect(enteredSensor).toBe(true);
      expect(leftSensor).toBe(true);
    });
  });

  it('exige un maintien d’une demi-seconde, soit trente pas fixes, avant le succès', () => {
    withSession(createBasketSensorLevelDocument(), (session) => {
      let entryFixedStep: number | undefined;

      for (let step = 0; step < 60 && entryFixedStep === undefined; step += 1) {
        session.advanceFixedSteps(1);
        entryFixedStep = session
          .readState()
          .events.find(
            (event): event is SimulationSensorEntryEvent =>
              isSensorEntryEvent(event) &&
              event.placementId === 'ball-1' &&
              event.targetId === 'basket-1',
          )?.fixedStep;
      }

      if (entryFixedStep === undefined) {
        throw new Error('Aucun événement d’entrée du panier n’a été produit.');
      }

      const stepsBeforeSuccess = entryFixedStep + 29 - session.readState().fixedStep;
      expect(stepsBeforeSuccess).toBeGreaterThanOrEqual(0);
      session.advanceFixedSteps(stepsBeforeSuccess);

      expect(session.readGoalEvaluation()).toEqual({
        status: 'pending',
        enteredAtFixedStep: entryFixedStep,
      });

      session.advanceFixedSteps(1);

      expect(session.readGoalEvaluation()).toEqual({
        status: 'succeeded',
        enteredAtFixedStep: entryFixedStep,
      });
    });
  });

  it('endort une balle immobile au lieu de la laisser vibrer indéfiniment', () => {
    withSession(createBasketDropLevelDocument(0), (session) => {
      session.advanceFixedSteps(SETTLING_FIXED_STEPS);
      const settled = body(session.readState(), 'ball-1', 'primary');

      expect(Math.abs(settled.linearVelocity.x)).toBe(0);
      expect(Math.abs(settled.linearVelocity.y)).toBe(0);
      expect(Math.abs(settled.angularVelocity)).toBe(0);

      session.advanceFixedSteps(60);
      const later = body(session.readState(), 'ball-1', 'primary');

      expect(later.position).toEqual(settled.position);
      expect(later.rotation).toBe(settled.rotation);
    });
  });

  it('conclut à la sortie de scène pour une balle dont le panier est inatteignable', () => {
    const level = createUnreachableBasketLevelDocument();
    const levelBeforeSimulation = structuredClone(level);

    withSession(level, (session) => {
      expect(session.readFailureEvaluation()).toEqual({
        status: 'pending',
        reason: null,
        failedAtFixedStep: null,
      });

      advanceUntilFailure(session, DEFAULT_ATTEMPT_TIMEOUT_FIXED_STEPS);

      const failure = session.readFailureEvaluation();
      expect(failure).toMatchObject({ status: 'failed', reason: 'out-of-scene' });
      // Bien avant la limite de temps : la chute dure environ 1,2 s.
      expect(failure.failedAtFixedStep).toBeLessThan(DEFAULT_ATTEMPT_TIMEOUT_FIXED_STEPS);
      expect(session.readState().fixedStep).toBe(failure.failedAtFixedStep);
      // Le centre de la balle a bien franchi la scène élargie de deux unités.
      expect(body(session.readState(), 'ball-1', 'primary').position.y).toBeGreaterThan(8);
      expect(session.readGoalEvaluation().status).toBe('pending');
      expect(level).toEqual(levelBeforeSimulation);

      session.reset();

      expect(session.readFailureEvaluation()).toEqual({
        status: 'pending',
        reason: null,
        failedAtFixedStep: null,
      });
      expect(level).toEqual(levelBeforeSimulation);
    });
  });

  it('conclut au temps écoulé pour une balle immobile dans la scène', () => {
    const level = createRestingBallLevelDocument();
    const levelBeforeSimulation = structuredClone(level);

    withSession(level, (session) => {
      session.advanceFixedSteps(DEFAULT_ATTEMPT_TIMEOUT_FIXED_STEPS - 1);

      const settled = body(session.readState(), 'ball-1', 'primary');
      expect(settled.linearVelocity).toEqual({ x: 0, y: 0 });
      expect(settled.position.y).toBeLessThan(6);
      expect(session.readFailureEvaluation()).toEqual({
        status: 'pending',
        reason: null,
        failedAtFixedStep: null,
      });

      session.advanceFixedSteps(1);

      expect(session.readFailureEvaluation()).toEqual({
        status: 'failed',
        reason: 'timeout',
        failedAtFixedStep: DEFAULT_ATTEMPT_TIMEOUT_FIXED_STEPS,
      });
      expect(session.readGoalEvaluation().status).toBe('pending');
      expect(level).toEqual(levelBeforeSimulation);
    });
  });

  it.each([
    ['sans objectif', undefined],
    ['avec une balle désignée et sans panier', { type: 'basket', ballId: 'ball-1' }],
  ] as const)(
    'laisse tomber une balle hors scène sans rien conclure, %s, et n’annonce que le temps écoulé (ADR 0020)',
    (_label, goal) => {
      const { goal: ignoredGoal, ...unreachable } = createUnreachableBasketLevelDocument();
      void ignoredGoal;
      const machine = levelDocumentSchema.parse(
        goal === undefined ? unreachable : { ...unreachable, goal },
      );

      withSession(machine, (session) => {
        session.advanceFixedSteps(DEFAULT_ATTEMPT_TIMEOUT_FIXED_STEPS - 1);

        expect(body(session.readState(), 'ball-1', 'primary').position.y).toBeGreaterThan(8);
        expect(session.hasReachedTimeLimit()).toBe(false);

        session.advanceFixedSteps(1);

        expect(session.hasReachedTimeLimit()).toBe(true);
        session.advanceFixedSteps(60);
        expect(session.readFailureEvaluation().status).toBe('pending');
        expect(session.readGoalEvaluation().status).toBe('pending');
      });
    },
  );

  it('n’atteint le temps écoulé qu’au bout de la durée injectée', () => {
    const session = createSimulationSession(createUnreachableBasketLevelDocument(), {
      fixedStepSeconds: FIXED_STEP_SECONDS,
      attemptTimeoutSeconds: 1,
    });

    try {
      session.advanceFixedSteps(59);
      expect(session.hasReachedTimeLimit()).toBe(false);
      session.advanceFixedSteps(1);
      expect(session.hasReachedTimeLimit()).toBe(true);
    } finally {
      session.destroy();
    }
  });

  it('compte la limite de temps en pas fixes issus de la durée injectée', () => {
    const level = createRestingBallLevelDocument();
    const session = createSimulationSession(level, {
      fixedStepSeconds: FIXED_STEP_SECONDS,
      attemptTimeoutSeconds: 1,
    });

    try {
      session.advanceFixedSteps(59);

      expect(session.readFailureEvaluation().status).toBe('pending');

      session.advanceFixedSteps(1);

      expect(session.readFailureEvaluation()).toEqual({
        status: 'failed',
        reason: 'timeout',
        failedAtFixedStep: 60,
      });
    } finally {
      session.destroy();
    }
  });

  it('pose une masse sur une poutre à la hauteur de son empreinte', () => {
    withSession(createMassLevelDocument(), (session) => {
      session.advanceFixedSteps(SETTLING_FIXED_STEPS);
      const resting = body(session.readState(), 'mass-resting', 'primary');

      expect(resting.bodyType).toBe('dynamic');
      expectCloseTo(resting.position.y, -(BEAM_HALF_THICKNESS + MASS_HALF_FOOTPRINT_HEIGHT));
      expectCloseTo(resting.position.x, 20);
    });
  });

  it('catapulte la balle quand la masse tombe sur l’autre bout de la bascule', () => {
    withSession(createMassLevelDocument(), (session) => {
      const start = body(session.readState(), 'ball-1', 'primary').position.y;
      let highest = start;
      for (let step = 0; step < 120; step += 1) {
        session.advanceFixedSteps(1);
        highest = Math.min(highest, body(session.readState(), 'ball-1', 'primary').position.y);
      }

      // Le bout de la planche ne monte que de 1,3 entre ses deux butées :
      // au-delà, c'est l'élan donné par les dix kilos qui lance la balle.
      expect(start - highest).toBeGreaterThan(1.5);
    });
  });

  it('entraîne ce que porte le convoyeur dans son sens, et rien quand il est arrêté', () => {
    // Une seconde de tapis : la masse, posée au bout d'une demi-seconde,
    // parcourt ensuite une bonne fraction de la vitesse du tapis.
    expect(massXAfter({ conveyor: 'right' }, 60)).toBeGreaterThan(0.4);
    expect(massXAfter({ conveyor: 'left' }, 60)).toBeLessThan(-0.4);
    expectCloseTo(massXAfter({ conveyor: 'stopped' }, 60), 0);
  });

  it('fait obéir un convoyeur relié au levier plutôt qu’à son propre sens', () => {
    expect(massXAfter({ conveyor: 'left', lever: 'right' }, 60)).toBeGreaterThan(0.4);
    expectCloseTo(massXAfter({ conveyor: 'right', lever: 'center' }, 60), 0);
  });

  it('retarde de la durée réglée le changement de position du levier', () => {
    withSession(
      createWiringLevelDocument({ conveyor: 'stopped', lever: 'left', timerDelaySeconds: 1 }),
      (session) => {
        expect(device(session.readState(), 'conveyor-1')).toMatchObject({ direction: 0 });
        expect(device(session.readState(), 'timer-1')).toMatchObject({
          kind: 'timer',
          delaySeconds: 1,
          remainingSeconds: 1,
          handAngle: 0,
        });

        session.advanceFixedSteps(30);
        expect(device(session.readState(), 'timer-1')).toMatchObject({
          remainingSeconds: 0.5,
          handAngle: Math.PI,
        });
        session.advanceFixedSteps(29);
        expect(device(session.readState(), 'conveyor-1')).toMatchObject({ direction: 0 });
        expect(device(session.readState(), 'timer-1')).toMatchObject({
          remainingSeconds: FIXED_STEP_SECONDS,
        });

        session.advanceFixedSteps(1);
        expect(device(session.readState(), 'conveyor-1')).toMatchObject({ direction: -1 });
        expect(device(session.readState(), 'timer-1')).toMatchObject({ remainingSeconds: null });
      },
    );
  });

  it('retransmet aussi le changement de cran provoqué plus tard par une balle', () => {
    const level = createWiringLevelDocument({
      conveyor: 'stopped',
      lever: 'center',
      ballDrop: { x: 5.88, y: -3 },
      timerDelaySeconds: 1,
    });

    withSession(level, (session) => {
      let changeStep: number | undefined;
      let checkedDelay = false;
      for (let step = 0; step < SETTLING_FIXED_STEPS; step += 1) {
        session.advanceFixedSteps(1);
        const state = session.readState();
        const leverState = device(state, 'lever-1');
        if (
          changeStep === undefined &&
          leverState.kind === 'lever' &&
          leverState.position === 'right'
        ) {
          changeStep = state.fixedStep;
        }
        if (changeStep !== undefined && state.fixedStep === changeStep + 59) {
          expect(device(state, 'conveyor-1')).toMatchObject({ direction: 0 });
        }
        if (changeStep !== undefined && state.fixedStep === changeStep + 60) {
          expect(device(state, 'conveyor-1')).toMatchObject({ direction: 1 });
          checkedDelay = true;
          break;
        }
      }

      expect(changeStep).toBeDefined();
      expect(checkedDelay).toBe(true);
    });
  });

  it('retarde séparément l’activation et la désactivation après un appui bref', () => {
    const level = createDeviceLevelDocument(
      [
        piston(),
        placed('timer-1', 'timer', { x: 2, y: 2 }, { delaySeconds: 1 }),
        // Clear of the piston's plate, which reaches x = 1,2 when extended.
        placed('button-1', 'button', { x: 2.5, y: 0.45 }),
        placed('press-ball', 'ball', { x: 2.75, y: -0.1 }),
      ],
      [{ id: 'wire-1', sourceId: 'button-1', timerId: 'timer-1', targetId: 'piston-1' }],
    );

    withSession(level, (session) => {
      let pressedAt: number | undefined;
      let releasedAt: number | undefined;
      let pistonExtended = false;
      let delayedReleaseChecked = false;
      for (let step = 0; step < 360; step += 1) {
        session.advanceFixedSteps(1);
        const state = session.readState();
        const buttonState = device(state, 'button-1');
        const pistonState = device(state, 'piston-1');
        if (buttonState.kind === 'button' && buttonState.pressed) {
          pressedAt ??= state.fixedStep;
        } else if (pressedAt !== undefined) {
          releasedAt ??= state.fixedStep;
        }
        if (pistonState.kind === 'piston' && pistonState.extension > 0.95) {
          pistonExtended = true;
        }
        if (releasedAt !== undefined && state.fixedStep === releasedAt + 59) {
          expect(pistonState).toMatchObject({ extension: 1 });
        }
        if (releasedAt !== undefined && state.fixedStep === releasedAt + 61) {
          expect(pistonState.kind === 'piston' && pistonState.extension).toBeLessThan(1);
          delayedReleaseChecked = true;
        }
      }

      expect(pressedAt).toBeDefined();
      expect(releasedAt).toBeDefined();
      expect(pistonExtended).toBe(true);
      expect(delayedReleaseChecked).toBe(true);
      expect(device(session.readState(), 'piston-1')).toMatchObject({ extension: 0 });
    });
  });

  it('tient la poignée du levier dans sa position de départ', () => {
    for (const position of ['left', 'center', 'right'] as const) {
      withSession(
        createWiringLevelDocument({ conveyor: 'stopped', lever: position }),
        (session) => {
          session.advanceFixedSteps(SETTLING_FIXED_STEPS);

          expect(device(session.readState(), 'lever-1')).toEqual({
            placementId: 'lever-1',
            kind: 'lever',
            position,
          });
          // Butées à 45° de la verticale, pas au-delà : la poignée ne se couche jamais.
          const expectedAngle = { left: -Math.PI / 4, center: 0, right: Math.PI / 4 }[position];
          expectCloseTo(
            body(session.readState(), 'lever-1', 'handle').rotation,
            expectedAngle,
            0.05,
          );
        },
      );
    }
  });

  it('tient les trois crans tous les 15°, sur le tour complet', () => {
    const rotations = Array.from(
      { length: 24 },
      (_, index) => ((index * 15 - 165) * Math.PI) / 180,
    );
    const turn = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));
    const failures: string[] = [];

    for (const rotation of rotations) {
      for (const position of ['left', 'center', 'right'] as const) {
        withSession(
          createWiringLevelDocument({
            conveyor: 'stopped',
            lever: position,
            leverRotation: rotation,
          }),
          (session) => {
            session.advanceFixedSteps(180);
            const state = session.readState();
            const actual = device(state, 'lever-1');
            const handle = body(state, 'lever-1', 'handle');
            const expectedAngle = { left: -Math.PI / 4, center: 0, right: Math.PI / 4 }[position];
            const degrees = (rotation * 180) / Math.PI;

            if (actual.kind !== 'lever' || actual.position !== position) {
              failures.push(
                `${String(degrees)}° ${position}: cran ${actual.kind === 'lever' ? actual.position : actual.kind}`,
              );
            }
            if (Math.abs(turn(handle.rotation - rotation - expectedAngle)) > 0.05) {
              failures.push(
                `${String(degrees)}° ${position}: angle ${String(turn(handle.rotation - rotation))}`,
              );
            }
          },
        );
      }
    }

    expect(failures).toEqual([]);
  });

  it('bascule un levier tourné à 90° sous l’impact d’une balle tombée sur le pommeau', () => {
    const level = createWiringLevelDocument({
      conveyor: 'stopped',
      lever: 'center',
      leverRotation: Math.PI / 2,
      ballDrop: { x: 6.7, y: -3 },
    });

    withSession(level, (session) => {
      session.advanceFixedSteps(SETTLING_FIXED_STEPS);

      expect(device(session.readState(), 'lever-1')).toMatchObject({ position: 'right' });
      expect(device(session.readState(), 'conveyor-1')).toMatchObject({ direction: 1 });
    });
  });

  it('bascule le levier sous l’impact d’une balle, et le convoyeur suit en pleine simulation', () => {
    const level = createWiringLevelDocument({
      conveyor: 'stopped',
      lever: 'center',
      // Juste à gauche du sommet du pommeau : le choc chasse le pommeau vers
      // la droite, au-delà de mi-course, et le cran de droite le retient.
      ballDrop: { x: 5.88, y: -3 },
    });

    withSession(level, (session) => {
      expect(device(session.readState(), 'conveyor-1')).toMatchObject({ direction: 0 });

      session.advanceFixedSteps(SETTLING_FIXED_STEPS);
      const state = session.readState();

      expect(device(state, 'lever-1')).toMatchObject({ position: 'right' });
      expect(device(state, 'conveyor-1')).toMatchObject({ direction: 1 });
      expect(body(state, 'mass-1', 'primary').position.x).toBeGreaterThan(0.2);
    });
  });

  it('fait défiler la bande d’une distance déterministe, remise à zéro au reset', () => {
    withSession(createWiringLevelDocument({ conveyor: 'left' }), (session) => {
      session.advanceFixedSteps(60);
      const offset = device(session.readState(), 'conveyor-1');

      expect(offset).toMatchObject({ kind: 'conveyor', direction: -1, facing: -1 });
      expect(offset.kind === 'conveyor' && offset.beltOffset).toBeCloseTo(-CONVEYOR_SPEED);

      session.reset();
      expect(device(session.readState(), 'conveyor-1')).toMatchObject({ beltOffset: 0 });
    });
  });

  it('emporte une balle presque à la vitesse du tapis, au lieu de la faire tourner sur place', () => {
    withSession(createRollingLevelDocument(), (session) => {
      session.advanceFixedSteps(90);
      const ball = body(session.readState(), 'ball-1', 'primary');

      expect(ball.linearVelocity.x).toBeGreaterThan(0.8 * CONVEYOR_SPEED);
    });
  });

  it('arrête une balle qui roule sur une poutre plate, par résistance au roulement', () => {
    withSession(createRampLevelDocument(), (session) => {
      session.advanceFixedSteps(60);
      const launched = body(session.readState(), 'ball-1', 'primary');
      expect(launched.linearVelocity.x).toBeGreaterThan(1);

      session.advanceFixedSteps(15 * 60);
      const ball = body(session.readState(), 'ball-1', 'primary');

      // Toujours sur la poutre, et immobile.
      expectCloseTo(ball.position.y, -(BEAM_HALF_THICKNESS + BALL_RADIUS));
      expect(ball.position.x).toBeLessThan(3);
      expect(Math.abs(ball.linearVelocity.x)).toBeLessThan(0.02);
    });
  });

  it('fait pivoter la planche après un impact puis revient à son angle initial', () => {
    const level = createSeesawImpactLevelDocument();

    withSession(level, (session) => {
      const initialBoard = body(session.readState(), 'seesaw-1', 'board');

      session.advanceFixedSteps(180);

      const impactedBoard = body(session.readState(), 'seesaw-1', 'board');
      expect(Math.abs(impactedBoard.rotation - initialBoard.rotation)).toBeGreaterThan(0.01);

      session.reset();

      const resetBoard = body(session.readState(), 'seesaw-1', 'board');
      expect(resetBoard.rotation).toBeCloseTo(initialBoard.rotation, 5);
    });
  });

  it('enfonce le bouton tant qu’un objet pèse dessus, et seulement alors', () => {
    const level = createDeviceLevelDocument([
      ball({ x: 0, y: -1.5 }),
      placed('button-1', 'button', { x: 0, y: 0 }),
      placed('button-2', 'button', { x: 3, y: 0 }),
    ]);

    withSession(level, (session) => {
      expect(device(session.readState(), 'button-1')).toEqual({
        placementId: 'button-1',
        kind: 'button',
        pressed: false,
      });

      session.advanceFixedSteps(SETTLING_FIXED_STEPS);
      const state = session.readState();

      expect(device(state, 'button-1')).toMatchObject({ pressed: true });
      expect(device(state, 'button-2')).toMatchObject({ pressed: false });
      // Le capuchon enfoncé descend vraiment : la balle repose dessus, sans jour.
      expectCloseTo(
        body(state, 'ball-1', 'primary').position.y,
        BUTTON_CAP_TOP + BUTTON_CAP_TRAVEL - BALL_RADIUS,
      );
    });
  });

  it('souffle la balle vers le haut quand le ventilateur tourne, et la laisse tomber sinon', () => {
    const ballYAfter = (state: string): number => {
      let y = 0;
      withSession(
        createDeviceLevelDocument([ball({ x: 0, y: -1.2 }), fan(-Math.PI / 2, state)]),
        (session) => {
          session.advanceFixedSteps(90);
          y = body(session.readState(), 'ball-1', 'primary').position.y;
        },
      );
      return y;
    };

    // Le souffle décroît avec la distance : la balle flotte au-dessus de la bouche.
    expect(ballYAfter('on')).toBeLessThan(-1.2);
    expect(ballYAfter('off')).toBeGreaterThan(-0.7);
  });

  it('souffle dans l’axe d’un ventilateur incliné, pas au quart de tour le plus proche', () => {
    // Tourné de -60° : il souffle vers le haut et la droite, à 30° de la verticale.
    // One step from rest: the velocity gained is the fan's push alone, gravity aside.
    const velocityAfter = (state: string): { readonly x: number; readonly y: number } => {
      let velocity = { x: 0, y: 0 };
      withSession(
        createDeviceLevelDocument([ball({ x: 0.6, y: -1.04 }), fan(-Math.PI / 3, state)]),
        (session) => {
          session.advanceFixedSteps(1);
          velocity = body(session.readState(), 'ball-1', 'primary').linearVelocity;
        },
      );
      return velocity;
    };

    const blown = velocityAfter('on');
    const still = velocityAfter('off');
    const push = { x: blown.x - still.x, y: blown.y - still.y };
    expect(push.x).toBeGreaterThan(0);
    // Along the axis (0.5, -0.87): √3 times higher than wide.
    expectCloseTo(-push.y / push.x, Math.sqrt(3), 0.01);
  });

  it('pousse une balle posée devant lui, beaucoup plus qu’une masse de dix kilos', () => {
    const floor = placed('floor', 'beam', { x: 1.5, y: 0 }, { size: 'long' });
    // Ventilateur posé sur la poutre, bouche à hauteur de ce qui roule dessus.
    const blower = fan(0, 'on', { x: -1.2, y: -0.593 });
    const xAfter = (objects: readonly unknown[], id: string): number => {
      let x = 0;
      withSession(createDeviceLevelDocument([floor, blower, ...objects]), (session) => {
        session.advanceFixedSteps(60);
        x = body(session.readState(), id, 'primary').position.x;
      });
      return x;
    };

    expect(xAfter([ball({ x: 0.2, y: -0.43 })], 'ball-1')).toBeGreaterThan(1);
    expectCloseTo(xAfter([mass('mass-1', { x: 0.2, y: -0.39 })], 'mass-1'), 0.2, 0.05);
  });

  it('met en marche un ventilateur relié à un levier de côté ou à un bouton enfoncé', () => {
    const running = (objects: readonly unknown[], sourceId: string): boolean => {
      let result = false;
      withSession(
        createDeviceLevelDocument(
          [fan(0, 'off', { x: 6, y: 0 }), ...objects],
          [{ id: 'wire-1', sourceId, targetId: 'fan-1' }],
        ),
        (session) => {
          session.advanceFixedSteps(SETTLING_FIXED_STEPS);
          const fanState = device(session.readState(), 'fan-1');
          result = fanState.kind === 'fan' && fanState.running;
        },
      );
      return result;
    };
    const lever = (position: string) => placed('lever-1', 'lever', { x: 0, y: 0 }, { position });
    const button = placed('button-1', 'button', { x: 0, y: 0 });

    expect(running([lever('center')], 'lever-1')).toBe(false);
    expect(running([lever('left')], 'lever-1')).toBe(true);
    expect(running([lever('right')], 'lever-1')).toBe(true);
    expect(running([button], 'button-1')).toBe(false);
    expect(running([button, mass('mass-1', { x: 0, y: -1 })], 'button-1')).toBe(true);
  });

  it('fait basculer un appareil relié à l’opposé de son état de départ quand sa commande est active', () => {
    const lever = (position: string) => placed('lever-1', 'lever', { x: 0, y: 0 }, { position });
    const deviceAfter = (target: unknown, position: string) => {
      let result: ReturnType<typeof device> | undefined;
      withSession(
        createDeviceLevelDocument(
          [target, lever(position)],
          [{ id: 'wire-1', sourceId: 'lever-1', targetId: 'device-1' }],
        ),
        (session) => {
          session.advanceFixedSteps(SETTLING_FIXED_STEPS);
          result = device(session.readState(), 'device-1');
        },
      );
      return result;
    };
    const runningFan = placed('device-1', 'fan', { x: 6, y: 0 }, { state: 'on' });
    const openBarrier = placed('device-1', 'barrier', { x: 6, y: 0 }, { state: 'open' });

    expect(deviceAfter(runningFan, 'center')).toMatchObject({ kind: 'fan', running: true });
    expect(deviceAfter(runningFan, 'left')).toMatchObject({ kind: 'fan', running: false });
    expect(deviceAfter(openBarrier, 'center')).toMatchObject({ kind: 'barrier', retraction: 1 });
    expect(deviceAfter(openBarrier, 'right')).toMatchObject({ kind: 'barrier', retraction: 0 });
  });

  it('fait tourner les pales d’un ventilateur en marche, et d’un angle remis à zéro au reset', () => {
    withSession(createDeviceLevelDocument([fan(Math.PI, 'on')]), (session) => {
      session.advanceFixedSteps(60);
      const spinning = device(session.readState(), 'fan-1');

      expect(spinning).toMatchObject({ kind: 'fan', running: true });
      expect(spinning.kind === 'fan' && Math.abs(spinning.bladeAngle)).toBeGreaterThan(Math.PI);

      session.reset();
      expect(device(session.readState(), 'fan-1')).toMatchObject({ bladeAngle: 0 });
    });
  });

  describe('le souffle est arrêté par les solides', () => {
    // Ventilateur soufflant vers la droite, en l'air : la bouche est à y ≈ −0,08.
    const MOUTH_Y = -0.0765;
    const STEPS = 10;
    const wall = (x: number) =>
      placed('wall', 'beam', { x, y: MOUTH_Y }, { size: 'short' }, Math.PI / 2);
    const velocitiesX = (objects: readonly unknown[]): Record<string, number> => {
      const result: Record<string, number> = {};
      withSession(createDeviceLevelDocument([fan(0, 'on'), ...objects]), (session) => {
        session.advanceFixedSteps(STEPS);
        const state = session.readState();
        for (const id of ['ball-1', 'ball-2']) {
          if (state.bodies.some(({ placementId }) => placementId === id)) {
            result[id] = body(state, id, 'primary').linearVelocity.x;
          }
        }
      });
      return result;
    };

    it('pousse une balle à découvert, pas une balle abritée derrière une poutre', () => {
      const target = ball({ x: 2, y: MOUTH_Y });

      expect(velocitiesX([target])['ball-1']).toBeGreaterThan(0.5);
      expectCloseTo(velocitiesX([target, wall(1.2)])['ball-1'] ?? Number.NaN, 0, 1e-6);
    });

    it('ignore une poutre qui ne coupe pas le trajet de l’air', () => {
      const target = ball({ x: 2, y: MOUTH_Y });
      const aside = placed('aside', 'beam', { x: 1.2, y: -1.5 }, { size: 'short' });

      expectCloseTo(
        velocitiesX([target, aside])['ball-1'] ?? Number.NaN,
        velocitiesX([target])['ball-1'] ?? Number.NaN,
        1e-9,
      );
    });

    it('laisse une balle placée devant en abriter une autre', () => {
      const front = placed('ball-2', 'ball', { x: 1, y: MOUTH_Y });
      const velocities = velocitiesX([ball({ x: 2, y: MOUTH_Y }), front]);

      expect(velocities['ball-2']).toBeGreaterThan(0.5);
      expectCloseTo(velocities['ball-1'] ?? Number.NaN, 0, 1e-6);
    });
  });

  it('retient la balle sur la barre fermée, et la laisse tomber quand elle est ouverte', () => {
    const ballAfter = (state: string): SimulationBodyState => {
      let result: SimulationBodyState | undefined;
      withSession(
        createDeviceLevelDocument([ball({ x: 0.8, y: -1 }), barrier(state)]),
        (session) => {
          session.advanceFixedSteps(SETTLING_FIXED_STEPS);
          result = body(session.readState(), 'ball-1', 'primary');
          expect(device(session.readState(), 'barrier-1')).toMatchObject({
            kind: 'barrier',
            retraction: state === 'open' ? 1 : 0,
          });
        },
      );
      if (result === undefined) throw new Error('Simulation non exécutée');
      return result;
    };

    expectCloseTo(
      ballAfter('closed').position.y,
      BARRIER_BAR_CENTER_Y - BARRIER_BAR_HALF_THICKNESS - BALL_RADIUS,
    );
    expect(ballAfter('open').position.y).toBeGreaterThan(5);
  });

  it('sort la barre de l’autre côté après un demi-tour', () => {
    withSession(
      createDeviceLevelDocument([ball({ x: -0.8, y: -1 }), barrier('closed', Math.PI)]),
      (session) => {
        session.advanceFixedSteps(SETTLING_FIXED_STEPS);
        const resting = body(session.readState(), 'ball-1', 'primary');

        expectCloseTo(resting.position.x, -0.8, 0.05);
        expectCloseTo(
          resting.position.y,
          BARRIER_BAR_CENTER_Y - BARRIER_BAR_HALF_THICKNESS - BALL_RADIUS,
        );
      },
    );
  });

  it('renvoie de côté ce qui arrive sur un tremplin tourné d’un quart de tour', () => {
    // Plateau tourné vers la droite : une balle qui dévale une rampe vers la
    // gauche le percute de face et repart vers la droite.
    withSession(
      createDeviceLevelDocument([
        ball({ x: 2.5, y: -0.7 }),
        placed('ramp', 'beam', { x: 1.7, y: 0.1 }, { size: 'short' }, -0.4),
        placed('springboard-1', 'springboard', { x: 0, y: 0 }, {}, Math.PI / 2),
      ]),
      (session) => {
        let bounced = false;
        for (let step = 0; step < 180; step += 1) {
          session.advanceFixedSteps(1);
          if (body(session.readState(), 'ball-1', 'primary').linearVelocity.x > 2) bounced = true;
        }
        expect(bounced).toBe(true);
      },
    );
  });

  it('fait rentrer la barre quand une masse enfonce le bouton relié, et la balle tombe', () => {
    const level = createDeviceLevelDocument(
      [
        ball({ x: 0.8, y: -1 }),
        barrier('closed'),
        placed('button-1', 'button', { x: 6, y: 0 }),
        mass('mass-1', { x: 6, y: -2 }),
      ],
      [{ id: 'wire-1', sourceId: 'button-1', targetId: 'barrier-1' }],
    );

    withSession(level, (session) => {
      session.advanceFixedSteps(20);
      expect(device(session.readState(), 'barrier-1')).toMatchObject({ retraction: 0 });

      session.advanceFixedSteps(SETTLING_FIXED_STEPS);
      const state = session.readState();

      expect(device(state, 'barrier-1')).toMatchObject({ retraction: 1 });
      expect(body(state, 'ball-1', 'primary').position.y).toBeGreaterThan(5);
    });
  });

  it('renvoie une balle tombée sur le tremplin presque à sa hauteur de chute', () => {
    const apexAfterBounce = (surface: unknown): number => {
      let apex = Number.POSITIVE_INFINITY;
      withSession(createDeviceLevelDocument([ball({ x: 0, y: -3 }), surface]), (session) => {
        let falling = true;
        for (let step = 0; step < 150; step += 1) {
          session.advanceFixedSteps(1);
          const current = body(session.readState(), 'ball-1', 'primary');
          if (falling && current.linearVelocity.y < 0) falling = false;
          if (!falling) apex = Math.min(apex, current.position.y);
        }
      });
      return apex;
    };

    // Le plateau affleure à 0,47 au-dessus de l'origine : chute d'environ 2,2.
    const springboardApex = apexAfterBounce(placed('springboard-1', 'springboard', { x: 0, y: 0 }));
    const beamApex = apexAfterBounce(
      placed('beam-1', 'beam', { x: 0, y: -0.34 }, { size: 'short' }),
    );

    expect(springboardApex).toBeLessThan(-2.4);
    expect(beamApex).toBeGreaterThan(-1.2);
  });

  it('tasse le ressort du tremplin à l’impact, puis le détend', () => {
    withSession(
      createDeviceLevelDocument([
        ball({ x: 0, y: -3 }),
        placed('springboard-1', 'springboard', { x: 0, y: 0 }),
      ]),
      (session) => {
        let strongest = 0;
        for (let step = 0; step < 60; step += 1) {
          session.advanceFixedSteps(1);
          const spring = device(session.readState(), 'springboard-1');
          if (spring.kind === 'springboard') strongest = Math.max(strongest, spring.compression);
        }

        expect(strongest).toBeGreaterThan(0.3);
        expect(strongest).toBeLessThanOrEqual(1);
        session.reset();
        expect(device(session.readState(), 'springboard-1')).toMatchObject({ compression: 0 });
      },
    );
  });
});

describe('piston commandé par bouton', () => {
  it('démarre fermé, pousse les objets devant lui et reste sorti pendant un appui maintenu', () => {
    const level = createDeviceLevelDocument(
      [
        piston(),
        placed('button-1', 'button', { x: 5, y: 0 }),
        placed('press-ball', 'ball', { x: 5, y: -0.55 }),
        placed('payload', 'ball', { x: 0.95, y: 0.2 }),
      ],
      [{ id: 'wire-1', sourceId: 'button-1', targetId: 'piston-1' }],
    );

    withSession(level, (session) => {
      expect(device(session.readState(), 'piston-1')).toMatchObject({
        kind: 'piston',
        extension: 0,
      });

      let wasPropelled = false;
      for (let step = 0; step < 180; step += 1) {
        session.advanceFixedSteps(1);
        if (body(session.readState(), 'payload', 'primary').linearVelocity.x > 1) {
          wasPropelled = true;
        }
      }

      expect(device(session.readState(), 'button-1')).toMatchObject({ pressed: true });
      expect(device(session.readState(), 'piston-1')).toMatchObject({ extension: 1 });
      expect(wasPropelled).toBe(true);

      session.advanceFixedSteps(60);
      expect(device(session.readState(), 'piston-1')).toMatchObject({ extension: 1 });
      session.reset();
      expect(device(session.readState(), 'piston-1')).toMatchObject({ extension: 0 });
    });
  });

  it('termine sa sortie après un appui bref, puis se rétracte automatiquement', () => {
    const level = createDeviceLevelDocument(
      [
        piston(),
        placed('button-1', 'button', { x: 0.5, y: 0.45 }),
        placed('press-ball', 'ball', { x: 0.75, y: -0.1 }),
      ],
      [{ id: 'wire-1', sourceId: 'button-1', targetId: 'piston-1' }],
    );

    withSession(level, (session) => {
      let maximumExtension = 0;
      for (let step = 0; step < 120; step += 1) {
        session.advanceFixedSteps(1);
        const current = device(session.readState(), 'piston-1');
        if (current.kind === 'piston')
          maximumExtension = Math.max(maximumExtension, current.extension);
      }

      expect(maximumExtension).toBeGreaterThan(0.95);
      expect(device(session.readState(), 'button-1')).toMatchObject({ pressed: false });
      expect(device(session.readState(), 'piston-1')).toMatchObject({ extension: 0 });
      expect(body(session.readState(), 'press-ball', 'primary').position.x).toBeGreaterThan(0.75);
    });
  });

  it('oriente la course du piston selon sa rotation', () => {
    const level = createDeviceLevelDocument(
      [
        piston(Math.PI / 2),
        placed('button-1', 'button', { x: 5, y: 0 }),
        placed('press-ball', 'ball', { x: 5, y: -1 }),
      ],
      [{ id: 'wire-1', sourceId: 'button-1', targetId: 'piston-1' }],
    );

    withSession(level, (session) => {
      session.advanceFixedSteps(120);
      expect(device(session.readState(), 'piston-1')).toMatchObject({ extension: 1 });
      expect(body(session.readState(), 'piston-1', 'piston').position.x).toBeCloseTo(0, 3);
      expect(body(session.readState(), 'piston-1', 'piston').position.y).toBeCloseTo(0.9352, 3);
    });
  });

  it('éjecte verticalement une balle sur toute la hauteur de la scène', () => {
    const scene = { min: { x: -6, y: -5 }, max: { x: 6, y: 5 } };
    const level = levelDocumentSchema.parse({
      schemaVersion: 3,
      id: 'piston-full-screen-launch',
      metadata: { title: 'Piston sur toute la hauteur' },
      objects: [
        placed('ball-1', 'ball', { x: -5, y: 4 }),
        placed('basket-1', 'basket', { x: -4, y: 4 }),
        piston(-Math.PI / 2, { x: 0, y: 4.3 }),
        placed('shot-ball', 'ball', { x: 0, y: 3.479 }),
        placed('button-1', 'button', { x: 4, y: 0 }),
        placed('press-ball', 'ball', { x: 4, y: -0.55 }),
      ],
      inventory: [],
      goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
      buildZones: [],
      wires: [{ id: 'wire-1', sourceId: 'button-1', targetId: 'piston-1' }],
      scene,
    });

    withSession(level, (session) => {
      let highestY = body(session.readState(), 'shot-ball', 'primary').position.y;
      let strongestUpwardSpeed = 0;
      for (let step = 0; step < 120; step += 1) {
        session.advanceFixedSteps(1);
        const shot = body(session.readState(), 'shot-ball', 'primary');
        highestY = Math.min(highestY, shot.position.y);
        strongestUpwardSpeed = Math.max(strongestUpwardSpeed, -shot.linearVelocity.y);
      }

      expect(highestY).toBeLessThan(scene.min.y);
      expect(strongestUpwardSpeed).toBeGreaterThan(20);
    });
  });
});
