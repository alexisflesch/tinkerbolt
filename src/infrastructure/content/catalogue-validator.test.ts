import { describe, expect, it } from 'vitest';

import { validateContentCatalog, type ContentLevelFile } from './catalogue-validator';

const validLevel = {
  schemaVersion: 3,
  id: 'first-drop',
  metadata: { title: 'Fixture de validation' },
  objects: [
    {
      id: 'ball-1',
      type: 'ball',
      transform: { position: { x: 0, y: 4 }, rotation: 0 },
      props: {},
      permissions: { move: false, rotate: false, remove: false },
    },
    {
      id: 'basket-1',
      type: 'basket',
      transform: { position: { x: 0, y: 0 }, rotation: 0 },
      props: {},
      permissions: { move: false, rotate: false, remove: false },
    },
  ],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [],
  scene: { min: { x: -4, y: -2 }, max: { x: 4, y: 6 } },
  wires: [],
};

const file = (filePath: string, value: unknown): ContentLevelFile => ({ filePath, value });

describe('validateContentCatalog', () => {
  it('valide un catalogue de niveaux v2 et retourne les documents valides', () => {
    const result = validateContentCatalog([file('level-1.json', validLevel)]);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.levels).toEqual([validLevel]);
  });

  it('valide un niveau de campagne qui donne des fils au joueur (U21)', () => {
    const levelWithWire = {
      ...validLevel,
      inventory: [
        {
          id: 'inventory-wire',
          type: 'wire',
          props: {},
          quantity: 2,
          permissions: { move: false, rotate: false, remove: true },
        },
      ],
    };

    const result = validateContentCatalog(
      [file('level-1.json', levelWithWire)],
      new Set(['first-drop']),
    );

    expect(result.issues).toEqual([]);
    expect(result.levels).toEqual([levelWithWire]);
  });

  it('signale le fichier dont le document ne respecte pas le schema strict', () => {
    const invalidLevel = {
      ...validLevel,
      unexpected: true,
    };

    const result = validateContentCatalog([file('broken-level.json', invalidLevel)]);

    expect(result.valid).toBe(false);
    expect(result.levels).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      filePath: 'broken-level.json',
      kind: 'invalid-file',
    });
    expect(result.issues[0]?.message).toContain('unexpected');
  });

  it('signale les identifiants de niveau dupliques', () => {
    const result = validateContentCatalog([
      file('first.json', validLevel),
      file('copy.json', { ...validLevel, metadata: { title: 'Copie' } }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      filePath: 'copy.json',
      kind: 'duplicate-id',
      message: 'L’identifiant de niveau « first-drop » est dupliqué (déjà défini dans first.json).',
    });
  });

  it('refuse les permissions actives sur les objets placés d’un niveau de campagne', () => {
    const unlockedCampaignLevel = {
      ...validLevel,
      objects: [
        ...validLevel.objects,
        {
          id: 'beam-1',
          type: 'beam',
          transform: { position: { x: 1, y: 2 }, rotation: 0 },
          props: { size: 'short' },
          permissions: { move: true, rotate: true, remove: true },
        },
      ],
    };

    const result = validateContentCatalog(
      [file('campaign.json', unlockedCampaignLevel)],
      new Set(['first-drop']),
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      {
        filePath: 'campaign.json',
        kind: 'invalid-file',
        message:
          'objects[2].permissions : les trois permissions doivent être false dans un niveau de campagne.',
      },
    ]);
  });

  it('exige un objectif complet d’un niveau de campagne, pas d’un autre niveau (ADR 0020)', () => {
    const { goal: ignoredGoal, ...machine } = validLevel;
    void ignoredGoal;

    const campaign = validateContentCatalog(
      [file('machine.json', machine)],
      new Set(['first-drop']),
    );
    expect(campaign.valid).toBe(false);
    expect(campaign.issues).toEqual([
      {
        filePath: 'machine.json',
        kind: 'invalid-file',
        message: 'goal : un niveau de campagne exige un objectif complet.',
      },
    ]);

    expect(validateContentCatalog([file('machine.json', machine)]).valid).toBe(true);
  });

  it('n’impose pas les permissions de campagne à un document hors campagne', () => {
    const workshop = {
      ...validLevel,
      id: 'free-workshop',
      objects: validLevel.objects,
    };

    const result = validateContentCatalog(
      [file('workshop.json', workshop)],
      new Set(['first-drop']),
    );

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('signale une erreur de lecture JSON avec un message exploitable', () => {
    const result = validateContentCatalog([
      {
        filePath: 'malformed.json',
        value: null,
        parseError: 'JSON invalide à la ligne 1, colonne 2.',
      },
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      filePath: 'malformed.json',
      kind: 'invalid-file',
      message: 'JSON invalide à la ligne 1, colonne 2.',
    });
  });
});
