import { describe, expect, it } from 'vitest';

import source from '../../levels/demo-landing.json';
import remixSource from '../../levels/demo-landing-remix.json';
import { embeddedLevels } from '../content/embedded-levels';
import { homeLevel } from '../content/home-level';
import { levelDocumentSchema } from '../domain/level-document';
import { projectLevel } from '../presentation/board-renderer';
import { createSimulationSession } from '../simulation/simulation-session';
import { createHomeScene } from './home-hero';

const level = levelDocumentSchema.parse(source);

describe('machine animée de l’accueil', () => {
  it('embarque le remix auteur avec le convoyeur retourné, sans objectif ni solution à poser', () => {
    const remix = levelDocumentSchema.parse(remixSource);

    expect(homeLevel).toEqual(remix);
    expect(homeLevel.goal).toBeUndefined();
    expect(homeLevel.solution).toBeUndefined();
    const scene = createHomeScene(homeLevel);
    expect(scene.objects).toEqual(remix.objects);
    expect(scene.wires).toEqual(remix.wires);
    expect(scene.objects.find(({ type }) => type === 'conveyor')).toMatchObject({
      transform: { rotation: Math.PI },
      props: { direction: 'left' },
    });
    expect(scene.objects.filter(({ type }) => type === 'ball')).toHaveLength(2);
  });

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

  it.each([
    { version: 'original au sens périphérique adapté', document: level },
    { version: 'remix', document: homeLevel },
  ])(
    'fait tourner les deux pistons du $version au-delà de vingt secondes, sans résultat de partie',
    ({ document }) => {
      const scene = createHomeScene(document);
      if (document === level) {
        // The retired original used the underside moving in the same direction
        // as the top. Reverse this test fixture to retain its actuator scenario
        // under the peripheral contract, without editing the author source.
        const conveyor = scene.objects.find(({ type }) => type === 'conveyor');
        if (conveyor?.type !== 'conveyor') throw new Error('Convoyeur absent');
        conveyor.props.direction = 'left';
      }
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
    },
  );
});
