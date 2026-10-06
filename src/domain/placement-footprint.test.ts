import { describe, expect, it } from 'vitest';

import type { LevelDocument } from './level-document';
import { placementFootprintCorners } from './placement-footprint';

const permissions = { move: true, rotate: false, remove: false } as const;

type Placement = LevelDocument['objects'][number];
type Point = Readonly<{ x: number; y: number }>;
type Pose = Readonly<{ position: Point; rotation?: number }>;

const common = (id: string, { position, rotation = 0 }: Pose) => ({
  id,
  transform: { position, rotation },
  permissions,
});

const ball = (pose: Pose = { position: { x: 0, y: 0 } }) => ({
  ...common('ball-1', pose),
  type: 'ball' as const,
  props: {},
});
const basket = (pose: Pose = { position: { x: 0, y: 0 } }) => ({
  ...common('basket-1', pose),
  type: 'basket' as const,
  props: {},
});
const beam = (size: 'short' | 'medium' | 'long', pose: Pose = { position: { x: 0, y: 0 } }) => ({
  ...common('beam-1', pose),
  type: 'beam' as const,
  props: { size },
});
const seesaw = (pose: Pose = { position: { x: 0, y: 0 } }) => ({
  ...common('seesaw-1', pose),
  type: 'seesaw' as const,
  props: {},
});
const mass = (pose: Pose = { position: { x: 0, y: 0 } }) => ({
  ...common('mass-1', pose),
  type: 'mass' as const,
  props: { weight: '10kg' as const },
});
const lever = (
  position: 'left' | 'center' | 'right',
  pose: Pose = { position: { x: 0, y: 0 } },
) => ({ ...common('lever-1', pose), type: 'lever' as const, props: { position } });
const conveyor = (pose: Pose = { position: { x: 0, y: 0 } }) => ({
  ...common('conveyor-1', pose),
  type: 'conveyor' as const,
  props: { direction: 'stopped' as const },
});
const button = (pose: Pose = { position: { x: 0, y: 0 } }) => ({
  ...common('button-1', pose),
  type: 'button' as const,
  props: {},
});
const fan = (pose: Pose = { position: { x: 0, y: 0 } }) => ({
  ...common('fan-1', pose),
  type: 'fan' as const,
  props: { state: 'on' as const },
});
const barrier = (state: 'open' | 'closed', pose: Pose = { position: { x: 0, y: 0 } }) => ({
  ...common('barrier-1', pose),
  type: 'barrier' as const,
  props: { state },
});
const springboard = (pose: Pose = { position: { x: 0, y: 0 } }) => ({
  ...common('springboard-1', pose),
  type: 'springboard' as const,
  props: {},
});

const expectCornersCloseTo = (actual: readonly Point[], expected: readonly Point[]): void => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((point, index) => {
    const expectedPoint = expected[index];
    if (expectedPoint === undefined) throw new Error('Expected corner is missing');
    expect(point.x).toBeCloseTo(expectedPoint.x, 6);
    expect(point.y).toBeCloseTo(expectedPoint.y, 6);
  });
};

const expectBoundsCloseTo = (placement: Placement, min: Point, max: Point): void => {
  const corners = placementFootprintCorners(placement);
  const xs = corners.map(({ x }) => x);
  const ys = corners.map(({ y }) => y);
  expect(Math.min(...xs)).toBeCloseTo(min.x, 6);
  expect(Math.min(...ys)).toBeCloseTo(min.y, 6);
  expect(Math.max(...xs)).toBeCloseTo(max.x, 6);
  expect(Math.max(...ys)).toBeCloseTo(max.y, 6);
};

describe('placementFootprintCorners', () => {
  it('returns the four world corners of an unrotated medium beam', () => {
    expectCornersCloseTo(
      placementFootprintCorners(beam('medium', { position: { x: 10, y: 20 } })),
      [
        { x: 8, y: 19.875 },
        { x: 12, y: 19.875 },
        { x: 12, y: 20.125 },
        { x: 8, y: 20.125 },
      ],
    );
  });

  it('rotates a beam footprint by ninety degrees around its placement origin', () => {
    expectCornersCloseTo(
      placementFootprintCorners(
        beam('medium', { position: { x: 10, y: 20 }, rotation: Math.PI / 2 }),
      ),
      [
        { x: 10.125, y: 18 },
        { x: 10.125, y: 22 },
        { x: 9.875, y: 22 },
        { x: 9.875, y: 18 },
      ],
    );
  });

  it('keeps the ball circle bounds unchanged by rotation', () => {
    expectCornersCloseTo(
      placementFootprintCorners(ball({ position: { x: 10, y: 20 }, rotation: Math.PI / 2 })),
      [
        { x: 9.7, y: 19.7 },
        { x: 10.3, y: 19.7 },
        { x: 10.3, y: 20.3 },
        { x: 9.7, y: 20.3 },
      ],
    );
  });

  it('includes the seesaw fulcrum below its non-centred pivot', () => {
    expectCornersCloseTo(placementFootprintCorners(seesaw({ position: { x: 10, y: 20 } })), [
      { x: 8.5, y: 19.88 },
      { x: 11.5, y: 19.88 },
      { x: 11.5, y: 20.7 },
      { x: 8.5, y: 20.7 },
    ]);
  });

  it('uses the tilted lever handle footprint selected by its persisted position', () => {
    const corners = placementFootprintCorners(lever('right'));
    const xs = corners.map(({ x }) => x);
    const ys = corners.map(({ y }) => y);
    expect(Math.min(...xs)).toBeCloseTo(-0.4, 6);
    expect(Math.max(...xs)).toBeCloseTo(0.746, 3);
    expect(Math.min(...ys)).toBeCloseTo(-0.746, 3);
    expect(Math.max(...ys)).toBeCloseTo(0.208, 3);
  });

  it('uses the declared world footprint for every object family and barrier state', () => {
    const cases: readonly Readonly<{ placement: Placement; min: Point; max: Point }>[] = [
      { placement: ball(), min: { x: -0.3, y: -0.3 }, max: { x: 0.3, y: 0.3 } },
      { placement: basket(), min: { x: -0.75, y: -0.55 }, max: { x: 0.75, y: 0.55 } },
      { placement: beam('short'), min: { x: -1, y: -0.125 }, max: { x: 1, y: 0.125 } },
      { placement: beam('long'), min: { x: -3, y: -0.125 }, max: { x: 3, y: 0.125 } },
      { placement: seesaw(), min: { x: -1.5, y: -0.12 }, max: { x: 1.5, y: 0.7 } },
      { placement: mass(), min: { x: -0.4, y: -0.2526 }, max: { x: 0.4, y: 0.2526 } },
      {
        placement: lever('right'),
        min: { x: -0.4, y: -0.7460683648 },
        max: { x: 0.7460683648, y: 0.2078893937 },
      },
      {
        placement: conveyor(),
        min: { x: -1.5, y: (-376 * 3) / 2120 / 2 },
        max: { x: 1.5, y: (376 * 3) / 2120 / 2 },
      },
      { placement: button(), min: { x: -0.4, y: -0.2402 }, max: { x: 0.4, y: 0.2402 } },
      { placement: fan(), min: { x: -0.6, y: -0.4683 }, max: { x: 0.6, y: 0.4684 } },
      { placement: barrier('open'), min: { x: -0.45, y: -0.4779 }, max: { x: 0.45, y: 0.4779 } },
      {
        placement: barrier('closed'),
        min: { x: -0.45, y: -0.4779 },
        max: { x: 1.7013, y: 0.4779 },
      },
      { placement: springboard(), min: { x: -0.5, y: -0.4654 }, max: { x: 0.5, y: 0.4654 } },
    ];

    cases.forEach(({ placement, min, max }) => {
      expectBoundsCloseTo(placement, min, max);
    });
  });
});
