// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { embeddedLevels } from '../content/embedded-levels';
import { frameLevel } from '../presentation/level-framing';
import { App } from './App';
import { renderStorageReady, storageAction, testProgressRepository } from './storage-test-fixture';

const tutorial = embeddedLevels[0];
if (tutorial === undefined) throw new Error('Premier tutoriel absent.');
const level = tutorial;

const canvas = () => screen.getByRole('img', { name: 'Rendu du plateau' });
const zoom = (): number => Number(canvas().getAttribute('data-camera-zoom'));
const originX = (): number =>
  Number((canvas().getAttribute('data-camera-origin') ?? '').split(',')[0]);

describe('cadrage à l’ouverture (ADR 0007, amendement du 5 octobre)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 450,
      width: 800,
      height: 450,
      toJSON() {
        return this;
      },
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ouvre un niveau cadré sur sa machine plutôt que sur toute la scène, et y revient avec « Ajuster »', async () => {
    window.history.replaceState(null, '', `/levels/${level.id}/play`);
    await renderStorageReady(<App progressRepository={testProgressRepository()} />);
    const framing = frameLevel(level);
    // Canvas simulé 800 × 450, marge de 4 % : la scène 16 × 9 entière donnerait 48 px/unité.
    const framedZoom =
      Math.min(800 / (framing.max.x - framing.min.x), 450 / (framing.max.y - framing.min.y)) * 0.96;
    expect(framedZoom).toBeGreaterThan(48);

    await waitFor(() => {
      expect(zoom()).toBeCloseTo(framedZoom);
    });
    expect(originX() + 400 / framedZoom).toBeCloseTo((framing.min.x + framing.max.x) / 2);

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Zoom arrière' })),
    );
    await waitFor(() => {
      expect(zoom()).toBeLessThan(framedZoom);
    });
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Ajuster à la scène' })),
    );
    await waitFor(() => {
      expect(zoom()).toBeCloseTo(framedZoom);
    });
  });

  it('garde toute la scène dans l’atelier, où l’auteur construit', async () => {
    window.history.replaceState(null, '', '/editor');
    await renderStorageReady(<App progressRepository={testProgressRepository()} />);

    await waitFor(() => {
      expect(zoom()).toBe(48);
    });
  });
});
