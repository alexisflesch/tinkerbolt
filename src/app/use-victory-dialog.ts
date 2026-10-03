import { useEffect, useState } from 'react';

/** U4b: time left to watch the ball settle in the basket before the dialog covers the scene. */
const VICTORY_DIALOG_DELAY_MILLISECONDS = 600;

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Opens the victory dialog a short moment after a victory, with a React
 * timer: the simulation is untouched. Under `prefers-reduced-motion` the
 * dialog opens at once, without its entrance animation (`styles.css`).
 * Result actions become available with the dialog and stay available when
 * the player closes it to watch the scene.
 * The dialog closes when the victory ends (next launch, « Recommencer »).
 */
export function useVictoryDialog(hasVictory: boolean): {
  readonly isOpen: boolean;
  readonly areActionsAvailable: boolean;
  readonly open: () => void;
  readonly close: () => void;
} {
  const [presentation, setPresentation] = useState({ isOpen: false, areActionsAvailable: false });

  useEffect(() => {
    if (!hasVictory) return undefined;
    const delay = prefersReducedMotion() ? 0 : VICTORY_DIALOG_DELAY_MILLISECONDS;
    const timer = window.setTimeout(() => {
      setPresentation({ isOpen: true, areActionsAvailable: true });
    }, delay);
    return () => {
      window.clearTimeout(timer);
      setPresentation({ isOpen: false, areActionsAvailable: false });
    };
  }, [hasVictory]);

  return {
    isOpen: hasVictory && presentation.isOpen,
    areActionsAvailable: hasVictory && presentation.areActionsAvailable,
    open: () => {
      setPresentation((current) => ({ ...current, isOpen: true }));
    },
    close: () => {
      setPresentation((current) => ({ ...current, isOpen: false }));
    },
  };
}
