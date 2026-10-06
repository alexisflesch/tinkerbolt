import { describe, expect, it } from 'vitest';

import { levelDocumentSchema } from '../domain/level-document';
import { createSimulationSession, type SimulationBodyState } from './simulation-session';

const permissions = { move: false, rotate: false, remove: false } as const;
const directions = [
  { direction: 'right', sign: 1 },
  { direction: 'left', sign: -1 },
] as const;
const orientations = Array.from({ length: 24 }, (_, step) => step * 15);
// Measured contour of the approved asset, before the production geometry changes.
const radius = (376 * 3) / 2120 / 2;
const endX = 1.5 - radius;
const surfaces = [
  { surface: 'dessus', centerX: 0, degrees: -90 },
  { surface: 'dessous', centerX: 0, degrees: 90 },
  { surface: 'jonction droite haut', centerX: endX, degrees: -90 },
  { surface: 'jonction droite bas', centerX: endX, degrees: 90 },
  { surface: 'jonction gauche haut', centerX: -endX, degrees: -90 },
  { surface: 'jonction gauche bas', centerX: -endX, degrees: 90 },
  { surface: 'bout droit', centerX: endX, degrees: 0 },
  { surface: 'arrondi droit haut', centerX: endX, degrees: -45 },
  { surface: 'arrondi droit bas', centerX: endX, degrees: 45 },
  { surface: 'bout gauche', centerX: -endX, degrees: 180 },
  { surface: 'arrondi gauche haut', centerX: -endX, degrees: 225 },
  { surface: 'arrondi gauche bas', centerX: -endX, degrees: 135 },
] as const;

const boxDistanceToCapsuleAxis = (box: SimulationBodyState, rotation: number): number => {
  // A square rotates as it rounds a pulley: compare its actual distance
  // to the capsule's centre segment, rather than a fixed half-height.
  const boxAngle = box.rotation - rotation;
  const cosine = Math.cos(rotation),
    sine = Math.sin(rotation);
  const bx = box.position.x * cosine + box.position.y * sine;
  const by = -box.position.x * sine + box.position.y * cosine;
  const corners = [-1, 1].flatMap((x) =>
    [-1, 1].map((y) => ({
      x: bx + 0.4 * (x * Math.cos(boxAngle) - y * Math.sin(boxAngle)),
      y: by + 0.4 * (x * Math.sin(boxAngle) + y * Math.cos(boxAngle)),
    })),
  );
  const distances = corners.map(({ x, y }) =>
    Math.hypot(x - Math.max(-endX, Math.min(endX, x)), y),
  );
  for (const endpoint of [-endX, endX]) {
    const dx = endpoint - bx,
      dy = -by;
    const x = dx * Math.cos(boxAngle) + dy * Math.sin(boxAngle);
    const y = -dx * Math.sin(boxAngle) + dy * Math.cos(boxAngle);
    distances.push(Math.hypot(Math.max(0, Math.abs(x) - 0.4), Math.max(0, Math.abs(y) - 0.4)));
  }
  return Math.min(...distances);
};
describe('courroie périphérique du convoyeur après rotation', () => {
  it.each(
    orientations.flatMap((degrees) =>
      directions.flatMap((direction) =>
        surfaces.map((surface) => ({
          ...surface,
          ...direction,
          normalDegrees: surface.degrees,
          degrees,
        })),
      ),
    ),
  )(
    'entraîne sur $surface à $degrees°, sens $direction',
    ({ degrees, direction, sign, normalDegrees, centerX }) => {
      const rotation = (degrees * Math.PI) / 180;
      const normalAngle = rotation + (normalDegrees * Math.PI) / 180;
      const normal = { x: Math.cos(normalAngle), y: Math.sin(normalAngle) };
      const tangent = { x: -normal.y, y: normal.x };
      const center = { x: centerX * Math.cos(rotation), y: centerX * Math.sin(rotation) };
      const distance = radius + 0.4 + 0.015;
      const start = { x: center.x + normal.x * distance, y: center.y + normal.y * distance };
      const level = levelDocumentSchema.parse({
        schemaVersion: 3,
        id: 'rotated-conveyor',
        metadata: { title: 'Courroie orientée et caisse métallique' },
        objects: [
          {
            id: 'conveyor',
            type: 'conveyor',
            transform: { position: { x: 0, y: 0 }, rotation },
            props: { direction },
            permissions,
          },
          {
            id: 'box',
            type: 'box',
            transform: { position: start, rotation: normalAngle + Math.PI / 2 },
            props: { material: 'metal' },
            permissions,
          },
          {
            id: 'magnet',
            type: 'electro-magnet',
            // Press normally into the tested surface, even against gravity.
            transform: {
              position: { x: center.x - normal.x * 0.8, y: center.y - normal.y * 0.8 },
              rotation: normalAngle + Math.PI / 2,
            },
            props: { state: 'on' },
            permissions,
          },
          {
            id: 'magnet-support',
            type: 'electro-magnet',
            transform: {
              position: { x: center.x - normal.x * 0.8, y: center.y - normal.y * 0.8 },
              rotation: normalAngle + Math.PI / 2,
            },
            props: { state: 'on' },
            permissions,
          },
        ],
        inventory: [],
        buildZones: [],
        scene: { min: { x: -4, y: -4 }, max: { x: 4, y: 4 } },
      });
      const before = structuredClone(level);
      const stoppedLevel = structuredClone(level);
      const stoppedBelt = stoppedLevel.objects.find(({ type }) => type === 'conveyor');
      if (stoppedBelt?.type !== 'conveyor') throw new Error('Convoyeur absent');
      stoppedBelt.props.direction = 'stopped';
      const stopped = createSimulationSession(stoppedLevel, { fixedStepSeconds: 1 / 60 });
      const session = createSimulationSession(level, { fixedStepSeconds: 1 / 60 });
      try {
        for (let step = 0; step < 20; step += 1) {
          session.advanceFixedSteps(1);
          const current = session
            .readState()
            .bodies.find(({ placementId }) => placementId === 'box');
          if (current === undefined) throw new Error('Caisse absente');
          expect(
            Math.abs(boxDistanceToCapsuleAxis(current, rotation) - radius - 0.01),
          ).toBeLessThan(0.025);
        }
        stopped.advanceFixedSteps(20);
        const restingBox = stopped
          .readState()
          .bodies.find(({ placementId }) => placementId === 'box');
        if (restingBox === undefined) throw new Error('Caisse témoin absente');
        const box = session.readState().bodies.find(({ placementId }) => placementId === 'box');
        if (box === undefined) throw new Error('Caisse absente de la simulation');
        // Gravity can oppose propulsion on a curved end. The stopped twin
        // isolates the belt's contribution without pretending that it glues a box.
        expect(
          sign *
            ((box.position.x - restingBox.position.x) * tangent.x +
              (box.position.y - restingBox.position.y) * tangent.y),
        ).toBeGreaterThan(0.02);
        expect(
          sign *
            ((box.linearVelocity.x - restingBox.linearVelocity.x) * tangent.x +
              (box.linearVelocity.y - restingBox.linearVelocity.y) * tangent.y),
        ).toBeGreaterThan(0.1);
        expect(Math.abs(boxDistanceToCapsuleAxis(box, rotation) - radius - 0.01)).toBeLessThan(
          0.025,
        );
        if (centerX === 0) {
          // On the straight faces, the supported box moves absolutely in the belt direction.
          expect(
            sign *
              ((box.position.x - start.x) * tangent.x + (box.position.y - start.y) * tangent.y),
          ).toBeGreaterThan(0.05);
          expect(
            sign * (box.linearVelocity.x * tangent.x + box.linearVelocity.y * tangent.y),
          ).toBeGreaterThan(0.2);
        }
        expect(level).toEqual(before);
      } finally {
        session.destroy();
        stopped.destroy();
      }
    },
  );
});
