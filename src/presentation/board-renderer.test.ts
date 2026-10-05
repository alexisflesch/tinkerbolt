import { describe, expect, it } from 'vitest';

import { embeddedWorkshopDocument } from '../content/embedded-levels';
import {
  spriteAssetPath,
  type DecodedSprite,
  type SpriteAsset,
  type SpriteFamily,
  type SpriteLoader,
} from './sprite-loader';
import { levelDocumentSchema } from '../domain/level-document';
import { ROTATION_HANDLE_KNOB_RADIUS_CSS_PIXELS } from './rotation-handle-metrics';
import {
  constrainingBuildZones,
  withAuthorRotation,
  createBoardRenderer,
  projectLevel,
  worldToPixels,
  type BoardCanvasContext,
  type BoardConveyorBelt,
  type BoardDeviceView,
  type BoardPose,
  type BoardSimulationView,
  type BoardViewport,
} from './board-renderer';

type Operation =
  | { readonly kind: 'setTransform'; readonly values: readonly number[] }
  | { readonly kind: 'save' }
  | { readonly kind: 'restore' }
  | { readonly kind: 'translate'; readonly values: readonly number[] }
  | { readonly kind: 'rotate'; readonly values: readonly number[] }
  | { readonly kind: 'scale'; readonly values: readonly number[] }
  | { readonly kind: 'lineWidth'; readonly values: readonly number[] }
  | { readonly kind: 'strokeRect'; readonly values: readonly number[] }
  | { readonly kind: 'fillRect'; readonly values: readonly number[] }
  | { readonly kind: 'drawImage'; readonly values: readonly unknown[] }
  | { readonly kind: 'beginPath' }
  | { readonly kind: 'moveTo'; readonly values: readonly number[] }
  | { readonly kind: 'lineTo'; readonly values: readonly number[] }
  | { readonly kind: 'arc'; readonly values: readonly number[] }
  | { readonly kind: 'ellipse'; readonly values: readonly number[] }
  | { readonly kind: 'radialGradient'; readonly values: readonly number[] }
  | { readonly kind: 'colourStop'; readonly values: readonly [number, string] }
  | { readonly kind: 'fill' }
  | { readonly kind: 'stroke' }
  | { readonly kind: 'globalAlpha'; readonly values: readonly number[] }
  | { readonly kind: 'fillText'; readonly values: readonly unknown[] }
  | { readonly kind: 'setLineDash'; readonly values: readonly number[] }
  | { readonly kind: 'strokeStyle'; readonly values: readonly string[] };

type ProjectedObject = Readonly<{
  readonly family: SpriteFamily;
  readonly assetKey: SpriteAsset;
  readonly assetPath: string;
  readonly destination: Readonly<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }>;
  readonly layer: Readonly<{
    readonly destination: Readonly<{
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    }>;
  }>;
}>;

type BeamSize = 'short' | 'medium' | 'long';

const createBeamDocument = (size: BeamSize) =>
  levelDocumentSchema.parse({
    ...levelDocument,
    objects: [
      ...levelDocument.objects.filter(
        (object) => object.type === 'ball' || object.type === 'basket',
      ),
      {
        id: `beam-${size}`,
        type: 'beam',
        transform: { position: { x: 12, y: 8 }, rotation: 0 },
        props: { size },
        permissions: { move: true, rotate: true, remove: true },
      },
    ],
  });

/**
 * Renders `document` and returns the destination Canvas rectangle drawn for
 * its (single) beam. Locates the beam's `drawImage` op by its position in
 * `projection.objects` rather than assuming it is drawn last: B4 introduced
 * a draw order where a ball is drawn after every non-ball object, so "last
 * drawn" no longer means "last in the document" once a ball is present.
 */
const renderDestination = async (
  document: Parameters<typeof projectLevel>[0],
  renderViewport: BoardViewport,
): Promise<{
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}> => {
  const { context, operations } = createContext();
  const spriteLoader = createPendingSpriteLoader();
  spriteLoader.setReady();
  const projection = projectLevel(document);
  const renderer = createBoardRenderer({
    canvas: { width: 0, height: 0 },
    context,
    viewport: renderViewport,
    spriteLoader: spriteLoader.loader,
  });

  await renderer.render(projection);

  const drawOperations = operations.filter(
    (candidate): candidate is Extract<Operation, { readonly kind: 'drawImage' }> =>
      candidate.kind === 'drawImage',
  );
  const beamIndex = projection.objects.findIndex(
    (object: ProjectedObject) => object.family === 'beam',
  );
  if (beamIndex === -1) {
    throw new Error('Aucune poutre n’est présente dans la projection.');
  }
  const operation = drawOperations[beamIndex];
  if (operation === undefined) {
    throw new Error('Aucune opération drawImage n’a été enregistrée pour la poutre.');
  }

  const [x, y, width, height] = operation.values.slice(-4);
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number'
  ) {
    throw new Error('La destination Canvas enregistrée est invalide.');
  }

  return { x, y, width, height };
};

const drawnAssetOrder = async (
  document: Parameters<typeof projectLevel>[0],
): Promise<readonly SpriteAsset[]> => {
  const { context, operations } = createContext();
  const spriteLoader = createPendingSpriteLoader();
  spriteLoader.setReady();
  const renderer = createBoardRenderer({
    canvas: { width: 0, height: 0 },
    context,
    viewport,
    spriteLoader: spriteLoader.loader,
  });

  await renderer.render(projectLevel(document));

  const drawOperations = operations.filter(
    (candidate): candidate is Extract<Operation, { readonly kind: 'drawImage' }> =>
      candidate.kind === 'drawImage',
  );

  return drawOperations.map((operation) => {
    const source = operation.values[0];
    const entry = (
      Object.entries(spriteLoader.sprites) as ReadonlyArray<[SpriteAsset, DecodedSprite]>
    ).find(([, sprite]) => sprite.source === source);
    if (entry === undefined) {
      throw new Error('Le sprite dessiné est introuvable parmi les sprites chargés.');
    }
    return entry[0];
  });
};

const viewport = {
  cssWidth: 320,
  cssHeight: 240,
  origin: { x: 10, y: 5 },
  pixelsPerWorldUnit: 4,
  devicePixelRatio: 2,
} satisfies BoardViewport;

const levelDocument = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'presentation-contract',
  metadata: { title: 'Contrat de rendu' },
  objects: [
    {
      id: 'ball-1',
      type: 'ball',
      transform: { position: { x: 12, y: 8 }, rotation: 0 },
      props: {},
      permissions: { move: true, rotate: false, remove: true },
    },
    {
      id: 'basket-1',
      type: 'basket',
      transform: { position: { x: 14, y: 9 }, rotation: 0 },
      props: {},
      permissions: { move: true, rotate: false, remove: true },
    },
    {
      id: 'beam-1',
      type: 'beam',
      transform: { position: { x: 16, y: 10 }, rotation: Math.PI / 4 },
      props: { size: 'medium' },
      permissions: { move: true, rotate: true, remove: true },
    },
    {
      id: 'seesaw-1',
      type: 'seesaw',
      transform: { position: { x: 18, y: 11 }, rotation: 0 },
      props: {},
      permissions: { move: true, rotate: false, remove: true },
    },
  ],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [],
  scene: { min: { x: 10, y: 6 }, max: { x: 20, y: 13 } },
});

/** The rotation handle's knob: a full circle of the knob's radius. */
const isRotationKnob = (operation: Operation): boolean =>
  operation.kind === 'arc' &&
  operation.values[2] === ROTATION_HANDLE_KNOB_RADIUS_CSS_PIXELS &&
  operation.values[4] === 2 * Math.PI;

const createContext = (): {
  readonly context: BoardCanvasContext;
  readonly operations: Operation[];
  /** The `fillStyle` in force at each `fillRect`, in call order. */
  readonly fillRectStyles: unknown[];
} => {
  const operations: Operation[] = [];
  const fillRectStyles: unknown[] = [];
  let fillStyle: string | CanvasGradient = '';
  let lineWidth = 1;
  let globalAlpha = 1;
  let strokeStyle = '';

  const context = {
    save: (): void => {
      operations.push({ kind: 'save' });
    },
    restore: (): void => {
      operations.push({ kind: 'restore' });
    },
    setTransform: (...values: [number, number, number, number, number, number]): void => {
      operations.push({ kind: 'setTransform', values });
    },
    translate: (...values: [number, number]): void => {
      operations.push({ kind: 'translate', values });
    },
    rotate: (...values: [number]): void => {
      operations.push({ kind: 'rotate', values });
    },
    scale: (...values: [number, number]): void => {
      operations.push({ kind: 'scale', values });
    },
    get lineWidth(): number {
      return lineWidth;
    },
    set lineWidth(value: number) {
      lineWidth = value;
      operations.push({ kind: 'lineWidth', values: [value] });
    },
    strokeRect: (...values: [number, number, number, number]): void => {
      operations.push({ kind: 'strokeRect', values });
    },
    setLineDash: (values: readonly number[]): void => {
      operations.push({ kind: 'setLineDash', values });
    },
    fillRect: (...values: [number, number, number, number]): void => {
      fillRectStyles.push(fillStyle);
      operations.push({ kind: 'fillRect', values });
    },
    drawImage: (...values: readonly unknown[]): void => {
      operations.push({ kind: 'drawImage', values });
    },
    drawImageRegion: (...values: readonly unknown[]): void => {
      operations.push({ kind: 'drawImage', values });
    },
    get globalAlpha(): number {
      return globalAlpha;
    },
    set globalAlpha(value: number) {
      globalAlpha = value;
      operations.push({ kind: 'globalAlpha', values: [value] });
    },
    get strokeStyle(): string {
      return strokeStyle;
    },
    set strokeStyle(value: string) {
      strokeStyle = value;
      operations.push({ kind: 'strokeStyle', values: [value] });
    },
    get fillStyle(): string | CanvasGradient {
      return fillStyle;
    },
    set fillStyle(value: string | CanvasGradient) {
      fillStyle = value;
    },
    lineCap: 'butt',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    beginPath: (): void => {
      operations.push({ kind: 'beginPath' });
    },
    moveTo: (...values: [number, number]): void => {
      operations.push({ kind: 'moveTo', values });
    },
    lineTo: (...values: [number, number]): void => {
      operations.push({ kind: 'lineTo', values });
    },
    arc: (...values: number[]): void => {
      operations.push({ kind: 'arc', values });
    },
    ellipse: (...values: number[]): void => {
      operations.push({ kind: 'ellipse', values });
    },
    createRadialGradient: (...values: number[]): CanvasGradient => {
      operations.push({ kind: 'radialGradient', values });
      return {
        addColorStop: (offset: number, colour: string) => {
          operations.push({ kind: 'colourStop', values: [offset, colour] });
        },
      };
    },
    stroke: (): void => {
      operations.push({ kind: 'stroke' });
    },
    fill: (): void => {
      operations.push({ kind: 'fill' });
    },
    fillText: (...values: readonly unknown[]): void => {
      operations.push({ kind: 'fillText', values });
    },
  } satisfies BoardCanvasContext;

  return { context, operations, fillRectStyles };
};

/** A decoded sprite whose bitmap is a marker object, so a draw names its asset. */
const fakeSprite = (asset: SpriteAsset): DecodedSprite => ({
  width: 64,
  height: 32,
  source: { asset },
});

const createPendingSpriteLoader = (): {
  readonly loader: SpriteLoader;
  readonly requestedFamilies: SpriteFamily[];
  readonly sprites: Readonly<Record<SpriteAsset, DecodedSprite>>;
  readonly release: () => void;
  readonly setReady: () => void;
} => {
  const requestedFamilies: SpriteFamily[] = [];
  const sprites: Readonly<Record<SpriteAsset, DecodedSprite>> = {
    'ball-base': fakeSprite('ball-base'),
    'ball-spin': fakeSprite('ball-spin'),
    'ball-highlight': fakeSprite('ball-highlight'),
    'second-ball-base': fakeSprite('second-ball-base'),
    'second-ball-spin': fakeSprite('second-ball-spin'),
    'second-ball-highlight': fakeSprite('second-ball-highlight'),
    'basket-back': fakeSprite('basket-back'),
    'basket-front': fakeSprite('basket-front'),
    'beam-short': fakeSprite('beam-short'),
    'beam-medium': fakeSprite('beam-medium'),
    'beam-long': fakeSprite('beam-long'),
    'seesaw-fulcrum': fakeSprite('seesaw-fulcrum'),
    'seesaw-beam': fakeSprite('seesaw-beam'),
    'mass-10kg': fakeSprite('mass-10kg'),
    'box-wood': fakeSprite('box-wood'),
    'box-metal': fakeSprite('box-metal'),
    'electro-magnet-off': fakeSprite('electro-magnet-off'),
    'electro-magnet-on': fakeSprite('electro-magnet-on'),
    'piston-rod': fakeSprite('piston-rod'),
    'piston-housing': fakeSprite('piston-housing'),
    'piston-plate': fakeSprite('piston-plate'),
    'timer-background': fakeSprite('timer-background'),
    'timer-hand': fakeSprite('timer-hand'),
    'lever-base': fakeSprite('lever-base'),
    'lever-handle': fakeSprite('lever-handle'),
    'conveyor-belt': fakeSprite('conveyor-belt'),
    'conveyor-belt-left': fakeSprite('conveyor-belt-left'),
    'conveyor-frame': fakeSprite('conveyor-frame'),
    'button-base': fakeSprite('button-base'),
    'button-cap': fakeSprite('button-cap'),
    'fan-blades': fakeSprite('fan-blades'),
    'fan-body': fakeSprite('fan-body'),
    'barrier-bar': fakeSprite('barrier-bar'),
    'barrier-pillar': fakeSprite('barrier-pillar'),
    'springboard-spring': fakeSprite('springboard-spring'),
    'springboard-base': fakeSprite('springboard-base'),
    'springboard-platform': fakeSprite('springboard-platform'),
  };
  let ready = false;
  let releasePending: () => void = () => {
    throw new Error('Le chargement des sprites n’a pas été initialisé.');
  };
  const loading = new Promise<void>((resolve) => {
    releasePending = resolve;
  });

  const loader = {
    getState: (family: SpriteFamily) => {
      void family;
      return ready ? 'ready' : 'loading';
    },
    getSprite: (asset: SpriteAsset) => {
      return ready ? sprites[asset] : undefined;
    },
    loadForFamilies: async (families: readonly SpriteFamily[]): Promise<void> => {
      requestedFamilies.push(...families);
      if (ready) {
        return;
      }
      await loading;
      ready = true;
    },
  } satisfies SpriteLoader;

  return {
    loader,
    requestedFamilies,
    sprites,
    release: releasePending,
    setReady: (): void => {
      ready = true;
    },
  };
};

const simulationView = (
  poses: readonly (readonly [string, BoardPose])[],
  belts: readonly (readonly [string, BoardConveyorBelt])[] = [],
  devices: readonly (readonly [string, BoardDeviceView])[] = [],
): BoardSimulationView => ({
  bodyPoses: new Map(poses),
  conveyorBelts: new Map(belts),
  devices: new Map(devices),
});

/** One object of the given family at (3, 3), next to the goal pair. */
const createDeviceDocument = (
  type: string,
  props: Readonly<Record<string, unknown>> = {},
  rotation = 0,
) =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'device-presentation',
    metadata: { title: 'Dispositif' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: 1, y: 1 }, rotation: 0 },
        props: {},
        permissions: lockedPermissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 1, y: 7 }, rotation: 0 },
        props: {},
        permissions: lockedPermissions,
      },
      {
        id: 'device-1',
        type,
        transform: { position: { x: 3, y: 3 }, rotation },
        props,
        permissions: lockedPermissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 10, y: 8 } },
  });

const lockedPermissions = { move: false, rotate: false, remove: false } as const;

/** The goal's ball, a second ball and the basket. */
const createTwoBallDocument = () =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'two-balls',
    metadata: { title: 'Deux balles' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: 1, y: 1 }, rotation: 0 },
        props: {},
        permissions: lockedPermissions,
      },
      {
        id: 'ball-2',
        type: 'ball',
        transform: { position: { x: 4, y: 1 }, rotation: 0 },
        props: {},
        permissions: lockedPermissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 1, y: 7 }, rotation: 0 },
        props: {},
        permissions: lockedPermissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 10, y: 8 } },
  });

/** A lever wired to a conveyor, with the goal pair out of the way. */
const createWiredDocument = (
  leverPosition: 'left' | 'center' | 'right',
  conveyorDirection: 'left' | 'stopped' | 'right',
) =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'wired-presentation',
    metadata: { title: 'Levier et convoyeur' },
    objects: [
      {
        id: 'ball-1',
        type: 'ball',
        transform: { position: { x: 1, y: 1 }, rotation: 0 },
        props: {},
        permissions: lockedPermissions,
      },
      {
        id: 'basket-1',
        type: 'basket',
        transform: { position: { x: 1, y: 7 }, rotation: 0 },
        props: {},
        permissions: lockedPermissions,
      },
      {
        id: 'lever-1',
        type: 'lever',
        transform: { position: { x: 2, y: 4 }, rotation: 0 },
        props: { position: leverPosition },
        permissions: lockedPermissions,
      },
      {
        id: 'conveyor-1',
        type: 'conveyor',
        transform: { position: { x: 7, y: 5 }, rotation: 0 },
        props: { direction: conveyorDirection },
        permissions: lockedPermissions,
      },
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 10, y: 8 } },
    wires: [{ id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1' }],
  });

const layerOf = (projection: ReturnType<typeof projectLevel>, asset: SpriteAsset) => {
  const found = projection.objects.find((object) => object.assetKey === asset);
  if (found === undefined) throw new Error(`Calque « ${asset} » absent.`);
  return found.layer;
};

const renderWired = async (
  simulation?: BoardSimulationView,
): Promise<{ readonly operations: Operation[] }> => {
  const { context, operations } = createContext();
  const spriteLoader = createPendingSpriteLoader();
  spriteLoader.setReady();
  const renderer = createBoardRenderer({
    canvas: { width: 0, height: 0 },
    context,
    viewport,
    spriteLoader: spriteLoader.loader,
  });
  await renderer.render(projectLevel(createWiredDocument('center', 'stopped'), simulation));
  return { operations };
};

/** Alpha of each wire drawn under the sprites, or of every wire and label when `all`. */
const wireAlphas = (operations: readonly Operation[], all = false): readonly number[] => {
  const firstSprite = operations.findIndex((operation) => operation.kind === 'drawImage');
  const stack: number[] = [];
  const alphas: number[] = [];
  let alpha = 1;
  for (const operation of all ? operations : operations.slice(0, firstSprite)) {
    if (operation.kind === 'save') stack.push(alpha);
    if (operation.kind === 'restore') alpha = stack.pop() ?? 1;
    if (operation.kind === 'globalAlpha') alpha = operation.values[0] ?? 1;
    if ((operation.kind === 'stroke' || (all && operation.kind === 'fillText')) && alpha < 1) {
      alphas.push(alpha);
    }
  }
  return alphas;
};

describe('projection du plateau', () => {
  it('pose la poignée du levier à sa position de départ, sur un socle immobile', () => {
    const projection = projectLevel(createWiredDocument('right', 'stopped'));

    expect(layerOf(projection, 'lever-handle').rotation).toBeCloseTo(Math.PI / 4);
    expect(layerOf(projection, 'lever-base').rotation).toBe(0);
    const handlePose = { position: { x: 2, y: 4 }, rotation: -0.5 };
    expect(
      layerOf(
        projectLevel(
          createWiredDocument('right', 'stopped'),
          simulationView([['lever-1', handlePose]]),
        ),
        'lever-handle',
      ).rotation,
    ).toBe(-0.5);
  });

  it('montre la bande du convoyeur dans son sens, derrière le cadre', () => {
    const construction = projectLevel(createWiredDocument('center', 'left'));
    const assets = construction.objects
      .filter((object) => object.family === 'conveyor')
      .map((object) => object.assetKey);

    expect(assets).toEqual(['conveyor-belt-left', 'conveyor-frame']);
    expect(layerOf(construction, 'conveyor-belt-left').source?.x).toBe(0);
  });

  it('fait défiler la bande d’après le déplacement simulé', () => {
    const projection = projectLevel(
      createWiredDocument('center', 'stopped'),
      simulationView([], [['conveyor-1', { offset: 0.15, facing: 1 }]]),
    );
    const belt = layerOf(projection, 'conveyor-belt');

    // A belt moving right shifts its pattern right: the source window moves left.
    expect(belt.source?.width).toBe(247);
    expect(belt.source?.x).toBeCloseTo(77 * (1 - 0.15 / 0.6006));
  });

  it('enfonce le capuchon du bouton pressé, sans bouger son socle', () => {
    const document = createDeviceDocument('button');
    const resting = projectLevel(document);
    const pressed = projectLevel(
      document,
      simulationView([], [], [['device-1', { kind: 'button', pressed: true }]]),
    );

    expect(
      resting.objects.map((object) => object.assetKey).filter((key) => key.startsWith('button')),
    ).toEqual(['button-base', 'button-cap']);
    expect(layerOf(pressed, 'button-cap').destination.y).toBeCloseTo(
      layerOf(resting, 'button-cap').destination.y + 0.06,
    );
    expect(layerOf(pressed, 'button-base')).toEqual(layerOf(resting, 'button-base'));
  });

  it('fait tourner les pales du ventilateur, écrasées en largeur, derrière son corps', () => {
    const document = createDeviceDocument('fan', { state: 'on' });
    const resting = projectLevel(document);
    const spinning = projectLevel(
      document,
      simulationView([], [], [['device-1', { kind: 'fan', bladeAngle: 1.2 }]]),
    );
    const blades = layerOf(spinning, 'fan-blades');

    expect(
      resting.objects.map((object) => object.assetKey).filter((key) => key.startsWith('fan')),
    ).toEqual(['fan-blades', 'fan-body']);
    expect(layerOf(resting, 'fan-blades').spin).toEqual({ angle: 0, squash: 0.53 });
    expect(blades.spin).toEqual({ angle: 1.2, squash: 0.53 });
    expect(blades.position.x).toBeCloseTo(3 + 0.1986);
    expect(blades.destination.x).toBeCloseTo(-blades.destination.width / 2);
  });

  it('fait tourner l’aiguille du minuteur et affiche les dixièmes de seconde', async () => {
    const document = createDeviceDocument('timer', { delaySeconds: 3 });
    const simulation = simulationView(
      [],
      [],
      [['device-1', { kind: 'timer', remainingSeconds: 1.26, handAngle: Math.PI / 2 }]],
    );
    const projection = projectLevel(document, simulation);
    const hand = layerOf(projection, 'timer-hand');
    const { context, operations, fillRectStyles } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    const renderer = createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport,
      spriteLoader: spriteLoader.loader,
    });

    expect(hand.spin).toEqual({ angle: Math.PI / 2, squash: 1 });
    expect(hand.position.x).toBeCloseTo(3 - 0.511);
    expect(hand.position.y).toBeCloseTo(3 + 0.033);
    expect(hand.destination.x).toBeCloseTo(-0.0981);
    expect(hand.destination.y).toBeCloseTo(-0.1067);
    expect(hand.destination.width).toBeCloseTo(0.14);
    await renderer.render(projection);

    expect(operations.some((operation) => operation.kind === 'fillText')).toBe(false);
    expect(fillRectStyles.filter((style) => style === '#ffc54d').length).toBeGreaterThanOrEqual(14);
  });

  it('retourne en miroir le ventilateur tourné d’un demi-tour, et tourne celui qui souffle en hauteur', () => {
    const left = projectLevel(createDeviceDocument('fan', { state: 'off' }, Math.PI));
    const up = projectLevel(createDeviceDocument('fan', { state: 'off' }, -Math.PI / 2));
    const device = (projection: ReturnType<typeof projectLevel>) => {
      const found = projection.objects.find((object) => object.id === 'device-1');
      if (found === undefined) throw new Error('Ventilateur absent.');
      return found;
    };

    expect(layerOf(left, 'fan-body').mirrored).toBe(true);
    expect(layerOf(left, 'fan-body').rotation).toBeCloseTo(0);
    expect(layerOf(left, 'fan-blades').position.x).toBeCloseTo(3 - 0.1986);
    expect(layerOf(up, 'fan-body').rotation).toBeCloseTo(-Math.PI / 2);
    expect(layerOf(up, 'fan-body').mirrored).toBe(false);
    expect(layerOf(up, 'fan-blades').position.y).toBeCloseTo(3 - 0.1986);
    // Selection follows the placement's own rotation around the unturned footprint.
    expect(device(up).destination.width).toBeCloseTo(1.2);
    expect(device(up).rotation).toBeCloseTo(-Math.PI / 2);
  });

  it('ne dessine de la barre que ce qui sort du poteau, de son côté', () => {
    const right = projectLevel(createDeviceDocument('barrier', { state: 'closed' }));
    const left = projectLevel(createDeviceDocument('barrier', { state: 'closed' }, Math.PI));
    const down = projectLevel(createDeviceDocument('barrier', { state: 'closed' }, Math.PI / 2));
    const open = projectLevel(
      createDeviceDocument('barrier', { state: 'closed' }),
      simulationView([], [], [['device-1', { kind: 'barrier', retraction: 1 }]]),
    );

    expect(
      right.objects.map((object) => object.assetKey).filter((key) => key.startsWith('barrier')),
    ).toEqual(['barrier-bar', 'barrier-pillar']);
    expect(layerOf(right, 'barrier-bar').destination).toMatchObject({ x: 0, width: 1.7013 });
    expect(layerOf(right, 'barrier-bar').source).toBeUndefined();
    expect(layerOf(left, 'barrier-bar').mirrored).toBe(true);
    expect(layerOf(left, 'barrier-pillar').mirrored).toBe(true);
    expect(layerOf(left, 'barrier-bar').destination).toMatchObject({ x: 0, width: 1.7013 });
    expect(layerOf(down, 'barrier-bar').rotation).toBeCloseTo(Math.PI / 2);
    expect(layerOf(down, 'barrier-bar').mirrored).toBe(false);

    const retracted = layerOf(open, 'barrier-bar');
    expect(retracted.destination.x).toBe(0);
    expect(retracted.destination.width).toBeCloseTo(0.3226);
    // The tip of the bar stays visible: the source keeps its right end, 160 px wide.
    expect(retracted.source?.x).toBeGreaterThan(0);
    expect((retracted.source?.x ?? 0) + (retracted.source?.width ?? 0)).toBeCloseTo(160);
  });

  it('tasse le ressort du tremplin et descend son plateau d’autant', () => {
    const document = createDeviceDocument('springboard');
    const resting = projectLevel(document);
    const squashed = projectLevel(
      document,
      simulationView([], [], [['device-1', { kind: 'springboard', compression: 0.5 }]]),
    );
    const sink = 0.5 * 0.12;

    expect(
      resting.objects
        .map((object) => object.assetKey)
        .filter((key) => key.startsWith('springboard')),
    ).toEqual(['springboard-spring', 'springboard-base', 'springboard-platform']);
    expect(layerOf(squashed, 'springboard-platform').destination.y).toBeCloseTo(
      layerOf(resting, 'springboard-platform').destination.y + sink,
    );
    const spring = layerOf(squashed, 'springboard-spring').destination;
    const restingSpring = layerOf(resting, 'springboard-spring').destination;
    expect(spring.height).toBeCloseTo(restingSpring.height - sink);
    expect(spring.y + spring.height).toBeCloseTo(restingSpring.y + restingSpring.height);
  });

  it('tire les fils droits avec leur lettre de circuit, hors du document', () => {
    const projection = projectLevel(createWiredDocument('center', 'stopped'));

    expect(projection.wires).toEqual([
      expect.objectContaining({
        id: 'wire-1',
        label: 'A',
        circuitIndex: 0,
        from: { x: 2.4, y: 4.05 },
        to: { x: 5.5, y: 5 },
      }),
    ]);
  });

  it.each([
    ['short', 'beam-short', 2],
    ['medium', 'beam-medium', 4],
    ['long', 'beam-long', 6],
  ] as const)(
    'dessine une poutre %s avec son propre sprite %s, à l’empreinte de sa longueur',
    (size, assetKey, length) => {
      const beams = projectLevel(createBeamDocument(size)).objects.filter(
        (object: ProjectedObject) => object.family === 'beam',
      );

      // Un seul calque par poutre : jamais le sprite d’une autre longueur étiré.
      expect(beams.map((object: ProjectedObject) => object.assetKey)).toEqual([assetKey]);
      expect(beams.map((object: ProjectedObject) => object.assetPath)).toEqual([
        `/assets/sprites/${assetKey}@2x.png`,
      ]);
      expect(beams.map((object: ProjectedObject) => object.layer.destination)).toEqual([
        { x: -length / 2, y: -0.125, width: length, height: 0.25 },
      ]);
    },
  );

  it('contient les quatre familles et porte les assets visuels hors du document', () => {
    const projection = projectLevel(levelDocument);

    // Ordre de dessin, pas ordre du document : la balle est entre les deux
    // calques du panier.
    expect(projection.objects.map((object: ProjectedObject) => object.assetKey)).toEqual([
      'basket-back',
      'beam-medium',
      'seesaw-fulcrum',
      'seesaw-beam',
      'ball-base',
      'ball-spin',
      'ball-highlight',
      'basket-front',
    ]);
    expect(
      projection.objects.every((object: ProjectedObject) => typeof object.assetPath === 'string'),
    ).toBe(true);
    expect(projection.objects.map((object) => object.assetPath)).toEqual(
      projection.objects.map((object) => spriteAssetPath(object.assetKey, 2)),
    );
    expect(levelDocument.objects.every((object) => !('assetPath' in object))).toBe(true);
  });

  it('centre la destination de la bascule sur son empreinte réelle, pas sur son pivot (A4)', () => {
    const projection = projectLevel(levelDocument);
    const seesaw = projection.objects.find((object) => object.family === 'seesaw');
    if (seesaw === undefined) throw new Error('La bascule est absente de la projection.');

    // Empreinte mesurée par A4 (simulation-session.ts) : socle x∈[-0,25,0,25]
    // y∈[0,+0,70], tablier x∈[-1,5,1,5] y∈[-0,12,+0,12] — union 3 × 0,82,
    // sommet à y=-0,12 relatif au pivot. Le socle étant posé sous le pivot et
    // non centré dessus, cette destination ne peut pas être symétrique comme
    // pour les trois autres familles.
    expect(seesaw.destination).toEqual({ x: -1.5, y: -0.12, width: 3, height: 0.82 });
  });

  it('laisse le pied de la bascule en place quand le tablier pivote', () => {
    const boardPose = { position: { x: 18, y: 11 }, rotation: 0.4 };
    const projection = projectLevel(levelDocument, simulationView([['seesaw-1', boardPose]]));
    const layer = (asset: string) => {
      const found = projection.objects.find((object) => object.assetKey === asset);
      if (found === undefined) throw new Error(`Calque « ${asset} » absent.`);
      return found.layer;
    };

    expect(layer('seesaw-beam').rotation).toBe(0.4);
    expect(layer('seesaw-beam').destination).toEqual({ x: -1.5, y: -0.12, width: 3, height: 0.24 });
    expect(layer('seesaw-fulcrum').rotation).toBe(0);
    expect(layer('seesaw-fulcrum').destination.y).toBeCloseTo(0.12);
  });

  it('fait tourner le motif de la balle sans faire tourner son ombrage ni son reflet', () => {
    const ballPose = { position: { x: 13, y: 9 }, rotation: 2 };
    const projection = projectLevel(levelDocument, simulationView([['ball-1', ballPose]]));
    const ballLayers = projection.objects.filter((object) => object.family === 'ball');

    expect(ballLayers.map((object) => [object.assetKey, object.layer.rotation])).toEqual([
      ['ball-base', 0],
      ['ball-spin', 2],
      ['ball-highlight', 0],
    ]);
    expect(ballLayers.every((object) => object.layer.position.x === 13)).toBe(true);
    // Hit-test and selection keep reading the placement, not the moving body.
    expect(ballLayers.every((object) => object.position.x === 12)).toBe(true);
  });

  it('garde les calques rouges pour la balle de l’objectif et dessine les autres en bleu', () => {
    const projection = projectLevel(createTwoBallDocument());
    const assetsOf = (id: string) =>
      projection.objects.filter((object) => object.id === id).map((object) => object.assetKey);

    expect(assetsOf('ball-1')).toEqual(['ball-base', 'ball-spin', 'ball-highlight']);
    expect(assetsOf('ball-2')).toEqual([
      'second-ball-base',
      'second-ball-spin',
      'second-ball-highlight',
    ]);
  });

  it('dessine la balle bleue comme la rouge : même empreinte, même rotation du motif', () => {
    const pose = { position: { x: 5, y: 2 }, rotation: 1.5 };
    const projection = projectLevel(createTwoBallDocument(), simulationView([['ball-2', pose]]));
    const blueLayers = projection.objects.filter((object) => object.id === 'ball-2');
    const redLayer = projection.objects.find((object) => object.id === 'ball-1');

    expect(blueLayers.map((object) => [object.assetKey, object.layer.rotation])).toEqual([
      ['second-ball-base', 0],
      ['second-ball-spin', 1.5],
      ['second-ball-highlight', 0],
    ]);
    for (const layer of blueLayers) {
      expect(layer.family).toBe('ball');
      expect(layer.destination).toEqual(redLayer?.destination);
      expect(layer.layer.destination).toEqual(redLayer?.layer.destination);
      expect(layer.layer.position).toEqual(pose.position);
    }
  });

  it('convertit les positions monde avec une origine et une échelle uniques', () => {
    expect(worldToPixels({ x: 12, y: 8 }, viewport)).toEqual({ x: 8, y: 12 });
    expect(worldToPixels({ x: 10, y: 5 }, viewport)).toEqual({ x: 0, y: 0 });
  });
});

describe('renderer Canvas 2D du plateau', () => {
  it('projette les dimensions visuelles selon pixelsPerWorldUnit', async () => {
    const destinationAtTwoPixels = await renderDestination(createBeamDocument('medium'), {
      ...viewport,
      pixelsPerWorldUnit: 2,
    });
    const destinationAtFourPixels = await renderDestination(createBeamDocument('medium'), {
      ...viewport,
      pixelsPerWorldUnit: 4,
    });

    expect(destinationAtFourPixels.width).toBe(destinationAtTwoPixels.width * 2);
    expect(destinationAtFourPixels.height).toBe(destinationAtTwoPixels.height * 2);
  });

  it('projette les longueurs de poutre dans l’ordre short, medium, long', async () => {
    const destinations = await Promise.all(
      (['short', 'medium', 'long'] as const).map((size) =>
        renderDestination(createBeamDocument(size), viewport),
      ),
    );
    const [shortDestination, mediumDestination, longDestination] = destinations;
    if (
      shortDestination === undefined ||
      mediumDestination === undefined ||
      longDestination === undefined
    ) {
      throw new Error('Les trois longueurs de poutre doivent être rendues.');
    }

    expect(shortDestination.width).toBeLessThan(mediumDestination.width);
    expect(mediumDestination.width).toBeLessThan(longDestination.width);
  });

  it('dimensionne le canvas en pixels physiques sans muter le LevelDocument', async () => {
    const { context } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    const canvas = { width: 0, height: 0 };
    const documentBeforeRender = JSON.stringify(levelDocument);
    const projection = projectLevel(levelDocument);
    const renderer = createBoardRenderer({
      canvas,
      context,
      viewport,
      spriteLoader: spriteLoader.loader,
    });

    await renderer.render(projection);

    expect(canvas).toEqual({ width: 640, height: 480 });
    expect(JSON.stringify(levelDocument)).toBe(documentBeforeRender);
  });

  it('attend tous les sprites requis avant le premier dessin', async () => {
    const { context, operations } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    const canvas = { width: 0, height: 0 };
    const projection = projectLevel(levelDocument);
    const renderer = createBoardRenderer({
      canvas,
      context,
      viewport,
      spriteLoader: spriteLoader.loader,
    });
    const rendering = renderer.render(projection);

    await Promise.resolve();
    expect(operations.some((operation) => operation.kind === 'drawImage')).toBe(false);
    // Ordre de dessin (B4) : basket, beam, seesaw, puis ball en dernier.
    expect(spriteLoader.requestedFamilies).toEqual(['basket', 'beam', 'seesaw', 'ball']);

    spriteLoader.release();
    await rendering;

    expect(operations.some((operation) => operation.kind === 'drawImage')).toBe(true);
  });

  it('dessine dans un ordre déterministe avec rotation et destinations projetées', async () => {
    const { context, operations } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    const canvas = { width: 0, height: 0 };
    const projection = projectLevel(levelDocument);
    const renderer = createBoardRenderer({
      canvas,
      context,
      viewport,
      spriteLoader: spriteLoader.loader,
    });

    await renderer.render(projection);

    expect(operations.find((operation) => operation.kind === 'setTransform')).toEqual({
      kind: 'setTransform',
      values: [2, 0, 0, 2, 0, 0],
    });
    // Ordre de dessin : calques arrière, balle, puis lèvres avant — pas
    // l'ordre du document.
    expect(
      replay(operations)
        .filter(({ operation }) => operation.kind === 'drawImage')
        .flatMap(({ state }) => state.transforms)
        .filter(
          (operation): operation is Extract<Operation, { readonly kind: 'translate' }> =>
            operation.kind === 'translate',
        )
        .map((operation) => operation.values),
    ).toEqual([
      [16, 16],
      [24, 20],
      [32, 24],
      [32, 24],
      [8, 12],
      [8, 12],
      [8, 12],
      [16, 16],
    ]);
    expect(
      replay(operations)
        .filter(({ operation }) => operation.kind === 'drawImage')
        .flatMap(({ state }) => state.transforms)
        .filter(
          (operation): operation is Extract<Operation, { readonly kind: 'rotate' }> =>
            operation.kind === 'rotate',
        )
        .map((operation) => operation.values),
    ).toEqual([[0], [Math.PI / 4], [0], [0], [0], [0], [0], [0]]);

    const drawOperations = operations.filter(
      (operation): operation is Extract<Operation, { readonly kind: 'drawImage' }> =>
        operation.kind === 'drawImage',
    );
    expect(drawOperations).toHaveLength(projection.objects.length);
    expect(drawOperations.map((operation) => operation.values.slice(-4))).toEqual(
      projection.objects.map((object: ProjectedObject) => [
        object.layer.destination.x * viewport.pixelsPerWorldUnit,
        object.layer.destination.y * viewport.pixelsPerWorldUnit,
        object.layer.destination.width * viewport.pixelsPerWorldUnit,
        object.layer.destination.height * viewport.pixelsPerWorldUnit,
      ]),
    );
    for (const [index, object] of projection.objects.entries()) {
      const drawOperation = drawOperations[index];
      if (drawOperation === undefined) {
        continue;
      }

      expect(drawOperation.values[0]).toBe(spriteLoader.sprites[object.assetKey].source);
    }
  });

  it('dessine le panier arrière, la balle, puis le panier avant', async () => {
    const document = levelDocumentSchema.parse({
      schemaVersion: 3,
      id: 'b4-ball-before-basket',
      metadata: { title: 'Balle avant panier' },
      objects: [
        {
          id: 'ball-1',
          type: 'ball',
          transform: { position: { x: 4, y: 4 }, rotation: 0 },
          props: {},
          permissions: { move: false, rotate: false, remove: false },
        },
        {
          id: 'basket-1',
          type: 'basket',
          transform: { position: { x: 4, y: 4 }, rotation: 0 },
          props: {},
          permissions: { move: false, rotate: false, remove: false },
        },
      ],
      inventory: [],
      goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
      buildZones: [],
      scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 8 } },
    });

    const order = await drawnAssetOrder(document);

    expect(order).toEqual([
      'basket-back',
      'ball-base',
      'ball-spin',
      'ball-highlight',
      'basket-front',
    ]);
  });

  it('conserve l’ordre du document entre deux objets qui ne sont pas des balles', async () => {
    const document = levelDocumentSchema.parse({
      schemaVersion: 3,
      id: 'b4-non-ball-order',
      metadata: { title: 'Poutre et bascule' },
      objects: [
        {
          id: 'seesaw-1',
          type: 'seesaw',
          transform: { position: { x: 4, y: 4 }, rotation: 0 },
          props: {},
          permissions: { move: false, rotate: false, remove: false },
        },
        {
          id: 'beam-1',
          type: 'beam',
          transform: { position: { x: 4, y: 4 }, rotation: 0 },
          props: { size: 'medium' },
          permissions: { move: false, rotate: false, remove: false },
        },
        {
          id: 'ball-1',
          type: 'ball',
          transform: { position: { x: 1, y: 1 }, rotation: 0 },
          props: {},
          permissions: { move: false, rotate: false, remove: false },
        },
        {
          id: 'basket-1',
          type: 'basket',
          transform: { position: { x: 7, y: 7 }, rotation: 0 },
          props: {},
          permissions: { move: false, rotate: false, remove: false },
        },
      ],
      inventory: [],
      goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
      buildZones: [],
      scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 8 } },
    });

    const order = await drawnAssetOrder(document);

    // Les éléments de fond conservent leur ordre document, puis la balle, puis
    // la lèvre avant du panier.
    expect(order).toEqual([
      'seesaw-fulcrum',
      'seesaw-beam',
      'beam-medium',
      'basket-back',
      'ball-base',
      'ball-spin',
      'ball-highlight',
      'basket-front',
    ]);
  });

  it('dessine chaque fil en équerre horizontale/verticale sous les objets, avec sa lettre aux deux bouts', async () => {
    const { operations } = await renderWired();

    const firstSprite = operations.findIndex((operation) => operation.kind === 'drawImage');
    // V2b: the world grid is the first stroke and covers the viewport; the wires come after it.
    const gridStroke = operations.findIndex((operation) => operation.kind === 'stroke');
    const underSprites = operations.slice(gridStroke + 1, firstSprite);
    const start = worldToPixels({ x: 2.4, y: 4.05 }, viewport);
    // The lever's port faces sideways: the wire leaves horizontally first,
    // then turns once down to the conveyor's port (U14b).
    const bend = worldToPixels({ x: 5.5, y: 4.05 }, viewport);
    const end = worldToPixels({ x: 5.5, y: 5 }, viewport);
    expect(underSprites.filter((operation) => operation.kind === 'stroke').length).toBeGreaterThan(
      0,
    );
    // Every stroke under the sprites is the same L-shaped route: no bridge.
    const pathOperations = underSprites.filter(
      (operation) =>
        operation.kind === 'moveTo' || operation.kind === 'lineTo' || operation.kind === 'arc',
    );
    expect(pathOperations.length).toBeGreaterThan(0);
    for (let index = 0; index < pathOperations.length; index += 3) {
      expect(pathOperations[index]).toEqual({ kind: 'moveTo', values: [start.x, start.y] });
      expect(pathOperations[index + 1]).toEqual({ kind: 'lineTo', values: [bend.x, bend.y] });
      expect(pathOperations[index + 2]).toEqual({ kind: 'lineTo', values: [end.x, end.y] });
    }
    expect(
      operations
        .filter(
          (operation): operation is Extract<Operation, { readonly kind: 'fillText' }> =>
            operation.kind === 'fillText',
        )
        .map((operation) => operation.values[0]),
    ).toEqual(['A', 'A']);
  });

  it('dessine les fils translucides pendant la construction', async () => {
    const alphas = wireAlphas((await renderWired()).operations);

    expect(alphas.length).toBeGreaterThan(0);
    for (const alpha of alphas) {
      expect(alpha).toBeGreaterThan(0.2);
      expect(alpha).toBeLessThanOrEqual(0.6);
    }
  });

  it('efface presque les fils pendant la simulation', async () => {
    const alphas = wireAlphas((await renderWired(simulationView([]))).operations, true);

    expect(alphas.length).toBeGreaterThan(0);
    for (const alpha of alphas) {
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(0.1);
    }
  });

  it('dessine les zones de construction sous les objets, en unités monde', async () => {
    const { context, operations } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    const renderer = createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport,
      spriteLoader: spriteLoader.loader,
    });

    await renderer.render({
      ...projectLevel(levelDocument),
      buildZones: [{ min: { x: 11, y: 6 }, max: { x: 14, y: 9 } }],
    });

    const zoneFill = operations.findIndex(
      (operation) =>
        operation.kind === 'fillRect' && operation.values.join(',') === [4, 4, 12, 12].join(','),
    );
    const firstSprite = operations.findIndex((operation) => operation.kind === 'drawImage');
    expect(zoneFill).toBeGreaterThanOrEqual(0);
    expect(zoneFill).toBeLessThan(firstSprite);
  });

  it('rend tournable pour l’auteur tout objet sauf la balle et le panier, quelles que soient ses permissions', () => {
    const rotatable = withAuthorRotation(projectLevel(levelDocument).objects)
      .filter(({ rotatable }) => rotatable)
      .map(({ family }) => family);

    expect(new Set(rotatable)).toEqual(new Set(['beam', 'seesaw']));
    expect(
      withAuthorRotation(projectLevel(levelDocument).objects).some(
        ({ family, rotatable }) => (family === 'ball' || family === 'basket') && rotatable,
      ),
    ).toBe(false);
  });

  it('ne met en évidence aucune zone quand l’une d’elles couvre toute la scène', () => {
    const sceneZone = { min: { x: 10, y: 6 }, max: { x: 20, y: 13 } };
    const smallZone = { min: { x: 11, y: 6 }, max: { x: 14, y: 9 } };

    expect(constrainingBuildZones({ ...levelDocument, buildZones: [sceneZone] })).toEqual([]);
    expect(
      constrainingBuildZones({ ...levelDocument, buildZones: [smallZone, sceneZone] }),
    ).toEqual([]);
    expect(constrainingBuildZones({ ...levelDocument, buildZones: [smallZone] })).toEqual([
      smallZone,
    ]);
  });

  it('atténue l’objet dont la position est refusée, et lui seul', async () => {
    const renderWith = async (refusedPlacementId?: string): Promise<readonly Operation[]> => {
      const { context, operations } = createContext();
      const spriteLoader = createPendingSpriteLoader();
      spriteLoader.setReady();
      const renderer = createBoardRenderer({
        canvas: { width: 0, height: 0 },
        context,
        viewport,
        spriteLoader: spriteLoader.loader,
      });
      // U13: a refused move or turn is drawn as the invalid ghost of U1.
      await renderer.render(
        projectLevel(
          levelDocument,
          undefined,
          refusedPlacementId === undefined
            ? undefined
            : { ghostPlacementId: refusedPlacementId, isGhostValid: false },
        ),
      );
      return operations;
    };
    const translucentDraws = (operations: readonly Operation[]): number => {
      let alpha = 1;
      let count = 0;
      for (const operation of operations) {
        if (operation.kind === 'globalAlpha') alpha = operation.values[0] ?? 1;
        if (operation.kind === 'restore') alpha = 1;
        if (operation.kind === 'drawImage' && alpha < 1) count += 1;
      }
      return count;
    };

    expect(translucentDraws(await renderWith())).toBe(0);
    expect(translucentDraws(await renderWith('beam-1'))).toBe(1);
  });

  it('entoure d’un pointillé chaque objet à placer de l’atelier, et lui seul (U22)', async () => {
    const dashedOutlines = async (document: typeof levelDocument): Promise<number> => {
      const { context, operations } = createContext();
      const spriteLoader = createPendingSpriteLoader();
      spriteLoader.setReady();
      const renderer = createBoardRenderer({
        canvas: { width: 0, height: 0 },
        context,
        viewport,
        spriteLoader: spriteLoader.loader,
      });
      await renderer.render(projectLevel(document));
      let dashed = false;
      let count = 0;
      for (const operation of operations) {
        if (operation.kind === 'setLineDash') dashed = operation.values.length > 0;
        if (operation.kind === 'restore') dashed = false;
        if (operation.kind === 'strokeRect' && dashed) count += 1;
      }
      return count;
    };
    const marked = {
      ...levelDocument,
      objects: levelDocument.objects.map((object) =>
        object.id === 'beam-1' ? { ...object, toPlace: true as const } : object,
      ),
    };

    expect(projectLevel(marked).toPlaceIds).toEqual(['beam-1']);
    expect(projectLevel(marked, simulationView([])).toPlaceIds).toEqual([]);
    expect(await dashedOutlines(levelDocument)).toBe(0);
    expect(await dashedOutlines(marked)).toBe(1);
  });

  it('expose une API de rendu sans victoire ni sérialisation', () => {
    const { context } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    const renderer = createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport,
      spriteLoader: spriteLoader.loader,
    });

    expect('hasWon' in renderer).toBe(false);
    expect('serialize' in renderer).toBe(false);
  });

  it('dessine la sélection avec une épaisseur CSS fixe et une poignée de rotation tactile distincte', async () => {
    const renderSelected = async (
      selectedPlacementId: string,
      pixelsPerWorldUnit: number,
    ): Promise<readonly Operation[]> => {
      const { context, operations } = createContext();
      const spriteLoader = createPendingSpriteLoader();
      spriteLoader.setReady();
      const renderer = createBoardRenderer({
        canvas: { width: 0, height: 0 },
        context,
        viewport: { ...viewport, pixelsPerWorldUnit },
        spriteLoader: spriteLoader.loader,
      });

      // Selection is view state: it is deliberately carried by the
      // projection rather than persisted in LevelDocument.
      const projection = { ...projectLevel(levelDocument), selectedPlacementId };
      await renderer.render(projection);
      return operations;
    };

    const atTwoPixels = await renderSelected('beam-1', 2);
    const atFourPixels = await renderSelected('beam-1', 4);
    const rectangleOperations = (operations: readonly Operation[]) =>
      operations.filter(
        (
          operation,
        ): operation is Extract<Operation, { readonly kind: 'strokeRect' | 'fillRect' }> =>
          operation.kind === 'strokeRect' || operation.kind === 'fillRect',
      );

    const twoPixelRects = rectangleOperations(atTwoPixels);
    const fourPixelRects = rectangleOperations(atFourPixels);

    // The selected medium beam's 4 × 0.25 world-unit footprint is outlined;
    // its rotation handle is a separate knob of fixed CSS size.
    expect(
      twoPixelRects.some((operation) => {
        const [, , width, height] = operation.values;
        return width === 8 && height === 0.5;
      }),
    ).toBe(true);
    expect(atTwoPixels.some(isRotationKnob)).toBe(true);
    expect(atFourPixels.some(isRotationKnob)).toBe(true);
    expect(
      fourPixelRects.some((operation) => {
        const [, , width, height] = operation.values;
        return width === 16 && height === 1;
      }),
    ).toBe(true);

    const twoPixelLineWidths = atTwoPixels
      .filter(
        (operation): operation is Extract<Operation, { readonly kind: 'lineWidth' }> =>
          operation.kind === 'lineWidth',
      )
      .map((operation) => operation.values[0]);
    const fourPixelLineWidths = atFourPixels
      .filter(
        (operation): operation is Extract<Operation, { readonly kind: 'lineWidth' }> =>
          operation.kind === 'lineWidth',
      )
      .map((operation) => operation.values[0]);
    expect(twoPixelLineWidths.length).toBeGreaterThan(0);
    expect(twoPixelLineWidths).toEqual(fourPixelLineWidths);
  });

  it('ne dessine pas de poignée de rotation pour un objet non rotatable sélectionné', async () => {
    const { context, operations } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    const renderer = createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport,
      spriteLoader: spriteLoader.loader,
    });

    const projection = { ...projectLevel(levelDocument), selectedPlacementId: 'ball-1' };
    await renderer.render(projection);

    expect(operations.some(isRotationKnob)).toBe(false);
  });

  it('dessine la poignée quand la projection effective rend la rotation disponible', async () => {
    const { context, operations } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    const renderer = createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport,
      spriteLoader: spriteLoader.loader,
    });

    const sourceProjection = projectLevel(embeddedWorkshopDocument);
    const projection = {
      ...sourceProjection,
      objects: sourceProjection.objects.map((object) =>
        object.family === 'beam' ? { ...object, rotatable: true } : object,
      ),
      selectedPlacementId: 'workshop-floor',
    };
    await renderer.render(projection);

    expect(operations.some(isRotationKnob)).toBe(true);
  });

  it('centre la flèche de rotation dans son bouton bleu nuit (reprise du 5 octobre)', async () => {
    const { context, operations } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    const renderer = createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport,
      spriteLoader: spriteLoader.loader,
    });
    const sourceProjection = projectLevel(embeddedWorkshopDocument);
    await renderer.render({
      ...sourceProjection,
      objects: sourceProjection.objects.map((object) =>
        object.family === 'beam' ? { ...object, rotatable: true } : object,
      ),
      selectedPlacementId: 'workshop-floor',
    });

    const knobIndex = operations.findIndex(isRotationKnob);
    const knob = operations[knobIndex];
    if (knob?.kind !== 'arc') throw new Error('Bouton de rotation absent.');
    const [knobX = 0, knobY = 0] = knob.values;
    // After the knob: the arrow's arc, then its three-point head.
    const after = operations.slice(knobIndex + 1);
    const arrow = after.find((operation) => operation.kind === 'arc');
    if (arrow?.kind !== 'arc') throw new Error('Flèche de rotation absente.');
    const [arcX = 0, arcY = 0, radius = 0, start = 0, end = 0] = arrow.values;
    const points: [number, number][] = [];
    for (let step = 0; step <= 64; step += 1) {
      const angle = start + ((end - start) * step) / 64;
      points.push([arcX + radius * Math.cos(angle), arcY + radius * Math.sin(angle)]);
    }
    const head = after
      .slice(after.indexOf(arrow) + 1)
      .filter((operation) => operation.kind === 'moveTo' || operation.kind === 'lineTo')
      .slice(0, 3);
    for (const operation of head) {
      points.push([operation.values[0] ?? 0, operation.values[1] ?? 0]);
    }
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(knobX, 1);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(knobY, 1);

    const styles = replay(operations);
    const knobFill = styles.find(({ operation }) => operation === knob);
    expect(knobFill?.state.strokeStyle).toBe('#0a1426');
    expect(operations).toContainEqual({ kind: 'strokeStyle', values: ['#ffc53d'] });
  });
});

/** Canvas state at one drawing operation, replayed from the recorded operations. */
type DrawState = Readonly<{
  readonly alpha: number;
  readonly dashed: boolean;
  readonly lineWidth: number;
  readonly strokeStyle: string;
  /** `translate` and `rotate` applied since the last `setTransform`, in order. */
  readonly transforms: readonly Extract<
    Operation,
    { readonly kind: 'translate' | 'rotate' | 'scale' }
  >[];
}>;

type DrawOperation = Extract<
  Operation,
  { readonly kind: 'drawImage' | 'strokeRect' | 'arc' | 'ellipse' }
>;

const replay = (
  operations: readonly Operation[],
): readonly { readonly operation: DrawOperation; readonly state: DrawState }[] => {
  const initial: DrawState = {
    alpha: 1,
    dashed: false,
    lineWidth: 1,
    strokeStyle: '',
    transforms: [],
  };
  const stack: DrawState[] = [];
  let state = initial;
  const drawn: { readonly operation: DrawOperation; readonly state: DrawState }[] = [];
  for (const operation of operations) {
    switch (operation.kind) {
      case 'save':
        stack.push(state);
        break;
      case 'restore':
        state = stack.pop() ?? initial;
        break;
      case 'globalAlpha':
        state = { ...state, alpha: operation.values[0] ?? 1 };
        break;
      case 'setLineDash':
        state = { ...state, dashed: operation.values.length > 0 };
        break;
      case 'lineWidth':
        state = { ...state, lineWidth: operation.values[0] ?? 1 };
        break;
      case 'strokeStyle':
        state = { ...state, strokeStyle: operation.values[0] ?? '' };
        break;
      case 'translate':
      case 'rotate':
      case 'scale':
        state = { ...state, transforms: [...state.transforms, operation] };
        break;
      case 'drawImage':
      case 'strokeRect':
      case 'arc':
      case 'ellipse':
        drawn.push({ operation, state });
        break;
      case 'setTransform':
      case 'radialGradient':
      case 'colourStop':
      case 'fill':
      case 'fillRect':
      case 'beginPath':
      case 'moveTo':
      case 'lineTo':
      case 'stroke':
      case 'fillText':
        break;
    }
  }
  return drawn;
};

describe('fantôme de placement (U1)', () => {
  const ghost = (isGhostValid: boolean) => ({ ghostPlacementId: 'beam-1', isGhostValid });

  const renderGhost = async (
    options: { readonly ghostPlacementId: string; readonly isGhostValid: boolean } | undefined,
    pixelsPerWorldUnit = viewport.pixelsPerWorldUnit,
  ) => {
    const { context, operations } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    const renderer = createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport: { ...viewport, pixelsPerWorldUnit },
      spriteLoader: spriteLoader.loader,
    });
    await renderer.render(projectLevel(levelDocument, undefined, options));
    return { drawn: replay(operations), sprites: spriteLoader.sprites };
  };

  /** The medium beam `beam-1`: 4 × 0,25 at (16, 10), turned a quarter of π. */
  const beamCentre = worldToPixels({ x: 16, y: 10 }, viewport);

  it('projette le placement candidat en fantôme, et les autres objets pleins', () => {
    const appearances = (options?: Parameters<typeof projectLevel>[2]) =>
      projectLevel(levelDocument, undefined, options).objects.map(({ id, appearance }) => [
        id,
        appearance,
      ]);

    const solid = appearances();
    expect(solid.length).toBeGreaterThan(0);
    expect(solid.every(([, look]) => look === 'solid')).toBe(true);
    expect(appearances(ghost(true))).toEqual(
      solid.map(([id]) => [id, id === 'beam-1' ? 'ghost-valid' : 'solid']),
    );
    expect(appearances(ghost(false))).toEqual(
      solid.map(([id]) => [id, id === 'beam-1' ? 'ghost-invalid' : 'solid']),
    );
  });

  it('dessine un fantôme valide avec le sprite de sa famille, à son empreinte et sa rotation, translucide', async () => {
    const { drawn, sprites } = await renderGhost(ghost(true));

    const beam = drawn.find(
      ({ operation }) =>
        operation.kind === 'drawImage' && operation.values[0] === sprites['beam-medium'].source,
    );
    expect(beam).toBeDefined();
    expect(beam?.operation.values.slice(-2)).toEqual([16, 1]);
    expect(beam?.state.alpha).toBe(0.55);
    expect(beam?.state.transforms).toEqual([
      { kind: 'translate', values: [beamCentre.x, beamCentre.y] },
      { kind: 'rotate', values: [Math.PI / 4] },
    ]);

    // Every other object stays opaque.
    const others = drawn.filter(
      ({ operation }) =>
        operation.kind === 'drawImage' && operation.values[0] !== sprites['beam-medium'].source,
    );
    expect(others.length).toBeGreaterThan(0);
    expect(others.every(({ state }) => state.alpha === 1)).toBe(true);
  });

  it('entoure un fantôme valide d’un trait plein de 2 px CSS, après son sprite', async () => {
    const { drawn, sprites } = await renderGhost(ghost(true));

    const outlineIndex = drawn.findIndex(
      ({ operation }) =>
        operation.kind === 'strokeRect' && operation.values[2] === 16 && operation.values[3] === 1,
    );
    const spriteIndex = drawn.findIndex(
      ({ operation }) =>
        operation.kind === 'drawImage' && operation.values[0] === sprites['beam-medium'].source,
    );
    const outline = drawn[outlineIndex];
    expect(outline).toBeDefined();
    expect(outlineIndex).toBeGreaterThan(spriteIndex);
    expect(outline?.state.lineWidth).toBe(2);
    expect(outline?.state.dashed).toBe(false);
    expect(outline?.state.alpha).toBe(1);
    expect(outline?.state.transforms).toEqual([
      { kind: 'translate', values: [beamCentre.x, beamCentre.y] },
      { kind: 'rotate', values: [Math.PI / 4] },
    ]);
  });

  it('dessine un fantôme invalide plus pâle, entouré de tirets couleur d’avertissement', async () => {
    const { drawn, sprites } = await renderGhost(ghost(false));

    const beam = drawn.find(
      ({ operation }) =>
        operation.kind === 'drawImage' && operation.values[0] === sprites['beam-medium'].source,
    );
    expect(beam?.state.alpha).toBe(0.35);

    const outline = drawn.find(
      ({ operation }) =>
        operation.kind === 'strokeRect' && operation.values[2] === 16 && operation.values[3] === 1,
    );
    expect(outline?.state.dashed).toBe(true);
    expect(outline?.state.strokeStyle).toBe('#e53935');
    expect(outline?.state.lineWidth).toBe(2);
  });

  it('agrandit le sprite avec le zoom, mais pas l’épaisseur du contour', async () => {
    const atFour = await renderGhost(ghost(true), 4);
    const atEight = await renderGhost(ghost(true), 8);
    const beamSize = ({ drawn, sprites }: Awaited<ReturnType<typeof renderGhost>>) =>
      drawn
        .find(
          ({ operation }) =>
            operation.kind === 'drawImage' && operation.values[0] === sprites['beam-medium'].source,
        )
        ?.operation.values.slice(-2);
    const outlineWidth = ({ drawn }: Awaited<ReturnType<typeof renderGhost>>) =>
      drawn.filter(({ operation }) => operation.kind === 'strokeRect').at(-1)?.state.lineWidth;

    expect(beamSize(atFour)).toEqual([16, 1]);
    expect(beamSize(atEight)).toEqual([32, 2]);
    expect(outlineWidth(atFour)).toBe(2);
    expect(outlineWidth(atEight)).toBe(2);
  });

  it('ne dessine ni fantôme ni contour hors placement', async () => {
    const { drawn } = await renderGhost(undefined);

    expect(
      drawn
        .filter(({ operation }) => operation.kind === 'drawImage')
        .every(({ state }) => state.alpha === 1),
    ).toBe(true);
    expect(drawn.some(({ operation }) => operation.kind === 'strokeRect')).toBe(false);
  });
});

describe('objet déplacé hors zone (U13)', () => {
  it('se dessine comme le fantôme invalide : pâle, tirets rouges, sans cadre bleu, poignée gardée', async () => {
    const { context, operations } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    const renderer = createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport,
      spriteLoader: spriteLoader.loader,
    });

    await renderer.render({
      ...projectLevel(levelDocument, undefined, {
        ghostPlacementId: 'beam-1',
        isGhostValid: false,
      }),
      selectedPlacementId: 'beam-1',
    });

    const drawn = replay(operations);
    const beam = drawn.find(
      ({ operation }) =>
        operation.kind === 'drawImage' &&
        operation.values[0] === spriteLoader.sprites['beam-medium'].source,
    );
    expect(beam?.state.alpha).toBe(0.35);
    // One outline only around the beam's footprint: the dashed warning one.
    const outlines = drawn.filter(
      ({ operation }) =>
        operation.kind === 'strokeRect' && operation.values[2] === 16 && operation.values[3] === 1,
    );
    expect(outlines.map(({ state }) => [state.strokeStyle, state.dashed])).toEqual([
      ['#e53935', true],
    ]);
    // The finger may be turning it by its handle: the handle stays.
    expect(operations.some(isRotationKnob)).toBe(true);
  });
});

describe('balle cible sans surcharge (R1, décision auteur)', () => {
  const ballViewport = { ...viewport, origin: { x: 0, y: 0 }, pixelsPerWorldUnit: 40 };

  const renderBalls = async (
    document: Parameters<typeof projectLevel>[0],
    simulation?: BoardSimulationView,
    pixelsPerWorldUnit = ballViewport.pixelsPerWorldUnit,
    selectedPlacementId?: string,
  ) => {
    const { context, operations } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    const renderer = createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport: { ...ballViewport, pixelsPerWorldUnit },
      spriteLoader: spriteLoader.loader,
    });
    await renderer.render({
      ...projectLevel(document, simulation),
      ...(selectedPlacementId !== undefined && { selectedPlacementId }),
    });
    return { drawn: replay(operations), sprites: spriteLoader.sprites };
  };

  it('ne projette plus de marqueur permanent, même avec plusieurs balles', () => {
    expect(projectLevel(createTwoBallDocument())).not.toHaveProperty('goalBallMarkerId');
    expect(projectLevel(levelDocument)).not.toHaveProperty('goalBallMarkerId');
    const running = simulationView([['ball-1', { position: { x: 2, y: 3 }, rotation: 1 }]]);
    expect(projectLevel(createTwoBallDocument(), running)).not.toHaveProperty('goalBallMarkerId');
  });

  it('garde les sprites rouge et bleu sans ajouter d’anneau ni de cadre', async () => {
    const { drawn, sprites } = await renderBalls(createTwoBallDocument());
    const sources = drawn.flatMap(({ operation }) =>
      operation.kind === 'drawImage' ? [operation.values[0]] : [],
    );
    expect(sources).toContain(sprites['ball-highlight'].source);
    expect(sources).toContain(sprites['second-ball-highlight'].source);
    expect(drawn.some(({ operation }) => operation.kind === 'arc')).toBe(false);
    expect(drawn.some(({ operation }) => operation.kind === 'strokeRect')).toBe(false);
  });

  it('dessine la balle à sa pose simulée sans anneau', async () => {
    const pose = { position: { x: 2, y: 3 }, rotation: 1 };
    const { drawn, sprites } = await renderBalls(
      createTwoBallDocument(),
      simulationView([['ball-1', pose]]),
    );
    const ball = drawn.find(
      ({ operation }) =>
        operation.kind === 'drawImage' && operation.values[0] === sprites['ball-base'].source,
    );
    expect(ball?.state.transforms).toContainEqual({ kind: 'translate', values: [80, 120] });
    expect(drawn.some(({ operation }) => operation.kind === 'arc')).toBe(false);
  });

  it('n’ajoute aucun anneau au zoom', async () => {
    const { drawn } = await renderBalls(createTwoBallDocument(), undefined, 80);
    expect(drawn.some(({ operation }) => operation.kind === 'arc')).toBe(false);
  });

  it('garde aussi la balle seule sans anneau', async () => {
    const { drawn } = await renderBalls(levelDocument);
    expect(drawn.some(({ operation }) => operation.kind === 'arc')).toBe(false);
  });

  it.each([false, true])(
    'ne cadre pas une balle sélectionnée, permission de déplacement %s',
    async (move) => {
      const document = levelDocumentSchema.parse({
        ...levelDocument,
        objects: levelDocument.objects.map((object) =>
          object.id === 'ball-1'
            ? { ...object, permissions: { ...object.permissions, move } }
            : object,
        ),
      });
      const { drawn } = await renderBalls(document, undefined, 40, 'ball-1');
      expect(drawn.some(({ operation }) => operation.kind === 'strokeRect')).toBe(false);
    },
  );

  it('définit explicitement le bleu nuit du contour des autres objets sélectionnés (style du 5 octobre)', async () => {
    const { drawn } = await renderBalls(levelDocument, undefined, 40, 'beam-1');
    const outline = drawn.find(({ operation }) => operation.kind === 'strokeRect');
    expect(outline?.state.strokeStyle).toBe('#0f1d36');
  });
});

describe('ombre portée (U3)', () => {
  it('ne dessine aucune ombre par défaut, au repos, en simulation et pendant un placement (décision auteur)', async () => {
    const { context, operations } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    const renderer = createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport,
      spriteLoader: spriteLoader.loader,
    });
    const projections = [
      projectLevel(levelDocument),
      projectLevel(
        levelDocument,
        simulationView([['ball-1', { position: { x: 13, y: 10 }, rotation: 1.2 }]]),
      ),
      projectLevel(levelDocument, undefined, { ghostPlacementId: 'beam-1', isGhostValid: true }),
      projectLevel(levelDocument, undefined, { ghostPlacementId: 'beam-1', isGhostValid: false }),
    ];
    for (const projection of projections) {
      operations.length = 0;
      await renderer.render(projection);
      expect(operations.some(({ kind }) => kind === 'drawImage')).toBe(true);
      expect(
        operations.filter(({ kind }) => kind === 'ellipse' || kind === 'radialGradient'),
      ).toEqual([]);
    }
  });

  const renderShadows = async (
    options: {
      readonly camera?: BoardViewport;
      readonly simulation?: BoardSimulationView;
      readonly ghost?: Parameters<typeof projectLevel>[2];
    } = {},
  ) => {
    const { context, operations } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    await createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport: options.camera ?? viewport,
      spriteLoader: spriteLoader.loader,
      objectShadows: true,
    }).render(projectLevel(levelDocument, options.simulation, options.ghost));
    const drawn = replay(operations);
    return {
      operations,
      drawn,
      shadows: drawn.filter(({ operation }) => operation.kind === 'ellipse'),
    };
  };

  it('dessine une seule ombre par objet avant tous les sprites, même avec plusieurs calques', async () => {
    const { operations, shadows, drawn } = await renderShadows();
    expect(shadows).toHaveLength(levelDocument.objects.length);
    const firstSprite = operations.findIndex(({ kind }) => kind === 'drawImage');
    const lastShadow = operations.map(({ kind }) => kind).lastIndexOf('fill');
    expect(lastShadow).toBeGreaterThan(-1);
    expect(lastShadow).toBeLessThan(firstSprite);
    expect(shadows.every(({ state }) => state.alpha === 0.18)).toBe(true);
    // A shadow's alpha and transform must never leak into the sprite layers.
    expect(
      drawn
        .filter(({ operation }) => operation.kind === 'drawImage')
        .every(({ state }) => state.alpha === 1),
    ).toBe(true);
  });

  it('place une ellipse large de 90 % de l’empreinte, 0,08 unité sous son bord inférieur', async () => {
    const { shadows, operations } = await renderShadows();
    // Basket and seesaw also have multiple layers: only four ellipses overall.
    const ball = shadows.at(-1);
    expect(ball?.operation.values).toEqual([0, 0, 1, 1, 0, 0, 2 * Math.PI]);
    const transforms = ball?.state.transforms;
    expect(transforms?.[0]?.kind).toBe('translate');
    expect(transforms?.[0]?.values[0]).toBe(8);
    expect(transforms?.[0]?.values[1]).toBeCloseTo((8 + 0.3 + 0.08 - 5) * 4);
    expect(transforms?.[1]?.kind).toBe('scale');
    expect(transforms?.[1]?.values[0]).toBeCloseTo((0.6 * 0.9 * 4) / 2);
    expect(transforms?.[1]?.values[1]).toBeCloseTo((0.6 * 0.35 * 4) / 2);
    expect(operations.filter(({ kind }) => kind === 'radialGradient')).toHaveLength(4);
    expect(operations.filter(({ kind }) => kind === 'colourStop').slice(-2)).toEqual([
      { kind: 'colourStop', values: [0, '#30291f'] },
      { kind: 'colourStop', values: [1, 'rgba(48, 41, 31, 0)'] },
    ]);
  });

  it('projette l’ombre avec le zoom et le panoramique, sans doubler les pixels CSS avec le DPR', async () => {
    const { shadows } = await renderShadows({
      camera: { ...viewport, origin: { x: 9, y: 4 }, pixelsPerWorldUnit: 8, devicePixelRatio: 3 },
    });
    const ball = shadows.at(-1);
    expect(ball?.state.transforms[0]?.values[0]).toBe(24);
    expect(ball?.state.transforms[0]?.values[1]).toBeCloseTo((8 + 0.3 + 0.08 - 4) * 8);
    expect(ball?.state.transforms[1]?.values[0]).toBeCloseTo((0.6 * 0.9 * 8) / 2);
    expect(ball?.state.transforms[1]?.values[1]).toBeCloseTo((0.6 * 0.35 * 8) / 2);
  });

  it('suit la balle en chute libre sans modifier le document ni tourner avec son motif', async () => {
    const before = structuredClone(levelDocument);
    const pose = { position: { x: 13, y: 10 }, rotation: 1.2 };
    const { shadows } = await renderShadows({ simulation: simulationView([['ball-1', pose]]) });
    const ball = shadows.at(-1);
    expect(ball?.state.transforms[0]?.values[0]).toBe(12);
    expect(ball?.state.transforms[0]?.values[1]).toBeCloseTo((10 + 0.3 + 0.08 - 5) * 4);
    expect(ball?.state.transforms.some(({ kind }) => kind === 'rotate')).toBe(false);
    expect(levelDocument).toEqual(before);
  });

  it('adapte l’ellipse à l’empreinte tournée d’une poutre et garde le décalage vers le bas du monde', async () => {
    const { shadows } = await renderShadows();
    const beam = shadows[1];
    const extent = (4 + 0.25) / Math.sqrt(2);
    expect(beam?.state.transforms[0]?.values[0]).toBe(24);
    expect(beam?.state.transforms[0]?.values[1]).toBeCloseTo((10 + extent / 2 + 0.08 - 5) * 4);
    expect(beam?.state.transforms[1]?.values[0]).toBeCloseTo((extent * 0.9 * 4) / 2);
  });

  it('garde l’ombre d’un fantôme valide, sans changer l’opacité de son sprite', async () => {
    const { shadows, drawn } = await renderShadows({
      ghost: { ghostPlacementId: 'beam-1', isGhostValid: true },
    });
    expect(shadows).toHaveLength(4);
    expect(shadows[1]?.state.alpha).toBe(0.18);
    const beam = drawn.find(
      ({ operation }) => operation.kind === 'drawImage' && operation.values[3] === 16,
    );
    expect(beam?.state.alpha).toBe(0.55);
  });

  it('ne dessine aucune ombre sous un fantôme invalide, tout en gardant les autres ombres', async () => {
    for (const id of ['beam-1', 'ball-1', 'basket-1']) {
      const solid = await renderShadows();
      const invalid = await renderShadows({ ghost: { ghostPlacementId: id, isGhostValid: false } });
      const shadowIndex = id === 'basket-1' ? 0 : id === 'beam-1' ? 1 : 3;
      expect(invalid.shadows.map(({ state }) => state.transforms)).toEqual(
        solid.shadows
          .filter((_, index) => index !== shadowIndex)
          .map(({ state }) => state.transforms),
      );
      expect(invalid.shadows).toHaveLength(3);
    }
  });
});

describe('fond uni et grille sur tout le viewport (V2b)', () => {
  const renderBoard = async (renderViewport: BoardViewport) => {
    const { context, operations, fillRectStyles } = createContext();
    const spriteLoader = createPendingSpriteLoader();
    spriteLoader.setReady();
    await createBoardRenderer({
      canvas: { width: 0, height: 0 },
      context,
      viewport: renderViewport,
      spriteLoader: spriteLoader.loader,
    }).render(projectLevel(levelDocument));
    return { operations, fillRectStyles };
  };
  const gridPaths = (operations: readonly Operation[]) =>
    operations.filter((operation) => operation.kind === 'moveTo' || operation.kind === 'lineTo');

  it('peint tout le viewport d’une couleur parchemin unie, sans image de fond ni démarcation de la scène', async () => {
    const { operations, fillRectStyles } = await renderBoard(viewport);

    expect(operations.filter((operation) => operation.kind === 'fillRect')).toEqual([
      { kind: 'fillRect', values: [0, 0, 320, 240] },
    ]);
    expect(fillRectStyles).toEqual(['#f6ead3']);
    expect(operations.filter(({ kind }) => kind === 'strokeRect')).toEqual([]);
    // Seuls les sprites des objets sont des images : le fond n'en est plus une.
    expect(operations.filter((operation) => operation.kind === 'drawImage').length).toBe(
      projectLevel(levelDocument).objects.length,
    );
  });

  it('dessine la couleur, puis la grille, puis les objets', async () => {
    const { operations } = await renderBoard({ ...viewport, pixelsPerWorldUnit: 40 });
    const fill = operations.findIndex(({ kind }) => kind === 'fillRect');
    const grid = operations.findIndex(({ kind }) => kind === 'stroke');
    const firstImage = operations.findIndex(({ kind }) => kind === 'drawImage');

    expect(fill).toBeGreaterThanOrEqual(0);
    expect(fill).toBeLessThan(grid);
    expect(grid).toBeLessThan(firstImage);
  });

  it('trace une grille d’un mètre sur tout le viewport, scène comprise ou non, en pixels CSS', async () => {
    // La scène du niveau va de (10, 6) à (20, 13) : à ce cadrage elle déborde à
    // droite et s'arrête 20 px avant le bas, et la grille continue au-delà.
    const camera = { ...viewport, pixelsPerWorldUnit: 40, origin: { x: 11.5, y: 7.5 } };
    const { operations } = await renderBoard(camera);
    const paths = gridPaths(operations);

    expect(paths.slice(0, 4)).toEqual([
      { kind: 'moveTo', values: [20, 0] },
      { kind: 'lineTo', values: [20, 240] },
      { kind: 'moveTo', values: [60, 0] },
      { kind: 'lineTo', values: [60, 240] },
    ]);
    // x = 12 à 19 (huit lignes), y = 8 à 13 (six lignes), chacune sur tout le viewport.
    expect(paths).toHaveLength((8 + 6) * 2);
    expect(paths).toContainEqual({ kind: 'moveTo', values: [0, 20] });
    expect(paths).toContainEqual({ kind: 'lineTo', values: [320, 20] });
    expect(paths).toContainEqual({ kind: 'moveTo', values: [0, 260 - 40] });
    expect(operations.filter(({ kind }) => kind === 'lineWidth')).toEqual([
      { kind: 'lineWidth', values: [1] },
    ]);
  });

  it('trace la grille même quand la scène est entièrement hors du viewport, et la suit au panoramique', async () => {
    const at = async (origin: { x: number; y: number }) =>
      gridPaths(
        (await renderBoard({ ...viewport, pixelsPerWorldUnit: 40, origin })).operations,
      ).slice(0, 2);

    expect(await at({ x: 0.5, y: 0.5 })).toEqual([
      { kind: 'moveTo', values: [20, 0] },
      { kind: 'lineTo', values: [20, 240] },
    ]);
    expect(await at({ x: -30.25, y: 90 })).toEqual([
      { kind: 'moveTo', values: [10, 0] },
      { kind: 'lineTo', values: [10, 240] },
    ]);
  });

  it('atténue la grille au faible zoom', async () => {
    const colours = async (zoom: number) =>
      (
        await renderBoard({ ...viewport, pixelsPerWorldUnit: zoom, origin: { x: 10, y: 6 } })
      ).operations
        .filter((operation) => operation.kind === 'strokeStyle')
        .map(({ values }) => values[0]);

    expect(await colours(24)).toEqual(['rgba(78, 68, 51, 0.06)']);
    expect(await colours(64)).toEqual(['rgba(78, 68, 51, 0.16)']);
  });
});
