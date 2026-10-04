import { describe, expect, it } from 'vitest';

import { createConstructionAttempt } from '../application/construction';
import {
  startSimulation,
  createEditorSession,
  type EditorSession,
} from '../application/editor-session';
import type { LevelDocument } from '../domain/level-document';
import { highlightedBuildZones } from './build-zone-highlight';

const locked = { move: false, rotate: false, remove: false } as const;

const leftZone = { min: { x: 0, y: 1.5 }, max: { x: 3, y: 5.5 } } as const;
const rightZone = { min: { x: 5, y: 1.5 }, max: { x: 8, y: 5.5 } } as const;
const sceneZone = { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } } as const;

const level = (buildZones: LevelDocument['buildZones']): LevelDocument => ({
  schemaVersion: 3,
  id: 'zones',
  metadata: { title: 'Zones de construction' },
  objects: [
    {
      id: 'ball',
      type: 'ball',
      props: {},
      transform: { position: { x: 1, y: 1 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'basket',
      type: 'basket',
      props: {},
      transform: { position: { x: 7, y: 1 }, rotation: 0 },
      permissions: locked,
    },
  ],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
  buildZones,
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  wires: [],
});

const session = (
  mode: EditorSession['mode'],
  buildZones: LevelDocument['buildZones'],
): EditorSession => createEditorSession(mode, createConstructionAttempt(level(buildZones)));

describe('highlightedBuildZones (U13)', () => {
  it('montre au joueur qui construit chaque zone qui restreint la pose, même plusieurs', () => {
    expect(highlightedBuildZones(session('resolution', [leftZone]))).toEqual([leftZone]);
    expect(highlightedBuildZones(session('resolution', [leftZone, rightZone]))).toEqual([
      leftZone,
      rightZone,
    ]);
  });

  it('ne montre rien quand une zone couvre toute la scène : la pose n’est pas restreinte', () => {
    expect(highlightedBuildZones(session('resolution', [sceneZone]))).toEqual([]);
    expect(highlightedBuildZones(session('resolution', [leftZone, sceneZone]))).toEqual([]);
  });

  it('ne montre rien à l’auteur, que les zones ne restreignent pas', () => {
    expect(highlightedBuildZones(session('creation', [leftZone]))).toEqual([]);
  });

  it('efface les zones pendant la simulation', () => {
    const launched = startSimulation(session('resolution', [leftZone]));
    if (launched.status !== 'accepted') throw new Error('La simulation devait démarrer.');

    expect(highlightedBuildZones(launched.session)).toEqual([]);
  });
});
