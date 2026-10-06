import { describe, expect, it } from 'vitest';

import {
  hasCompleteGoal,
  isMachine,
  levelDocumentAttemptSchema,
  levelDocumentSchema,
  levelDocumentV1Schema,
  levelDocumentV2Schema,
  type LevelDocument,
} from './level-document';

const locked = { move: false, rotate: false, remove: false } as const;

const ball = {
  id: 'ball-1',
  type: 'ball',
  transform: { position: { x: 0, y: 6 }, rotation: 0 },
  props: {},
  permissions: locked,
};
const basket = {
  id: 'basket-1',
  type: 'basket',
  transform: { position: { x: 0, y: 0 }, rotation: 0 },
  props: {},
  permissions: locked,
};
const beam = {
  id: 'beam-1',
  type: 'beam',
  transform: { position: { x: -4, y: 4 }, rotation: 0 },
  props: { size: 'short' },
  permissions: { move: true, rotate: true, remove: true },
};

const base = {
  schemaVersion: 3,
  id: 'machine',
  metadata: { title: 'Machine' },
  objects: [ball, basket, beam],
  inventory: [],
  buildZones: [],
  scene: { min: { x: -12, y: -4 }, max: { x: 12, y: 17 } },
  wires: [],
};

const withGoal = (goal: unknown): unknown => ({ ...base, goal });
const goalIssues = (candidate: unknown): readonly string[] => {
  const parsed = levelDocumentSchema.safeParse(candidate);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
};
const parse = (candidate: unknown): LevelDocument => levelDocumentSchema.parse(candidate);

describe('objectif facultatif (ADR 0020)', () => {
  it('accepte un document v3 sans objectif, et le relit tel quel', () => {
    const document = parse(base);

    expect(document).toEqual(base);
    expect('goal' in document).toBe(false);
  });

  it('accepte un objectif partiel : une balle sans panier, un panier sans balle', () => {
    expect(
      levelDocumentSchema.safeParse(withGoal({ type: 'basket', ballId: 'ball-1' })).success,
    ).toBe(true);
    expect(
      levelDocumentSchema.safeParse(withGoal({ type: 'basket', basketId: 'basket-1' })).success,
    ).toBe(true);
  });

  it('accepte un objectif complet', () => {
    expect(
      levelDocumentSchema.safeParse(
        withGoal({ type: 'basket', ballId: 'ball-1', basketId: 'basket-1' }),
      ).success,
    ).toBe(true);
  });

  it('refuse un objectif sans aucun identifiant', () => {
    expect(levelDocumentSchema.safeParse(withGoal({ type: 'basket' })).success).toBe(false);
  });

  it('vérifie la famille de chaque identifiant présent', () => {
    expect(goalIssues(withGoal({ type: 'basket', ballId: 'basket-1' }))).toContain(
      'L’objectif doit référencer une balle déjà placée.',
    );
    expect(goalIssues(withGoal({ type: 'basket', basketId: 'ball-1' }))).toContain(
      'L’objectif doit référencer un panier déjà placé.',
    );
    expect(goalIssues(withGoal({ type: 'basket', ballId: 'absent' }))).toHaveLength(1);
  });

  it('exige un objectif complet dès qu’il y a un inventaire, une solution ou un défi', () => {
    const inventory = [
      {
        id: 'beam-stock',
        type: 'beam',
        props: { size: 'short' },
        quantity: 1,
        permissions: { move: true, rotate: true, remove: true },
      },
    ];
    const partial = { type: 'basket', ballId: 'ball-1' };

    expect(goalIssues({ ...base, inventory })).toContain(
      'Un niveau avec un inventaire, une solution ou un défi exige un objectif complet.',
    );
    expect(levelDocumentSchema.safeParse({ ...base, inventory, goal: partial }).success).toBe(
      false,
    );
    expect(
      levelDocumentSchema.safeParse({
        ...base,
        challenge: { elegantObjectCount: 2, minimalObjectCount: 1 },
      }).success,
    ).toBe(false);
    expect(
      levelDocumentSchema.safeParse({
        ...base,
        inventory,
        goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
      }).success,
    ).toBe(true);
  });

  it('accepte un objet « à placer » sans objectif complet (atelier en cours)', () => {
    expect(
      levelDocumentSchema.safeParse({
        ...base,
        objects: [ball, basket, { ...beam, toPlace: true }],
      }).success,
    ).toBe(true);
  });

  it('garde l’objectif toujours fixe, partiel ou non', () => {
    expect(
      levelDocumentSchema.safeParse({
        ...(withGoal({ type: 'basket', ballId: 'ball-1' }) as object),
        objects: [{ ...ball, toPlace: true }, basket],
      }).success,
    ).toBe(false);
  });

  it('s’applique aussi au schéma de tentative', () => {
    expect(levelDocumentAttemptSchema.safeParse(base).success).toBe(true);
  });

  it('laisse l’objectif complet obligatoire en versions 1 et 2', () => {
    const { schemaVersion: ignoredVersion, wires: ignoredWires, ...v1Fields } = base;
    void ignoredVersion;
    void ignoredWires;
    expect(levelDocumentV2Schema.safeParse({ ...base, schemaVersion: 2 }).success).toBe(false);
    expect(
      levelDocumentV2Schema.safeParse({
        ...base,
        schemaVersion: 2,
        goal: { type: 'basket', ballId: 'ball-1' },
      }).success,
    ).toBe(false);
    expect(
      levelDocumentV1Schema.safeParse({
        ...v1Fields,
        schemaVersion: 1,
        scene: undefined,
        objects: [ball, basket],
      }).success,
    ).toBe(false);
  });

  it('laisse les documents existants valides et inchangés', () => {
    const full = {
      ...base,
      goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
    };

    expect(parse(full)).toEqual(full);
  });
});

describe('hasCompleteGoal et isMachine (ADR 0020)', () => {
  const complete = { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' } as const;

  it('hasCompleteGoal ne dit vrai que si la balle et le panier sont désignés', () => {
    expect(hasCompleteGoal(parse(base))).toBe(false);
    expect(hasCompleteGoal(parse(withGoal({ type: 'basket', ballId: 'ball-1' })))).toBe(false);
    expect(hasCompleteGoal(parse(withGoal({ type: 'basket', basketId: 'basket-1' })))).toBe(false);
    expect(hasCompleteGoal(parse(withGoal(complete)))).toBe(true);
  });

  it('isMachine : rien à poser, avec ou sans objectif', () => {
    expect(isMachine(parse(base))).toBe(true);
    expect(isMachine(parse(withGoal(complete)))).toBe(true);
  });

  it('isMachine refuse un inventaire, une solution ou une marque « à placer »', () => {
    const stock = {
      id: 'beam-stock',
      type: 'beam',
      props: { size: 'short' },
      quantity: 1,
      permissions: { move: true, rotate: true, remove: true },
    };
    expect(isMachine(parse({ ...(withGoal(complete) as object), inventory: [stock] }))).toBe(false);
    expect(isMachine(parse({ ...base, objects: [ball, basket, { ...beam, toPlace: true }] }))).toBe(
      false,
    );
    expect(
      isMachine(
        parse({
          ...(withGoal(complete) as object),
          inventory: [stock],
          solution: {
            placements: [{ inventoryId: 'beam-stock', transform: beam.transform }],
          },
          objects: [ball, basket],
        }),
      ),
    ).toBe(false);
  });

  it('isMachine refuse un fil « à placer »', () => {
    const lever = {
      id: 'lever-1',
      type: 'lever',
      transform: { position: { x: -6, y: 8 }, rotation: 0 },
      props: { position: 'center' },
      permissions: locked,
    };
    const conveyor = {
      id: 'conveyor-1',
      type: 'conveyor',
      transform: { position: { x: 6, y: 8 }, rotation: 0 },
      props: { direction: 'stopped' },
      permissions: locked,
    };
    const wire = { id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1' };
    const objects = [ball, basket, lever, conveyor];

    expect(isMachine(parse({ ...base, objects, wires: [wire] }))).toBe(true);
    expect(isMachine(parse({ ...base, objects, wires: [{ ...wire, toPlace: true }] }))).toBe(false);
  });
});
