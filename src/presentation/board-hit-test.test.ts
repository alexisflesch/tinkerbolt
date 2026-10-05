import { describe, expect, it } from 'vitest';

import { levelDocumentSchema, type LevelDocument } from '../domain/level-document';
import {
  beamSizeHandleGeometry,
  projectLevel,
  rotationHandleBounds,
  type BoardViewport,
} from './board-renderer';
import { hitTestBoard, hitTestRotationHandle } from './board-hit-test';
import { ROTATION_HANDLE_CORNER_OFFSET_CSS_PIXELS } from './rotation-handle-metrics';

const viewport: BoardViewport = {
  cssWidth: 320,
  cssHeight: 240,
  origin: { x: 3, y: 2 },
  pixelsPerWorldUnit: 20,
  devicePixelRatio: 1,
};

const createDocument = (objects: LevelDocument['objects']): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'hit-test',
    metadata: { title: 'Hit-test' },
    objects,
    inventory: [],
    goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 16, y: 9 } },
  });

const beam = (
  id: string,
  position: { readonly x: number; readonly y: number },
  rotation = 0,
): LevelDocument['objects'][number] => ({
  id,
  type: 'beam',
  transform: { position, rotation },
  props: { size: 'medium' },
  permissions: { move: true, rotate: true, remove: true },
});

const ball = (id: string, position: { readonly x: number; readonly y: number }) => ({
  id,
  type: 'ball' as const,
  transform: { position, rotation: 0 },
  props: {},
  permissions: { move: false, rotate: false, remove: false },
});

const basket = (id: string, position: { readonly x: number; readonly y: number }) => ({
  id,
  type: 'basket' as const,
  transform: { position, rotation: 0 },
  props: {},
  permissions: { move: false, rotate: false, remove: false },
});

describe('hit-test pur du plateau', () => {
  it('projette le point en tenant compte de la caméra et de la rotation de l’empreinte', () => {
    const document = createDocument([
      ball('ball-1', { x: 1, y: 1 }),
      basket('basket-1', { x: 2, y: 1 }),
      beam('beam-rotated', { x: 5, y: 4 }, Math.PI / 2),
    ]);

    const objects = projectLevel(document).objects;

    // (5, 4) in world units maps to (40, 40) with this camera. The beam is
    // rotated, so a point 30 CSS px below its centre lies inside its long
    // side; an axis-aligned hit-test would reject it.
    expect(hitTestBoard({ x: 40, y: 70 }, objects, viewport)).toBe('beam-rotated');
    expect(hitTestBoard({ x: 100, y: 70 }, objects, viewport)).toBeNull();
  });

  it('élargit chaque empreinte à une zone tactile minimale de 44 × 44 CSS px', () => {
    const document = createDocument([
      ball('ball-1', { x: 1, y: 1 }),
      basket('basket-1', { x: 2, y: 1 }),
      beam('small-target', { x: 5, y: 4 }),
    ]);

    const objects = projectLevel(document).objects;

    // The medium beam is only 5 CSS px high at this zoom. Its centre is
    // (40, 40), so ±20 CSS px must still be actionable through the expanded
    // touch target, while a point beyond the 44 px target is outside.
    expect(hitTestBoard({ x: 40, y: 60 }, objects, viewport)).toBe('small-target');
    expect(hitTestBoard({ x: 40, y: 63 }, objects, viewport)).toBeNull();
  });

  it('donne la priorité déterministe au dernier objet placé', () => {
    const document = createDocument([
      ball('ball-1', { x: 1, y: 1 }),
      basket('basket-1', { x: 2, y: 1 }),
      beam('first', { x: 5, y: 4 }),
      beam('last', { x: 5, y: 4 }),
    ]);

    expect(hitTestBoard({ x: 40, y: 40 }, projectLevel(document).objects, viewport)).toBe('last');
  });

  it('traite une bascule comme une cible unique', () => {
    const document = createDocument([
      ball('ball-1', { x: 1, y: 1 }),
      basket('basket-1', { x: 2, y: 1 }),
      {
        id: 'seesaw-1',
        type: 'seesaw',
        transform: { position: { x: 7, y: 4 }, rotation: 0 },
        props: {},
        permissions: { move: true, rotate: false, remove: true },
      },
    ]);

    const candidates = projectLevel(document).objects.filter((object) => object.id === 'seesaw-1');
    // Fulcrum and board are two layers of one target sharing the whole footprint.
    expect(candidates.map((candidate) => candidate.destination)).toEqual([
      { x: -1.5, y: -0.12, width: 3, height: 0.82 },
      { x: -1.5, y: -0.12, width: 3, height: 0.82 },
    ]);
    expect(hitTestBoard({ x: 80, y: 40 }, projectLevel(document).objects, viewport)).toBe(
      'seesaw-1',
    );
  });

  it('accroche la poignée de rotation au coin supérieur gauche de l’objet, et la fait tourner avec lui', () => {
    const selectedBeam = (rotation: number) => {
      const document = createDocument([
        ball('ball-1', { x: 1, y: 1 }),
        basket('basket-1', { x: 2, y: 1 }),
        {
          ...beam('rotatable-beam', { x: 5, y: 4 }),
          transform: { position: { x: 5, y: 4 }, rotation },
        },
      ]);
      const selected = projectLevel(document).objects.find(
        (object) => object.id === 'rotatable-beam',
      );
      if (selected === undefined) throw new Error('La poutre sélectionnée est absente.');
      return selected;
    };

    // The beam centre maps to (40, 40). In the beam's own frame, the knob sits
    // diagonally off its top-left corner; it turns with the beam, never jumping.
    const { destination } = selectedBeam(0);
    const local = {
      x: destination.x * 20 - ROTATION_HANDLE_CORNER_OFFSET_CSS_PIXELS,
      y: destination.y * 20 - ROTATION_HANDLE_CORNER_OFFSET_CSS_PIXELS,
    };
    const knobAt = (rotation: number) => ({
      x: 40 + local.x * Math.cos(rotation) - local.y * Math.sin(rotation),
      y: 40 + local.x * Math.sin(rotation) + local.y * Math.cos(rotation),
    });

    // Flat, the knob is left of the beam's left end and above its top edge.
    expect(knobAt(0).x).toBeLessThan(40 + destination.x * 20);
    expect(knobAt(0).y).toBeLessThan(40 + destination.y * 20);
    const flat = rotationHandleBounds(selectedBeam(0), viewport);
    expect(flat.x + flat.width / 2).toBeCloseTo(knobAt(0).x);
    expect(flat.y + flat.height / 2).toBeCloseTo(knobAt(0).y);

    for (const rotation of [0, Math.PI / 12, Math.PI / 4, Math.PI / 2, -Math.PI / 3]) {
      const turned = selectedBeam(rotation);
      const knob = knobAt(rotation);
      expect(hitTestRotationHandle(knob, turned, viewport)).toBe(true);
      expect(hitTestRotationHandle({ x: 40, y: 40 }, turned, viewport)).toBe(false);
      // The middle of the top edge no longer carries the handle.
      expect(
        hitTestRotationHandle(
          {
            x: 40 - (destination.y * 20 - 28) * Math.sin(rotation),
            y: 40 + (destination.y * 20 - 28) * Math.cos(rotation),
          },
          turned,
          viewport,
        ),
      ).toBe(false);
    }
    // Turned a quarter, the knob has left the place it held when flat.
    expect(hitTestRotationHandle(knobAt(0), selectedBeam(Math.PI / 2), viewport)).toBe(false);
    expect(
      hitTestRotationHandle({ x: knobAt(0).x, y: knobAt(0).y - 21 }, selectedBeam(0), viewport),
    ).toBe(true);
  });

  it('place l’icône de taille au milieu du bord droit et la fait suivre la rotation', () => {
    const document = createDocument([
      ball('ball-1', { x: 1, y: 1 }),
      basket('basket-1', { x: 2, y: 1 }),
      beam('sized-beam', { x: 5, y: 4 }),
    ]);
    const selected = projectLevel(document).objects.find((object) => object.id === 'sized-beam');
    if (selected === undefined) throw new Error('La poutre sélectionnée est absente.');

    const horizontal = beamSizeHandleGeometry(selected, viewport);
    const rotationHandle = rotationHandleBounds(selected, viewport);
    expect(horizontal.stem.start).toEqual({ x: 80, y: 40 });
    expect(horizontal.stem.end).toEqual({ x: 110, y: 40 });
    expect(horizontal.bounds).toEqual({ x: 88, y: 18, width: 44, height: 44 });
    expect(horizontal.bounds.width).toBe(rotationHandle.width);
    expect(horizontal.bounds.height).toBe(rotationHandle.height);

    const vertical = beamSizeHandleGeometry({ ...selected, rotation: Math.PI / 2 }, viewport);
    expect(vertical.stem.start.x).toBeCloseTo(40);
    expect(vertical.stem.start.y).toBeCloseTo(80);
    expect(vertical.stem.end.x).toBeCloseTo(40);
    expect(vertical.stem.end.y).toBeCloseTo(110);
    expect(vertical.bounds.x).toBeCloseTo(18);
    expect(vertical.bounds.y).toBeCloseTo(88);
  });
});
