import { describe, expect, it } from 'vitest';
import { embeddedLevels } from '../content/embedded-levels';
import { levelDocumentSchema } from '../domain/level-document';
import { decodeLevelFile, encodeLevelFile } from '../infrastructure/level-file/level-file-codec';
import {
  decodeShareFragment,
  encodeShareFragment,
} from '../infrastructure/level-share/level-share-codec';
import { createSpriteLoader } from '../presentation/sprite-loader';
import { createSimulationSession } from '../simulation/simulation-session';
import { projectLevel } from '../presentation/board-renderer';
import { authorCatalogue } from '../app/object-catalog';
import { verifyPuzzle, workshopFromPuzzle } from '../application/puzzle/puzzle-workshop';
import { createConstructionAttempt, placeFromInventory } from '../application/construction';

const base = embeddedLevels[0];
if (base === undefined) throw new Error('Missing level');
const permissions = { move: true, rotate: true, remove: true };
const candidate = (material: string = 'wood') => ({
  ...base,
  schemaVersion: 3,
  challenge: undefined,
  solution: undefined,
  objects: [
    ...base.objects.filter(({ type }) => type === 'ball' || type === 'basket'),
    {
      id: 'box-1',
      type: 'box',
      props: { material },
      permissions,
      transform: { position: { x: 6, y: 1 }, rotation: 0 },
    },
    {
      id: 'box-floor',
      type: 'beam',
      props: { size: 'long' },
      permissions,
      transform: { position: { x: 6, y: 5 }, rotation: 0 },
    },
  ],
  inventory: [{ id: 'box-stock', type: 'box', props: { material }, permissions, quantity: 2 }],
});

describe('C9a caisses', () => {
  it.each(['wood', 'metal'])(
    'conserve la variante %s dans les codecs et les poses joueur',
    (material) => {
      const document = levelDocumentSchema.parse(candidate(material));
      expect(decodeLevelFile(encodeLevelFile(document))).toEqual({ status: 'ok', document });
      const placed = placeFromInventory({
        context: 'player',
        inventoryEntryId: 'box-stock',
        placementId: 'player-box',
        transform: { position: { x: 9, y: 3 }, rotation: 0.3 },
      }).execute(createConstructionAttempt(document));
      expect(placed.status).toBe('accepted');
      if (placed.status !== 'accepted') return;
      expect(placed.state.document.objects.at(-1)).toMatchObject({
        type: 'box',
        props: { material },
        permissions,
      });
      expect(placed.state.document.inventory[0]?.quantity).toBe(1);
    },
  );

  it('refuse un matériau inconnu et les caisses en v2', () => {
    expect(levelDocumentSchema.safeParse(candidate('plastic')).success).toBe(false);
    expect(decodeLevelFile(JSON.stringify({ ...candidate(), schemaVersion: 2 }))).toMatchObject({
      status: 'error',
      code: 'invalid-document',
    });
  });

  it.each(['wood', 'metal'])(
    'la caisse %s tombe, repose sur sa face et revient à sa pose au reset',
    (material) => {
      const document = levelDocumentSchema.parse(candidate(material));
      const before = JSON.stringify(document);
      const session = createSimulationSession(document, { fixedStepSeconds: 1 / 60 });
      try {
        const readBox = () =>
          session.readState().bodies.find(({ placementId }) => placementId === 'box-1');
        expect(readBox()).toMatchObject({ bodyType: 'dynamic', position: { x: 6, y: 1 } });
        session.advanceFixedSteps(30);
        expect(readBox()?.position.y).toBeGreaterThan(1.5);
        session.advanceFixedSteps(270);
        expect(readBox()?.position.y).toBeCloseTo(4.475, 1);
        expect(readBox()?.rotation).toBeCloseTo(0, 1);
        session.reset();
        expect(readBox()).toMatchObject({ position: { x: 6, y: 1 }, rotation: 0 });
        expect(JSON.stringify(document)).toBe(before);
      } finally {
        session.destroy();
      }
    },
  );

  it('offre deux choix de catalogue de la même famille et dessine seulement le bon sprite', () => {
    expect(authorCatalogue.filter(({ type }) => type === 'box').map(({ props }) => props)).toEqual([
      { material: 'wood' },
      { material: 'metal' },
    ]);
    for (const material of ['wood', 'metal']) {
      const projection = projectLevel(levelDocumentSchema.parse(candidate(material)));
      expect(
        projection.objects.filter(({ id }) => id === 'box-1').map(({ assetKey }) => assetKey),
      ).toEqual([`box-${material}`]);
    }
  });

  it.each(['wood', 'metal'])(
    'la caisse %s permet de résoudre un puzzle de bouton et barrière',
    (material) => {
      const place = (
        id: string,
        type: string,
        x: number,
        y: number,
        props = {},
        toPlace?: true,
      ) => ({
        id,
        type,
        props,
        permissions: { move: false, rotate: false, remove: false },
        transform: { position: { x, y }, rotation: 0 },
        ...(toPlace === undefined ? {} : { toPlace }),
      });
      const workshop = levelDocumentSchema.parse({
        schemaVersion: 3,
        id: 'box-puzzle',
        metadata: { title: 'Ouvrir la trappe' },
        scene: { min: { x: -2, y: -2 }, max: { x: 8, y: 8 } },
        buildZones: [],
        inventory: [],
        goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
        objects: [
          place('ball', 'ball', 4, 1),
          place('basket', 'basket', 4, 4),
          place('barrier', 'barrier', 3, 2, { state: 'closed' }),
          place('button', 'button', 0, 3),
          place('box', 'box', 0, 1, { material }, true),
        ],
        wires: [{ id: 'wire', sourceId: 'button', targetId: 'barrier' }],
      });
      const run = (document: ReturnType<typeof levelDocumentSchema.parse>) => {
        const session = createSimulationSession(document, { fixedStepSeconds: 1 / 60 });
        try {
          session.advanceFixedSteps(600);
          return session.readGoalEvaluation().status === 'succeeded' ? 'won' : 'lost';
        } finally {
          session.destroy();
        }
      };
      const result = verifyPuzzle(workshop, run);
      expect(result.status).toBe('verified');
      if (result.status !== 'verified') return;
      expect(result.puzzle.inventory).toMatchObject([
        { type: 'box', props: { material }, quantity: 1 },
      ]);
      expect(workshopFromPuzzle(result.puzzle).objects.at(-1)).toMatchObject({
        type: 'box',
        props: { material },
        toPlace: true,
      });
      expect(decodeLevelFile(encodeLevelFile(result.puzzle))).toEqual({
        status: 'ok',
        document: result.puzzle,
      });
    },
  );

  it.each(['wood', 'metal'])('le convoyeur entraîne une caisse %s', (material) => {
    const original = candidate(material);
    const document = levelDocumentSchema.parse({
      ...original,
      objects: original.objects.map((object) =>
        object.id === 'box-floor'
          ? { ...object, type: 'conveyor', props: { direction: 'right' } }
          : object,
      ),
    });
    const session = createSimulationSession(document, { fixedStepSeconds: 1 / 60 });
    try {
      session.advanceFixedSteps(150);
      expect(
        session.readState().bodies.find(({ placementId }) => placementId === 'box-1')?.position.x,
      ).toBeGreaterThan(6.8);
    } finally {
      session.destroy();
    }
  });

  it('la caisse en bois est plus facile à pousser que la caisse métallique', () => {
    const moved = (material: string) => {
      const original = candidate(material);
      const document = levelDocumentSchema.parse({
        ...original,
        objects: original.objects
          .map((object) =>
            object.id === 'box-1'
              ? { ...object, transform: { position: { x: 1.1, y: 2.475 }, rotation: 0 } }
              : object.id === 'box-floor'
                ? { ...object, transform: { position: { x: 2, y: 3 }, rotation: 0 } }
                : object,
          )
          .concat([
            {
              id: 'fan',
              type: 'fan',
              props: { state: 'on' },
              permissions,
              transform: { position: { x: 0, y: 2.4 }, rotation: 0 },
            },
          ]),
      });
      const session = createSimulationSession(document, { fixedStepSeconds: 1 / 60 });
      try {
        session.advanceFixedSteps(30);
        return (
          (session.readState().bodies.find(({ placementId }) => placementId === 'box-1')?.position
            .x ?? 1.1) - 1.1
        );
      } finally {
        session.destroy();
      }
    };
    const wood = moved('wood');
    const metal = moved('metal');
    expect(wood).toBeGreaterThan(0.1);
    expect(wood).toBeGreaterThan(metal * 2);
  });

  it.each(['wood', 'metal'])(
    'partage la variante %s par URL et suit sa pose simulée',
    async (material) => {
      const document = levelDocumentSchema.parse(candidate(material));
      const fragment = await encodeShareFragment(document);
      expect(await decodeShareFragment(fragment)).toEqual({ status: 'ok', document });
      const projection = projectLevel(document, {
        bodyPoses: new Map([['box-1', { position: { x: 8, y: 4 }, rotation: 0.3 }]]),
        devices: new Map(),
        conveyorBelts: new Map(),
      });
      expect(projection.objects.find(({ id }) => id === 'box-1')?.layer).toMatchObject({
        position: { x: 8, y: 4 },
        rotation: 0.3,
      });
    },
  );

  it('charge les deux sprites avant de déclarer la famille prête', async () => {
    const decoded: string[] = [];
    const loader = createSpriteLoader({
      scale: 2,
      decode: (path) => {
        decoded.push(path);
        return Promise.resolve({ width: 102, height: 102, source: path });
      },
    });
    await loader.loadForFamilies(['box']);
    expect(loader.getState('box')).toBe('ready');
    expect(decoded).toEqual([
      '/assets/sprites/box-wood@2x.png',
      '/assets/sprites/box-metal@2x.png',
    ]);
  });

  it('migre un fichier v2 en conservant toutes ses données', () => {
    const legacy = { ...base, schemaVersion: 2 };
    expect(decodeLevelFile(JSON.stringify(legacy))).toEqual({
      status: 'ok',
      document: { ...legacy, schemaVersion: 3 },
    });
  });
});
