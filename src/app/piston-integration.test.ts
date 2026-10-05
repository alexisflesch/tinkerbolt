import { describe, expect, it } from 'vitest';
import { createConstructionAttempt, placeFromInventory } from '../application/construction';
import { verifyPuzzle, workshopFromPuzzle } from '../application/puzzle/puzzle-workshop';
import { authorCatalogue, objectKinds } from './object-catalog';
import { levelDocumentSchema } from '../domain/level-document';
import { decodeLevelFile, encodeLevelFile } from '../infrastructure/level-file/level-file-codec';
import {
  decodeShareFragment,
  encodeShareFragment,
} from '../infrastructure/level-share/level-share-codec';
import { projectLevel } from '../presentation/board-renderer';
import { createSpriteLoader } from '../presentation/sprite-loader';
import { createSimulationSession } from '../simulation/simulation-session';

const permissions = { move: true, rotate: true, remove: true };
const place = (id: string, type: string, x: number, y: number, props = {}, rotation = 0) => ({
  id,
  type,
  props,
  permissions: { ...permissions, rotate: type !== 'ball' && type !== 'basket' },
  transform: { position: { x, y }, rotation },
});

const candidate = (
  pistonProps: Record<string, unknown> = {},
  stockProps: Record<string, unknown> = {},
) => ({
  schemaVersion: 3,
  id: 'piston-test',
  metadata: { title: 'Piston' },
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  buildZones: [{ min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } }],
  goal: { type: 'basket', ballId: 'goal-ball', basketId: 'basket' },
  objects: [
    place('goal-ball', 'ball', 7, 1),
    place('basket', 'basket', 7, 4.7),
    place('button', 'button', 1, 3),
    place('piston', 'piston', 3, 3, pistonProps),
  ],
  inventory: [
    {
      id: 'piston-stock',
      type: 'piston',
      props: stockProps,
      quantity: 1,
      permissions,
    },
    {
      id: 'wire-stock',
      type: 'wire',
      props: {},
      quantity: 1,
      permissions: { move: false, rotate: false, remove: true },
    },
  ],
  wires: [{ id: 'button-piston', sourceId: 'button', targetId: 'piston' }],
});

describe('C9c piston', () => {
  it('persiste une famille sans état initial configurable', () => {
    const result = levelDocumentSchema.safeParse(candidate());
    expect(result.success).toBe(true);
    if (!result.success) return;

    const piston = result.data.objects.find((object) => object.id === 'piston');
    expect(piston).toMatchObject({ type: 'piston', props: {} });
    expect(result.data.inventory.find((entry) => entry.type === 'piston')).toMatchObject({
      props: {},
    });
  });

  it('refuse un état initial sorti dans le placement ou l’inventaire', () => {
    expect(levelDocumentSchema.safeParse(candidate({ state: 'on' })).success).toBe(false);
    expect(levelDocumentSchema.safeParse(candidate({}, { state: 'on' })).success).toBe(false);
    expect(decodeLevelFile(JSON.stringify({ ...candidate(), schemaVersion: 2 })).status).toBe(
      'error',
    );
  });

  it('conserve la famille et ses poses par fichier, URL et placement depuis l’inventaire', async () => {
    const document = levelDocumentSchema.parse(candidate());
    expect(decodeLevelFile(encodeLevelFile(document))).toEqual({ status: 'ok', document });
    const fragment = await encodeShareFragment(document);
    expect(await decodeShareFragment(fragment)).toEqual({ status: 'ok', document });

    const placed = placeFromInventory({
      context: 'player',
      inventoryEntryId: 'piston-stock',
      placementId: 'placed-piston',
      transform: { position: { x: 5, y: 3 }, rotation: Math.PI / 2 },
    }).execute(createConstructionAttempt(document));
    expect(placed.status).toBe('accepted');
    if (placed.status !== 'accepted') return;
    expect(placed.state.document.objects.at(-1)).toMatchObject({
      type: 'piston',
      props: {},
      transform: { position: { x: 5, y: 3 }, rotation: Math.PI / 2 },
    });
    expect(placed.state.document.inventory.find((entry) => entry.type === 'piston')?.quantity).toBe(
      0,
    );
  });

  it('ne laisse commander le piston que par un bouton', () => {
    const document = candidate();
    expect(levelDocumentSchema.safeParse(document).success).toBe(true);
    expect(
      levelDocumentSchema.safeParse({
        ...document,
        objects: document.objects.map((object) =>
          object.id === 'button' ? place('button', 'lever', 1, 3, { position: 'right' }) : object,
        ),
      }).success,
    ).toBe(false);
  });

  it('fournit une carte, trois calques et une pose fermée sans propriété de départ', async () => {
    const document = levelDocumentSchema.parse(candidate());
    expect(authorCatalogue.find((entry) => entry.type === 'piston')).toMatchObject({
      name: 'Piston',
      props: {},
    });
    expect(objectKinds.find(({ kind }) => kind === 'Piston')?.description).toContain('Pousse');

    const paths: string[] = [];
    const loader = createSpriteLoader({
      scale: 2,
      decode: (path) => {
        paths.push(path);
        return Promise.resolve({ width: 64, height: 32, source: path });
      },
    });
    await loader.loadForFamilies(['piston']);
    expect(loader.getState('piston')).toBe('ready');
    expect(paths).toEqual([
      '/assets/sprites/piston-rod@2x.png',
      '/assets/sprites/piston-housing@2x.png',
      '/assets/sprites/piston-plate@2x.png',
    ]);

    const closed = projectLevel(document).objects.filter(({ id }) => id === 'piston');
    expect(closed.map(({ assetKey }) => assetKey)).toEqual([
      'piston-rod',
      'piston-housing',
      'piston-plate',
    ]);
    expect(closed.find(({ assetKey }) => assetKey === 'piston-housing')?.layer.position).toEqual({
      x: 3,
      y: 3,
    });
    expect(closed.find(({ assetKey }) => assetKey === 'piston-plate')?.layer.position).toEqual({
      x: 3.3556,
      y: 3,
    });

    const extended = projectLevel(document, {
      bodyPoses: new Map([['piston', { position: { x: 3.9352, y: 3 }, rotation: 0 }]]),
      conveyorBelts: new Map(),
      devices: new Map(),
    }).objects.filter(({ id }) => id === 'piston');
    expect(extended.find(({ assetKey }) => assetKey === 'piston-housing')?.layer.position.x).toBe(
      3,
    );
    expect(extended.find(({ assetKey }) => assetKey === 'piston-plate')?.layer.position.x).toBe(
      3.9352,
    );
  });

  it('résout un puzzle où un piston posé propulse la balle dans le panier', () => {
    const puzzleWorkshop = levelDocumentSchema.parse({
      schemaVersion: 3,
      id: 'piston-puzzle',
      metadata: { title: 'Un coup de piston' },
      scene: { min: { x: -6, y: -2 }, max: { x: 8, y: 5 } },
      buildZones: [],
      inventory: [],
      goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
      objects: [
        // The enlarged piston (5 October) shoots the ball off the short deck: it
        // rebounds on the wall and drops into the basket standing below.
        place('ball', 'ball', 1.6, 0.775),
        place('basket', 'basket', 3.5, 3),
        place('beam', 'beam', 0.5, 1.2, { size: 'medium' }),
        place('wall', 'beam', 4.65, 2, { size: 'long' }, Math.PI / 2),
        { ...place('piston', 'piston', 0.5, 0.4), toPlace: true },
        place('button', 'button', -5, 0),
        place('press', 'box', -5, -1, { material: 'wood' }),
      ],
      wires: [{ id: 'button-piston', sourceId: 'button', targetId: 'piston' }],
    });

    const verified = verifyPuzzle(puzzleWorkshop, (document) => {
      const session = createSimulationSession(document, { fixedStepSeconds: 1 / 60 });
      try {
        session.advanceFixedSteps(600);
        return session.readGoalEvaluation().status === 'succeeded' ? 'won' : 'lost';
      } finally {
        session.destroy();
      }
    });
    expect(verified.status).toBe('verified');
    if (verified.status !== 'verified') return;
    expect(verified.puzzle.inventory).toMatchObject([
      { type: 'wire', quantity: 1 },
      { type: 'piston', props: {}, quantity: 1 },
    ]);
    const restoredPiston = workshopFromPuzzle(verified.puzzle).objects.find(
      (object) => object.type === 'piston',
    );
    expect(restoredPiston).toMatchObject({ type: 'piston', toPlace: true, props: {} });
  });
});
