import { describe, expect, it } from 'vitest';

import { embeddedLevels } from '../../content/embedded-levels';
import type { LevelDocument } from '../../domain/level-document';
import {
  connectControlWire,
  createConstructionAttempt,
  movePlacement,
  placeFromInventory,
  removePlacement,
  type ConstructionAttempt,
} from './construction-attempt';
import { validatePlayerConstruction } from './player-construction';

const level = embeddedLevels[0];
if (level === undefined) throw new Error('Missing test level');
const source: LevelDocument = {
  ...level,
  buildZones: [{ min: { x: 2, y: 1 }, max: { x: 12, y: 8 } }],
};
const placed = (document = source): ConstructionAttempt => {
  const result = placeFromInventory({
    context: 'player',
    inventoryEntryId: 'beam-a-placer',
    placementId: 'player-beam',
    transform: { position: { x: 7, y: 4 }, rotation: 0.2 },
  }).execute(createConstructionAttempt(document));
  if (result.status !== 'accepted') throw new Error(result.reason);
  return result.state;
};

describe('validation relationnelle des constructions de joueur', () => {
  it('retrouve le stock restant et la provenance sans modifier la source', () => {
    const attempt = placed();
    const result = validatePlayerConstruction(source, attempt);
    expect(result).toEqual({ status: 'ok', attempt });
    if (result.status !== 'ok') throw new Error(result.code);
    expect(Object.isFrozen(result.attempt.document.objects[0]?.transform.position)).toBe(true);
    expect(Object.isFrozen(result.attempt.provenance)).toBe(true);
    expect(source.inventory[0]?.quantity).toBe(1);
    const removed = removePlacement({ context: 'player', placementId: 'player-beam' }).execute(
      result.attempt,
    );
    expect(removed.status).toBe('accepted');
    if (removed.status === 'accepted')
      expect(removed.state.document.inventory[0]?.quantity).toBe(1);
  });

  it.each([
    ['provenance manquante', (a: ConstructionAttempt) => ({ ...a, provenance: {} })],
    [
      'clé pendante',
      (a: ConstructionAttempt) => ({
        ...a,
        provenance: { ...a.provenance, absent: 'beam-a-placer' },
      }),
    ],
    [
      'entrée absente',
      (a: ConstructionAttempt) => ({ ...a, provenance: { 'player-beam': 'absent' } }),
    ],
    [
      'décor consommé',
      (a: ConstructionAttempt) => ({
        ...a,
        provenance: { ...a.provenance, 'placement-1': 'beam-a-placer' },
      }),
    ],
    [
      'stock non consommé',
      (a: ConstructionAttempt) => ({
        ...a,
        document: { ...a.document, inventory: source.inventory },
      }),
    ],
    [
      'entrée omise',
      (a: ConstructionAttempt) => ({ ...a, document: { ...a.document, inventory: [] } }),
    ],
    [
      'métadonnée changée',
      (a: ConstructionAttempt) => ({
        ...a,
        document: { ...a.document, metadata: { title: 'Autre' } },
      }),
    ],
    [
      'solution changée',
      (a: ConstructionAttempt) => ({
        ...a,
        document: { ...a.document, solution: { placements: [] } },
      }),
    ],
    [
      'scène changée',
      (a: ConstructionAttempt) => ({
        ...a,
        document: { ...a.document, scene: { min: { x: -1, y: -1 }, max: { x: 16, y: 9 } } },
      }),
    ],
    [
      'objet décor absent',
      (a: ConstructionAttempt) => ({
        ...a,
        document: {
          ...a.document,
          objects: a.document.objects.filter(({ id }) => id !== 'placement-1'),
        },
      }),
    ],
    [
      'définition détournée',
      (a: ConstructionAttempt) => ({
        ...a,
        document: {
          ...a.document,
          objects: a.document.objects.map((o) =>
            o.id === 'player-beam' ? { ...o, props: { size: 'long' } } : o,
          ),
        },
      }),
    ],
    [
      'permissions détournées',
      (a: ConstructionAttempt) => ({
        ...a,
        document: {
          ...a.document,
          objects: a.document.objects.map((o) =>
            o.id === 'player-beam' ? { ...o, permissions: { ...o.permissions, remove: false } } : o,
          ),
        },
      }),
    ],
    [
      'décor verrouillé déplacé',
      (a: ConstructionAttempt) => ({
        ...a,
        document: {
          ...a.document,
          objects: a.document.objects.map((o) =>
            o.id === 'placement-1'
              ? { ...o, transform: { ...o.transform, position: { x: 5, y: 5 } } }
              : o,
          ),
        },
      }),
    ],
    [
      'empreinte hors zone',
      (a: ConstructionAttempt) => ({
        ...a,
        document: {
          ...a.document,
          objects: a.document.objects.map((o) =>
            o.id === 'player-beam'
              ? { ...o, transform: { position: { x: 0, y: 0 }, rotation: 0 } }
              : o,
          ),
        },
      }),
    ],
    [
      'marquage auteur',
      (a: ConstructionAttempt) => ({
        ...a,
        document: {
          ...a.document,
          objects: a.document.objects.map((o) =>
            o.id === 'player-beam' ? { ...o, toPlace: true } : o,
          ),
        },
      }),
    ],
    ['champ interne', (a: ConstructionAttempt) => ({ ...a, history: [] })],
    [
      'id hérité sans provenance',
      (a: ConstructionAttempt) => ({
        ...a,
        provenance: {},
        document: {
          ...a.document,
          inventory: source.inventory,
          objects: a.document.objects.map((o) =>
            o.id === 'player-beam' ? { ...o, id: 'constructor' } : o,
          ),
        },
      }),
    ],
    [
      'entrée inventée',
      (a: ConstructionAttempt) => ({
        ...a,
        document: {
          ...a.document,
          inventory: [
            ...a.document.inventory,
            {
              id: 'other-entry',
              type: 'beam',
              props: { size: 'short' },
              quantity: 0,
              permissions: { move: true, rotate: true, remove: true },
            },
          ],
        },
      }),
    ],
    [
      'entrée redéfinie',
      (a: ConstructionAttempt) => ({
        ...a,
        document: {
          ...a.document,
          inventory: a.document.inventory.map((e) => ({
            ...e,
            permissions: { ...e.permissions, remove: false },
          })),
        },
      }),
    ],
    [
      'stock négatif',
      (a: ConstructionAttempt) => ({
        ...a,
        document: {
          ...a.document,
          inventory: a.document.inventory.map((e) => ({ ...e, quantity: -1 })),
        },
      }),
    ],
    [
      'stock fractionnaire',
      (a: ConstructionAttempt) => ({
        ...a,
        document: {
          ...a.document,
          inventory: a.document.inventory.map((e) => ({ ...e, quantity: 0.5 })),
        },
      }),
    ],
    [
      'rotation du décor interdite',
      (a: ConstructionAttempt) => ({
        ...a,
        document: {
          ...a.document,
          objects: a.document.objects.map((o) =>
            o.id === 'placement-1' ? { ...o, transform: { ...o.transform, rotation: 0.5 } } : o,
          ),
        },
      }),
    ],
    [
      'objectif modifié',
      (a: ConstructionAttempt) => ({
        ...a,
        document: { ...a.document, goal: { ...a.document.goal, ballId: 'other-ball' } },
      }),
    ],
    [
      'zone modifiée',
      (a: ConstructionAttempt) => ({ ...a, document: { ...a.document, buildZones: [] } }),
    ],
  ])('rejette %s', (_name, corrupt) => {
    expect(validatePlayerConstruction(source, corrupt(placed()))).toEqual({
      status: 'error',
      code: 'invalid-construction',
    });
  });

  it('conserve un décor mobile sans provenance et tolère sa position initiale hors zone', () => {
    const mobile: LevelDocument = {
      ...source,
      buildZones: [{ min: { x: 5, y: 2 }, max: { x: 12, y: 8 } }],
      objects: source.objects.map((o) =>
        o.id === 'placement-1'
          ? { ...o, permissions: { move: true, rotate: true, remove: false } }
          : o,
      ),
    };
    expect(validatePlayerConstruction(mobile, createConstructionAttempt(mobile)).status).toBe('ok');
    const moved = movePlacement({
      context: 'player',
      placementId: 'placement-1',
      position: { x: 8, y: 5 },
    }).execute(createConstructionAttempt(mobile));
    if (moved.status !== 'accepted') throw new Error(moved.reason);
    expect(validatePlayerConstruction(mobile, moved.state)).toEqual({
      status: 'ok',
      attempt: moved.state,
    });
    expect(moved.state.provenance).toEqual({});
  });

  it('rejette une rotation initiale interdite pour un objet ajouté de famille fixe', () => {
    const sourceBall = source.objects.find(({ type }) => type === 'ball');
    if (sourceBall === undefined) throw new Error('Missing source ball');
    const withBallInStock: LevelDocument = {
      ...source,
      inventory: [
        ...source.inventory,
        {
          id: 'ball-extra',
          type: 'ball',
          props: {},
          quantity: 1,
          permissions: { move: true, rotate: false, remove: true },
        },
      ],
    };
    const placement = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'ball-extra',
      placementId: 'player-ball',
      transform: { position: { x: 10, y: 5 }, rotation: 0 },
    }).execute(createConstructionAttempt(withBallInStock));
    if (placement.status !== 'accepted') throw new Error(placement.reason);
    const rotated = {
      ...placement.state,
      document: {
        ...placement.state.document,
        objects: placement.state.document.objects.map((object) =>
          object.id === 'player-ball'
            ? { ...object, transform: { ...object.transform, rotation: 0.25 } }
            : object,
        ),
      },
    };

    expect(validatePlayerConstruction(withBallInStock, rotated)).toEqual({
      status: 'error',
      code: 'invalid-construction',
    });
  });

  it('contrôle les fils consommés également présents dans la solution cachée', () => {
    const wiring = embeddedLevels.find(({ id }) => id === 'tuto-5');
    if (wiring === undefined) throw new Error('Missing wiring test level');
    const connected = connectControlWire({
      context: 'player',
      wireId: 'wire-1',
      sourceId: 'placement-9',
      targetId: 'placement-4',
      inventoryEntryId: 'wire-a-placer',
    }).execute(createConstructionAttempt(wiring));
    if (connected.status !== 'accepted') throw new Error(connected.reason);
    expect(validatePlayerConstruction(wiring, connected.state)).toEqual({
      status: 'ok',
      attempt: connected.state,
    });
    expect(validatePlayerConstruction(wiring, { ...connected.state, provenance: {} }).status).toBe(
      'error',
    );
    expect(
      validatePlayerConstruction(wiring, {
        ...connected.state,
        provenance: { 'wire-1': 'ball-a-placer' },
      }).status,
    ).toBe('error');
    expect(
      validatePlayerConstruction(wiring, {
        ...connected.state,
        document: {
          ...connected.state.document,
          wires: [
            {
              ...connected.state.document.wires[0],
              id: 'placement-4',
              sourceId: 'placement-9',
              targetId: 'placement-4',
            },
          ],
        },
        provenance: { 'placement-4': 'wire-a-placer' },
      }).status,
    ).toBe('error');
  });

  it('garde les fils fixes identiques sans les attribuer au joueur', () => {
    const wiring = embeddedLevels.find(({ id }) => id === 'tuto-5');
    if (wiring === undefined) throw new Error('Missing wiring test level');
    const fixed: LevelDocument = {
      ...wiring,
      solution: undefined,
      wires: [{ id: 'fixed-wire', sourceId: 'placement-9', targetId: 'placement-4' }],
    };
    const state = createConstructionAttempt(fixed);
    expect(validatePlayerConstruction(fixed, state).status).toBe('ok');
    expect(
      validatePlayerConstruction(fixed, { ...state, document: { ...state.document, wires: [] } })
        .status,
    ).toBe('error');
    expect(
      validatePlayerConstruction(fixed, {
        ...state,
        document: {
          ...state.document,
          wires: [{ id: 'fixed-wire', sourceId: 'placement-9', targetId: 'placement-11' }],
        },
      }).status,
    ).toBe('error');
    expect(
      validatePlayerConstruction(fixed, { ...state, provenance: { 'fixed-wire': 'wire-a-placer' } })
        .status,
    ).toBe('error');
  });
});
