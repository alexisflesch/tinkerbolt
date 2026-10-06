import { describe, expect, it } from 'vitest';

import {
  hasCompleteGoal,
  isMachine,
  levelDocumentSchema,
  type LevelDocument,
} from '../../domain/level-document';
import { addAuthoredPlacement, setPlacementToPlace } from '../construction/authoring-commands';
import { createConstructionAttempt, type ConstructionAttempt } from '../construction';
import { verifyPuzzle } from '../puzzle/puzzle-workshop';
import { creationFromLevel } from './creation-from-level';

const locked = { move: false, rotate: false, remove: false } as const;

const ball = {
  id: 'ball-1',
  type: 'ball',
  props: {},
  transform: { position: { x: 1, y: 1 }, rotation: 0 },
  permissions: locked,
};
const basket = {
  id: 'basket-1',
  type: 'basket',
  props: {},
  transform: { position: { x: 7, y: 5 }, rotation: 0 },
  permissions: locked,
};
const slope = {
  id: 'slope',
  type: 'beam',
  props: { size: 'medium' },
  transform: { position: { x: 2, y: 2 }, rotation: 0.2 },
  permissions: locked,
};

const machine = (objects: readonly unknown[], goal?: unknown): LevelDocument =>
  levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'machine-source',
    metadata: { title: 'Machine source', author: 'Lili' },
    objects,
    inventory: [],
    ...(goal === undefined ? {} : { goal }),
    buildZones: [],
    scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  });

const apply = (
  attempt: ConstructionAttempt,
  command: Parameters<typeof addAuthoredPlacement>[0] | ReturnType<typeof setPlacementToPlace>,
): ConstructionAttempt => {
  const outcome = ('execute' in command ? command : addAuthoredPlacement(command)).execute(attempt);
  if (outcome.status !== 'accepted') throw new Error(`refusé : ${outcome.reason}`);
  return outcome.state;
};

/** The decor alone loses; with the player's extra object on the board, the machine wins. */
const winsWithOneMoreObject =
  (decorObjectCount: number) =>
  (document: LevelDocument): 'won' | 'lost' =>
    document.objects.length > decorObjectCount ? 'won' : 'lost';

describe('remixer une machine puis la réexporter (ADR 0020)', () => {
  it('garde l’objectif d’une machine, et la création s’exporte en défi une fois un objet à placer marqué', () => {
    const source = machine([ball, basket, slope], {
      type: 'basket',
      ballId: 'ball-1',
      basketId: 'basket-1',
    });
    const { document } = creationFromLevel(source, { createId: () => 'creation-1' });

    expect(document.goal).toEqual(source.goal);
    expect(hasCompleteGoal(document)).toBe(true);
    let attempt = createConstructionAttempt(document);
    attempt = apply(attempt, {
      context: 'author',
      placementId: 'extra-beam',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 4, y: 3 }, rotation: 0 },
    });
    attempt = apply(
      attempt,
      setPlacementToPlace({ context: 'author', placementId: 'extra-beam', toPlace: true }),
    );

    const verification = verifyPuzzle(attempt.document, winsWithOneMoreObject(3));
    expect(verification.status).toBe('verified');
  });

  it('remet un objectif à une machine sans objectif avec le catalogue, puis exporte en défi', () => {
    const source = machine([slope]);
    const { document } = creationFromLevel(source, { createId: () => 'creation-2' });
    expect(document.goal).toBeUndefined();
    expect(isMachine(document)).toBe(true);
    expect(verifyPuzzle(document, winsWithOneMoreObject(3))).toEqual({
      status: 'refused',
      reason: 'no-complete-goal',
    });

    let attempt = createConstructionAttempt(document);
    attempt = apply(attempt, {
      context: 'author',
      placementId: 'red-ball',
      type: 'ball',
      props: {},
      transform: ball.transform,
      goalRole: 'ball',
    });
    attempt = apply(attempt, {
      context: 'author',
      placementId: 'the-basket',
      type: 'basket',
      props: {},
      transform: basket.transform,
      goalRole: 'basket',
    });
    expect(hasCompleteGoal(attempt.document)).toBe(true);
    attempt = apply(attempt, {
      context: 'author',
      placementId: 'extra-beam',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 4, y: 3 }, rotation: 0 },
    });
    attempt = apply(
      attempt,
      setPlacementToPlace({ context: 'author', placementId: 'extra-beam', toPlace: true }),
    );

    const verification = verifyPuzzle(attempt.document, winsWithOneMoreObject(3));
    expect(verification.status).toBe('verified');
  });
});
