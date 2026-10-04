import { describe, expect, it } from 'vitest';

import type { LevelDocument } from '../../domain/level-document';
import { createConstructionAttempt, movePlacement, placeFromInventory } from '../construction';
import {
  beginEditorManipulation,
  cancelEditorManipulation,
  commitEditorManipulation,
  completeSimulation,
  createEditorSession,
  currentEditorAttempt,
  executeEditorCommand,
  pauseSimulation,
  previewEditorManipulation,
  previewInvalidEditorManipulation,
  redoEditorCommand,
  resetSimulation,
  resumeSimulation,
  selectEditorPlacement,
  startSimulation,
  undoEditorCommand,
  type EditorSession,
} from './index';

const permissions = { move: true, rotate: false, remove: false } as const;

const createLevel = (): LevelDocument => ({
  schemaVersion: 3,
  id: 'editor-session-test',
  metadata: { title: 'Editor session test' },
  objects: [
    {
      id: 'goal-ball',
      type: 'ball',
      props: {},
      transform: { position: { x: 1, y: 8 }, rotation: 0 },
      permissions,
    },
    {
      id: 'goal-basket',
      type: 'basket',
      props: {},
      transform: { position: { x: 8, y: 1 }, rotation: 0 },
      permissions,
    },
    {
      id: 'movable-beam',
      type: 'beam',
      props: { size: 'medium' },
      transform: { position: { x: 2, y: 2 }, rotation: 0 },
      permissions: { move: true, rotate: true, remove: false },
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
  ],
  goal: { type: 'basket', ballId: 'goal-ball', basketId: 'goal-basket' },
  buildZones: [{ min: { x: 0, y: 0 }, max: { x: 10, y: 10 } }],
  scene: { min: { x: -5, y: -5 }, max: { x: 15, y: 15 } },
  wires: [],
});

const createSession = (): EditorSession =>
  createEditorSession('resolution', createConstructionAttempt(createLevel()));

const moveBeamTo = (x: number, y = 2) =>
  movePlacement({
    context: 'player',
    placementId: 'movable-beam',
    position: { x, y },
  });

const placeBeamAt = (x = 4) =>
  placeFromInventory({
    context: 'player',
    inventoryEntryId: 'short-beams',
    placementId: 'placed-beam',
    transform: { position: { x, y: 4 }, rotation: 0 },
  });

const placeBeam = () => placeBeamAt();

const beamPosition = (session: EditorSession) =>
  currentEditorAttempt(session).document.objects.find(({ id }) => id === 'movable-beam')?.transform
    .position;

describe('EditorSession', () => {
  it('coordonne la tentative, le mode, la sélection et un historique initial vide', () => {
    const attempt = createConstructionAttempt(createLevel());

    const session = createEditorSession('resolution', attempt);
    const selected = selectEditorPlacement(session, 'movable-beam');

    expect(session).toMatchObject({
      mode: 'resolution',
      phase: 'construction',
      selectedPlacementId: null,
      manipulation: null,
      simulationSnapshot: null,
    });
    expect(session.history.state).toBe(attempt);
    expect(session.history.past).toHaveLength(0);
    expect(selected.selectedPlacementId).toBe('movable-beam');
    expect(selected.history).toBe(session.history);
    expect(selectEditorPlacement(selected, 'missing').selectedPlacementId).toBeNull();
  });

  it('exécute chaque commande atomique existante via l’historique', () => {
    const initial = createSession();

    const moved = executeEditorCommand(initial, moveBeamTo(5));

    expect(moved.status).toBe('accepted');
    if (moved.status !== 'accepted') return;
    expect(moved.recorded).toBe(true);
    expect(beamPosition(moved.session)).toEqual({ x: 5, y: 2 });
    expect(moved.session.history.past).toHaveLength(1);
    expect(beamPosition(initial)).toEqual({ x: 2, y: 2 });
  });

  it('groupe toutes les prévisualisations d’une manipulation dans un commit unique', () => {
    const initial = createSession();
    const begun = beginEditorManipulation(initial, {
      kind: 'move',
      placementId: 'movable-beam',
    });
    expect(begun.status).toBe('accepted');
    if (begun.status !== 'accepted') return;

    const first = previewEditorManipulation(begun.session, moveBeamTo(4));
    expect(first.status).toBe('accepted');
    if (first.status !== 'accepted') return;
    const second = previewEditorManipulation(first.session, moveBeamTo(7));
    expect(second.status).toBe('accepted');
    if (second.status !== 'accepted') return;

    expect(beamPosition(second.session)).toEqual({ x: 7, y: 2 });
    expect(second.session.history.state.document.objects[2]?.transform.position).toEqual({
      x: 2,
      y: 2,
    });
    expect(second.session.history.past).toHaveLength(0);

    const committed = commitEditorManipulation(second.session);
    expect(committed.status).toBe('accepted');
    if (committed.status !== 'accepted') return;
    expect(committed.recorded).toBe(true);
    expect(committed.session.manipulation).toBeNull();
    expect(committed.session.history.past).toHaveLength(1);
    expect(beamPosition(committed.session)).toEqual({ x: 7, y: 2 });
  });

  it('reprojette un placement depuis la base puis sélectionne l’objet au commit', () => {
    const initial = createSession();
    const begun = beginEditorManipulation(initial, {
      kind: 'placement',
      placementId: 'placed-beam',
    });
    if (begun.status !== 'accepted') throw new Error('placement should begin');
    const first = previewEditorManipulation(begun.session, placeBeamAt(3));
    if (first.status !== 'accepted') throw new Error('first preview should be accepted');
    const second = previewEditorManipulation(first.session, placeBeamAt(7));
    if (second.status !== 'accepted') throw new Error('second preview should be accepted');

    expect(
      currentEditorAttempt(second.session).document.objects.find(({ id }) => id === 'placed-beam')
        ?.transform.position,
    ).toEqual({ x: 7, y: 4 });
    expect(second.session.history.state.document.inventory[0]?.quantity).toBe(1);

    const committed = commitEditorManipulation(second.session);
    expect(committed.status).toBe('accepted');
    if (committed.status !== 'accepted') return;
    expect(committed.session.selectedPlacementId).toBe('placed-beam');
    expect(committed.session.history.state.document.inventory[0]?.quantity).toBe(0);
    expect(committed.session.history.past).toHaveLength(1);
  });

  it('ne crée pas d’entrée si la projection finale revient à l’état de départ', () => {
    const begun = beginEditorManipulation(createSession(), {
      kind: 'move',
      placementId: 'movable-beam',
    });
    if (begun.status !== 'accepted') throw new Error('manipulation should begin');
    const moved = previewEditorManipulation(begun.session, moveBeamTo(6));
    if (moved.status !== 'accepted') throw new Error('preview should be accepted');
    const returned = previewEditorManipulation(moved.session, moveBeamTo(2));
    if (returned.status !== 'accepted') throw new Error('return preview should be accepted');

    const committed = commitEditorManipulation(returned.session);

    expect(committed.status).toBe('accepted');
    if (committed.status !== 'accepted') return;
    expect(committed.recorded).toBe(false);
    expect(committed.session.history.past).toHaveLength(0);
    expect(beamPosition(committed.session)).toEqual({ x: 2, y: 2 });
  });

  it('annule complètement une projection sans modifier l’historique', () => {
    const initial = createSession();
    const begun = beginEditorManipulation(initial, {
      kind: 'move',
      placementId: 'movable-beam',
    });
    if (begun.status !== 'accepted') throw new Error('manipulation should begin');
    const previewed = previewEditorManipulation(begun.session, moveBeamTo(6));
    if (previewed.status !== 'accepted') throw new Error('preview should be accepted');

    const cancelled = cancelEditorManipulation(previewed.session);

    expect(cancelled.status).toBe('accepted');
    if (cancelled.status !== 'accepted') return;
    expect(cancelled.session.history).toBe(initial.history);
    expect(cancelled.session.manipulation).toBeNull();
    expect(beamPosition(cancelled.session)).toEqual({ x: 2, y: 2 });
    expect(cancelled.session.history.past).toHaveLength(0);
  });

  it('conserve la dernière projection valide après un aperçu refusé', () => {
    const initial = createSession();
    const begun = beginEditorManipulation(initial, {
      kind: 'move',
      placementId: 'movable-beam',
    });
    if (begun.status !== 'accepted') throw new Error('manipulation should begin');
    const valid = previewEditorManipulation(begun.session, moveBeamTo(6));
    if (valid.status !== 'accepted') throw new Error('preview should be accepted');

    const rejected = previewEditorManipulation(valid.session, moveBeamTo(12));

    expect(rejected).toMatchObject({ status: 'rejected', reason: 'outside-build-zone' });
    expect(rejected.session).toBe(valid.session);
    expect(beamPosition(rejected.session)).toEqual({ x: 6, y: 2 });
    expect(rejected.session.history.past).toHaveLength(0);
  });

  it('montre une projection invalide sous le doigt sans pouvoir la valider', () => {
    const begun = beginEditorManipulation(createSession(), {
      kind: 'move',
      placementId: 'movable-beam',
    });
    if (begun.status !== 'accepted') throw new Error('manipulation should begin');
    const valid = previewEditorManipulation(begun.session, moveBeamTo(6));
    if (valid.status !== 'accepted') throw new Error('preview should be accepted');

    const invalid = previewInvalidEditorManipulation(
      valid.session,
      movePlacement({ context: 'author', placementId: 'movable-beam', position: { x: 12, y: 2 } }),
      'outside-build-zone',
    );

    expect(invalid.status).toBe('accepted');
    expect(beamPosition(invalid.session)).toEqual({ x: 12, y: 2 });
    expect(invalid.session.manipulation?.invalidReason).toBe('outside-build-zone');
    const commit = commitEditorManipulation(invalid.session);
    expect(commit).toMatchObject({ status: 'rejected', reason: 'outside-build-zone' });
    expect(commit.session.history.past).toHaveLength(0);

    const back = previewEditorManipulation(invalid.session, moveBeamTo(7));
    if (back.status !== 'accepted') throw new Error('preview should be accepted');
    expect(back.session.manipulation?.invalidReason).toBeNull();
    const committed = commitEditorManipulation(back.session);
    expect(committed.status).toBe('accepted');
    expect(beamPosition(committed.session)).toEqual({ x: 7, y: 2 });
  });

  it('annule la projection précédente lorsqu’une autre manipulation commence', () => {
    const initial = createSession();
    const begun = beginEditorManipulation(initial, {
      kind: 'move',
      placementId: 'movable-beam',
    });
    if (begun.status !== 'accepted') throw new Error('manipulation should begin');
    const previewed = previewEditorManipulation(begun.session, moveBeamTo(6));
    if (previewed.status !== 'accepted') throw new Error('preview should be accepted');

    const replaced = beginEditorManipulation(previewed.session, {
      kind: 'rotation',
      placementId: 'movable-beam',
    });

    expect(replaced.status).toBe('accepted');
    if (replaced.status !== 'accepted') return;
    expect(beamPosition(replaced.session)).toEqual({ x: 2, y: 2 });
    expect(replaced.session.history).toBe(initial.history);
    expect(replaced.session.manipulation?.kind).toBe('rotation');
  });

  it('undo et redo restaurent ensemble document, inventaire et provenance', () => {
    const placed = executeEditorCommand(createSession(), placeBeam());
    if (placed.status !== 'accepted') throw new Error('placement should be accepted');
    expect(placed.session.history.state.provenance).toEqual({
      'placed-beam': 'short-beams',
    });
    expect(placed.session.history.state.document.inventory[0]?.quantity).toBe(0);

    const undone = undoEditorCommand(placed.session);
    expect(undone.status).toBe('accepted');
    if (undone.status !== 'accepted') return;
    expect(undone.session.history.state.provenance).toEqual({});
    expect(undone.session.history.state.document.inventory[0]?.quantity).toBe(1);

    const redone = redoEditorCommand(undone.session);
    expect(redone.status).toBe('accepted');
    if (redone.status !== 'accepted') return;
    expect(redone.session.history.state.provenance).toEqual({
      'placed-beam': 'short-beams',
    });
    expect(redone.session.history.state.document.inventory[0]?.quantity).toBe(0);
  });

  it('lance la simulation depuis le snapshot de construction et annule la projection active', () => {
    const selected = selectEditorPlacement(createSession(), 'movable-beam');
    const begun = beginEditorManipulation(selected, {
      kind: 'move',
      placementId: 'movable-beam',
    });
    if (begun.status !== 'accepted') throw new Error('manipulation should begin');
    const previewed = previewEditorManipulation(begun.session, moveBeamTo(6));
    if (previewed.status !== 'accepted') throw new Error('preview should be accepted');

    const launched = startSimulation(previewed.session);

    expect(launched.status).toBe('accepted');
    if (launched.status !== 'accepted') return;
    expect(launched.session.phase).toBe('running');
    expect(launched.session.manipulation).toBeNull();
    expect(launched.session.selectedPlacementId).toBe('movable-beam');
    expect(launched.session.simulationSnapshot).toBe(selected.history.state);
    expect(beamPosition(launched.session)).toEqual({ x: 2, y: 2 });
  });

  it('interdit toute mutation de tentative et toute navigation d’historique en simulation', () => {
    const launched = startSimulation(createSession());
    if (launched.status !== 'accepted') throw new Error('simulation should start');

    expect(executeEditorCommand(launched.session, moveBeamTo(5))).toMatchObject({
      status: 'rejected',
      reason: 'editing-unavailable-during-simulation',
      session: launched.session,
    });
    expect(
      beginEditorManipulation(launched.session, {
        kind: 'move',
        placementId: 'movable-beam',
      }),
    ).toMatchObject({
      status: 'rejected',
      reason: 'editing-unavailable-during-simulation',
    });
    expect(undoEditorCommand(launched.session)).toMatchObject({
      status: 'rejected',
      reason: 'editing-unavailable-during-simulation',
    });

    const paused = pauseSimulation(launched.session);
    if (paused.status !== 'accepted') throw new Error('simulation should pause');
    expect(executeEditorCommand(paused.session, moveBeamTo(5))).toMatchObject({
      status: 'rejected',
      reason: 'editing-unavailable-during-simulation',
    });
  });

  it('applique l’automate running, paused, result puis restaure exactement la construction', () => {
    const placed = executeEditorCommand(createSession(), placeBeam());
    if (placed.status !== 'accepted') throw new Error('placement should be accepted');
    const constructionHistory = placed.session.history;
    const launched = startSimulation(placed.session);
    if (launched.status !== 'accepted') throw new Error('simulation should start');
    const paused = pauseSimulation(launched.session);
    if (paused.status !== 'accepted') throw new Error('simulation should pause');
    const resumed = resumeSimulation(paused.session);
    if (resumed.status !== 'accepted') throw new Error('simulation should resume');
    const completed = completeSimulation(resumed.session);
    if (completed.status !== 'accepted') throw new Error('simulation should complete');

    expect(paused.session.phase).toBe('paused');
    expect(resumed.session.phase).toBe('running');
    expect(completed.session.phase).toBe('result');

    const reset = resetSimulation(completed.session);
    expect(reset.status).toBe('accepted');
    if (reset.status !== 'accepted') return;
    expect(reset.session.phase).toBe('construction');
    expect(reset.session.history).toBe(constructionHistory);
    expect(reset.session.simulationSnapshot).toBeNull();
    expect(reset.session.history.state.provenance).toEqual({
      'placed-beam': 'short-beams',
    });
    expect(reset.session.history.state.document.inventory[0]?.quantity).toBe(0);
  });

  it('refuse les transitions de phase hors de l’automate', () => {
    const construction = createSession();

    expect(pauseSimulation(construction)).toMatchObject({
      status: 'rejected',
      reason: 'invalid-phase-transition',
      session: construction,
    });
    expect(resetSimulation(construction)).toMatchObject({
      status: 'rejected',
      reason: 'invalid-phase-transition',
      session: construction,
    });
  });
});
