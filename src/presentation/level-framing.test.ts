import { describe, expect, it } from 'vitest';

import { embeddedLevels, embeddedWorkshopDocument } from '../content/embedded-levels';
import { placementFootprintCorners } from '../domain/placement-footprint';
import { levelDocumentSchema } from '../domain/level-document';
import { frameLevel, LEVEL_FRAMING_MIN_SIZE } from './level-framing';

const level = (id: string) => {
  const found = embeddedLevels.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Niveau absent : ${id}`);
  return found;
};

const lockedPermissions = { move: false, rotate: false, remove: false } as const;

const smallLevel = (objects: readonly { id: string; type: string; x: number; y: number }[]) =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'cadrage',
    metadata: { title: 'Cadrage' },
    objects: objects.map(({ id, type, x, y }) => ({
      id,
      type,
      transform: { position: { x, y }, rotation: 0 },
      props: {},
      permissions: lockedPermissions,
    })),
    inventory: [],
    goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 16, y: 9 } },
    wires: [],
  });

describe('cadrage utile d’un niveau', () => {
  it('cadre tuto-6 sur sa machine et sa solution, pas sur toute la scène 16 × 9', () => {
    const document = level('tuto-6');
    const framing = frameLevel(document);

    expect(framing.max.x - framing.min.x).toBeLessThan(12);
    expect(framing.max.x - framing.min.x).toBeGreaterThanOrEqual(LEVEL_FRAMING_MIN_SIZE.width);
    expect(framing.max.y - framing.min.y).toBeGreaterThanOrEqual(LEVEL_FRAMING_MIN_SIZE.height);
    expect(framing.min.x).toBeGreaterThanOrEqual(document.scene.min.x);
    expect(framing.min.y).toBeGreaterThanOrEqual(document.scene.min.y);
    expect(framing.max.x).toBeLessThanOrEqual(document.scene.max.x);
    expect(framing.max.y).toBeLessThanOrEqual(document.scene.max.y);

    const corners = document.objects.flatMap((object) => placementFootprintCorners(object));
    const solution = document.solution?.placements.map(({ transform }) => transform.position);
    for (const { x, y } of [...corners, ...(solution ?? [])]) {
      expect(x).toBeGreaterThanOrEqual(framing.min.x);
      expect(x).toBeLessThanOrEqual(framing.max.x);
      expect(y).toBeGreaterThanOrEqual(framing.min.y);
      expect(y).toBeLessThanOrEqual(framing.max.y);
    }
  });

  it('ne descend pas sous 8 × 5,5 unités et reste dans la scène', () => {
    const framing = frameLevel(
      smallLevel([
        { id: 'ball', type: 'ball', x: 1, y: 1 },
        { id: 'basket', type: 'basket', x: 2, y: 1.5 },
      ]),
    );

    expect(framing).toEqual({ min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } });
  });

  it('rend la scène entière quand la machine l’occupe', () => {
    const document = smallLevel([
      { id: 'ball', type: 'ball', x: 0.5, y: 0.5 },
      { id: 'basket', type: 'basket', x: 15, y: 8.3 },
    ]);

    expect(frameLevel(document)).toEqual(document.scene);
  });

  it('cadre l’atelier sur son contenu de départ sans sortir de la scène', () => {
    const framing = frameLevel(embeddedWorkshopDocument);

    expect(framing.min.x).toBeGreaterThanOrEqual(0);
    expect(framing.max.x).toBeLessThanOrEqual(16);
  });
});
