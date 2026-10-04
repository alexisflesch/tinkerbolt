import { describe, expect, it } from 'vitest';

import {
  levelDocumentSchema,
  type LevelDocument,
  type Solution,
} from '../../domain/level-document';
import { workshopFromPuzzle } from '../puzzle/puzzle-workshop';

import { creationFromLevel } from './creation-from-level';

const locked = { move: false, rotate: false, remove: false } as const;

/** A puzzle (received or from the campaign): decor, inventory, reference solution. */
const level: LevelDocument = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'recu-0123456789abcdef',
  metadata: {
    title: 'Le grand saut',
    description: 'Fais entrer la balle rouge.',
    author: 'Lili',
    basedOn: [{ title: 'Le petit saut', author: 'Max' }],
  },
  objects: [
    {
      id: 'ball',
      type: 'ball',
      props: {},
      transform: { position: { x: 1, y: 1 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'basket',
      type: 'basket',
      props: {},
      transform: { position: { x: 9, y: 6 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'decor-lever',
      type: 'lever',
      props: { position: 'left' },
      transform: { position: { x: 2, y: 6 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'decor-fan',
      type: 'fan',
      props: { state: 'off' },
      transform: { position: { x: 4, y: 6 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'decor-barrier',
      type: 'barrier',
      props: { state: 'closed' },
      transform: { position: { x: 6, y: 6 }, rotation: 0 },
      permissions: locked,
    },
  ],
  inventory: [
    {
      id: 'beams',
      type: 'beam',
      props: { size: 'medium' },
      quantity: 2,
      permissions: { move: true, rotate: true, remove: true },
    },
    {
      id: 'buttons',
      type: 'button',
      props: {},
      quantity: 1,
      permissions: { move: true, rotate: false, remove: true },
    },
    {
      id: 'wires',
      type: 'wire',
      props: {},
      quantity: 2,
      permissions: { move: false, rotate: false, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
  buildZones: [{ min: { x: 0, y: 0 }, max: { x: 10, y: 7 } }],
  scene: { min: { x: 0, y: 0 }, max: { x: 10, y: 7 } },
  wires: [{ id: 'decor-wire', sourceId: 'decor-lever', targetId: 'decor-barrier' }],
  challenge: { elegantObjectCount: 2, minimalObjectCount: 1 },
  solution: {
    placements: [
      {
        inventoryId: 'beams',
        transform: { position: { x: 8.25, y: 3.75 }, rotation: 0.3 },
      },
    ],
  },
});

/** A winning attempt of the player, in the `solution` shape (M5). */
const playerSolution: Solution = {
  placements: [
    { inventoryId: 'beams', transform: { position: { x: 3, y: 3 }, rotation: 0.4 } },
    {
      inventoryId: 'buttons',
      placementId: 'joueur-bouton',
      transform: { position: { x: 7, y: 2 }, rotation: 0 },
    },
  ],
  wires: [
    { id: 'fil-bouton', inventoryId: 'wires', sourceId: 'joueur-bouton', targetId: 'decor-fan' },
  ],
};

const createId = (): string => 'creation-m6';

describe('créer une création depuis un niveau (M6, ADR 0015, ADR 0016)', () => {
  it('sans solution du joueur, reprend le décor sans rien à placer ni trace de la solution', () => {
    const pristine = structuredClone(level);

    const { document } = creationFromLevel(level, { createId });

    expect(document.id).toBe('creation-m6');
    expect(document.objects).toEqual(level.objects);
    expect(document.wires).toEqual(level.wires);
    expect(document.objects.some(({ toPlace }) => toPlace === true)).toBe(false);
    expect(document.solution).toBeUndefined();
    expect(document.inventory).toEqual([]);
    expect(document.challenge).toBeUndefined();
    expect(JSON.stringify(document)).not.toContain('8.25');
    expect(document.goal).toEqual(level.goal);
    expect(document.scene).toEqual(level.scene);
    expect(document.buildZones).toEqual(level.buildZones);
    expect(level).toEqual(pristine);
  });

  it('garde le niveau d’origine intact comme source, hors du document', () => {
    const creation = creationFromLevel(level, { playerSolution, createId });

    expect(creation.source).toEqual(level);
    expect(creation.source).not.toBe(level);
    expect(Object.keys(creation)).toEqual(['document', 'source']);
  });

  it('pose chaque objet de la solution du joueur « à placer » et remappe ses fils', () => {
    const { document } = creationFromLevel(level, { playerSolution, createId });

    const toPlace = document.objects.filter(({ toPlace }) => toPlace === true);
    expect(toPlace).toEqual([
      {
        id: 'beams-2',
        type: 'beam',
        props: { size: 'medium' },
        transform: { position: { x: 3, y: 3 }, rotation: 0.4 },
        permissions: locked,
        toPlace: true,
      },
      {
        id: 'buttons-2',
        type: 'button',
        props: {},
        transform: { position: { x: 7, y: 2 }, rotation: 0 },
        permissions: locked,
        toPlace: true,
      },
    ]);
    expect(document.objects.slice(0, level.objects.length)).toEqual(level.objects);
    expect(document.wires).toEqual([
      ...level.wires,
      { id: 'fil-bouton', sourceId: 'buttons-2', targetId: 'decor-fan', toPlace: true },
    ]);
    expect(document.inventory).toEqual([]);
    expect(document.solution).toBeUndefined();
  });

  it('place les poses comme `workshopFromPuzzle` le fait pour la solution de l’auteur', () => {
    const asWorkshop = workshopFromPuzzle({ ...level, solution: playerSolution });

    const { document } = creationFromLevel(level, { playerSolution, createId });

    expect(document.objects).toEqual(asWorkshop.objects);
    expect(document.wires).toEqual(asWorkshop.wires);
  });

  it('produit un document valide, sans inventaire, avec ou sans solution du joueur', () => {
    for (const options of [{ createId }, { playerSolution, createId }]) {
      const { document } = creationFromLevel(level, options);

      expect(levelDocumentSchema.safeParse(document).success).toBe(true);
    }
  });

  it('intitule la création « (remix) », retire l’auteur et prolonge les sources', () => {
    const { document } = creationFromLevel(level, { createId });

    expect(document.metadata).toEqual({
      title: 'Le grand saut (remix)',
      description: 'Fais entrer la balle rouge.',
      basedOn: [
        { title: 'Le grand saut', author: 'Lili' },
        { title: 'Le petit saut', author: 'Max' },
      ],
    });
  });

  it('garde la description du niveau d’origine, ou n’en invente pas (M14b)', () => {
    expect(creationFromLevel(level, { createId }).document.metadata.description).toBe(
      'Fais entrer la balle rouge.',
    );

    const bare: LevelDocument = { ...level, metadata: { title: 'Sans description' } };
    const { document } = creationFromLevel(bare, { createId });

    expect('description' in document.metadata).toBe(false);
  });

  it('cite une source sans auteur sans lui en inventer un', () => {
    const anonymous: LevelDocument = { ...level, metadata: { title: 'Anonyme' } };

    const { document } = creationFromLevel(anonymous, { createId });

    expect(document.metadata).toEqual({
      title: 'Anonyme (remix)',
      basedOn: [{ title: 'Anonyme' }],
    });
  });

  it('tronque les sources à seize, les plus anciennes tombant', () => {
    const sources = Array.from({ length: 16 }, (_, index) => ({
      title: `Source ${String(index + 1)}`,
    }));
    const deep: LevelDocument = {
      ...level,
      metadata: { title: 'Profond', author: 'Lili', basedOn: sources },
    };

    const { document } = creationFromLevel(deep, { createId });

    expect(document.metadata.basedOn).toEqual([
      { title: 'Profond', author: 'Lili' },
      ...sources.slice(0, 15),
    ]);
    expect(levelDocumentSchema.safeParse(document).success).toBe(true);
  });

  it('tronque le titre d’origine pour garder « (remix) » entier (M6b)', () => {
    const longTitle = 'a'.repeat(160);
    const long: LevelDocument = { ...level, metadata: { title: longTitle } };

    const { document } = creationFromLevel(long, { createId });

    expect(document.metadata.title).toBe(`${'a'.repeat(152)} (remix)`);
    expect(document.metadata.title.endsWith(' (remix)')).toBe(true);
    expect(document.metadata.title.length).toBeLessThanOrEqual(160);
    expect(document.metadata.basedOn?.[0]).toEqual({ title: longTitle });
    expect(levelDocumentSchema.safeParse(document).success).toBe(true);
  });
});
