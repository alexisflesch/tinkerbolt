import { describe, expect, it } from 'vitest';
import { levelDocumentSchema, type LevelDocument } from '../domain/level-document';
import { decodeLevelFile, encodeLevelFile } from '../infrastructure/level-file/level-file-codec';
import {
  decodeShareFragment,
  encodeShareFragment,
} from '../infrastructure/level-share/level-share-codec';
import { projectLevel, type BoardSimulationView } from '../presentation/board-renderer';
import { createSpriteLoader } from '../presentation/sprite-loader';
import { createSimulationSession } from '../simulation/simulation-session';
import { authorCatalogue, objectKinds } from './object-catalog';
import {
  createConstructionAttempt,
  placeFromInventory,
  connectControlWire,
} from '../application/construction';
import { verifyPuzzle, workshopFromPuzzle } from '../application/puzzle/puzzle-workshop';

const permissions = { move: true, rotate: true, remove: true };
const place = (id: string, type: string, x: number, y: number, props = {}, rotation = 0) => ({
  id,
  type,
  props,
  permissions: { ...permissions, rotate: type !== 'ball' && type !== 'basket' },
  transform: { position: { x, y }, rotation },
});
const wire = { id: 'wire', sourceId: 'button', targetId: 'magnet' };
const candidate = (
  type = 'box',
  props: Record<string, string> = { material: 'metal' },
  wired = true,
  distance = 2,
) => ({
  schemaVersion: 3,
  id: 'magnet-test',
  metadata: { title: 'Aimant' },
  scene: { min: { x: -5, y: -5 }, max: { x: 15, y: 12 } },
  buildZones: [{ min: { x: -5, y: -5 }, max: { x: 15, y: 12 } }],
  goal: { type: 'basket', ballId: 'goal-ball', basketId: 'basket' },
  objects: [
    place('goal-ball', 'ball', 12, 0),
    place('basket', 'basket', 12, 9),
    place('target', type, 0, 2.475, props),
    place('floor', 'beam', 1, 3, { size: 'long' }),
    place('magnet', 'electro-magnet', distance, 2.475, { state: 'off' }),
    place('button', 'button', 8, 3),
    place('press', 'box', 8, 2, { material: 'wood' }),
  ],
  wires: wired ? [wire] : [],
  inventory: [
    { id: 'stock', type: 'electro-magnet', props: { state: 'off' }, permissions, quantity: 2 },
  ],
});
const sessionFor = (document: LevelDocument) =>
  createSimulationSession(document, { fixedStepSeconds: 1 / 60 });
const run = (document: LevelDocument, steps = 120) => {
  const session = sessionFor(document);
  try {
    session.advanceFixedSteps(steps);
    return session.readState();
  } finally {
    session.destroy();
  }
};

describe('C9b électroaimant', () => {
  it('valide l’état initial en v3, conserve les codecs et refuse les versions anciennes', async () => {
    const document = levelDocumentSchema.parse(candidate());
    expect(decodeLevelFile(encodeLevelFile(document))).toEqual({ status: 'ok', document });
    expect(await decodeShareFragment(await encodeShareFragment(document))).toEqual({
      status: 'ok',
      document,
    });
    for (const schemaVersion of [1, 2])
      expect(decodeLevelFile(JSON.stringify({ ...candidate(), schemaVersion }))).toMatchObject({
        status: 'error',
        code: 'invalid-document',
      });
    expect(
      levelDocumentSchema.safeParse({
        ...candidate(),
        objects: candidate().objects.map((object) =>
          object.id === 'magnet' ? { ...object, props: { state: 'pulse' } } : object,
        ),
      }).success,
    ).toBe(false);
  });

  it('refuse un état initial inconnu dans les propriétés du stock', () => {
    const original = candidate();
    expect(
      levelDocumentSchema.safeParse({
        ...original,
        inventory: original.inventory.map((entry) => ({ ...entry, props: { state: 'pulse' } })),
      }).success,
    ).toBe(false);
  });

  it('accepte le bouton, refuse le levier, les autres sources et deux commandes', () => {
    expect(levelDocumentSchema.safeParse(candidate()).success).toBe(true);
    const original = candidate();
    expect(
      levelDocumentSchema.safeParse({
        ...original,
        objects: original.objects.map((object) =>
          object.id === 'button'
            ? { ...object, type: 'lever', props: { position: 'right' } }
            : object,
        ),
      }).success,
    ).toBe(false);
    expect(
      decodeLevelFile(
        JSON.stringify({
          ...original,
          objects: original.objects.map((object) =>
            object.id === 'button'
              ? { ...object, type: 'lever', props: { position: 'right' } }
              : object,
          ),
        }),
      ),
    ).toMatchObject({ status: 'error', code: 'invalid-document' });
    expect(
      levelDocumentSchema.safeParse({
        ...original,
        wires: [{ ...wire, sourceId: 'magnet', targetId: 'button' }],
      }).success,
    ).toBe(false);
    expect(
      levelDocumentSchema.safeParse({ ...original, wires: [wire, { ...wire, id: 'wire-2' }] })
        .success,
    ).toBe(false);
  });

  it('place depuis le stock et raccorde seulement une commande bouton', () => {
    const original = candidate();
    const document = levelDocumentSchema.parse({
      ...original,
      objects: original.objects.filter((object) => object.id !== 'magnet'),
      wires: [],
    });
    const placed = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'stock',
      placementId: 'magnet',
      transform: { position: { x: 2, y: 2.475 }, rotation: 0.3 },
    }).execute(createConstructionAttempt(document));
    expect(placed.status).toBe('accepted');
    if (placed.status !== 'accepted') return;
    expect(placed.state.document.inventory[0]?.quantity).toBe(1);
    expect(
      connectControlWire({
        context: 'author',
        wireId: 'wire',
        sourceId: 'button',
        targetId: 'magnet',
      }).execute(placed.state).status,
    ).toBe('accepted');
  });

  it('avec état initial off, reste éteint sans fil et attire la caisse métallique quand le bouton est pressé', () => {
    const active = run(levelDocumentSchema.parse(candidate()));
    const inactive = run(levelDocumentSchema.parse(candidate('box', { material: 'metal' }, false)));
    const x = (state: typeof active) =>
      state.bodies.find((body) => body.placementId === 'target')?.position.x ?? 0;
    expect(active.devices.find((device) => device.placementId === 'magnet')).toMatchObject({
      kind: 'electro-magnet',
      active: true,
    });
    expect(inactive.devices.find((device) => device.placementId === 'magnet')).toMatchObject({
      active: false,
    });
    expect(x(active)).toBeGreaterThan(0.7);
    expect(x(inactive)).toBeCloseTo(0, 2);
  });

  it.each([
    ['box', { material: 'wood' }],
    ['ball', {}],
    ['mass', { weight: '10kg' }],
  ])('ne magnétise pas %s %j', (type, props) => {
    const active = run(levelDocumentSchema.parse(candidate(type, props)));
    const inactive = run(levelDocumentSchema.parse(candidate(type, props, false)));
    expect(active.bodies.find((body) => body.placementId === 'target')).toEqual(
      inactive.bodies.find((body) => body.placementId === 'target'),
    );
  });

  it('ne dépasse pas une portée de 2,8 unités monde', () => {
    const active = run(
      levelDocumentSchema.parse(candidate('box', { material: 'metal' }, true, 2.9)),
    );
    expect(active.bodies.find((body) => body.placementId === 'target')?.position.x).toBeCloseTo(
      0,
      2,
    );
  });

  it.each(['off', 'on'])('reprend son état initial %s au relâchement du bouton', (state) => {
    const original = candidate();
    const document = levelDocumentSchema.parse({
      ...original,
      objects: original.objects.map((object) =>
        object.id === 'magnet'
          ? { ...object, props: { state } }
          : object.id === 'button'
            ? { ...object, transform: { ...object.transform, rotation: Math.PI / 6 } }
            : object.id === 'press'
              ? place('press', 'ball', 8, 1.8)
              : object,
      ),
    });
    const session = sessionFor(document);
    try {
      let activeSteps = 0;
      for (let step = 0; step < 240; step++) {
        session.advanceFixedSteps(1);
        const snapshot = session.readState();
        const button = snapshot.devices.find((device) => device.placementId === 'button');
        const magnet = snapshot.devices.find((device) => device.placementId === 'magnet');
        if (magnet?.kind !== 'electro-magnet' || button?.kind !== 'button')
          throw new Error('Appareil absent');
        expect(magnet.active).toBe((state === 'on') !== button.pressed);
        if (button.pressed) activeSteps++;
      }
      expect(activeSteps).toBeGreaterThan(0);
      expect(activeSteps).toBeLessThan(240);
      expect(
        session.readState().devices.find((device) => device.placementId === 'magnet'),
      ).toMatchObject({ active: state === 'on' });
    } finally {
      session.destroy();
    }
  });

  it('attire encore juste dans la portée, sans attraction à sa limite ou au-delà', () => {
    const xAfter = (distance: number) => {
      const original = candidate('box', { material: 'metal' }, true, distance);
      const document = levelDocumentSchema.parse({
        ...original,
        objects: original.objects
          .filter((object) => object.id !== 'floor')
          .map((object) =>
            object.id === 'press' ? place('press', 'box', 8, 2.31, { material: 'wood' }) : object,
          ),
      });
      return (
        run(document, 20).bodies.find((body) => body.placementId === 'target')?.position.x ?? 0
      );
    };
    expect(xAfter(2.7)).toBeGreaterThan(0.001);
    expect(xAfter(2.8)).toBe(0);
    expect(xAfter(2.9)).toBe(0);
  });

  it('commence actif sans fil et inverse cet état tant que le bouton est pressé', () => {
    const withState = (wired: boolean) => {
      const original = candidate('box', { material: 'metal' }, wired);
      return levelDocumentSchema.parse({
        ...original,
        objects: original.objects.map((object) =>
          object.id === 'magnet' ? { ...object, props: { state: 'on' } } : object,
        ),
      });
    };
    const alwaysOn = sessionFor(withState(false));
    const commanded = sessionFor(withState(true));
    try {
      expect(
        alwaysOn.readState().devices.find((device) => device.placementId === 'magnet'),
      ).toMatchObject({ active: true });
      alwaysOn.advanceFixedSteps(120);
      expect(
        alwaysOn.readState().bodies.find((body) => body.placementId === 'target')?.position.x,
      ).toBeGreaterThan(0.7);
      commanded.advanceFixedSteps(120);
      expect(
        commanded.readState().devices.find((device) => device.placementId === 'magnet'),
      ).toMatchObject({ active: false });
      commanded.reset();
      expect(
        commanded.readState().devices.find((device) => device.placementId === 'magnet'),
      ).toMatchObject({ active: true });
      const initial = withState(false);
      expect(decodeLevelFile(encodeLevelFile(initial))).toEqual({
        status: 'ok',
        document: initial,
      });
      expect(projectLevel(initial).objects.find((object) => object.id === 'magnet')?.assetKey).toBe(
        'electro-magnet-on',
      );
    } finally {
      alwaysOn.destroy();
      commanded.destroy();
    }
  });

  it('refuse l’absence d’état initial et toute propriété étrangère', () => {
    const original = candidate();
    for (const props of [{}, { state: 'off', force: 100 }])
      expect(
        levelDocumentSchema.safeParse({
          ...original,
          objects: original.objects.map((object) =>
            object.id === 'magnet' ? { ...object, props } : object,
          ),
        }).success,
      ).toBe(false);
  });

  it('reset, pas fixes et permutation des objets gardent le résultat déterministe et le document intact', () => {
    const document = levelDocumentSchema.parse(candidate());
    const initial = JSON.stringify(document);
    const session = sessionFor(document);
    try {
      session.advanceFixedSteps(120);
      const first = session.readState();
      session.reset();
      expect(
        session.readState().devices.find((device) => device.placementId === 'magnet'),
      ).toMatchObject({ active: false });
      session.advanceFixedSteps(120);
      expect(session.readState()).toEqual(first);
      expect(run({ ...document, objects: [...document.objects].reverse() }).bodies).toEqual(
        first.bodies,
      );
      expect(JSON.stringify(document)).toBe(initial);
    } finally {
      session.destroy();
    }
  });

  it('charge les deux états, catalogue en marche et projette un seul sprite avec le même cadre', async () => {
    const document = levelDocumentSchema.parse(candidate());
    const paths: string[] = [];
    const loader = createSpriteLoader({
      scale: 2,
      decode: (path) => {
        paths.push(path);
        return Promise.resolve({ width: 128, height: 102, source: {} });
      },
    });
    await loader.loadForFamilies(['electro-magnet']);
    expect(paths).toEqual([
      '/assets/sprites/electro-magnet-off@2x.png',
      '/assets/sprites/electro-magnet-on@2x.png',
    ]);
    expect(authorCatalogue.find((entry) => entry.type === 'electro-magnet')).toMatchObject({
      name: 'Électroaimant',
      props: { state: 'on' },
    });
    expect(objectKinds.find(({ kind }) => kind === 'Électroaimant')?.description).toBe(
      'Attire les caisses métalliques quand il est en marche',
    );
    const view: BoardSimulationView = {
      bodyPoses: new Map(),
      conveyorBelts: new Map(),
      devices: new Map([['magnet', { kind: 'electro-magnet', active: true }]]),
    };
    const off = projectLevel(document).objects.filter((object) => object.id === 'magnet');
    const on = projectLevel(document, view).objects.filter((object) => object.id === 'magnet');
    expect(off.map((object) => object.assetKey)).toEqual(['electro-magnet-off']);
    expect(on.map((object) => object.assetKey)).toEqual(['electro-magnet-on']);
    expect(on[0]?.destination).toEqual(off[0]?.destination);
  });

  it('résout un puzzle en retirant une caisse métallique qui bouche la chute', () => {
    const workshop = levelDocumentSchema.parse({
      ...candidate(),
      inventory: [],
      objects: [
        place('goal-ball', 'ball', 4, 1.325),
        place('basket', 'basket', 4, 4.2),
        place('left', 'beam', 2.65, 2.55, { size: 'short' }),
        place('right', 'beam', 5.35, 2.55, { size: 'short' }),
        place('bridge', 'box', 4, 2.025, { material: 'metal' }),
        place('button', 'button', 0, 3),
        place('press', 'box', 0, 1, { material: 'wood' }),
        { ...place('magnet', 'electro-magnet', 6, 2.025, { state: 'off' }), toPlace: true },
      ],
    });
    const result = verifyPuzzle(workshop, (document) => {
      const session = sessionFor(document);
      try {
        session.advanceFixedSteps(600);
        return session.readGoalEvaluation().status === 'succeeded' ? 'won' : 'lost';
      } finally {
        session.destroy();
      }
    });
    const poweredWorkshop = levelDocumentSchema.parse({
      ...workshop,
      wires: [],
      objects: workshop.objects.map((object) =>
        object.type === 'electro-magnet' ? { ...object, props: { state: 'on' } } : object,
      ),
    });
    const powered = verifyPuzzle(poweredWorkshop, (document) => {
      const session = sessionFor(document);
      try {
        session.advanceFixedSteps(600);
        return session.readGoalEvaluation().status === 'succeeded' ? 'won' : 'lost';
      } finally {
        session.destroy();
      }
    });
    expect(powered.status).toBe('verified');
    if (powered.status === 'verified')
      expect(powered.puzzle.inventory).toMatchObject([
        { type: 'electro-magnet', props: { state: 'on' }, quantity: 1 },
      ]);
    expect(result.status).toBe('verified');
    if (result.status !== 'verified') return;
    expect(result.puzzle.inventory).toMatchObject([
      { type: 'wire', quantity: 1 },
      { type: 'electro-magnet', props: { state: 'off' }, quantity: 1 },
    ]);
    expect(workshopFromPuzzle(result.puzzle).objects.at(-1)).toMatchObject({
      type: 'electro-magnet',
      toPlace: true,
    });
    expect(decodeLevelFile(encodeLevelFile(result.puzzle))).toEqual({
      status: 'ok',
      document: result.puzzle,
    });
  });
});
