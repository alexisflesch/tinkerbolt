import { describe, expect, it } from 'vitest';

import type { LevelDocument } from '../../domain/level-document';
import { createHistory, executeCommand, redo, undo } from '../history';
import {
  beamSizeChoicesFor,
  changeBeamSize,
  connectControlWire,
  createConstructionAttempt,
  disconnectControlWire,
  movePlacement,
  placeFromInventory,
  removePlacement,
  rotatePlacement,
  updatePlacementProperties,
  type ConstructionAttempt,
  type ConstructionContext,
  type ConstructionErrorCode,
} from './index';

const permissions = {
  move: true,
  rotate: false,
  remove: false,
} as const;

const createLevel = (): LevelDocument => ({
  schemaVersion: 3,
  id: 'construction-test',
  metadata: { title: 'Construction test' },
  objects: [
    {
      id: 'goal-ball',
      type: 'ball',
      props: {},
      transform: { position: { x: -2, y: 5 }, rotation: 0 },
      permissions,
    },
    {
      id: 'goal-basket',
      type: 'basket',
      props: {},
      transform: { position: { x: 8, y: 0 }, rotation: 0 },
      permissions,
    },
    {
      id: 'fixed-beam',
      type: 'beam',
      props: { size: 'medium' },
      transform: { position: { x: 3, y: 3 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
  ],
  inventory: [
    {
      id: 'short-beams',
      type: 'beam',
      props: { size: 'short' },
      quantity: 1,
      permissions: { move: true, rotate: true, remove: true },
    },
    {
      id: 'empty-seesaws',
      type: 'seesaw',
      props: {},
      quantity: 0,
      permissions: { move: true, rotate: false, remove: true },
    },
  ],
  buildZones: [{ min: { x: 0, y: 0 }, max: { x: 10, y: 10 } }],
  goal: { type: 'basket', ballId: 'goal-ball', basketId: 'goal-basket' },
  // Wide enough to still contain the author-mode moves in this file, which
  // deliberately go far outside the player build zone (up to ±20).
  scene: { min: { x: -25, y: -25 }, max: { x: 25, y: 25 } },
  wires: [],
});

const lockedPermissions = { move: false, rotate: false, remove: false } as const;

/** A lever and two conveyors placed by the author, none of them wired yet. */
const createWiringLevel = (): LevelDocument => {
  const level = createLevel();
  return {
    ...level,
    objects: [
      ...level.objects,
      {
        id: 'lever-1',
        type: 'lever',
        props: { position: 'center' },
        transform: { position: { x: 1, y: 8 }, rotation: 0 },
        permissions: lockedPermissions,
      },
      {
        id: 'conveyor-1',
        type: 'conveyor',
        props: { direction: 'stopped' },
        transform: { position: { x: 6, y: 8 }, rotation: 0 },
        permissions: lockedPermissions,
      },
      {
        id: 'conveyor-2',
        type: 'conveyor',
        props: { direction: 'right' },
        transform: { position: { x: 6, y: 2 }, rotation: 0 },
        permissions: lockedPermissions,
      },
    ],
  };
};

const placeBeam = (context: ConstructionContext = 'player') =>
  placeFromInventory({
    context,
    inventoryEntryId: 'short-beams',
    placementId: 'placed-beam',
    transform: { position: { x: 4, y: 5 }, rotation: 0.25 },
  });

const createResizableBeamAttempt = (includeOtherSizes = true, x = 4) => {
  const level = createLevel();
  const withBeamStock: LevelDocument = {
    ...level,
    inventory: [
      ...level.inventory,
      ...(includeOtherSizes
        ? [
            {
              id: 'medium-beams',
              type: 'beam' as const,
              props: { size: 'medium' as const },
              quantity: 1,
              permissions: { move: true, rotate: true, remove: true },
            },
            {
              id: 'long-beams',
              type: 'beam' as const,
              props: { size: 'long' as const },
              quantity: 1,
              permissions: { move: true, rotate: true, remove: true },
            },
          ]
        : []),
    ],
  };
  const result = placeFromInventory({
    context: 'player',
    inventoryEntryId: 'short-beams',
    placementId: 'resizable-beam',
    transform: { position: { x, y: 5 }, rotation: 0 },
  }).execute(createConstructionAttempt(withBeamStock));
  if (result.status !== 'accepted') throw new Error(result.reason);
  return result.state;
};

const expectRejected = (
  result: ReturnType<ReturnType<typeof placeFromInventory>['execute']>,
  reason: ConstructionErrorCode,
): void => {
  expect(result).toEqual({ status: 'rejected', reason });
};

describe('ConstructionAttempt', () => {
  it('starts as an immutable JSON-like snapshot without modifying or aliasing the source', () => {
    const source = createLevel();

    const attempt = createConstructionAttempt(source);

    expect(attempt).toEqual({ document: source, provenance: {} });
    expect(attempt.document).not.toBe(source);
    expect(attempt.document.objects).not.toBe(source.objects);
    expect(Object.isFrozen(attempt)).toBe(true);
    expect(Object.isFrozen(attempt.document.objects)).toBe(true);
    expect(Object.isFrozen(attempt.provenance)).toBe(true);
    expect(Object.isFrozen(source)).toBe(false);
  });

  it('places from inventory atomically and records the ephemeral provenance', () => {
    const source = createLevel();
    const attempt = createConstructionAttempt(source);

    const result = placeBeam().execute(attempt);

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    expect(result.state.document.objects.at(-1)).toEqual({
      id: 'placed-beam',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 4, y: 5 }, rotation: 0.25 },
      permissions: { move: true, rotate: true, remove: true },
    });
    expect(result.state.document.inventory[0]?.quantity).toBe(0);
    expect(result.state.provenance).toEqual({ 'placed-beam': 'short-beams' });
    expect(attempt.document.inventory[0]?.quantity).toBe(1);
    expect(attempt.document.objects).toHaveLength(3);
    expect(Object.isFrozen(result.state.document.objects.at(-1))).toBe(true);
  });

  it('keeps a two-object challenge valid while consuming its inventory', () => {
    const source = createLevel();
    const attempt = createConstructionAttempt({
      ...source,
      challenge: { elegantObjectCount: 2, minimalObjectCount: 2 },
      inventory: source.inventory.map((entry) =>
        entry.id === 'short-beams' ? { ...entry, quantity: 2 } : entry,
      ),
    });
    const first = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'short-beams',
      placementId: 'first-challenge-beam',
      transform: { position: { x: 4, y: 5 }, rotation: 0 },
    }).execute(attempt);

    expect(first.status).toBe('accepted');
    if (first.status !== 'accepted') return;
    expect(first.state.document.inventory[0]?.quantity).toBe(1);

    const second = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'short-beams',
      placementId: 'second-challenge-beam',
      transform: { position: { x: 6, y: 6 }, rotation: 0 },
    }).execute(first.state);

    expect(second.status).toBe('accepted');
    if (second.status !== 'accepted') return;
    expect(second.state.document.inventory[0]?.quantity).toBe(0);
    expect(second.state.provenance).toEqual({
      'first-challenge-beam': 'short-beams',
      'second-challenge-beam': 'short-beams',
    });
  });

  it.each([
    ['unknown-entry', 'missing-entry', 'inventory-entry-not-found'],
    ['depleted-entry', 'empty-seesaws', 'inventory-depleted'],
    ['duplicate-id', 'short-beams', 'placement-id-already-used'],
  ] as const)('rejects %s without changing the attempt', (_case, inventoryEntryId, reason) => {
    const attempt = createConstructionAttempt(createLevel());
    const before = structuredClone(attempt);
    const placementId = reason === 'placement-id-already-used' ? 'fixed-beam' : 'new-object';

    const result = placeFromInventory({
      context: 'player',
      inventoryEntryId,
      placementId,
      transform: { position: { x: 2, y: 2 }, rotation: 0 },
    }).execute(attempt);

    expectRejected(result, reason);
    expect(attempt).toEqual(before);
  });

  it('rejects a player placement whose full footprint is outside build zones', () => {
    const attempt = createConstructionAttempt(createLevel());

    const result = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'short-beams',
      placementId: 'outside-beam',
      transform: { position: { x: 10.1, y: 5 }, rotation: 0 },
    }).execute(attempt);

    expectRejected(result, 'outside-build-zone');
    expect(attempt.document.inventory[0]?.quantity).toBe(1);
    expect(attempt.provenance).toEqual({});
  });

  it('rejects a player placement when the beam end leaves the zone although its centre is inside', () => {
    const attempt = createConstructionAttempt(createLevel());
    const before = structuredClone(attempt);

    const result = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'short-beams',
      placementId: 'edge-beam',
      transform: { position: { x: 9.5, y: 5 }, rotation: 0 },
    }).execute(attempt);

    expectRejected(result, 'outside-build-zone');
    expect(attempt).toEqual(before);
  });

  it('accepts a player placement whose full footprint reaches the inclusive zone boundary', () => {
    const attempt = createConstructionAttempt(createLevel());

    const result = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'short-beams',
      placementId: 'edge-beam',
      transform: { position: { x: 9, y: 5 }, rotation: 0 },
    }).execute(attempt);

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    expect(result.state.document.objects.at(-1)?.transform.position).toEqual({ x: 9, y: 5 });
    expect(result.state.document.inventory[0]?.quantity).toBe(0);
  });

  it('accepts a rotated player footprint at an inclusive boundary despite rounding error', () => {
    const attempt = createConstructionAttempt(createLevel());

    const result = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'short-beams',
      placementId: 'rotated-edge-beam',
      transform: { position: { x: 0.125, y: 5 }, rotation: Math.PI / 2 },
    }).execute(attempt);

    expect(result.status).toBe('accepted');
  });

  it('lets the player place like the author when a zone covers the whole scene', () => {
    const level = createLevel();
    const scene = { min: { x: -3, y: -1 }, max: { x: 10, y: 10 } };
    const attempt = createConstructionAttempt({ ...level, scene, buildZones: [scene] });

    // Centre in the scene, footprint past its edge: no zone is really drawn.
    const moved = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'short-beams',
      placementId: 'edge-beam',
      transform: { position: { x: 9.5, y: 5 }, rotation: 0 },
    }).execute(attempt);
    expect(moved.status).toBe('accepted');

    // The scene still bounds the player.
    const outside = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'short-beams',
      placementId: 'outside-beam',
      transform: { position: { x: 11, y: 5 }, rotation: 0 },
    }).execute(attempt);
    expect(outside.status).toBe('rejected');
  });

  it('grows the scene, and a zone covering it, when the author moves an object past its edge', () => {
    const level = createLevel();
    const scene = { min: { x: -3, y: -1 }, max: { x: 10, y: 10 } };
    const attempt = createConstructionAttempt({ ...level, scene, buildZones: [scene] });

    const moved = movePlacement({
      context: 'author',
      placementId: 'fixed-beam',
      position: { x: 13.4, y: -2.5 },
    }).execute(attempt);

    expect(moved.status).toBe('accepted');
    if (moved.status !== 'accepted') return;
    const grown = { min: { x: -3, y: -4 }, max: { x: 15, y: 10 } };
    expect(moved.state.document.scene).toEqual(grown);
    expect(moved.state.document.buildZones).toEqual([grown]);

    const tooFar = movePlacement({
      context: 'author',
      placementId: 'fixed-beam',
      position: { x: 80, y: 5 },
    }).execute(attempt);
    expect(tooFar).toEqual({ status: 'rejected', reason: 'invalid-level-document' });

    const byPlayer = movePlacement({
      context: 'player',
      placementId: 'fixed-beam',
      position: { x: 13.4, y: -2.5 },
    }).execute(attempt);
    expect(byPlayer.status).toBe('rejected');
  });

  it('rejects a player move when the centre stays in-zone but the beam footprint leaves it', () => {
    const attempt = createConstructionAttempt(createLevel());
    const placed = placeBeam().execute(attempt);
    if (placed.status !== 'accepted') throw new Error('placement should be accepted');
    const before = structuredClone(placed.state);

    const moved = movePlacement({
      context: 'player',
      placementId: 'placed-beam',
      position: { x: 9.5, y: 5 },
    }).execute(placed.state);

    expect(moved).toEqual({ status: 'rejected', reason: 'outside-build-zone' });
    expect(placed.state).toEqual(before);
  });

  it('rejects a player rotation that moves a corner outside the zone without changing the document', () => {
    const attempt = createConstructionAttempt(createLevel());
    const placed = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'short-beams',
      placementId: 'edge-beam',
      transform: { position: { x: 5, y: 9.5 }, rotation: 0 },
    }).execute(attempt);
    if (placed.status !== 'accepted') throw new Error('placement should be accepted');
    const before = structuredClone(placed.state);

    const rotated = rotatePlacement({
      context: 'player',
      placementId: 'edge-beam',
      rotation: Math.PI / 4,
    }).execute(placed.state);

    expect(rotated).toEqual({ status: 'rejected', reason: 'outside-build-zone' });
    expect(placed.state).toEqual(before);
    expect(attempt.document.objects.some(({ id }) => id === 'edge-beam')).toBe(false);
  });

  it('requires the whole footprint to fit in one zone instead of spanning adjacent zones', () => {
    const level = createLevel();
    const attempt = createConstructionAttempt({
      ...level,
      buildZones: [
        { min: { x: 0, y: 0 }, max: { x: 5, y: 10 } },
        { min: { x: 5, y: 0 }, max: { x: 10, y: 10 } },
      ],
    });

    const result = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'short-beams',
      placementId: 'spanning-beam',
      transform: { position: { x: 5, y: 5 }, rotation: 0 },
    }).execute(attempt);

    expectRejected(result, 'outside-build-zone');
    expect(attempt.document.inventory[0]?.quantity).toBe(1);
  });

  it('lets the author place and move outside future player build zones and permissions', () => {
    const attempt = createConstructionAttempt(createLevel());
    const placed = placeFromInventory({
      context: 'author',
      inventoryEntryId: 'short-beams',
      placementId: 'outside-beam',
      transform: { position: { x: 20, y: 20 }, rotation: 0 },
    }).execute(attempt);
    expect(placed.status).toBe('accepted');
    if (placed.status !== 'accepted') return;

    const moved = movePlacement({
      context: 'author',
      placementId: 'fixed-beam',
      position: { x: -20, y: -20 },
    }).execute(placed.state);

    expect(moved.status).toBe('accepted');
    if (moved.status !== 'accepted') return;
    expect(
      moved.state.document.objects.find(({ id }) => id === 'fixed-beam')?.transform.position,
    ).toEqual({ x: -20, y: -20 });
  });

  it('applies player move permission and zone atomically', () => {
    const attempt = createConstructionAttempt(createLevel());

    expect(
      movePlacement({
        context: 'player',
        placementId: 'fixed-beam',
        position: { x: 4, y: 4 },
      }).execute(attempt),
    ).toEqual({ status: 'rejected', reason: 'move-not-permitted' });

    const placed = placeBeam().execute(attempt);
    if (placed.status !== 'accepted') throw new Error('placement should be accepted');
    const outside = movePlacement({
      context: 'player',
      placementId: 'placed-beam',
      position: { x: 11, y: 4 },
    }).execute(placed.state);

    expect(outside).toEqual({ status: 'rejected', reason: 'outside-build-zone' });
    expect(
      placed.state.document.objects.find(({ id }) => id === 'placed-beam')?.transform.position,
    ).toEqual({ x: 4, y: 5 });
  });

  it('rotates free-angle objects and applies player permission and zone checks', () => {
    const attempt = createConstructionAttempt(createLevel());

    expect(
      rotatePlacement({ context: 'author', placementId: 'goal-ball', rotation: 1 }).execute(
        attempt,
      ),
    ).toEqual({ status: 'rejected', reason: 'placement-not-rotatable' });
    expect(
      rotatePlacement({ context: 'player', placementId: 'fixed-beam', rotation: 1 }).execute(
        attempt,
      ),
    ).toEqual({ status: 'rejected', reason: 'rotate-not-permitted' });

    const placed = placeBeam().execute(attempt);
    if (placed.status !== 'accepted') throw new Error('placement should be accepted');
    const rotated = rotatePlacement({
      context: 'player',
      placementId: 'placed-beam',
      rotation: 1.5,
    }).execute(placed.state);

    expect(rotated.status).toBe('accepted');
    if (rotated.status !== 'accepted') return;
    expect(
      rotated.state.document.objects.find(({ id }) => id === 'placed-beam')?.transform.rotation,
    ).toBe(1.5);
  });

  it('rotates a lever in author mode and validates the resulting angle', () => {
    const attempt = createConstructionAttempt(createWiringLevel());
    const rotate = (rotation: number) =>
      rotatePlacement({ context: 'author', placementId: 'lever-1', rotation }).execute(attempt);

    const rotated = rotate(Math.PI / 2);
    expect(rotated.status).toBe('accepted');
    if (rotated.status === 'accepted') {
      expect(
        rotated.state.document.objects.find(({ id }) => id === 'lever-1')?.transform.rotation,
      ).toBe(Math.PI / 2);
    }
    expect(rotate(Math.PI).status).toBe('accepted');
  });

  it('turns a fan by fifteen degrees, like every other rotatable family', () => {
    const level = createLevel();
    const attempt = createConstructionAttempt({
      ...level,
      objects: [
        ...level.objects,
        {
          id: 'fan-1',
          type: 'fan',
          transform: { position: { x: 3, y: 3 }, rotation: 0 },
          props: { state: 'on' },
          permissions: { move: true, rotate: true, remove: true },
        },
      ],
    });
    const turn = (rotation: number) =>
      rotatePlacement({ context: 'author', placementId: 'fan-1', rotation }).execute(attempt);

    expect(turn(Math.PI / 2).status).toBe('accepted');
    expect(turn(Math.PI / 12).status).toBe('accepted');
  });

  it('restores the exact source entry and removes provenance atomically for the player', () => {
    const attempt = createConstructionAttempt(createLevel());
    const placed = placeBeam().execute(attempt);
    if (placed.status !== 'accepted') throw new Error('placement should be accepted');

    const removed = removePlacement({
      context: 'player',
      placementId: 'placed-beam',
    }).execute(placed.state);

    expect(removed.status).toBe('accepted');
    if (removed.status !== 'accepted') return;
    expect(removed.state.document.objects.some(({ id }) => id === 'placed-beam')).toBe(false);
    expect(removed.state.document.inventory[0]?.quantity).toBe(1);
    expect(removed.state.provenance).toEqual({});
  });

  it('rejects player removal without permission or valid matching provenance', () => {
    const attempt = createConstructionAttempt(createLevel());

    expect(
      removePlacement({ context: 'player', placementId: 'fixed-beam' }).execute(attempt),
    ).toEqual({ status: 'rejected', reason: 'remove-not-permitted' });

    const removableWithoutProvenance: ConstructionAttempt = {
      ...attempt,
      document: {
        ...attempt.document,
        objects: attempt.document.objects.map((placement) =>
          placement.id === 'fixed-beam'
            ? { ...placement, permissions: { ...placement.permissions, remove: true } }
            : placement,
        ),
      },
    };
    expect(
      removePlacement({ context: 'player', placementId: 'fixed-beam' }).execute(
        removableWithoutProvenance,
      ),
    ).toEqual({ status: 'rejected', reason: 'inventory-provenance-missing' });

    const mismatchedProvenance: ConstructionAttempt = {
      ...removableWithoutProvenance,
      provenance: { 'fixed-beam': 'short-beams' },
    };
    expect(
      removePlacement({ context: 'player', placementId: 'fixed-beam' }).execute(
        mismatchedProvenance,
      ),
    ).toEqual({ status: 'rejected', reason: 'inventory-provenance-mismatch' });
    expect(mismatchedProvenance.document.inventory[0]?.quantity).toBe(1);
  });

  it('never removes a goal object for the player', () => {
    const attempt = createConstructionAttempt(createLevel());

    expect(
      removePlacement({ context: 'player', placementId: 'goal-ball' }).execute(attempt),
    ).toEqual({ status: 'rejected', reason: 'goal-object-protected' });
    expect(
      removePlacement({ context: 'player', placementId: 'goal-basket' }).execute(attempt),
    ).toEqual({ status: 'rejected', reason: 'goal-object-protected' });
  });

  describe('l’auteur retire la balle rouge ou le panier (ADR 0020)', () => {
    const withoutStock = (): ConstructionAttempt =>
      createConstructionAttempt({ ...createLevel(), inventory: [] });
    const removeAsAuthor = (attempt: ConstructionAttempt, placementId: string) => {
      const outcome = removePlacement({ context: 'author', placementId }).execute(attempt);
      if (outcome.status !== 'accepted') throw new Error(`refusé : ${outcome.reason}`);
      return outcome.state;
    };

    it('retire la balle de l’objectif, qui garde le panier', () => {
      const state = removeAsAuthor(withoutStock(), 'goal-ball');

      expect(state.document.objects.some(({ id }) => id === 'goal-ball')).toBe(false);
      expect(state.document.goal).toEqual({ type: 'basket', basketId: 'goal-basket' });
    });

    it('retire le panier de l’objectif, qui garde la balle', () => {
      const state = removeAsAuthor(withoutStock(), 'goal-basket');

      expect(state.document.goal).toEqual({ type: 'basket', ballId: 'goal-ball' });
    });

    it('retire l’objectif quand il ne désigne plus rien', () => {
      const state = removeAsAuthor(removeAsAuthor(withoutStock(), 'goal-ball'), 'goal-basket');

      expect('goal' in state.document).toBe(false);
    });

    it('vide l’inventaire et la solution, qui exigent un objectif complet', () => {
      const state = removeAsAuthor(createConstructionAttempt(createLevel()), 'goal-ball');

      expect(state.document.inventory).toEqual([]);
      expect(state.document.solution).toBeUndefined();
    });

    it('s’annule par l’historique', () => {
      const initial = createConstructionAttempt(createLevel());
      const history = executeCommand(
        createHistory(initial),
        removePlacement({ context: 'author', placementId: 'goal-ball' }),
      );
      if (history.status !== 'accepted') throw new Error('refusé');

      expect(undo(history.history).history.state).toEqual(initial);
    });
  });

  it('allows the author to delete a fixed non-goal object without inventory provenance', () => {
    const attempt = createConstructionAttempt(createLevel());

    const result = removePlacement({ context: 'author', placementId: 'fixed-beam' }).execute(
      attempt,
    );

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    expect(result.state.document.objects.some(({ id }) => id === 'fixed-beam')).toBe(false);
    expect(result.state.document.inventory[0]?.quantity).toBe(1);
  });

  it('lets the author change a beam size immutably', () => {
    const attempt = createConstructionAttempt(createLevel());

    const result = updatePlacementProperties({
      context: 'author',
      placementId: 'fixed-beam',
      props: { size: 'long' },
    }).execute(attempt);

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    expect(result.state.document.objects.find(({ id }) => id === 'fixed-beam')?.props).toEqual({
      size: 'long',
    });
    expect(attempt.document.objects.find(({ id }) => id === 'fixed-beam')?.props).toEqual({
      size: 'medium',
    });
    expect(result.state).not.toBe(attempt);
  });

  it('records one atomic beam-size command and supports undo and redo', () => {
    const initialAttempt = createConstructionAttempt(createLevel());
    const history = createHistory(initialAttempt);

    const changed = executeCommand(
      history,
      updatePlacementProperties({
        context: 'author',
        placementId: 'fixed-beam',
        props: { size: 'short' },
      }),
    );

    expect(changed.status).toBe('accepted');
    if (changed.status !== 'accepted') return;
    expect(changed.recorded).toBe(true);
    expect(changed.history.past).toHaveLength(1);
    expect(
      changed.history.state.document.objects.find(({ id }) => id === 'fixed-beam')?.props,
    ).toEqual({ size: 'short' });

    const undone = undo(changed.history);
    expect(undone.status).toBe('accepted');
    if (undone.status !== 'accepted') return;
    expect(undone.history.state).toEqual(initialAttempt);

    const redone = redo(undone.history);
    expect(redone.status).toBe('accepted');
    if (redone.status !== 'accepted') return;
    expect(
      redone.history.state.document.objects.find(({ id }) => id === 'fixed-beam')?.props,
    ).toEqual({ size: 'short' });
  });

  it('does not record a no-op beam-size update', () => {
    const history = createHistory(createConstructionAttempt(createLevel()));

    const result = executeCommand(
      history,
      updatePlacementProperties({
        context: 'author',
        placementId: 'fixed-beam',
        props: { size: 'medium' },
      }),
    );

    expect(result).toEqual({ status: 'accepted', history, recorded: false });
  });

  it('échange une poutre de joueur contre une taille disponible en une commande annulable', () => {
    const initialAttempt = createResizableBeamAttempt();
    const history = createHistory(initialAttempt);

    const changed = executeCommand(
      history,
      changeBeamSize({ context: 'player', placementId: 'resizable-beam', size: 'medium' }),
    );

    expect(changed.status).toBe('accepted');
    if (changed.status !== 'accepted') return;
    expect(changed.recorded).toBe(true);
    expect(changed.history.past).toHaveLength(1);
    expect(
      changed.history.state.document.objects.find(({ id }) => id === 'resizable-beam'),
    ).toMatchObject({
      type: 'beam',
      props: { size: 'medium' },
    });
    expect(changed.history.state.document.inventory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'short-beams', quantity: 1 }),
        expect.objectContaining({ id: 'medium-beams', quantity: 0 }),
      ]),
    );
    expect(changed.history.state.provenance['resizable-beam']).toBe('medium-beams');

    const undone = undo(changed.history);
    expect(undone.status).toBe('accepted');
    if (undone.status !== 'accepted') return;
    expect(undone.history.state).toEqual(initialAttempt);

    const redone = redo(undone.history);
    expect(redone.status).toBe('accepted');
    if (redone.status !== 'accepted') return;
    expect(redone.history.state).toEqual(changed.history.state);
  });

  it('propose au joueur la taille courante et les seules variantes encore en stock', () => {
    const attempt = createResizableBeamAttempt(false);

    expect(beamSizeChoicesFor(attempt, 'resizable-beam', 'player')).toEqual([
      { size: 'short', isCurrent: true, isAvailable: true, quantity: 0 },
      { size: 'medium', isCurrent: false, isAvailable: false, quantity: 0 },
      { size: 'long', isCurrent: false, isAvailable: false, quantity: 0 },
    ]);
  });

  it('garde les trois tailles disponibles à l’auteur même pour une poutre fixe', () => {
    const attempt = createConstructionAttempt(createLevel());

    expect(beamSizeChoicesFor(attempt, 'fixed-beam', 'author')).toEqual([
      { size: 'short', isCurrent: false, isAvailable: true, quantity: null },
      { size: 'medium', isCurrent: true, isAvailable: true, quantity: null },
      { size: 'long', isCurrent: false, isAvailable: true, quantity: null },
    ]);
    expect(beamSizeChoicesFor(attempt, 'fixed-beam', 'player')).toBeNull();
  });

  it('ne crée aucune entrée d’historique quand la taille choisie est déjà courante', () => {
    const history = createHistory(createResizableBeamAttempt(false));

    expect(
      executeCommand(
        history,
        changeBeamSize({ context: 'player', placementId: 'resizable-beam', size: 'short' }),
      ),
    ).toEqual({ status: 'accepted', history, recorded: false });
  });

  it('refuse une taille absente du stock sans modifier la construction', () => {
    const attempt = createResizableBeamAttempt(false);

    expect(
      changeBeamSize({ context: 'player', placementId: 'resizable-beam', size: 'long' }).execute(
        attempt,
      ),
    ).toEqual({ status: 'rejected', reason: 'inventory-depleted' });
    expect(attempt.document.objects.find(({ id }) => id === 'resizable-beam')?.props).toEqual({
      size: 'short',
    });
  });

  it('refuse un redimensionnement joueur qui sortirait de la zone de construction', () => {
    const attempt = createResizableBeamAttempt(true, 2);

    expectRejected(
      changeBeamSize({ context: 'player', placementId: 'resizable-beam', size: 'long' }).execute(
        attempt,
      ),
      'outside-build-zone',
    );
  });

  it('rejects a missing placement with a stable reason', () => {
    const attempt = createConstructionAttempt(createLevel());

    expect(
      updatePlacementProperties({
        context: 'author',
        placementId: 'missing-beam',
        props: { size: 'long' },
      }).execute(attempt),
    ).toEqual({ status: 'rejected', reason: 'placement-not-found' });
  });

  it('does not let the player change a persistent beam property', () => {
    const attempt = createConstructionAttempt(createLevel());

    expect(
      updatePlacementProperties({
        context: 'player',
        placementId: 'fixed-beam',
        props: { size: 'long' },
      }).execute(attempt),
    ).toEqual({ status: 'rejected', reason: 'properties-not-permitted' });
  });

  it('rejects unknown properties and properties from another family at the type boundary', () => {
    const attempt = createConstructionAttempt(createLevel());
    const unknownPropertyCommand = updatePlacementProperties({
      context: 'author',
      placementId: 'fixed-beam',
      // @ts-expect-error beam properties are strict and expose only size
      props: { size: 'long', unknown: true },
    });
    expect(unknownPropertyCommand.execute(attempt)).toEqual({
      status: 'rejected',
      reason: 'invalid-level-document',
    });

    const otherFamilyCommand = updatePlacementProperties({
      context: 'author',
      placementId: 'goal-ball',
      props: { size: 'long' },
    });
    expect(otherFamilyCommand.execute(attempt)).toEqual({
      status: 'rejected',
      reason: 'invalid-level-document',
    });
  });

  it('rejects a produced document that fails the LevelDocument schema', () => {
    const attempt = createConstructionAttempt(createLevel());

    const result = placeFromInventory({
      context: 'author',
      inventoryEntryId: 'short-beams',
      placementId: 'INVALID ID',
      transform: { position: { x: 2, y: 2 }, rotation: 0 },
    }).execute(attempt);

    expectRejected(result, 'invalid-level-document');
    expect(attempt.document.inventory[0]?.quantity).toBe(1);
  });

  it('supports undo and redo for atomic placement and removal', () => {
    const initialAttempt = createConstructionAttempt(createLevel());
    const history = createHistory(initialAttempt);
    const placed = executeCommand(history, placeBeam());
    if (placed.status !== 'accepted') throw new Error('placement should be accepted');

    const placementUndone = undo(placed.history);
    if (placementUndone.status !== 'accepted') throw new Error('placement undo should exist');
    expect(placementUndone.history.state).toEqual(initialAttempt);
    const placementRedone = redo(placementUndone.history);
    if (placementRedone.status !== 'accepted') throw new Error('placement redo should exist');
    expect(placementRedone.history.state.provenance).toEqual({ 'placed-beam': 'short-beams' });

    const removed = executeCommand(
      placementRedone.history,
      removePlacement({ context: 'player', placementId: 'placed-beam' }),
    );
    if (removed.status !== 'accepted') throw new Error('removal should be accepted');
    expect(removed.history.state.document.inventory[0]?.quantity).toBe(1);

    const removalUndone = undo(removed.history);
    if (removalUndone.status !== 'accepted') throw new Error('removal undo should exist');
    expect(removalUndone.history.state.provenance).toEqual({ 'placed-beam': 'short-beams' });
    const removalRedone = redo(removalUndone.history);
    if (removalRedone.status !== 'accepted') throw new Error('removal redo should exist');
    expect(removalRedone.history.state).toEqual(initialAttempt);
  });
});

describe('fils de commande', () => {
  const connect = (targetId: string, wireId = 'wire-1', context: ConstructionContext = 'author') =>
    connectControlWire({ context, wireId, sourceId: 'lever-1', targetId });

  it('relie un levier à un convoyeur, annulable et rétablissable', () => {
    const initial = createConstructionAttempt(createWiringLevel());
    const connected = executeCommand(createHistory(initial), connect('conveyor-1'));

    expect(connected.status).toBe('accepted');
    if (connected.status !== 'accepted') return;
    expect(connected.history.state.document.wires).toEqual([
      { id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1' },
    ]);

    const undone = undo(connected.history);
    if (undone.status !== 'accepted') throw new Error('undo refusé');
    expect(undone.history.state.document.wires).toEqual([]);
  });

  it('refuse un fil invalide, un doublon, et un joueur qui câble', () => {
    const attempt = createConstructionAttempt(createWiringLevel());
    const connected = connect('conveyor-1').execute(attempt);
    if (connected.status !== 'accepted') throw new Error('fil refusé');

    expect(connect('goal-ball', 'wire-2').execute(attempt)).toEqual({
      status: 'rejected',
      reason: 'invalid-level-document',
    });
    expect(connect('conveyor-1', 'wire-2').execute(connected.state)).toEqual({
      status: 'rejected',
      reason: 'wire-already-connected',
    });
    expect(connect('conveyor-2', 'wire-2', 'player').execute(attempt)).toEqual({
      status: 'rejected',
      reason: 'wiring-not-permitted',
    });
  });

  it('pose un circuit avec minuteur comme une seule liaison et réserve le minuteur', () => {
    const level = createLevel();
    const withTimer: LevelDocument = {
      ...level,
      objects: [
        ...level.objects,
        {
          id: 'button-1',
          type: 'button',
          props: {},
          transform: { position: { x: 1, y: 8 }, rotation: 0 },
          permissions: lockedPermissions,
        },
        {
          id: 'timer-1',
          type: 'timer',
          props: { delaySeconds: 3 },
          transform: { position: { x: 4, y: 8 }, rotation: 0 },
          permissions: lockedPermissions,
        },
        {
          id: 'fan-1',
          type: 'fan',
          props: { state: 'off' },
          transform: { position: { x: 8, y: 8 }, rotation: 0 },
          permissions: lockedPermissions,
        },
        {
          id: 'barrier-1',
          type: 'barrier',
          props: { state: 'closed' },
          transform: { position: { x: 8, y: 4 }, rotation: 0 },
          permissions: lockedPermissions,
        },
      ],
      inventory: [
        ...level.inventory,
        {
          id: 'wire-stock',
          type: 'wire',
          props: {},
          quantity: 1,
          permissions: { move: false, rotate: false, remove: true },
        },
      ],
    };
    const attempt = createConstructionAttempt(withTimer);
    const linked = connectControlWire({
      context: 'player',
      wireId: 'wire-1',
      inventoryEntryId: 'wire-stock',
      sourceId: 'button-1',
      timerId: 'timer-1',
      targetId: 'fan-1',
    }).execute(attempt);

    expect(linked.status).toBe('accepted');
    if (linked.status !== 'accepted') return;
    expect(linked.state.document.wires).toEqual([
      { id: 'wire-1', sourceId: 'button-1', timerId: 'timer-1', targetId: 'fan-1' },
    ]);
    expect(linked.state.document.inventory.find(({ id }) => id === 'wire-stock')?.quantity).toBe(0);
    expect(linked.state.provenance['wire-1']).toBe('wire-stock');
    expect(
      connectControlWire({
        context: 'author',
        wireId: 'wire-2',
        sourceId: 'button-1',
        timerId: 'timer-1',
        targetId: 'barrier-1',
      }).execute(linked.state),
    ).toEqual({ status: 'rejected', reason: 'timer-already-connected' });
  });

  it('délie un fil par son identifiant', () => {
    const attempt = createConstructionAttempt(createWiringLevel());
    const connected = connect('conveyor-1').execute(attempt);
    if (connected.status !== 'accepted') throw new Error('fil refusé');

    const result = disconnectControlWire({ context: 'author', wireId: 'wire-1' }).execute(
      connected.state,
    );

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    expect(result.state.document.wires).toEqual([]);
    expect(
      disconnectControlWire({ context: 'author', wireId: 'wire-1' }).execute(result.state),
    ).toEqual({ status: 'rejected', reason: 'wire-not-found' });
  });

  it('retire les fils d’un objet supprimé, dans la même commande', () => {
    const attempt = createConstructionAttempt(createWiringLevel());
    const connected = connect('conveyor-1').execute(attempt);
    if (connected.status !== 'accepted') throw new Error('fil refusé');

    const result = removePlacement({ context: 'author', placementId: 'conveyor-1' }).execute(
      connected.state,
    );

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    expect(result.state.document.wires).toEqual([]);
  });

  it('change la position initiale d’un levier et le sens d’un convoyeur', () => {
    const attempt = createConstructionAttempt(createWiringLevel());

    const lever = updatePlacementProperties({
      context: 'author',
      placementId: 'lever-1',
      props: { position: 'left' },
    }).execute(attempt);
    const conveyor = updatePlacementProperties({
      context: 'author',
      placementId: 'conveyor-1',
      props: { direction: 'left' },
    }).execute(attempt);

    expect(lever.status === 'accepted' && lever.state.document.objects[3]?.props).toEqual({
      position: 'left',
    });
    expect(conveyor.status === 'accepted' && conveyor.state.document.objects[4]?.props).toEqual({
      direction: 'left',
    });
    expect(
      updatePlacementProperties({
        context: 'author',
        placementId: 'lever-1',
        props: { direction: 'left' },
      }).execute(attempt),
    ).toEqual({ status: 'rejected', reason: 'invalid-level-document' });
  });
});

describe('fils de l’inventaire du joueur (U21)', () => {
  const wireEntry = {
    id: 'inventory-wires',
    type: 'wire',
    props: {},
    quantity: 1,
    permissions: { move: false, rotate: false, remove: true },
  } as const;

  /** The wiring level with one wire for the player and a level wire lever-1 → conveyor-2. */
  const createPlayerWiringLevel = (
    entry: LevelDocument['inventory'][number] = wireEntry,
  ): LevelDocument => {
    const level = createWiringLevel();
    return {
      ...level,
      objects: [
        ...level.objects,
        {
          id: 'button-1',
          type: 'button',
          props: {},
          transform: { position: { x: 2, y: 2 }, rotation: 0 },
          permissions: lockedPermissions,
        },
      ],
      inventory: [...level.inventory, entry],
      wires: [{ id: 'level-wire', sourceId: 'lever-1', targetId: 'conveyor-2' }],
    };
  };

  const playerConnect = (
    sourceId: string,
    targetId: string,
    inventoryEntryId = 'inventory-wires',
    wireId = 'player-wire',
  ) => connectControlWire({ context: 'player', wireId, sourceId, targetId, inventoryEntryId });

  const quantityOf = (attempt: ConstructionAttempt, entryId: string): number | undefined =>
    attempt.document.inventory.find(({ id }) => id === entryId)?.quantity;

  it('consomme un fil de l’inventaire et en garde la provenance, annulable', () => {
    const initial = createConstructionAttempt(createPlayerWiringLevel());

    const connected = executeCommand(
      createHistory(initial),
      playerConnect('lever-1', 'conveyor-1'),
    );

    if (connected.status !== 'accepted') throw new Error('fil du joueur refusé');
    const state = connected.history.state;
    expect(state.document.wires).toContainEqual({
      id: 'player-wire',
      sourceId: 'lever-1',
      targetId: 'conveyor-1',
    });
    expect(quantityOf(state, 'inventory-wires')).toBe(0);
    expect(state.provenance).toEqual({ 'player-wire': 'inventory-wires' });

    const undone = undo(connected.history);
    if (undone.status !== 'accepted') throw new Error('undo refusé');
    expect(undone.history.state).toEqual(initial);
  });

  it('refuse le joueur sans fil en inventaire, ou avec une entrée épuisée ou d’un autre genre', () => {
    const attempt = createConstructionAttempt(createPlayerWiringLevel());
    const depleted = createConstructionAttempt(
      createPlayerWiringLevel({ ...wireEntry, quantity: 0 }),
    );

    expectRejected(
      connectControlWire({
        context: 'player',
        wireId: 'player-wire',
        sourceId: 'lever-1',
        targetId: 'conveyor-1',
      }).execute(attempt),
      'wiring-not-permitted',
    );
    expectRejected(
      playerConnect('lever-1', 'conveyor-1', 'missing').execute(attempt),
      'inventory-entry-not-found',
    );
    expectRejected(
      playerConnect('lever-1', 'conveyor-1', 'short-beams').execute(attempt),
      'inventory-entry-kind-mismatch',
    );
    expectRejected(playerConnect('lever-1', 'conveyor-1').execute(depleted), 'inventory-depleted');
  });

  it('applique au joueur les règles du fil de l’auteur, sans consommer', () => {
    const attempt = createConstructionAttempt(createPlayerWiringLevel());

    expectRejected(
      playerConnect('button-1', 'conveyor-1').execute(attempt),
      'invalid-level-document',
    );
    expectRejected(
      playerConnect('conveyor-1', 'lever-1').execute(attempt),
      'invalid-level-document',
    );
    expectRejected(
      playerConnect('lever-1', 'conveyor-2').execute(attempt),
      'wire-already-connected',
    );
    expectRejected(
      playerConnect('lever-1', 'conveyor-1', 'inventory-wires', 'lever-1').execute(attempt),
      'identifier-already-used',
    );
  });

  it('ne pose jamais un fil comme un objet', () => {
    const attempt = createConstructionAttempt(createPlayerWiringLevel());

    expectRejected(
      placeFromInventory({
        context: 'player',
        inventoryEntryId: 'inventory-wires',
        placementId: 'wire-object',
        transform: { position: { x: 4, y: 5 }, rotation: 0 },
      }).execute(attempt),
      'inventory-entry-kind-mismatch',
    );
  });

  it('rend au joueur le fil qu’il délie, jamais un fil du niveau', () => {
    const initial = createConstructionAttempt(createPlayerWiringLevel());
    const connected = playerConnect('lever-1', 'conveyor-1').execute(initial);
    if (connected.status !== 'accepted') throw new Error('fil du joueur refusé');

    const unlinked = disconnectControlWire({ context: 'player', wireId: 'player-wire' }).execute(
      connected.state,
    );

    expect(unlinked).toEqual({ status: 'accepted', state: initial });
    expectRejected(
      disconnectControlWire({ context: 'player', wireId: 'level-wire' }).execute(connected.state),
      'inventory-provenance-missing',
    );
  });

  it('ne laisse pas délier un fil dont l’entrée interdit le retrait', () => {
    const initial = createConstructionAttempt(
      createPlayerWiringLevel({
        ...wireEntry,
        permissions: { move: false, rotate: false, remove: false },
      }),
    );
    const connected = playerConnect('lever-1', 'conveyor-1').execute(initial);
    if (connected.status !== 'accepted') throw new Error('fil du joueur refusé');

    expectRejected(
      disconnectControlWire({ context: 'player', wireId: 'player-wire' }).execute(connected.state),
      'remove-not-permitted',
    );
  });

  it('rend le fil quand le joueur retire l’objet qu’il reliait', () => {
    const level = createPlayerWiringLevel();
    const withLever: LevelDocument = {
      ...level,
      inventory: [
        ...level.inventory,
        {
          id: 'inventory-levers',
          type: 'lever',
          props: { position: 'center' },
          quantity: 1,
          permissions: { move: true, rotate: true, remove: true },
        },
      ],
    };
    const initial = createConstructionAttempt(withLever);
    const placed = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'inventory-levers',
      placementId: 'player-lever',
      transform: { position: { x: 3, y: 6 }, rotation: 0 },
    }).execute(initial);
    if (placed.status !== 'accepted') throw new Error('levier refusé');
    const connected = playerConnect('player-lever', 'conveyor-1').execute(placed.state);
    if (connected.status !== 'accepted') throw new Error('fil du joueur refusé');

    const removed = removePlacement({ context: 'player', placementId: 'player-lever' }).execute(
      connected.state,
    );

    expect(removed).toEqual({ status: 'accepted', state: initial });
  });

  it('garde valide un défi dont le seul objet est un fil, fil consommé', () => {
    const initial = createConstructionAttempt({
      ...createPlayerWiringLevel(),
      challenge: { elegantObjectCount: 2, minimalObjectCount: 2 },
    });

    expect(playerConnect('lever-1', 'conveyor-1').execute(initial).status).toBe('accepted');
  });
});
