import { describe, expect, it } from 'vitest';

import {
  barrierFootprint,
  barrierGeometry,
  buttonGeometry,
  fanGeometry,
  leverFootprint,
  leverGeometry,
  massGeometry,
  facingPose,
  mirroredRotation,
  pistonGeometry,
  seesawGeometry,
  springboardGeometry,
  type WorldPolygon,
  type WorldRect,
} from './family-geometry';

const MAX_POLYGON_VERTICES = 8;
/** The polygons are measured on sprites; a hundredth of a unit is under a pixel at 64 px/unit. */
const MEASUREMENT_TOLERANCE = 0.01;

const isConvex = (polygon: WorldPolygon): boolean => {
  const signs = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length] ?? point;
    const afterNext = polygon[(index + 2) % polygon.length] ?? point;
    return Math.sign(
      (next.x - point.x) * (afterNext.y - next.y) - (next.y - point.y) * (afterNext.x - next.x),
    );
  });
  return signs.every((sign) => sign >= 0) || signs.every((sign) => sign <= 0);
};

const bounds = (polygon: WorldPolygon): WorldRect => {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

/**
 * ADR 0007: the sprite's alpha box is exactly the collider footprint. For a
 * polygon collider this means its bounding box fills the declared footprint
 * on all four sides.
 */
export const expectPolygonToFillFootprint = (polygon: WorldPolygon, footprint: WorldRect): void => {
  expect(polygon.length).toBeGreaterThanOrEqual(3);
  expect(polygon.length).toBeLessThanOrEqual(MAX_POLYGON_VERTICES);
  expect(isConvex(polygon)).toBe(true);

  const actual = bounds(polygon);
  expect(Math.abs(actual.x - footprint.x)).toBeLessThanOrEqual(MEASUREMENT_TOLERANCE);
  expect(Math.abs(actual.y - footprint.y)).toBeLessThanOrEqual(MEASUREMENT_TOLERANCE);
  expect(Math.abs(actual.width - footprint.width)).toBeLessThanOrEqual(MEASUREMENT_TOLERANCE);
  expect(Math.abs(actual.height - footprint.height)).toBeLessThanOrEqual(MEASUREMENT_TOLERANCE);
};

describe('géométrie des familles', () => {
  it('pose le pied de la bascule sous le tablier, sans le traverser', () => {
    const { board, fulcrum } = seesawGeometry;

    expect(fulcrum.footprint.y).toBeCloseTo(board.halfThickness);
    expectPolygonToFillFootprint(fulcrum.polygon, fulcrum.footprint);
  });

  it('donne à la masse un collider, corps et anneau, qui remplit son empreinte', () => {
    const { footprint, polygon, ring } = massGeometry;
    const body = bounds(polygon);

    expect(footprint.width).toBe(0.8);
    expect(polygon.length).toBeLessThanOrEqual(MAX_POLYGON_VERTICES);
    expect(isConvex(polygon)).toBe(true);
    const near = (actual: number, expected: number): void => {
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(MEASUREMENT_TOLERANCE);
    };
    near(body.x, footprint.x);
    near(body.width, footprint.width);
    near(body.y + body.height, footprint.y + footprint.height);
    near(ring.center.y - ring.radius, footprint.y);
    expect(ring.center.y + ring.radius).toBeGreaterThan(body.y);
  });

  it('donne au socle du levier un collider qui remplit son empreinte', () => {
    expectPolygonToFillFootprint(leverGeometry.base.polygon, leverGeometry.base.footprint);
  });

  it('élargit l’empreinte du levier du côté où penche sa poignée', () => {
    const center = leverFootprint('center');
    const right = leverFootprint('right');
    const left = leverFootprint('left');

    expect(center.x).toBeCloseTo(-0.4);
    expect(center.width).toBeCloseTo(0.8);
    expect(right.x + right.width).toBeGreaterThan(0.6);
    expect(left.x).toBeCloseTo(-(right.x + right.width));
    expect(right.y).toBeGreaterThan(center.y);
  });

  it('garde l’empreinte d’ensemble de la bascule figée par A4', () => {
    expect(seesawGeometry.footprint).toEqual({ x: -1.5, y: -0.12, width: 3, height: 0.82 });
  });

  it('donne aux pièces fixes des nouvelles familles des colliders qui remplissent leur empreinte', () => {
    expectPolygonToFillFootprint(buttonGeometry.base.polygon, buttonGeometry.base.footprint);
    expectPolygonToFillFootprint(
      springboardGeometry.base.polygon,
      springboardGeometry.base.footprint,
    );
    expectPolygonToFillFootprint(barrierGeometry.pillar.polygon, barrierGeometry.pillar.footprint);
    expectPolygonToFillFootprint(fanGeometry.body.polygon, fanGeometry.body.footprint);
  });

  it('garde le piston à une taille proche du ventilateur', () => {
    const pistonArea = pistonGeometry.footprint.width * pistonGeometry.footprint.height;
    const fanArea = fanGeometry.body.footprint.width * fanGeometry.body.footprint.height;

    expect(pistonGeometry.footprint.width).toBeLessThan(fanGeometry.body.footprint.width * 1.05);
    expect(pistonGeometry.footprint.height).toBeLessThan(fanGeometry.body.footprint.height * 1.2);
    expect(pistonArea).toBeGreaterThan(fanArea * 0.7);
    expect(pistonArea).toBeLessThan(fanArea * 1.25);
  });

  it('pose le capuchon du bouton et le plateau du tremplin au sommet de leur empreinte', () => {
    expect(buttonGeometry.cap.footprint.y).toBeCloseTo(buttonGeometry.footprint.y);
    expect(buttonGeometry.cap.footprint.y + buttonGeometry.cap.footprint.height).toBeGreaterThan(
      buttonGeometry.base.footprint.y,
    );
    expect(springboardGeometry.platform.footprint.y).toBeCloseTo(springboardGeometry.footprint.y);
  });

  it('dessine en miroir ce qui pointe vers la gauche, pour ne jamais mettre un ventilateur la tête en bas', () => {
    expect(facingPose(0)).toEqual({ angle: 0, mirrored: false });
    expect(facingPose(-Math.PI / 2)).toEqual({ angle: -Math.PI / 2, mirrored: false });
    expect(facingPose((3 * Math.PI) / 2).mirrored).toBe(false);
    expect(facingPose(Math.PI)).toEqual({ angle: 0, mirrored: true });
    expect(facingPose(3 * Math.PI).mirrored).toBe(true);
    expect(facingPose(-Math.PI).angle).toBeCloseTo(-2 * Math.PI);
    // Tilted by 15° while pointing left: mirrored, then turned the other way.
    const tilted = facingPose(Math.PI - Math.PI / 12);
    expect(tilted.mirrored).toBe(true);
    expect(tilted.angle).toBeCloseTo(-Math.PI / 12);
  });

  it('retourne un objet de gauche à droite, en miroir de son inclinaison', () => {
    expect(mirroredRotation(0)).toBeCloseTo(Math.PI);
    expect(mirroredRotation(Math.PI)).toBeCloseTo(0);
    expect(mirroredRotation(Math.PI / 12)).toBeCloseTo((11 * Math.PI) / 12);
    expect(mirroredRotation(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    const back = facingPose(mirroredRotation(Math.PI / 12));
    expect(back.mirrored).toBe(true);
    expect(back.angle).toBeCloseTo(-Math.PI / 12);
  });

  it('étend l’empreinte de la barrière fermée jusqu’au bout de sa barre, et la réduit au poteau ouverte', () => {
    const pillar = barrierGeometry.pillar.footprint;
    const closed = barrierFootprint('closed');

    expect(barrierFootprint('open')).toEqual(pillar);
    expect(closed.x).toBeCloseTo(pillar.x);
    expect(closed.x + closed.width).toBeCloseTo(barrierGeometry.bar.length);
  });
});
