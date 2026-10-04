import { describe, expect, it } from 'vitest';

import {
  levelDocumentSchema,
  solutionSchema,
  type LevelDocument,
} from '../../domain/level-document';
import {
  connectControlWire,
  createConstructionAttempt,
  movePlacement,
  placeFromInventory,
  removePlacement,
  type ConstructionAttempt,
} from '../construction';
import { solutionFromAttempt } from './player-solution';
import { playSolution } from './puzzle-workshop';

const locked = { move: false, rotate: false, remove: false } as const;

/** A received level: decor with a movable beam, a lever and two devices to command. */
const origin: LevelDocument = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'recu-m5',
  metadata: { title: 'Niveau reçu M5' },
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
      id: 'decor-beam',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 5, y: 1 }, rotation: 0 },
      permissions: { move: true, rotate: false, remove: false },
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
  wires: [],
});

/** Runs player commands in order and fails the test on the first refusal. */
const run = (
  start: ConstructionAttempt,
  commands: readonly ReturnType<typeof placeFromInventory>[],
): ConstructionAttempt =>
  commands.reduce((attempt, command) => {
    const outcome = command.execute(attempt);
    if (outcome.status === 'rejected') throw new Error(`commande refusée : ${outcome.reason}`);
    return outcome.state;
  }, start);

const placeBeam = placeFromInventory({
  context: 'player',
  inventoryEntryId: 'beams',
  placementId: 'joueur-poutre',
  transform: { position: { x: 3, y: 3 }, rotation: 0.4 },
});
const placeButton = placeFromInventory({
  context: 'player',
  inventoryEntryId: 'buttons',
  placementId: 'joueur-bouton',
  transform: { position: { x: 7, y: 2 }, rotation: 0 },
});
const wireButtonToFan = connectControlWire({
  context: 'player',
  wireId: 'fil-bouton',
  inventoryEntryId: 'wires',
  sourceId: 'joueur-bouton',
  targetId: 'decor-fan',
});
const wireLeverToBarrier = connectControlWire({
  context: 'player',
  wireId: 'fil-levier',
  inventoryEntryId: 'wires',
  sourceId: 'decor-lever',
  targetId: 'decor-barrier',
});
const moveDecorBeam = movePlacement({
  context: 'player',
  placementId: 'decor-beam',
  position: { x: 5, y: 2 },
});

/**
 * Two attempts are the same up to the ids the player chose for the objects
 * they placed: those are matched by their order on the board.
 */
const withPlayerIdsRenamed = (attempt: ConstructionAttempt): ConstructionAttempt => {
  const playerObjectIds = attempt.document.objects
    .map(({ id }) => id)
    .filter((id) => attempt.provenance[id] !== undefined);
  const renamed = new Map(playerObjectIds.map((id, index) => [id, `pose-${String(index + 1)}`]));
  const rename = (id: string): string => renamed.get(id) ?? id;
  return {
    document: {
      ...attempt.document,
      objects: attempt.document.objects.map((placement) => ({
        ...placement,
        id: rename(placement.id),
      })),
      wires: attempt.document.wires.map((wire) => ({
        ...wire,
        sourceId: rename(wire.sourceId),
        targetId: rename(wire.targetId),
      })),
    },
    provenance: Object.fromEntries(
      Object.entries(attempt.provenance).map(([takenId, entryId]) => [rename(takenId), entryId]),
    ),
  };
};

describe('solution d’une tentative gagnante (M5, ADR 0015)', () => {
  it('ne reprend pas un objet du décor que le joueur a déplacé', () => {
    const attempt = run(createConstructionAttempt(origin), [placeBeam, moveDecorBeam]);

    expect(solutionFromAttempt(attempt)).toEqual({
      placements: [
        { inventoryId: 'beams', transform: { position: { x: 3, y: 3 }, rotation: 0.4 } },
      ],
    });
  });

  it('reprend les fils du joueur avec leurs extrémités, et la référence de la pose reliée', () => {
    const attempt = run(createConstructionAttempt(origin), [
      placeBeam,
      placeButton,
      wireButtonToFan,
      wireLeverToBarrier,
    ]);

    expect(solutionFromAttempt(attempt)).toEqual({
      placements: [
        { inventoryId: 'beams', transform: { position: { x: 3, y: 3 }, rotation: 0.4 } },
        {
          inventoryId: 'buttons',
          placementId: 'joueur-bouton',
          transform: { position: { x: 7, y: 2 }, rotation: 0 },
        },
      ],
      wires: [
        {
          id: 'fil-bouton',
          inventoryId: 'wires',
          sourceId: 'joueur-bouton',
          targetId: 'decor-fan',
        },
        {
          id: 'fil-levier',
          inventoryId: 'wires',
          sourceId: 'decor-lever',
          targetId: 'decor-barrier',
        },
      ],
    });
  });

  it('produit une solution valide pour le schéma et cohérente avec le niveau joué', () => {
    const attempt = run(createConstructionAttempt(origin), [
      placeBeam,
      placeButton,
      wireButtonToFan,
      wireLeverToBarrier,
    ]);
    const solution = solutionFromAttempt(attempt);

    expect(solutionSchema.safeParse(solution).success).toBe(true);
    expect(levelDocumentSchema.safeParse({ ...origin, solution }).success).toBe(true);
  });

  it('ne reprend pas un objet que le joueur a posé puis retiré', () => {
    const attempt = run(createConstructionAttempt(origin), [
      placeButton,
      removePlacement({ context: 'player', placementId: 'joueur-bouton' }),
    ]);

    expect(solutionFromAttempt(attempt)).toEqual({ placements: [] });
  });

  it('rejouée sur le niveau d’origine par les commandes du joueur, redonne la même tentative', () => {
    const attempt = run(createConstructionAttempt(origin), [
      placeBeam,
      placeButton,
      wireButtonToFan,
      wireLeverToBarrier,
    ]);

    const replayed = playSolution(origin, solutionFromAttempt(attempt));

    expect(replayed).not.toBeNull();
    expect(replayed === null ? null : withPlayerIdsRenamed(replayed)).toEqual(
      withPlayerIdsRenamed(attempt),
    );
  });
});
