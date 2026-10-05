import { describe, expect, it } from 'vitest';

import { levelDocumentSchema } from '../domain/level-document';
import { pistonGeometry } from '../domain/family-geometry';
import { projectPendingWire, projectWires } from './control-wires';

const lockedPermissions = { move: false, rotate: false, remove: false } as const;

const placement = (id: string, type: string, x: number, y: number, props: object) => ({
  id,
  type,
  transform: { position: { x, y }, rotation: 0 },
  props,
  permissions: lockedPermissions,
});

/** A lever wired to a conveyor, a long beam lying right between them. */
const wiredDocument = (conveyorX: number) =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'wires',
    metadata: { title: 'Fils' },
    objects: [
      placement('ball-1', 'ball', 1, 1, {}),
      placement('basket-1', 'basket', 1, 9, {}),
      placement('lever-1', 'lever', 5, 4, { position: 'center' }),
      placement('beam-1', 'beam', 7.5, 4.5, { size: 'long' }),
      placement('conveyor-1', 'conveyor', conveyorX, 5, { direction: 'stopped' }),
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 14, y: 10 } },
    wires: [{ id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1' }],
  });

/** Lever and conveyor with ports level with each other: no bend needed. */
const alignedDocument = () =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'wires-aligned',
    metadata: { title: 'Fils alignés' },
    objects: [
      placement('ball-1', 'ball', 1, 1, {}),
      placement('basket-1', 'basket', 1, 9, {}),
      placement('lever-1', 'lever', 5, 4, { position: 'center' }),
      placement('conveyor-1', 'conveyor', 11, 4.05, { direction: 'stopped' }),
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 14, y: 10 } },
    wires: [{ id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1' }],
  });

const timerDocument = () =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'wires-timer',
    metadata: { title: 'Fil avec minuteur' },
    objects: [
      placement('ball-1', 'ball', 1, 1, {}),
      placement('basket-1', 'basket', 1, 9, {}),
      placement('lever-1', 'lever', 2, 4, { position: 'center' }),
      placement('timer-1', 'timer', 6, 4.05, { delaySeconds: 3 }),
      placement('conveyor-1', 'conveyor', 10, 4.05, { direction: 'stopped' }),
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 14, y: 10 } },
    wires: [{ id: 'wire-1', sourceId: 'lever-1', timerId: 'timer-1', targetId: 'conveyor-1' }],
  });

/** A button wired to a piston standing at (7, 5). */
const pistonDocument = (buttonX: number) =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'wires-piston',
    metadata: { title: 'Fil du piston' },
    objects: [
      placement('ball-1', 'ball', 1, 1, {}),
      placement('basket-1', 'basket', 1, 9, {}),
      placement('button-1', 'button', buttonX, 3, {}),
      placement('piston-1', 'piston', 7, 5, {}),
    ],
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 14, y: 10 } },
    wires: [{ id: 'wire-1', sourceId: 'button-1', targetId: 'piston-1' }],
  });

describe('tracé des fils', () => {
  it('relie la source à la cible par un segment unique quand les ports sont alignés', () => {
    const [wire] = projectWires(alignedDocument());

    expect(wire?.from).toEqual({ x: 5.4, y: 4.05 });
    expect(wire?.to).toEqual({ x: 9.5, y: 4.05 });
    expect(wire).not.toHaveProperty('bend');
    expect(wire).not.toHaveProperty('points');
    expect(wire).not.toHaveProperty('bridges');
  });

  it('sinon part dans l’axe du port de la source puis tourne une fois vers la cible (équerre)', () => {
    const [wire] = projectWires(wiredDocument(11));

    // Right port of the lever's base, left end of the conveyor's frame; the
    // wire leaves the lever horizontally (its port's axis), then turns once
    // down to the conveyor. The beam between them does not bend the route.
    expect(wire?.from).toEqual({ x: 5.4, y: 4.05 });
    expect(wire?.to).toEqual({ x: 9.5, y: 5 });
    expect(wire?.bend).toEqual({ x: 9.5, y: 4.05 });
    expect(wire).not.toHaveProperty('bridges');
  });

  it('prend sur chaque objet le port tourné vers l’autre', () => {
    const [wire] = projectWires(wiredDocument(1.5));

    expect(wire?.from).toEqual({ x: 4.6, y: 4.05 });
    expect(wire?.to).toEqual({ x: 3, y: 5 });
    expect(wire?.bend).toEqual({ x: 3, y: 4.05 });
  });

  it('dérive deux segments autour du minuteur dans une seule liaison', () => {
    const [wire] = projectWires(timerDocument());

    expect(wire?.segments).toEqual([
      { from: { x: 2.4, y: 4.05 }, to: { x: 5.25, y: 4.05 } },
      { from: { x: 6.75, y: 4.05 }, to: { x: 8.5, y: 4.05 } },
    ]);
    expect(wire?.id).toBe('wire-1');
    expect(wire?.sourceId).toBe('lever-1');
    expect(wire?.targetId).toBe('conveyor-1');
  });

  it.each([
    ['à gauche du piston', 2],
    ['à droite du piston', 12],
  ])('accroche le fil à l’arrière du boîtier du piston, bouton %s', (_side, buttonX) => {
    const [wire] = projectWires(pistonDocument(buttonX));
    const { housing } = pistonGeometry;
    const local = { x: (wire?.to.x ?? 0) - 7, y: (wire?.to.y ?? 0) - 5 };

    // The plate and rod move on the right: the wire always takes the rear.
    expect(local.x).toBeCloseTo(housing.footprint.x, 1);
    expect(local.x).toBeGreaterThanOrEqual(housing.footprint.x);
    expect(local.y).toBeGreaterThan(housing.footprint.y);
    expect(local.y).toBeLessThan(housing.footprint.y + housing.footprint.height);
  });
});

describe('fil en cours de pose', () => {
  it('suit le curseur depuis le port du premier objet, en équerre', () => {
    const pending = projectPendingWire(wiredDocument(11), { firstId: 'lever-1' }, { x: 8, y: 6 });

    expect(pending).toEqual([
      { from: { x: 5.4, y: 4.05 }, to: { x: 8, y: 6 }, bend: { x: 8, y: 4.05 } },
    ]);
  });

  it('prend le port tourné vers le curseur', () => {
    const pending = projectPendingWire(
      wiredDocument(11),
      { firstId: 'lever-1' },
      { x: 2, y: 4.05 },
    );

    expect(pending).toEqual([{ from: { x: 4.6, y: 4.05 }, to: { x: 2, y: 4.05 } }]);
  });

  it('garde le segment vers le minuteur et tire le second depuis sa sortie', () => {
    const pending = projectPendingWire(
      timerDocument(),
      { firstId: 'lever-1', timerId: 'timer-1' },
      { x: 9, y: 6 },
    );

    expect(pending).toEqual([
      { from: { x: 2.4, y: 4.05 }, to: { x: 5.25, y: 4.05 } },
      { from: { x: 6.75, y: 4.05 }, to: { x: 9, y: 6 }, bend: { x: 9, y: 4.05 } },
    ]);
  });

  it('ne trace rien depuis un objet sans port ou disparu', () => {
    expect(projectPendingWire(wiredDocument(11), { firstId: 'beam-1' }, { x: 8, y: 6 })).toEqual(
      [],
    );
    expect(projectPendingWire(wiredDocument(11), { firstId: 'absent' }, { x: 8, y: 6 })).toEqual(
      [],
    );
  });
});
