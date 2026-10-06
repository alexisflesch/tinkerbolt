import { describe, expect, it } from 'vitest';

import { isMachine, levelDocumentSchema, type LevelDocument } from '../../domain/level-document';
import {
  machineFromWorkshop,
  playSolution,
  puzzleFromWorkshop,
  verifyPuzzle,
  workshopFromPuzzle,
  type PuzzleRunOutcome,
} from './puzzle-workshop';

const locked = { move: false, rotate: false, remove: false } as const;

const workshop = (overrides: Partial<LevelDocument> = {}): LevelDocument => ({
  schemaVersion: 3,
  id: 'atelier-u22',
  metadata: { title: 'Atelier U22' },
  objects: [
    {
      id: 'ball-1',
      type: 'ball',
      props: {},
      transform: { position: { x: 2, y: 1 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'slope',
      type: 'beam',
      props: { size: 'medium' },
      transform: { position: { x: 2, y: 2 }, rotation: 0.2 },
      permissions: locked,
    },
    {
      id: 'basket-1',
      type: 'basket',
      props: {},
      transform: { position: { x: 7, y: 5 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'placement-1',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 5, y: 2.15 }, rotation: 0 },
      permissions: locked,
      toPlace: true,
    },
    {
      id: 'placement-2',
      type: 'mass',
      props: { weight: '10kg' },
      transform: { position: { x: 4, y: 4 }, rotation: 0 },
      permissions: locked,
      toPlace: true,
    },
    {
      id: 'placement-3',
      type: 'fan',
      props: { state: 'on' },
      transform: { position: { x: 1, y: 4 }, rotation: Math.PI / 2 },
      permissions: locked,
      toPlace: true,
    },
    {
      id: 'placement-4',
      type: 'mass',
      props: { weight: '10kg' },
      transform: { position: { x: 6, y: 4 }, rotation: 0 },
      permissions: locked,
      toPlace: true,
    },
  ],
  // The workshop's stock is the author's, never shown: the puzzle drops it.
  inventory: [
    {
      id: 'inventory-beam',
      type: 'beam',
      props: { size: 'medium' },
      quantity: 99,
      permissions: { move: true, rotate: true, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  wires: [],
  ...overrides,
});

const expectedPuzzle: LevelDocument = {
  schemaVersion: 3,
  id: 'atelier-u22',
  metadata: { title: 'Atelier U22' },
  objects: workshop().objects.slice(0, 3),
  inventory: [
    {
      id: 'beam-a-placer',
      type: 'beam',
      props: { size: 'short' },
      quantity: 1,
      permissions: { move: true, rotate: true, remove: true },
    },
    {
      id: 'mass-a-placer',
      type: 'mass',
      props: { weight: '10kg' },
      quantity: 2,
      permissions: { move: true, rotate: true, remove: true },
    },
    {
      id: 'fan-a-placer',
      type: 'fan',
      props: { state: 'on' },
      quantity: 1,
      permissions: { move: true, rotate: true, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [{ min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } }],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  wires: [],
  solution: {
    placements: [
      {
        inventoryId: 'beam-a-placer',
        transform: { position: { x: 5, y: 2.15 }, rotation: 0 },
      },
      { inventoryId: 'mass-a-placer', transform: { position: { x: 4, y: 4 }, rotation: 0 } },
      {
        inventoryId: 'fan-a-placer',
        transform: { position: { x: 1, y: 4 }, rotation: Math.PI / 2 },
      },
      { inventoryId: 'mass-a-placer', transform: { position: { x: 6, y: 4 }, rotation: 0 } },
    ],
  },
};

const lever = {
  id: 'lever-1',
  type: 'lever',
  props: { position: 'center' },
  transform: { position: { x: 3, y: 4 }, rotation: 0 },
  permissions: locked,
} as const;
const conveyor = {
  id: 'conveyor-1',
  type: 'conveyor',
  props: { direction: 'stopped' },
  transform: { position: { x: 5, y: 4 }, rotation: 0 },
  permissions: locked,
} as const;
const timer = {
  id: 'timer-1',
  type: 'timer',
  props: { delaySeconds: 3 },
  transform: { position: { x: 4, y: 5 }, rotation: 0 },
  permissions: locked,
} as const;
const button = {
  id: 'button-1',
  type: 'button',
  props: {},
  transform: { position: { x: 3, y: 5 }, rotation: 0 },
  permissions: locked,
} as const;
const fan = {
  id: 'fan-1',
  type: 'fan',
  props: { state: 'off' },
  transform: { position: { x: 5, y: 5 }, rotation: 0 },
  permissions: locked,
} as const;

describe('passage de l’atelier au puzzle (U22, ADR 0013)', () => {
  it('garde le décor fixe, met les objets à placer dans l’inventaire et leur pose dans la solution', () => {
    const result = puzzleFromWorkshop(workshop());

    expect(result).toEqual({ status: 'ok', puzzle: expectedPuzzle });
    expect(levelDocumentSchema.safeParse(expectedPuzzle).success).toBe(true);
  });

  it('n’ajoute ni ne conserve de seuils de défi dans le puzzle exporté (U24)', () => {
    const result = puzzleFromWorkshop(
      workshop({ challenge: { elegantObjectCount: 1, minimalObjectCount: 1 } }),
    );

    expect(result.status === 'ok' ? result.puzzle.challenge : undefined).toBeUndefined();
  });

  it('conserve l’auteur et les sources de l’atelier (M1, ADR 0016)', () => {
    const metadata = {
      title: 'Atelier U22 (remix)',
      author: 'Mira',
      basedOn: [{ title: 'Atelier U22', author: 'Zed' }],
    };

    const result = puzzleFromWorkshop(workshop({ metadata }));

    expect(result).toEqual({ status: 'ok', puzzle: { ...expectedPuzzle, metadata } });
  });

  it('conserve les zones de construction existantes et les fils du décor', () => {
    const zone = { min: { x: 0, y: 1 }, max: { x: 8, y: 5 } };
    const wire = { id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1' };
    const document = workshop({
      objects: [...workshop().objects, lever, conveyor],
      buildZones: [zone],
      wires: [wire],
    });

    const result = puzzleFromWorkshop(document);

    expect(result.status === 'ok' && result.puzzle.buildZones).toEqual([zone]);
    expect(result.status === 'ok' && result.puzzle.wires).toEqual([wire]);
    expect(result.status === 'ok' && result.puzzle.objects.map(({ id }) => id)).toEqual([
      'ball-1',
      'slope',
      'basket-1',
      'lever-1',
      'conveyor-1',
    ]);
  });

  it('refuse un atelier sans objet à placer', () => {
    const document = workshop({ objects: workshop().objects.slice(0, 3) });

    expect(puzzleFromWorkshop(document)).toEqual({
      status: 'refused',
      reason: 'no-object-to-place',
    });
  });

  it('exporte dans la solution un fil dont une extrémité est à placer (U25)', () => {
    const document = workshop({
      objects: [...workshop().objects, { ...lever, toPlace: true }, conveyor],
      wires: [{ id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1' }],
    });

    const result = puzzleFromWorkshop(document);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.puzzle.wires).toEqual([]);
    expect(result.puzzle.inventory).toContainEqual({
      id: 'wire-a-placer',
      type: 'wire',
      props: {},
      quantity: 1,
      permissions: { move: false, rotate: false, remove: true },
    });
    expect(result.puzzle.solution?.placements).toContainEqual({
      inventoryId: 'lever-a-placer',
      placementId: 'lever-1',
      transform: lever.transform,
    });
    expect(result.puzzle.solution?.wires).toEqual([
      {
        id: 'wire-1',
        inventoryId: 'wire-a-placer',
        sourceId: 'lever-1',
        targetId: 'conveyor-1',
      },
    ]);
    expect(levelDocumentSchema.safeParse(result.puzzle).success).toBe(true);
  });

  it('exporte dans la solution un fil fixe marqué « à placer » (U25)', () => {
    const document = workshop({
      objects: [...workshop().objects, lever, conveyor],
      wires: [{ id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1', toPlace: true }],
    });

    const result = puzzleFromWorkshop(document);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.puzzle.wires).toEqual([]);
    expect(result.puzzle.solution?.wires).toEqual([
      {
        id: 'wire-1',
        inventoryId: 'wire-a-placer',
        sourceId: 'lever-1',
        targetId: 'conveyor-1',
      },
    ]);
  });

  it('exporte, rejoue et rouvre un fil dont le minuteur est à placer', () => {
    const source = workshop({
      objects: [...workshop().objects, button, { ...timer, toPlace: true }, fan],
      wires: [{ id: 'wire-timer', sourceId: 'button-1', timerId: 'timer-1', targetId: 'fan-1' }],
    });

    const result = puzzleFromWorkshop(source);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.puzzle.solution?.placements).toContainEqual({
      inventoryId: 'timer-a-placer',
      placementId: 'timer-1',
      transform: timer.transform,
    });
    expect(result.puzzle.solution?.wires).toContainEqual({
      id: 'wire-timer',
      inventoryId: 'wire-a-placer',
      sourceId: 'button-1',
      timerId: 'timer-1',
      targetId: 'fan-1',
    });

    const replayed =
      result.puzzle.solution === undefined
        ? null
        : playSolution(result.puzzle, result.puzzle.solution);
    expect(replayed).not.toBeNull();
    if (replayed === null) return;
    const placedTimer = replayed.document.objects.find(({ type }) => type === 'timer');
    expect(placedTimer).toBeDefined();
    expect(replayed.document.wires[0]?.timerId).toBe(placedTimer?.id);

    const reopened = workshopFromPuzzle(result.puzzle);
    const reopenedTimer = reopened.objects.find(({ type }) => type === 'timer');
    expect(reopened.wires[0]?.timerId).toBe(reopenedTimer?.id);
  });

  it('rouvre les fils de la solution comme fils à placer dans l’atelier (U25)', () => {
    const source = workshop({
      objects: [...workshop().objects, { ...lever, toPlace: true }, conveyor],
      wires: [{ id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1' }],
    });
    const exported = puzzleFromWorkshop(source);
    if (exported.status !== 'ok') throw new Error('export refusé');

    const reopened = workshopFromPuzzle(exported.puzzle);

    expect(reopened.solution).toBeUndefined();
    expect(reopened.wires[0]).toMatchObject({
      id: 'wire-1',
      targetId: 'conveyor-1',
      toPlace: true,
    });
    expect(reopened.wires[0]?.sourceId).toMatch(/^lever-a-placer/);
    expect(reopened.objects.find(({ id }) => id === reopened.wires[0]?.sourceId)?.toPlace).toBe(
      true,
    );
  });

  it('rouvre un puzzle dans l’atelier, objets à placer remis en place, puis le reproduit', () => {
    const reopened = workshopFromPuzzle(expectedPuzzle);

    expect(levelDocumentSchema.safeParse(reopened).success).toBe(true);
    expect(reopened.solution).toBeUndefined();
    expect(reopened.inventory).toEqual(expectedPuzzle.inventory);
    expect(reopened.objects.filter(({ toPlace }) => toPlace === true)).toEqual(
      workshop()
        .objects.slice(3)
        .map((object) => ({ ...object, id: expect.any(String) as string })),
    );
    expect(puzzleFromWorkshop(reopened)).toEqual({ status: 'ok', puzzle: expectedPuzzle });
  });

  it('laisse intact un document sans solution', () => {
    const document = workshop();

    expect(workshopFromPuzzle(document)).toBe(document);
  });
});

describe('vérification d’un puzzle avant export (U22)', () => {
  const winsWithFan = (document: LevelDocument): PuzzleRunOutcome =>
    document.objects.some(({ type }) => type === 'fan') ? 'won' : 'lost';

  it('accepte un puzzle que la solution fait gagner et qui perd sans le joueur', () => {
    const runs: LevelDocument[] = [];

    const result = verifyPuzzle(workshop(), (document) => {
      runs.push(document);
      return winsWithFan(document);
    });

    expect(result).toEqual({ status: 'verified', puzzle: expectedPuzzle });
    expect(runs.map(({ objects }) => objects.length)).toEqual([7, 3]);
  });

  it('rejoue les fils à placer avant de simuler la solution (U25)', () => {
    const document = workshop({
      objects: [...workshop().objects, { ...lever, toPlace: true }, conveyor],
      wires: [{ id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1' }],
    });

    const result = verifyPuzzle(document, (candidate) =>
      candidate.objects.some(({ type }) => type === 'lever') && candidate.wires.length === 1
        ? 'won'
        : 'lost',
    );

    expect(result.status).toBe('verified');
  });

  it('refuse la machine complète qui ne gagne pas', () => {
    expect(verifyPuzzle(workshop(), () => 'lost')).toEqual({
      status: 'refused',
      reason: 'solution-does-not-win',
    });
  });

  it('refuse un puzzle qui gagne sans les objets à placer', () => {
    expect(verifyPuzzle(workshop(), () => 'won')).toEqual({
      status: 'refused',
      reason: 'wins-without-player',
    });
  });

  it('refuse une solution que le joueur ne peut pas poser', () => {
    const document = workshop({ buildZones: [{ min: { x: 0, y: 3 }, max: { x: 8, y: 5.5 } }] });

    expect(verifyPuzzle(document, winsWithFan)).toEqual({
      status: 'refused',
      reason: 'solution-not-playable',
    });
  });

  it('refuse sans simuler un atelier sans objet à placer', () => {
    const document = workshop({ objects: workshop().objects.slice(0, 3) });

    expect(
      verifyPuzzle(document, () => {
        throw new Error('La simulation ne doit pas être lancée.');
      }),
    ).toEqual({ status: 'refused', reason: 'no-object-to-place' });
  });
});

describe('atelier sans objectif complet (ADR 0020)', () => {
  const withoutBasket = (): LevelDocument => {
    const { goal: ignoredGoal, ...rest } = workshop({
      objects: workshop().objects.filter(({ id }) => id !== 'basket-1'),
    });
    void ignoredGoal;
    return { ...rest, goal: { type: 'basket', ballId: 'ball-1' } };
  };

  it('refuse le défi avec une raison dédiée, sans simuler', () => {
    expect(puzzleFromWorkshop(withoutBasket())).toEqual({
      status: 'refused',
      reason: 'no-complete-goal',
    });
    expect(
      verifyPuzzle(withoutBasket(), () => {
        throw new Error('La simulation ne doit pas être lancée.');
      }),
    ).toEqual({ status: 'refused', reason: 'no-complete-goal' });
  });

  it('dit d’abord qu’il manque l’objectif, avant les objets à placer', () => {
    const { goal: ignoredGoal, ...bare } = workshop({
      objects: workshop().objects.slice(0, 3),
    });
    void ignoredGoal;

    expect(puzzleFromWorkshop(bare)).toEqual({ status: 'refused', reason: 'no-complete-goal' });
  });
});

describe('machine à partir de l’atelier (ADR 0020)', () => {
  const machine = machineFromWorkshop(workshop());

  it('retire solution, défi, inventaire et zones, et les marques « à placer »', () => {
    expect(machine.inventory).toEqual([]);
    expect(machine.buildZones).toEqual([]);
    expect(machine.solution).toBeUndefined();
    expect(machine.challenge).toBeUndefined();
    expect(machine.objects.some(({ toPlace }) => toPlace === true)).toBe(false);
    expect(isMachine(machine)).toBe(true);
    expect(levelDocumentSchema.safeParse(machine).success).toBe(true);
  });

  it('laisse en place les objets à placer, avec leurs permissions d’auteur', () => {
    expect(machine.objects).toEqual(
      workshop().objects.map(({ toPlace, ...object }) => {
        void toPlace;
        return object;
      }),
    );
  });

  it('garde l’objectif tel quel : la balle rouge reste rouge', () => {
    expect(machine.goal).toEqual({ type: 'basket', ballId: 'ball-1', basketId: 'basket-1' });
  });

  it('retire la marque « à placer » des fils et garde les fils', () => {
    const wired = machineFromWorkshop(
      workshop({
        objects: [...workshop().objects, { ...lever, toPlace: true }, conveyor],
        wires: [{ id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1', toPlace: true }],
      }),
    );

    expect(wired.wires).toEqual([{ id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1' }]);
    expect(isMachine(wired)).toBe(true);
  });

  it('réussit sans objectif ni objet à placer, et garde le titre et l’attribution', () => {
    const { goal: ignoredGoal, ...bare } = workshop({
      metadata: { title: 'Ma machine', author: 'Lili' },
      objects: workshop().objects.slice(0, 3),
    });
    void ignoredGoal;
    const result = machineFromWorkshop(bare);

    expect(result.goal).toBeUndefined();
    expect(result.metadata).toEqual({ title: 'Ma machine', author: 'Lili' });
  });

  it('réussit pour un atelier qui porte une solution ou un défi (campagne)', () => {
    const puzzle = puzzleFromWorkshop(workshop());
    if (puzzle.status !== 'ok') throw new Error('puzzle attendu');

    const result = machineFromWorkshop({
      ...puzzle.puzzle,
      challenge: { elegantObjectCount: 4, minimalObjectCount: 3 },
    });

    expect(result.solution).toBeUndefined();
    expect(result.challenge).toBeUndefined();
    expect(result.inventory).toEqual([]);
  });

  it('ne modifie pas l’atelier', () => {
    const document = workshop();
    const before = structuredClone(document);
    machineFromWorkshop(document);

    expect(document).toEqual(before);
  });
});
