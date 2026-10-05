import { useSyncExternalStore } from 'react';

function subscribeToViewport(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
}

function getNarrowPortraitSnapshot() {
  if (typeof window === 'undefined') return false;

  // Kept in sync with the « téléphone en portrait » media query of the board screens.
  return window.innerWidth < 700 && window.innerHeight > window.innerWidth;
}

/**
 * True on a phone held upright: the board's bar then has room for the history,
 * the framing and « Lancer » only, and the level's own actions go to the header.
 */
export function useIsNarrowPortrait(): boolean {
  return useSyncExternalStore(subscribeToViewport, getNarrowPortraitSnapshot, () => false);
}
