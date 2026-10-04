import { describe, expect, it } from 'vitest';

import { createConstructionAttempt, placeFromInventory } from '../application/construction';
import { solutionFromAttempt } from '../application/puzzle/player-solution';
import { playSolution } from '../application/puzzle/puzzle-workshop';
import { levelDocumentSchema } from '../domain/level-document';
import { runLevelOutcome } from '../simulation/level-outcome';

const locked = { move: false, rotate: false, remove: false } as const;

/**
 * A local level, not a campaign one (their calibration is the author's): the
 * ball falls beside the basket unless a tilted beam sends it there.
 */
const origin = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'recu-m5-rejeu',
  metadata: { title: 'Rejeu M5' },
  objects: [
    {
      id: 'ball',
      type: 'ball',
      props: {},
      transform: { position: { x: 2, y: 1 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'basket',
      type: 'basket',
      props: {},
      transform: { position: { x: 6.5, y: 5 }, rotation: 0 },
      permissions: locked,
    },
  ],
  inventory: [
    {
      id: 'beams',
      type: 'beam',
      props: { size: 'medium' },
      quantity: 1,
      permissions: { move: true, rotate: true, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
  buildZones: [{ min: { x: 0, y: 0 }, max: { x: 8, y: 6 } }],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 6 } },
  wires: [],
});

describe('rejeu de la solution d’une tentative gagnante (M5, ADR 0015)', () => {
  it('rejouée sur le niveau d’origine, redonne la même tentative et gagne en simulation', () => {
    const placed = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'beams',
      placementId: 'poutre-du-joueur',
      transform: { position: { x: 3, y: 2.5 }, rotation: 0.4 },
    }).execute(createConstructionAttempt(origin));
    if (placed.status === 'rejected') throw new Error(`pose refusée : ${placed.reason}`);
    const winning = placed.state;
    expect(runLevelOutcome(origin)).toBe('lost');
    expect(runLevelOutcome(winning.document)).toBe('won');

    const solution = solutionFromAttempt(winning);
    const replayed = playSolution(origin, solution);

    expect(replayed).not.toBeNull();
    if (replayed === null) return;
    expect(solutionFromAttempt(replayed)).toEqual(solution);
    expect(replayed.document.inventory).toEqual(winning.document.inventory);
    expect(runLevelOutcome(replayed.document)).toBe('won');
  });
});
