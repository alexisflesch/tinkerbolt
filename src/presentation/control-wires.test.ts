import { describe, expect, it } from 'vitest';

import { levelDocumentSchema } from '../domain/level-document';
import { projectWires } from './control-wires';

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
});
