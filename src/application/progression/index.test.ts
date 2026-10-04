import { describe, expect, it } from 'vitest';

import type { ConstructionAttempt } from '../construction';
import { connectControlWire, createConstructionAttempt, placeFromInventory } from '../construction';
import type { LevelDocument } from '../../domain/level-document';
import {
  countObjectsUsed,
  evaluateTier,
  isLevelUnlocked,
  nextChallengeHint,
  recordSuccess,
  type CampaignProgress,
  type Challenge,
} from './index';

const fixed = { move: false, rotate: false, remove: false } as const;
const movableBeam = { move: true, rotate: true, remove: true } as const;
const movableMass = { move: true, rotate: false, remove: true } as const;

const createLevel = (): LevelDocument => ({
  schemaVersion: 3,
  id: 'progression-test',
  metadata: { title: 'Progression test' },
  objects: [
    {
      id: 'ball-1',
      type: 'ball',
      props: {},
      transform: { position: { x: 1, y: 1 }, rotation: 0 },
      permissions: fixed,
    },
    {
      id: 'basket-1',
      type: 'basket',
      props: {},
      transform: { position: { x: 7, y: 4 }, rotation: 0 },
      permissions: fixed,
    },
    {
      id: 'fixed-beam',
      type: 'beam',
      props: { size: 'medium' },
      transform: { position: { x: 4, y: 3 }, rotation: 0 },
      permissions: fixed,
    },
  ],
  inventory: [
    {
      id: 'inventory-short-beam',
      type: 'beam',
      props: { size: 'short' },
      quantity: 2,
      permissions: movableBeam,
    },
    {
      id: 'inventory-mass',
      type: 'mass',
      props: { weight: '10kg' },
      quantity: 1,
      permissions: movableMass,
    },
  ],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [{ min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } }],
  wires: [],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
});

const placeInventoryObject = (
  attempt: ConstructionAttempt,
  inventoryEntryId: string,
  placementId: string,
) => {
  const result = placeFromInventory({
    context: 'player',
    inventoryEntryId,
    placementId,
    transform: { position: { x: 2, y: 2 }, rotation: 0 },
  }).execute(attempt);
  if (result.status === 'rejected') throw new Error(`La pose a été refusée : ${result.reason}`);
  return result.state;
};

const challenge: Challenge = { elegantObjectCount: 4, minimalObjectCount: 2 };
const campaign = [
  { levels: [{ id: 'level-1' }, { id: 'level-2' }] },
  { levels: [{ id: 'level-3' }, { id: 'level-4' }] },
] as const;

const emptyProgress: CampaignProgress = {};

describe('progression de campagne', () => {
  describe('countObjectsUsed', () => {
    it('ne compte pas les objets du niveau sans provenance d’inventaire', () => {
      expect(countObjectsUsed(createConstructionAttempt(createLevel()))).toBe(0);
    });

    it('compte chaque placement vivant issu de l’inventaire, pas les objets fixes', () => {
      const initial = createConstructionAttempt(createLevel());
      const withBeam = placeInventoryObject(initial, 'inventory-short-beam', 'placed-beam-1');
      const withTwoBeams = placeInventoryObject(withBeam, 'inventory-short-beam', 'placed-beam-2');
      const withMass = placeInventoryObject(withTwoBeams, 'inventory-mass', 'placed-mass');

      expect(countObjectsUsed(withMass)).toBe(3);
    });

    it('compte un fil posé par le joueur comme un objet, pas un fil du niveau (U21)', () => {
      const level = createLevel();
      const initial = createConstructionAttempt({
        ...level,
        objects: [
          ...level.objects,
          {
            id: 'lever-1',
            type: 'lever',
            props: { position: 'center' },
            transform: { position: { x: 2, y: 4 }, rotation: 0 },
            permissions: fixed,
          },
          {
            id: 'conveyor-1',
            type: 'conveyor',
            props: { direction: 'stopped' },
            transform: { position: { x: 5, y: 4 }, rotation: 0 },
            permissions: fixed,
          },
          {
            id: 'fan-1',
            type: 'fan',
            props: { state: 'off' },
            transform: { position: { x: 6, y: 1 }, rotation: 0 },
            permissions: fixed,
          },
        ],
        inventory: [
          ...level.inventory,
          {
            id: 'inventory-wire',
            type: 'wire',
            props: {},
            quantity: 1,
            permissions: { move: false, rotate: false, remove: true },
          },
        ],
        wires: [{ id: 'level-wire', sourceId: 'lever-1', targetId: 'fan-1' }],
      });
      const wired = connectControlWire({
        context: 'player',
        wireId: 'player-wire',
        sourceId: 'lever-1',
        targetId: 'conveyor-1',
        inventoryEntryId: 'inventory-wire',
      }).execute(initial);
      if (wired.status === 'rejected') throw new Error(`Le fil a été refusé : ${wired.reason}`);

      expect(countObjectsUsed(initial)).toBe(0);
      expect(countObjectsUsed(wired.state)).toBe(1);
    });

    it('ignore une provenance sans placement vivant ni entrée d’inventaire', () => {
      const initial = createConstructionAttempt(createLevel());
      const malformed: ConstructionAttempt = {
        ...initial,
        provenance: {
          ghost: 'inventory-short-beam',
          'fixed-beam': 'unknown-inventory-entry',
        },
      };

      expect(countObjectsUsed(malformed)).toBe(0);
    });
  });

  describe('evaluateTier', () => {
    it('résout sans défi quel que soit le nombre d’objets utilisés', () => {
      expect(evaluateTier(0)).toBe('resolved');
      expect(evaluateTier(20)).toBe('resolved');
    });

    it('applique les seuils élégants et minimaux inclusivement', () => {
      expect(evaluateTier(5, challenge)).toBe('resolved');
      expect(evaluateTier(4, challenge)).toBe('elegant');
      expect(evaluateTier(3, challenge)).toBe('elegant');
      expect(evaluateTier(2, challenge)).toBe('minimal');
      expect(evaluateTier(1, challenge)).toBe('minimal');
    });

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'refuse un compte d’objets invalide (%s)',
      (objectsUsed) => {
        expect(() => evaluateTier(objectsUsed, challenge)).toThrow(RangeError);
      },
    );
  });

  describe('nextChallengeHint', () => {
    it('ne révèle rien avant une réussite ou sans défi', () => {
      expect(nextChallengeHint(null, challenge)).toBeNull();
      expect(nextChallengeHint(10, undefined)).toBeNull();
    });

    it('révèle la cible élégante après une réussite non élégante', () => {
      expect(nextChallengeHint(5, challenge)).toEqual({
        nextTier: 'elegant',
        objectCount: 4,
      });
    });

    it('révèle la cible minimale après une réussite élégante', () => {
      expect(nextChallengeHint(4, challenge)).toEqual({
        nextTier: 'minimal',
        objectCount: 2,
      });
      expect(nextChallengeHint(3, challenge)).toEqual({
        nextTier: 'minimal',
        objectCount: 2,
      });
    });

    it('ne révèle rien après le palier minimal, même si le record le dépasse', () => {
      expect(nextChallengeHint(2, challenge)).toBeNull();
      expect(nextChallengeHint(1, challenge)).toBeNull();
    });

    it('refuse un record négatif ou fractionnaire', () => {
      expect(() => nextChallengeHint(-1, challenge)).toThrow(RangeError);
      expect(() => nextChallengeHint(1.5, challenge)).toThrow(RangeError);
    });
  });

  describe('recordSuccess', () => {
    it('crée un record résolu sans modifier la progression précédente', () => {
      const progress: CampaignProgress = { 'level-1': { resolved: false, bestObjectCount: null } };

      const updated = recordSuccess(progress, 'level-2', 5);

      expect(updated).toEqual({
        'level-1': { resolved: false, bestObjectCount: null },
        'level-2': { resolved: true, bestObjectCount: 5 },
      });
      expect(progress['level-2']).toBeUndefined();
    });

    it('garde le meilleur nombre d’objets, y compris un nouveau record inférieur au minimum connu', () => {
      const progress: CampaignProgress = {
        'level-2': { resolved: true, bestObjectCount: 5 },
      };

      const updated = recordSuccess(progress, 'level-2', 1);

      expect(updated['level-2']).toEqual({ resolved: true, bestObjectCount: 1 });
      expect(evaluateTier(updated['level-2']?.bestObjectCount ?? 0, challenge)).toBe('minimal');
      expect(progress['level-2']?.bestObjectCount).toBe(5);
    });

    it('ne remplace jamais un meilleur record par un résultat moins bon', () => {
      const progress: CampaignProgress = {
        'level-2': { resolved: true, bestObjectCount: 3 },
      };

      expect(recordSuccess(progress, 'level-2', 6)['level-2']).toEqual({
        resolved: true,
        bestObjectCount: 3,
      });
    });

    it('refuse un compte d’objets invalide', () => {
      expect(() => recordSuccess(emptyProgress, 'level-1', -1)).toThrow(RangeError);
      expect(() => recordSuccess(emptyProgress, 'level-1', 1.5)).toThrow(RangeError);
    });
  });

  describe('isLevelUnlocked', () => {
    it('laisse toujours ouvert le premier niveau, même sans progression', () => {
      expect(isLevelUnlocked(campaign, emptyProgress, 'level-1')).toBe(true);
    });

    it('ouvre le niveau suivant quand le précédent est résolu, entre chapitres compris', () => {
      const progress: CampaignProgress = {
        'level-2': { resolved: true, bestObjectCount: 7 },
      };

      expect(isLevelUnlocked(campaign, progress, 'level-3')).toBe(true);
      expect(isLevelUnlocked(campaign, progress, 'level-4')).toBe(false);
    });

    it('garde fermé le niveau suivant avant la résolution précédente', () => {
      const progress: CampaignProgress = {
        'level-1': { resolved: false, bestObjectCount: null },
      };

      expect(isLevelUnlocked(campaign, progress, 'level-2')).toBe(false);
    });

    it('garde fermé un identifiant inconnu ou une campagne vide', () => {
      expect(isLevelUnlocked(campaign, emptyProgress, 'unknown-level')).toBe(false);
      expect(isLevelUnlocked([], emptyProgress, 'level-1')).toBe(false);
    });
  });
});
