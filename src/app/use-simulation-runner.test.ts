import { describe, expect, it } from 'vitest';

import {
  MAX_CATCH_UP_FIXED_STEPS_PER_FRAME,
  capElapsedSecondsForCatchUp,
  fixedStepSeconds,
  isWatchedRunOver,
} from './use-simulation-runner';

describe('capElapsedSecondsForCatchUp', () => {
  it('laisse passer un écart inférieur au plafond', () => {
    const threeStepsWorth = 3 * fixedStepSeconds;

    expect(capElapsedSecondsForCatchUp(threeStepsWorth, fixedStepSeconds)).toBe(threeStepsWorth);
  });

  it('plafonne un écart de plusieurs secondes (retour d’onglet) à 5 pas fixes', () => {
    // 5 secondes d'écart représenteraient 300 pas fixes à 60 Hz sans plafond.
    const fiveSecondGap = 5;

    const capped = capElapsedSecondsForCatchUp(fiveSecondGap, fixedStepSeconds);

    expect(capped).toBeCloseTo(MAX_CATCH_UP_FIXED_STEPS_PER_FRAME * fixedStepSeconds, 10);
    expect(Math.floor(capped / fixedStepSeconds)).toBe(MAX_CATCH_UP_FIXED_STEPS_PER_FRAME);
  });

  it('abandonne le reste de la durée plutôt que de le reporter', () => {
    // Ce n'est pas un tampon : l'appelant ne doit rien réaccumuler au-delà du
    // plafond, la durée en trop est perdue pour cette frame.
    const tenSecondGap = 10;

    expect(capElapsedSecondsForCatchUp(tenSecondGap, fixedStepSeconds)).toBe(
      capElapsedSecondsForCatchUp(5, fixedStepSeconds),
    );
  });

  it('accepte un plafond personnalisé', () => {
    expect(capElapsedSecondsForCatchUp(1, fixedStepSeconds, 2)).toBeCloseTo(
      2 * fixedStepSeconds,
      10,
    );
  });
});

describe('isWatchedRunOver (ADR 0020)', () => {
  const complete = { goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' } } as const;

  it('s’arrête au temps écoulé quand il n’y a pas d’objectif complet', () => {
    expect(isWatchedRunOver({}, true)).toBe(true);
    expect(isWatchedRunOver({ goal: { type: 'basket', ballId: 'ball-1' } }, true)).toBe(true);
  });

  it('continue tant que le temps n’est pas écoulé', () => {
    expect(isWatchedRunOver({}, false)).toBe(false);
  });

  it('laisse un objectif complet à l’évaluation de la victoire et de l’échec', () => {
    expect(isWatchedRunOver(complete, true)).toBe(false);
  });
});
