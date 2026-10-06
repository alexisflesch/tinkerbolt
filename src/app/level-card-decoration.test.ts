import { describe, expect, it } from 'vitest';

import { levelCardDecoration } from './level-card-decoration';

describe('fixations et inclinaison des feuilles de niveaux', () => {
  it('varie aussi les fixations sur une petite série de créations aux identifiants voisins', () => {
    const kinds = Array.from(
      { length: 4 },
      (_, index) => levelCardDecoration(`creation-capture-${String(index)}`).kind,
    );
    expect(new Set(kinds).size).toBeGreaterThan(1);
  });

  it('varie les fixations, leurs positions et les deux dimensions du scotch avec une inclinaison discrète', () => {
    const decorations = Array.from({ length: 100 }, (_, i) =>
      levelCardDecoration(`niveau-${String(i)}`),
    );
    expect(new Set(decorations.map(({ kind }) => kind))).toEqual(new Set(['pin1', 'pin2', 'tape']));
    const tilts = decorations.map(({ style }) => Number.parseFloat(style['--card-tilt']));
    expect(tilts.some((tilt) => tilt < 0)).toBe(true);
    expect(tilts.some((tilt) => tilt > 0)).toBe(true);
    for (const { kind, style } of decorations) {
      expect(Math.abs(Number.parseFloat(style['--card-tilt']))).toBeLessThanOrEqual(0.8);
      const position = Number.parseFloat(style['--attachment-left']);
      expect(position).toBeGreaterThanOrEqual(kind === 'tape' ? 23 : 8);
      expect(position).toBeLessThanOrEqual(kind === 'tape' ? 70 : 88);
    }
    const tapes = decorations.filter(({ kind }) => kind === 'tape');
    expect(new Set(tapes.map(({ style }) => style['--attachment-width'])).size).toBeGreaterThan(1);
    expect(new Set(tapes.map(({ style }) => style['--attachment-height'])).size).toBeGreaterThan(1);
    expect(
      new Set(decorations.map(({ style }) => style['--attachment-angle'])).size,
    ).toBeGreaterThan(1);
  });

  it('est déterministe même entre deux appels séparés par un autre niveau', () => {
    const first = levelCardDecoration('tuto-1');
    levelCardDecoration('tuto-2');
    expect(levelCardDecoration('tuto-1')).toEqual(first);
    expect(levelCardDecoration('')).toEqual(levelCardDecoration(''));
  });
});
