import { describe, expect, it } from 'vitest';

import type { ProjectedWire } from './control-wires';
import { hitTestWires, wireRoutes } from './wire-hit-test';

const wire = (id: string, parts: Partial<ProjectedWire>): ProjectedWire => ({
  id,
  sourceId: 'lever',
  targetId: 'fan',
  label: 'A',
  circuitIndex: 0,
  from: { x: 0, y: 0 },
  to: { x: 4, y: 3 },
  ...parts,
});

describe('tracé et sélection des fils', () => {
  it('suit le coude d’un fil en deux tronçons, ou va droit sans coude', () => {
    expect(wireRoutes(wire('droit', { to: { x: 4, y: 0 } }))).toEqual([
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
    ]);
    expect(wireRoutes(wire('coude', { bend: { x: 4, y: 0 } }))).toEqual([
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
      ],
    ]);
  });

  it('suit les deux branches d’un fil passant par un minuteur', () => {
    const routes = wireRoutes(
      wire('minuteur', {
        segments: [
          { from: { x: 0, y: 0 }, to: { x: 2, y: 1 }, bend: { x: 2, y: 0 } },
          { from: { x: 3, y: 1 }, to: { x: 4, y: 3 } },
        ],
      }),
    );
    expect(routes).toHaveLength(2);
    expect(routes[0]).toHaveLength(3);
    expect(routes[1]).toHaveLength(2);
  });

  it('ne retient que les fils à portée, du plus proche au plus lointain', () => {
    const wires = [
      wire('loin', { from: { x: 0, y: 5 }, to: { x: 4, y: 5 } }),
      wire('proche', { from: { x: 0, y: 1 }, to: { x: 4, y: 1 } }),
      wire('voisin', { from: { x: 0, y: 1.1 }, to: { x: 4, y: 1.1 } }),
    ];

    expect(hitTestWires({ x: 2, y: 1.02 }, wires, 0.15)).toEqual(['proche', 'voisin']);
    expect(hitTestWires({ x: 2, y: 3 }, wires, 0.15)).toEqual([]);
    // Au-delà du bout du fil, la distance se mesure à son extrémité.
    expect(hitTestWires({ x: 4.1, y: 1 }, wires, 0.15)).toEqual(['proche', 'voisin']);
    expect(hitTestWires({ x: 4.5, y: 1 }, wires, 0.15)).toEqual([]);
  });

  it('touche un fil coudé sur sa branche verticale', () => {
    const bent = wire('coude', { bend: { x: 4, y: 0 } });

    expect(hitTestWires({ x: 4.05, y: 2 }, [bent], 0.15)).toEqual(['coude']);
    expect(hitTestWires({ x: 2, y: 2 }, [bent], 0.15)).toEqual([]);
  });
});
