import { describe, expect, it } from 'vitest';

import { wiringGuide, wiringTap, type WiringStep } from './use-wiring-tool';

const objects = [
  { id: 'lever-1', type: 'lever' },
  { id: 'button-1', type: 'button' },
  { id: 'conveyor-1', type: 'conveyor' },
  { id: 'fan-1', type: 'fan' },
  { id: 'timer-1', type: 'timer' },
  { id: 'ball-1', type: 'ball' },
] as const;

const firstStep: WiringStep = { kind: 'first' };
const fromSource = (firstId: string): WiringStep => ({ kind: 'second', firstId, first: 'source' });
const fromTarget = (firstId: string): WiringStep => ({ kind: 'second', firstId, first: 'target' });

describe('outil fil : une commande et un appareil, dans n’importe quel ordre (U15)', () => {
  it('guide chaque étape, et le geste s’annule toujours par « Annuler le fil »', () => {
    expect(wiringGuide(firstStep)).toEqual({
      prompt: 'Choisis une commande ou l’appareil à relier',
      exitLabel: 'Annuler le fil',
    });
    expect(wiringGuide(fromSource('lever-1'))).toEqual({
      prompt: 'Choisis le minuteur ou l’appareil à commander',
      exitLabel: 'Annuler le fil',
    });
    expect(wiringGuide(fromTarget('fan-1'))).toEqual({
      prompt: 'Choisis le levier ou le bouton qui le commande',
      exitLabel: 'Annuler le fil',
    });
  });

  it('insère le minuteur après le contrôleur puis termine le fil sur un appareil', () => {
    const withTimer: WiringStep = {
      kind: 'device-after-timer',
      sourceId: 'button-1',
      timerId: 'timer-1',
    };

    expect(wiringTap(fromSource('button-1'), objects, 'timer-1')).toEqual({
      kind: 'next',
      step: withTimer,
    });
    expect(wiringGuide(withTimer)).toEqual({
      prompt: 'Choisis l’appareil à commander',
      exitLabel: 'Annuler le fil',
    });
    expect(wiringTap(withTimer, objects, 'fan-1')).toEqual({
      kind: 'connect',
      sourceId: 'button-1',
      timerId: 'timer-1',
      targetId: 'fan-1',
    });
  });

  it('refuse le minuteur comme départ ou appareil final, et reprend si le minuteur disparaît', () => {
    const throughTimer: WiringStep = {
      kind: 'device-after-timer',
      sourceId: 'button-1',
      timerId: 'timer-1',
    };

    expect(wiringTap(firstStep, objects, 'timer-1').kind).toBe('refused');
    expect(wiringTap(throughTimer, objects, 'timer-1')).toMatchObject({ kind: 'refused' });
    expect(
      wiringTap(
        throughTimer,
        objects.filter(({ id }) => id !== 'timer-1'),
        'fan-1',
      ),
    ).toEqual({
      kind: 'next',
      step: fromSource('button-1'),
    });
  });

  it('commence par une commande ou par un appareil', () => {
    expect(wiringTap(firstStep, objects, 'lever-1')).toEqual({
      kind: 'next',
      step: fromSource('lever-1'),
    });
    expect(wiringTap(firstStep, objects, 'button-1')).toEqual({
      kind: 'next',
      step: fromSource('button-1'),
    });
    expect(wiringTap(firstStep, objects, 'fan-1')).toEqual({
      kind: 'next',
      step: fromTarget('fan-1'),
    });
  });

  it('refuse d’abord un objet qu’un fil ne relie jamais', () => {
    for (const placementId of ['ball-1', 'absent']) {
      expect(wiringTap(firstStep, objects, placementId)).toEqual({
        kind: 'refused',
        message:
          'Un fil relie un levier ou un bouton à un convoyeur, un ventilateur, une barrière, un électroaimant ou un piston.',
      });
    }
  });

  it('relie la commande à l’appareil, quel que soit celui touché en premier', () => {
    expect(wiringTap(fromSource('lever-1'), objects, 'conveyor-1')).toEqual({
      kind: 'connect',
      sourceId: 'lever-1',
      targetId: 'conveyor-1',
    });
    expect(wiringTap(fromTarget('fan-1'), objects, 'button-1')).toEqual({
      kind: 'connect',
      sourceId: 'button-1',
      targetId: 'fan-1',
    });
  });

  it('refuse un second objet qui ne complète pas le fil, avec la règle du domaine', () => {
    expect(wiringTap(fromSource('lever-1'), objects, 'ball-1')).toEqual({
      kind: 'refused',
      message:
        'Un fil doit arriver sur un convoyeur, un ventilateur, une barrière, un électroaimant ou un piston placés.',
    });
    expect(wiringTap(fromSource('button-1'), objects, 'conveyor-1')).toEqual({
      kind: 'refused',
      message: 'Un bouton ne commande pas de convoyeur : seul un levier en donne le sens.',
    });
    expect(wiringTap(fromTarget('conveyor-1'), objects, 'button-1')).toEqual({
      kind: 'refused',
      message: 'Un bouton ne commande pas de convoyeur : seul un levier en donne le sens.',
    });
    expect(wiringTap(fromTarget('fan-1'), objects, 'conveyor-1')).toEqual({
      kind: 'refused',
      message: 'Un fil doit partir d’un levier ou d’un bouton placé.',
    });
  });

  it('recommence le geste si le premier objet a disparu', () => {
    expect(wiringTap(fromSource('absent'), objects, 'fan-1')).toEqual({
      kind: 'next',
      step: firstStep,
    });
    expect(wiringTap(fromTarget('absent'), objects, 'lever-1')).toEqual({
      kind: 'next',
      step: firstStep,
    });
  });
});
