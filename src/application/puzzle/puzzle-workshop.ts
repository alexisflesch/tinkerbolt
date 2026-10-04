import {
  levelDocumentSchema,
  rotationMode,
  type LevelDocument,
  type Solution,
} from '../../domain/level-document';
import {
  connectControlWire,
  createConstructionAttempt,
  placeFromInventory,
  type ConstructionAttempt,
} from '../construction';

import { restoreSolution, uniqueIdentifier } from './restore-solution';

type Placement = LevelDocument['objects'][number];
type InventoryEntry = LevelDocument['inventory'][number];
type SolutionPlacement = NonNullable<LevelDocument['solution']>['placements'][number];
type SolutionWire = Exclude<NonNullable<LevelDocument['solution']>['wires'], undefined>[number];

/** Why a workshop cannot become a puzzle, or a puzzle cannot be exported (U22, ADR 0013). */
export type PuzzleRefusalReason =
  | 'no-object-to-place'
  | 'invalid-puzzle'
  | 'solution-not-playable'
  | 'solution-does-not-win'
  | 'wins-without-player';

type PuzzleConversion =
  | { readonly status: 'ok'; readonly puzzle: LevelDocument }
  | { readonly status: 'refused'; readonly reason: PuzzleRefusalReason };

type PuzzleVerification =
  | { readonly status: 'verified'; readonly puzzle: LevelDocument }
  | { readonly status: 'refused'; readonly reason: PuzzleRefusalReason };

export type PuzzleRunOutcome = 'won' | 'lost';

/**
 * Port to a deterministic, fixed-step simulation of a level with no player
 * action during the run: the application never depends on the engine.
 */
export type PuzzleRunner = (document: LevelDocument) => PuzzleRunOutcome;

/** Properties are flat objects of strings, so comparing their entries is exact. */
const sameProperties = (
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean =>
  Object.keys(left).length === Object.keys(right).length &&
  Object.entries(left).every(([key, value]) => right[key] === value);

const isToPlace = (placement: Placement): boolean => placement.toPlace === true;

interface EntryDraft {
  readonly id: string;
  readonly type: InventoryEntry['type'];
  readonly props: InventoryEntry['props'];
  quantity: number;
  readonly permissions: InventoryEntry['permissions'];
}

/**
 * U22/U25 (ADR 0013): fixed objects and fixed wires stay as decor; objects and
 * wires to place become inventory entries, and their poses/connections the
 * reference solution. The workshop's own stock is the author's and is dropped.
 * Without a build zone, the player may place anywhere in the scene. The result
 * is validated like any document before it is returned.
 */
export const puzzleFromWorkshop = (workshop: LevelDocument): PuzzleConversion => {
  const toPlace = workshop.objects.filter(isToPlace);
  if (toPlace.length === 0) return { status: 'refused', reason: 'no-object-to-place' };

  const toPlaceIds = new Set(toPlace.map(({ id }) => id));
  const decor = workshop.objects.filter((placement) => !isToPlace(placement));
  const wiresToPlace = workshop.wires.filter(
    ({ sourceId, targetId, timerId, toPlace }) =>
      toPlace === true ||
      toPlaceIds.has(sourceId) ||
      toPlaceIds.has(targetId) ||
      (timerId !== undefined && toPlaceIds.has(timerId)),
  );
  const decorWires = workshop.wires.filter((wire) => !wiresToPlace.includes(wire));
  const usedIds = new Set([...decor.map(({ id }) => id), ...workshop.wires.map(({ id }) => id)]);
  const inventory: EntryDraft[] = [];
  const wireEntryId =
    wiresToPlace.length > 0 ? uniqueIdentifier('wire-a-placer', usedIds) : undefined;
  if (wireEntryId !== undefined) {
    inventory.push({
      id: wireEntryId,
      type: 'wire',
      props: {},
      quantity: wiresToPlace.length,
      permissions: { move: false, rotate: false, remove: true },
    });
  }
  const wiredPlacementIds = new Set(
    wiresToPlace.flatMap(({ sourceId, targetId, timerId }) => [
      sourceId,
      targetId,
      ...(timerId === undefined ? [] : [timerId]),
    ]),
  );
  const placements: SolutionPlacement[] = toPlace.map((placement) => {
    let entry = inventory.find(
      (candidate) =>
        candidate.type === placement.type && sameProperties(candidate.props, placement.props),
    );
    if (entry === undefined) {
      entry = {
        id: uniqueIdentifier(`${placement.type}-a-placer`, usedIds),
        type: placement.type,
        props: placement.props,
        quantity: 0,
        permissions: {
          move: true,
          rotate: rotationMode(placement.type) !== 'fixed',
          remove: true,
        },
      };
      inventory.push(entry);
    }
    entry.quantity += 1;
    return {
      inventoryId: entry.id,
      ...(wiredPlacementIds.has(placement.id) ? { placementId: placement.id } : {}),
      transform: placement.transform,
    };
  });

  const solutionWires: SolutionWire[] =
    wireEntryId === undefined
      ? []
      : wiresToPlace.map((wire) => ({
          id: wire.id,
          inventoryId: wireEntryId,
          sourceId: wire.sourceId,
          ...(wire.timerId === undefined ? {} : { timerId: wire.timerId }),
          targetId: wire.targetId,
        }));

  const { challenge: ignoredChallenge, ...workshopWithoutChallenge } = workshop;
  void ignoredChallenge;
  const validation = levelDocumentSchema.safeParse({
    ...workshopWithoutChallenge,
    objects: decor,
    inventory,
    wires: decorWires,
    buildZones:
      workshop.buildZones.length > 0
        ? workshop.buildZones
        : [{ min: workshop.scene.min, max: workshop.scene.max }],
    solution: {
      placements,
      ...(solutionWires.length > 0 ? { wires: solutionWires } : {}),
    },
  });
  return validation.success
    ? { status: 'ok', puzzle: validation.data }
    : { status: 'refused', reason: 'invalid-puzzle' };
};

/**
 * The inverse of `puzzleFromWorkshop`, to reopen a puzzle in the workshop
 * (U17): each pose of the solution is back on the board, marked to place.
 * The inventory stays: the workshop never shows it, and the export derives it
 * again. Challenges in a campaign draft are not exported. A document without
 * solution is returned
 * as is, and so is one whose workshop form would not be valid.
 */
export const workshopFromPuzzle = (puzzle: LevelDocument): LevelDocument => {
  const { solution, ...workshop } = puzzle;
  if (solution === undefined) return puzzle;

  const usedIds = new Set([
    ...puzzle.objects.map(({ id }) => id),
    ...puzzle.inventory.map(({ id }) => id),
    ...puzzle.wires.map(({ id }) => id),
  ]);
  const restored = restoreSolution(solution, puzzle.inventory, usedIds);

  const validation = levelDocumentSchema.safeParse({
    ...workshop,
    objects: [...puzzle.objects, ...restored.objects],
    wires: [...puzzle.wires, ...restored.wires],
  });
  return validation.success ? validation.data : puzzle;
};

/**
 * Poses `solution` on `level` with the player's own commands, build zones
 * included (ADR 0013): the reference solution of a puzzle, or a player's
 * winning solution (ADR 0015). `null` when one command is refused.
 */
export const playSolution = (
  level: LevelDocument,
  solution: Solution,
): ConstructionAttempt | null => {
  const usedIds = new Set([
    ...level.objects.map(({ id }) => id),
    ...level.wires.map(({ id }) => id),
  ]);
  const placementIdsByReference = new Map<string, string>();
  let attempt = createConstructionAttempt(level);
  for (const pose of solution.placements) {
    const placementId = uniqueIdentifier('solution', usedIds);
    const outcome = placeFromInventory({
      context: 'player',
      inventoryEntryId: pose.inventoryId,
      placementId,
      transform: pose.transform,
    }).execute(attempt);
    if (outcome.status === 'rejected') return null;
    attempt = outcome.state;
    if (pose.placementId !== undefined) {
      placementIdsByReference.set(pose.placementId, placementId);
    }
  }
  for (const wire of solution.wires ?? []) {
    const outcome = connectControlWire({
      context: 'player',
      wireId: wire.id,
      inventoryEntryId: wire.inventoryId,
      sourceId: placementIdsByReference.get(wire.sourceId) ?? wire.sourceId,
      ...(wire.timerId === undefined
        ? {}
        : { timerId: placementIdsByReference.get(wire.timerId) ?? wire.timerId }),
      targetId: placementIdsByReference.get(wire.targetId) ?? wire.targetId,
    }).execute(attempt);
    if (outcome.status === 'rejected') return null;
    attempt = outcome.state;
  }
  return attempt;
};

/**
 * U22: the checks run before any export, without the author's help. The
 * complete machine, posed by the player's commands, wins; the decor alone
 * does not.
 */
export const verifyPuzzle = (workshop: LevelDocument, run: PuzzleRunner): PuzzleVerification => {
  const conversion = puzzleFromWorkshop(workshop);
  if (conversion.status === 'refused') return conversion;

  const { puzzle } = conversion;
  const solved = playSolution(puzzle, puzzle.solution ?? { placements: [] });
  if (solved === null) return { status: 'refused', reason: 'solution-not-playable' };
  if (run(solved.document) !== 'won') return { status: 'refused', reason: 'solution-does-not-win' };
  if (run(puzzle) === 'won') return { status: 'refused', reason: 'wins-without-player' };
  return { status: 'verified', puzzle };
};
