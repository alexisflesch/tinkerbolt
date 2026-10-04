import { describe, expect, it } from 'vitest';

import { createConstructionAttempt, placeFromInventory } from '../application/construction';
import { creationFromLevel } from '../application/drafts/creation-from-level';
import { solutionFromAttempt } from '../application/puzzle/player-solution';
import { playSolution, puzzleFromWorkshop } from '../application/puzzle/puzzle-workshop';
import { levelDocumentSchema } from '../domain/level-document';
import { runLevelOutcome } from '../simulation/level-outcome';

const locked = { move: false, rotate: false, remove: false } as const;

/**
 * A local level, not a campaign one (their calibration is the author's): the
 * ball falls beside the basket unless a tilted beam sends it there.
 */
const origin = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'recu-m6-remix',
  metadata: { title: 'Remix M6', author: 'Lili' },
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

describe('création depuis une victoire, réexportée en puzzle (M6, ADR 0015)', () => {
  it('redonne par `puzzleFromWorkshop` un puzzle dont la solution gagne en simulation', () => {
    const placed = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'beams',
      placementId: 'poutre-du-joueur',
      transform: { position: { x: 3, y: 2.5 }, rotation: 0.4 },
    }).execute(createConstructionAttempt(origin));
    if (placed.status === 'rejected') throw new Error(`pose refusée : ${placed.reason}`);
    const playerSolution = solutionFromAttempt(placed.state);

    const { document } = creationFromLevel(origin, {
      playerSolution,
      createId: () => 'creation-m6',
    });
    const conversion = puzzleFromWorkshop(document);

    expect(conversion.status).toBe('ok');
    if (conversion.status !== 'ok') return;
    const { puzzle } = conversion;
    expect(puzzle.metadata).toEqual({
      title: 'Remix M6 (remix)',
      basedOn: [{ title: 'Remix M6', author: 'Lili' }],
    });
    expect(runLevelOutcome(puzzle)).toBe('lost');
    const solved = playSolution(puzzle, puzzle.solution ?? { placements: [] });
    expect(solved).not.toBeNull();
    expect(solved === null ? null : runLevelOutcome(solved.document)).toBe('won');
  });
});
