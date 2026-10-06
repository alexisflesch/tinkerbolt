import { describe, expect, it } from 'vitest';

import source from '../../levels/demo-landing.json';
import { embeddedLevels } from '../content/embedded-levels';
import { levelDocumentSchema } from '../domain/level-document';
import { projectLevel } from '../presentation/board-renderer';
import { createSimulationSession } from '../simulation/simulation-session';
import { createHomeScene } from './home-hero';

const level = levelDocumentSchema.parse(source);

describe('machine animée de l’accueil', () => {
  it('retire l’objectif et la bascule, pose les deux balles bleues et conserve les branchements', () => {
    const before = structuredClone(level);
    const scene = createHomeScene(level);

    expect(
      scene.objects.some(({ id }) => id === level.goal?.ballId || id === level.goal?.basketId),
    ).toBe(false);
    expect(scene.objects.some(({ type }) => type === 'seesaw' || type === 'basket')).toBe(false);
    expect(scene.objects.filter(({ type }) => type === 'ball')).toHaveLength(2);
    expect(scene.objects.find(({ id }) => id === 'ball-a-placer')?.transform).toEqual(
      level.solution?.placements[0]?.transform,
    );
    expect(scene.objects.some(({ toPlace }) => toPlace === true)).toBe(false);
    expect(scene.wires).toEqual(level.wires);
    expect(scene.goal).toBeUndefined();
    expect(level).toEqual(before);
    expect(embeddedLevels).toHaveLength(7);
    expect(embeddedLevels.some(({ id }) => id === level.id)).toBe(false);
    expect(
      projectLevel(scene)
        .objects.filter(({ family }) => family === 'ball')
        .every(({ assetKey }) => assetKey.startsWith('second-ball-')),
    ).toBe(true);
  });

  it('fait tourner les deux pistons au-delà de vingt secondes, sans résultat de partie', () => {
    const scene = createHomeScene(level);
    const before = structuredClone(scene);
    const session = createSimulationSession(scene, { fixedStepSeconds: 1 / 60 });
    const active = new Set<string>();
    const initial = session.readState();
    try {
      for (let step = 0; step < 1800; step += 1) {
        session.advanceFixedSteps(1);
        for (const device of session.readState().devices) {
          if (device.kind === 'piston' && device.extension > 0.5) active.add(device.placementId);
        }
      }
      expect([...active].sort()).toEqual(['placement-1', 'placement-6']);
      expect(session.readState().fixedStep).toBe(1800);
      expect(session.readGoalEvaluation().status).toBe('pending');
      expect(session.readFailureEvaluation().status).toBe('pending');
      expect(scene).toEqual(before);
      session.reset();
      expect(session.readState()).toEqual(initial);
    } finally {
      session.destroy();
    }
  });
});
