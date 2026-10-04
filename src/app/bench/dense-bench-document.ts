import { levelDocumentSchema, type LevelDocument } from '../../domain/level-document';

/**
 * The phone gate scene (ADR 0002, scene 7): the provisional maximum budget of
 * about thirty dynamic bodies and six joints, on the large 16 × 9 reference
 * scene (ADR 0007). Balls and masses rain on four seesaws and two levers
 * driving two conveyors, inside walls, so the whole budget stays busy for the
 * full attempt. The goal ball rests on a shelf out of reach and the basket is
 * unreachable: the attempt ends only by timeout, which is what a measure needs.
 */

const locked = { move: false, rotate: false, remove: false } as const;
const quarterTurn = Math.PI / 2;

type Placement = Record<string, unknown>;

const place = (
  id: string,
  type: string,
  x: number,
  y: number,
  props: Record<string, unknown> = {},
  rotation = 0,
): Placement => ({
  id,
  type,
  transform: { position: { x, y }, rotation },
  props,
  permissions: locked,
});

const seesawPivots = [2.6, 6.2, 9.8, 13.4];

const decor: Placement[] = [
  place('floor-left', 'beam', 3, 8.8, { size: 'long' }),
  place('floor-middle', 'beam', 9, 8.8, { size: 'long' }),
  place('floor-right', 'beam', 15, 8.8, { size: 'long' }),
  place('wall-left-top', 'beam', 0.15, 3, { size: 'long' }, quarterTurn),
  place('wall-left-bottom', 'beam', 0.15, 6, { size: 'long' }, quarterTurn),
  place('wall-right-top', 'beam', 15.85, 3, { size: 'long' }, quarterTurn),
  place('wall-right-bottom', 'beam', 15.85, 6, { size: 'long' }, quarterTurn),
  place('shelf', 'beam', 1.6, 1.2, { size: 'short' }),
  place('basket', 'basket', 14.6, 0.8),
  ...seesawPivots.map((x, index) => place(`seesaw-${String(index + 1)}`, 'seesaw', x, 6.2)),
  place('lever-1', 'lever', 4.4, 8.5, { position: 'center' }),
  place('lever-2', 'lever', 11.6, 8.5, { position: 'center' }),
  place('belt-1', 'conveyor', 7.6, 8.37, { direction: 'stopped' }),
  place('belt-2', 'conveyor', 13.2, 8.37, { direction: 'stopped' }),
];

// Three balls above each seesaw's ends and pivot, staggered in height.
const balls: Placement[] = seesawPivots.flatMap((x, seesaw) =>
  [-1.2, 0.4, 1.3].map((offset, index) =>
    place(`ball-${String(seesaw * 3 + index + 2)}`, 'ball', x + offset, 2.2 + index * 0.9),
  ),
);

// Masses above the other seesaw ends, the lever knobs and the belts.
const massPositions: readonly (readonly [number, number])[] = [
  [1.3, 1.6],
  [5.0, 0.8],
  [7.4, 1.6],
  [8.6, 0.8],
  [11.0, 1.6],
  [12.2, 0.8],
  [14.6, 2.4],
  [4.2, 4.2],
  [11.4, 4.2],
  [7.0, 5.0],
  [13.0, 5.0],
  [3.2, 3.8],
];
const masses: Placement[] = massPositions.map(([x, y], index) =>
  place(`mass-${String(index + 1)}`, 'mass', x, y, { weight: '10kg' }),
);

export const denseBenchDocument: LevelDocument = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'bench-dense-scene',
  metadata: {
    title: 'Scène dense',
    description:
      'Scène de mesure : trente corps dynamiques et six articulations en mouvement pendant vingt secondes.',
  },
  objects: [...decor, place('ball-1', 'ball', 1.6, 0.765), ...balls, ...masses],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket' },
  buildZones: [],
  scene: { min: { x: 0, y: 0 }, max: { x: 16, y: 9 } },
  wires: [
    { id: 'wire-1', sourceId: 'lever-1', targetId: 'belt-1' },
    { id: 'wire-2', sourceId: 'lever-2', targetId: 'belt-2' },
  ],
});
