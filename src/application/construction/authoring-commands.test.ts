import { describe, expect, it } from 'vitest';

import {
  hasCompleteGoal,
  levelDocumentSchema,
  type LevelDocument,
} from '../../domain/level-document';
import { creationFromLevel } from '../drafts/creation-from-level';
import { createHistory, executeCommand, redo, undo, type Command } from '../history';
import { workshopFromPuzzle } from '../puzzle/puzzle-workshop';
import type { ConstructionAttempt } from './construction-attempt';
import {
  addAuthoredPlacement,
  addBuildZone,
  addInventoryEntry,
  moveBuildZone,
  removeBuildZone,
  removeInventoryEntry,
  removeLevelChallenge,
  resizeBuildZone,
  revealAuthorSolution,
  setLevelChallenge,
  setControlWireToPlace,
  updateInventoryPermissions,
  updateInventoryProperties,
  updateInventoryQuantity,
  updateLevelAuthor,
  updateLevelDescription,
  updateLevelGoal,
  updateLevelTitle,
  setPlacementToPlace,
  updatePlacementPermissions,
  updateScene,
} from './index';

const createLevel = (overrides: Partial<LevelDocument> = {}): LevelDocument => ({
  schemaVersion: 3,
  id: 'authoring-test',
  metadata: { title: 'Authoring test', description: 'Description' },
  objects: [
    {
      id: 'ball-1',
      type: 'ball',
      props: {},
      transform: { position: { x: 2, y: 2 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
    {
      id: 'basket-1',
      type: 'basket',
      props: {},
      transform: { position: { x: 10, y: 2 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
    {
      id: 'ball-2',
      type: 'ball',
      props: {},
      transform: { position: { x: 2, y: 8 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
    {
      id: 'basket-2',
      type: 'basket',
      props: {},
      transform: { position: { x: 10, y: 8 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
    {
      id: 'beam-1',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 5, y: 5 }, rotation: 0 },
      permissions: { move: true, rotate: true, remove: true },
    },
  ],
  inventory: [
    {
      id: 'beam-stock',
      type: 'beam',
      props: { size: 'short' },
      quantity: 4,
      permissions: { move: true, rotate: true, remove: true },
    },
  ],
  buildZones: [{ min: { x: 1, y: 1 }, max: { x: 6, y: 6 } }],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  scene: { min: { x: 0, y: 0 }, max: { x: 20, y: 20 } },
  wires: [],
  ...overrides,
});

const addedZone = { min: { x: 7, y: 7 }, max: { x: 9, y: 9 } } as const;
const addedInventoryEntry = {
  id: 'mass-stock',
  type: 'mass',
  props: { weight: '10kg' },
  quantity: 2,
  permissions: { move: true, rotate: false, remove: true },
} as const;
const lockedPermissions = { move: false, rotate: false, remove: false } as const;
const addedMass = {
  context: 'author',
  placementId: 'mass-1',
  type: 'mass',
  props: { weight: '10kg' },
  transform: { position: { x: 8, y: 4 }, rotation: 0 },
} as const;
const addedBall = {
  context: 'author',
  placementId: 'ball-3',
  type: 'ball',
  props: {},
  transform: { position: { x: 4, y: 12 }, rotation: 0 },
} as const;
const wiredLever = {
  id: 'lever-1',
  type: 'lever',
  props: { position: 'center' },
  transform: { position: { x: 8, y: 8 }, rotation: 0 },
  permissions: lockedPermissions,
} as const;
const wiredConveyor = {
  id: 'conveyor-1',
  type: 'conveyor',
  props: { direction: 'stopped' },
  transform: { position: { x: 12, y: 8 }, rotation: 0 },
  permissions: lockedPermissions,
} as const;

const authoringCommands: readonly {
  readonly label: string;
  readonly command: Command<ConstructionAttempt>;
  readonly document?: LevelDocument;
}[] = [
  {
    label: 'change la scène',
    command: updateScene({
      context: 'author',
      scene: { min: { x: -1, y: -1 }, max: { x: 21, y: 21 } },
    }),
  },
  { label: 'ajoute une zone', command: addBuildZone({ context: 'author', zone: addedZone }) },
  {
    label: 'déplace une zone',
    command: moveBuildZone({ context: 'author', index: 0, offset: { x: 1, y: 1 } }),
  },
  {
    label: 'redimensionne une zone',
    command: resizeBuildZone({
      context: 'author',
      index: 0,
      zone: { min: { x: 1, y: 1 }, max: { x: 7, y: 7 } },
    }),
  },
  { label: 'supprime une zone', command: removeBuildZone({ context: 'author', index: 0 }) },
  { label: 'ajoute un objet hors inventaire', command: addAuthoredPlacement(addedMass) },
  { label: 'ajoute une balle', command: addAuthoredPlacement(addedBall) },
  {
    label: 'ajoute une entrée d’inventaire',
    command: addInventoryEntry({ context: 'author', entry: addedInventoryEntry }),
  },
  {
    label: 'change une quantité',
    command: updateInventoryQuantity({ context: 'author', entryId: 'beam-stock', quantity: 5 }),
  },
  {
    label: 'change les propriétés d’inventaire',
    command: updateInventoryProperties({
      context: 'author',
      entryId: 'beam-stock',
      props: { size: 'long' },
    }),
  },
  {
    label: 'change les permissions d’inventaire',
    command: updateInventoryPermissions({
      context: 'author',
      entryId: 'beam-stock',
      permissions: lockedPermissions,
    }),
  },
  {
    label: 'supprime une entrée d’inventaire',
    command: removeInventoryEntry({ context: 'author', entryId: 'beam-stock' }),
  },
  {
    label: 'change les permissions d’un objet placé',
    command: updatePlacementPermissions({
      context: 'author',
      placementId: 'beam-1',
      permissions: lockedPermissions,
    }),
  },
  {
    label: 'choisit la balle et le panier de l’objectif',
    command: updateLevelGoal({ context: 'author', ballId: 'ball-2', basketId: 'basket-2' }),
  },
  { label: 'change le titre', command: updateLevelTitle({ context: 'author', title: 'Nouveau' }) },
  {
    label: 'renseigne le pseudo (M14)',
    command: updateLevelAuthor({ context: 'author', author: 'Lili' }),
  },
  {
    label: 'retire le pseudo (M14)',
    command: updateLevelAuthor({ context: 'author', author: undefined }),
    document: createLevel({
      metadata: { title: 'Authoring test', description: 'Description', author: 'Lili' },
    }),
  },
  {
    label: 'change la description',
    command: updateLevelDescription({ context: 'author', description: 'Nouvelle description' }),
  },
  {
    label: 'retire la description',
    command: updateLevelDescription({ context: 'author', description: undefined }),
  },
  {
    label: 'définit le défi',
    command: setLevelChallenge({
      context: 'author',
      challenge: { elegantObjectCount: 3, minimalObjectCount: 2 },
    }),
  },
  {
    label: 'retire le défi',
    command: removeLevelChallenge({ context: 'author' }),
    document: createLevel({ challenge: { elegantObjectCount: 2, minimalObjectCount: 1 } }),
  },
];

const playerCommands: readonly Command<ConstructionAttempt>[] = [
  updateScene({ context: 'player', scene: { min: { x: 0, y: 0 }, max: { x: 20, y: 20 } } }),
  addBuildZone({ context: 'player', zone: addedZone }),
  moveBuildZone({ context: 'player', index: 0, offset: { x: 1, y: 1 } }),
  resizeBuildZone({
    context: 'player',
    index: 0,
    zone: { min: { x: 1, y: 1 }, max: { x: 7, y: 7 } },
  }),
  removeBuildZone({ context: 'player', index: 0 }),
  addAuthoredPlacement({ ...addedMass, context: 'player' }),
  addInventoryEntry({ context: 'player', entry: addedInventoryEntry }),
  updateInventoryQuantity({ context: 'player', entryId: 'beam-stock', quantity: 5 }),
  updateInventoryProperties({ context: 'player', entryId: 'beam-stock', props: { size: 'long' } }),
  updateInventoryPermissions({
    context: 'player',
    entryId: 'beam-stock',
    permissions: lockedPermissions,
  }),
  removeInventoryEntry({ context: 'player', entryId: 'beam-stock' }),
  updatePlacementPermissions({
    context: 'player',
    placementId: 'beam-1',
    permissions: lockedPermissions,
  }),
  updateLevelGoal({ context: 'player', ballId: 'ball-2', basketId: 'basket-2' }),
  updateLevelTitle({ context: 'player', title: 'Nouveau' }),
  updateLevelAuthor({ context: 'player', author: 'Lili' }),
  updateLevelDescription({ context: 'player', description: 'Nouvelle' }),
  setLevelChallenge({
    context: 'player',
    challenge: { elegantObjectCount: 2, minimalObjectCount: 1 },
  }),
  removeLevelChallenge({ context: 'player' }),
];

const expectUndoRedoRoundTrip = (
  command: Command<ConstructionAttempt>,
  initialDocument: LevelDocument = createLevel(),
): void => {
  const initialAttempt: ConstructionAttempt = { document: initialDocument, provenance: {} };
  const history = createHistory(initialAttempt);
  const applied = executeCommand(history, command);
  expect(applied.status).toBe('accepted');
  if (applied.status !== 'accepted') throw new Error('authoring command should be accepted');
  expect(applied.recorded).toBe(true);

  const undone = undo(applied.history);
  expect(undone.status).toBe('accepted');
  if (undone.status !== 'accepted') throw new Error('authoring command should be undoable');
  expect(undone.history.state.document).toEqual(initialAttempt.document);

  const redone = redo(undone.history);
  expect(redone.status).toBe('accepted');
  if (redone.status !== 'accepted') throw new Error('authoring command should be redoable');
  expect(redone.history.state).toEqual(applied.history.state);
};

describe('commandes d’auteur', () => {
  it.each(authoringCommands)('$label est annulable et rétablissable', ({ command, document }) => {
    expectUndoRedoRoundTrip(command, document);
  });

  it.each(playerCommands)('refuse une commande auteur au joueur sans mutation', (command) => {
    const state: ConstructionAttempt = { document: createLevel(), provenance: {} };
    const before = structuredClone(state);

    expect(command.execute(state)).toEqual({ status: 'rejected', reason: 'authoring-only' });
    expect(state).toEqual(before);
  });

  it('refuse une scène qui exclurait le centre d’un objet ou une zone', () => {
    const state = createLevel();

    expect(
      updateScene({
        context: 'author',
        scene: { min: { x: 0, y: 0 }, max: { x: 9, y: 9 } },
      }).execute({ document: state, provenance: {} }),
    ).toEqual({ status: 'rejected', reason: 'scene-excludes-content' });

    const zoneOutsideIfShrunk = createLevel({
      objects: createLevel().objects.filter((placement) => placement.id !== 'basket-1'),
      goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-2' },
      buildZones: [{ min: { x: 14, y: 14 }, max: { x: 16, y: 16 } }],
    });
    expect(
      updateScene({
        context: 'author',
        scene: { min: { x: 0, y: 0 }, max: { x: 13, y: 13 } },
      }).execute({ document: zoneOutsideIfShrunk, provenance: {} }),
    ).toEqual({ status: 'rejected', reason: 'scene-excludes-content' });
  });

  it('valide les entrées et les relations avant d’accepter une commande auteur', () => {
    const state = { document: createLevel(), provenance: {} };

    expect(
      moveBuildZone({ context: 'author', index: 4, offset: { x: 1, y: 1 } }).execute(state),
    ).toEqual({ status: 'rejected', reason: 'build-zone-not-found' });
    expect(
      resizeBuildZone({ context: 'author', index: 4, zone: addedZone }).execute(state),
    ).toEqual({ status: 'rejected', reason: 'build-zone-not-found' });
    expect(removeBuildZone({ context: 'author', index: 4 }).execute(state)).toEqual({
      status: 'rejected',
      reason: 'build-zone-not-found',
    });
    expect(
      addBuildZone({
        context: 'author',
        zone: { min: { x: 19, y: 19 }, max: { x: 21, y: 21 } },
      }).execute(state),
    ).toEqual({ status: 'rejected', reason: 'invalid-level-document' });
    expect(
      addInventoryEntry({
        context: 'author',
        entry: { ...addedInventoryEntry, id: 'ball-1' },
      }).execute(state),
    ).toEqual({ status: 'rejected', reason: 'identifier-already-used' });
    expect(
      updateInventoryQuantity({ context: 'author', entryId: 'beam-stock', quantity: 1.5 }).execute(
        state,
      ),
    ).toEqual({ status: 'rejected', reason: 'invalid-level-document' });
    expect(
      updateInventoryProperties({ context: 'author', entryId: 'beam-stock', props: {} }).execute(
        state,
      ),
    ).toEqual({ status: 'rejected', reason: 'invalid-level-document' });
    expect(
      updateLevelGoal({ context: 'author', ballId: 'basket-1', basketId: 'ball-1' }).execute(state),
    ).toEqual({ status: 'rejected', reason: 'goal-ball-not-found' });
    expect(
      setLevelChallenge({
        context: 'author',
        challenge: { elegantObjectCount: 1, minimalObjectCount: 2 },
      }).execute(state),
    ).toEqual({ status: 'rejected', reason: 'invalid-level-document' });
    expect(state.document).toEqual(createLevel());
  });

  it('n’enregistre pas d’entrée d’historique lorsqu’une valeur ne change pas', () => {
    const state = { document: createLevel(), provenance: {} };
    const history = createHistory(state);

    const unchanged = executeCommand(
      history,
      updateLevelTitle({ context: 'author', title: 'Authoring test' }),
    );

    expect(unchanged).toEqual({ status: 'accepted', history, recorded: false });
  });

  describe('pseudo de l’auteur (M14, ADR 0016 § Pseudo)', () => {
    const attributed = createLevel({
      metadata: {
        title: 'Authoring test',
        description: 'Description',
        author: 'Lili',
        basedOn: [{ title: 'Origine', author: 'Max' }],
      },
    });

    it('change ou retire le pseudo sans toucher au reste des métadonnées', () => {
      const changed = updateLevelAuthor({ context: 'author', author: 'Noé' }).execute({
        document: attributed,
        provenance: {},
      });
      expect(changed.status === 'accepted' && changed.state.document.metadata).toEqual({
        ...attributed.metadata,
        author: 'Noé',
      });

      const removed = updateLevelAuthor({ context: 'author', author: undefined }).execute({
        document: attributed,
        provenance: {},
      });
      expect(removed.status === 'accepted' && removed.state.document.metadata).toEqual({
        title: 'Authoring test',
        description: 'Description',
        basedOn: [{ title: 'Origine', author: 'Max' }],
      });
    });

    it('refuse un pseudo que le schéma refuse, sans rien réécrire', () => {
      const state = { document: attributed, provenance: {} };

      for (const author of ['Li\tli', 'Li\nli', 'x'.repeat(41), '   ']) {
        expect(updateLevelAuthor({ context: 'author', author }).execute(state)).toEqual({
          status: 'rejected',
          reason: 'invalid-level-document',
        });
      }
      expect(state.document).toEqual(attributed);
    });

    it('n’enregistre rien quand le pseudo ne change pas', () => {
      const history = createHistory<ConstructionAttempt>({ document: attributed, provenance: {} });

      expect(
        executeCommand(history, updateLevelAuthor({ context: 'author', author: 'Lili' })),
      ).toEqual({ status: 'accepted', history, recorded: false });
      const withoutAuthor = createHistory<ConstructionAttempt>({
        document: createLevel(),
        provenance: {},
      });
      expect(
        executeCommand(withoutAuthor, updateLevelAuthor({ context: 'author', author: undefined })),
      ).toEqual({ status: 'accepted', history: withoutAuthor, recorded: false });
    });
  });

  describe('description de l’auteur (M14b, ADR 0016)', () => {
    const attributed = createLevel({
      metadata: {
        title: 'Authoring test',
        description: 'Description',
        author: 'Lili',
        basedOn: [{ title: 'Origine', author: 'Max' }],
      },
    });

    it('change la description sans toucher au reste des métadonnées', () => {
      const changed = updateLevelDescription({
        context: 'author',
        description: 'Autre description',
      }).execute({ document: attributed, provenance: {} });

      expect(changed.status === 'accepted' && changed.state.document.metadata).toEqual({
        ...attributed.metadata,
        description: 'Autre description',
      });
    });

    it('retire seulement la description : titre, pseudo et sources restent', () => {
      const removed = updateLevelDescription({ context: 'author', description: undefined }).execute(
        { document: attributed, provenance: {} },
      );

      expect(removed.status === 'accepted' && removed.state.document.metadata).toEqual({
        title: 'Authoring test',
        author: 'Lili',
        basedOn: [{ title: 'Origine', author: 'Max' }],
      });
      expect(
        removed.status === 'accepted' && 'description' in removed.state.document.metadata,
      ).toBe(false);
    });

    it('ajoute une description à un niveau qui n’en a pas, le pseudo et les sources gardés', () => {
      const withoutDescription = createLevel({
        metadata: { title: 'Authoring test', author: 'Lili' },
      });

      const added = updateLevelDescription({ context: 'author', description: 'Nouvelle' }).execute({
        document: withoutDescription,
        provenance: {},
      });

      expect(added.status === 'accepted' && added.state.document.metadata).toEqual({
        title: 'Authoring test',
        author: 'Lili',
        description: 'Nouvelle',
      });
    });

    it('n’enregistre rien quand la description ne change pas', () => {
      const withDescription = createHistory<ConstructionAttempt>({
        document: attributed,
        provenance: {},
      });
      expect(
        executeCommand(
          withDescription,
          updateLevelDescription({ context: 'author', description: 'Description' }),
        ),
      ).toEqual({ status: 'accepted', history: withDescription, recorded: false });
      const withoutDescription = createHistory<ConstructionAttempt>({
        document: createLevel({ metadata: { title: 'Authoring test', author: 'Lili' } }),
        provenance: {},
      });
      expect(
        executeCommand(
          withoutDescription,
          updateLevelDescription({ context: 'author', description: undefined }),
        ),
      ).toEqual({ status: 'accepted', history: withoutDescription, recorded: false });
    });

    it('refuse une description que le schéma refuse, sans rien réécrire', () => {
      const state = { document: attributed, provenance: {} };

      expect(
        updateLevelDescription({ context: 'author', description: 'x'.repeat(2001) }).execute(state),
      ).toEqual({ status: 'rejected', reason: 'invalid-level-document' });
      expect(state.document).toEqual(attributed);
    });
  });

  describe('ajout d’un objet par l’auteur', () => {
    const accepted = (
      command: Command<ConstructionAttempt>,
      document: LevelDocument = createLevel(),
    ): ConstructionAttempt => {
      const outcome = command.execute({ document, provenance: {} });
      if (outcome.status !== 'accepted') throw new Error(`refusé : ${outcome.reason}`);
      return outcome.state;
    };

    it('pose n’importe quelle famille sans exiger ni consommer l’inventaire', () => {
      const levelWithoutStock = createLevel({ inventory: [] });
      const state = accepted(addAuthoredPlacement(addedMass), levelWithoutStock);

      expect(state.document.objects.at(-1)).toEqual({
        id: 'mass-1',
        type: 'mass',
        props: { weight: '10kg' },
        transform: { position: { x: 8, y: 4 }, rotation: 0 },
        // An object present at the start of a level is locked for the player.
        permissions: lockedPermissions,
      });
      expect(state.document.inventory).toEqual([]);
      expect(state.provenance).toEqual({});
      expect(state.document.goal?.ballId).toBe('ball-1');
    });

    it('agrandit la scène pour accueillir un objet posé au-delà de son bord', () => {
      const state = accepted(
        addAuthoredPlacement({
          ...addedMass,
          transform: { position: { x: 22.5, y: 4 }, rotation: 0 },
        }),
        createLevel(),
      );

      expect(state.document.scene).toEqual({ min: { x: 0, y: 0 }, max: { x: 24, y: 20 } });
      expect(state.document.objects.at(-1)?.transform.position).toEqual({ x: 22.5, y: 4 });
    });

    it('ignore les zones de construction : elles ne contraignent que le joueur', () => {
      const state = accepted(
        addAuthoredPlacement({
          ...addedMass,
          transform: { position: { x: 15, y: 15 }, rotation: 0 },
        }),
      );

      expect(state.document.objects.some(({ id }) => id === 'mass-1')).toBe(true);
    });

    it('ne fait pas d’une balle ajoutée sans rôle l’objectif, même s’il est déjà posé', () => {
      const state = accepted(addAuthoredPlacement(addedBall));

      expect(state.document.goal?.ballId).toBe('ball-1');
      expect(state.document.objects.some(({ id }) => id === 'ball-3')).toBe(true);
    });

    describe('balle rouge et panier du catalogue (ADR 0020)', () => {
      const { goal: ignoredGoal, ...withoutGoal } = createLevel({ inventory: [] });
      void ignoredGoal;
      const bare = (objects: LevelDocument['objects']): LevelDocument => ({
        ...withoutGoal,
        objects,
      });
      const ball = createLevel().objects[0];
      const basket = createLevel().objects[1];
      if (ball === undefined || basket === undefined) throw new Error('Fixture invalide.');
      const redBall = { ...addedBall, placementId: 'red-ball', goalRole: 'ball' } as const;
      const redBasket = {
        ...addedMass,
        placementId: 'the-basket',
        type: 'basket',
        props: {},
        goalRole: 'basket',
      } as const;

      it('pose la balle rouge et la désigne dans l’objectif, un panier ensuite le complète', () => {
        const withBall = accepted(addAuthoredPlacement(redBall), bare([]));
        expect(withBall.document.goal).toEqual({ type: 'basket', ballId: 'red-ball' });
        expect(withBall.document.objects.at(-1)).toMatchObject({ id: 'red-ball', type: 'ball' });

        const complete = accepted(addAuthoredPlacement(redBasket), withBall.document);
        expect(complete.document.goal).toEqual({
          type: 'basket',
          ballId: 'red-ball',
          basketId: 'the-basket',
        });
        expect(hasCompleteGoal(complete.document)).toBe(true);
      });

      it('n’autorise qu’un exemplaire de chacun', () => {
        const state = { document: createLevel(), provenance: {} };

        expect(addAuthoredPlacement(redBall).execute(state)).toEqual({
          status: 'rejected',
          reason: 'goal-role-taken',
        });
        expect(addAuthoredPlacement(redBasket).execute(state)).toEqual({
          status: 'rejected',
          reason: 'goal-role-taken',
        });
      });

      it('refuse une famille qui n’est pas celle du rôle', () => {
        expect(
          addAuthoredPlacement({ ...redBall, type: 'mass', props: { weight: '10kg' } }).execute({
            document: bare([]),
            provenance: {},
          }),
        ).toEqual({ status: 'rejected', reason: 'goal-role-mismatch' });
      });

      it('s’annule par l’historique, objectif compris', () => {
        const history = executeCommand(
          createHistory<ConstructionAttempt>({ document: bare([]), provenance: {} }),
          addAuthoredPlacement(redBall),
        );
        if (history.status !== 'accepted') throw new Error('refusé');

        const undone = undo(history.history);
        expect(undone.history.state.document).toEqual(bare([]));
        expect(redo(undone.history).history.state.document.goal?.ballId).toBe('red-ball');
      });

      it('laisse une balle ordinaire hors de l’objectif', () => {
        const state = accepted(addAuthoredPlacement(addedBall), bare([ball]));
        expect(state.document.goal).toBeUndefined();
      });
    });

    it('refuse un identifiant pris et des propriétés invalides', () => {
      const state = { document: createLevel(), provenance: {} };

      expect(addAuthoredPlacement({ ...addedMass, placementId: 'beam-1' }).execute(state)).toEqual({
        status: 'rejected',
        reason: 'identifier-already-used',
      });
      expect(
        addAuthoredPlacement({ ...addedMass, placementId: 'beam-stock' }).execute(state),
      ).toEqual({ status: 'rejected', reason: 'identifier-already-used' });
      expect(
        addAuthoredPlacement({ ...addedMass, props: { size: 'medium' } }).execute(state),
      ).toEqual({ status: 'rejected', reason: 'invalid-level-document' });
      expect(state.document).toEqual(createLevel());
    });
  });

  describe('réglage « Fixe / À placer » (U22)', () => {
    const run = (command: Command<ConstructionAttempt>, document = createLevel()) =>
      command.execute({ document, provenance: {} });

    it('marque un objet à placer, le remet fixe, et s’annule par l’historique', () => {
      const history = executeCommand(
        createHistory<ConstructionAttempt>({ document: createLevel(), provenance: {} }),
        setPlacementToPlace({ context: 'author', placementId: 'beam-1', toPlace: true }),
      );
      if (history.status !== 'accepted') throw new Error('refusé');
      const marked = history.history.state.document.objects.find(({ id }) => id === 'beam-1');

      expect(marked?.toPlace).toBe(true);
      const fixedAgain = run(
        setPlacementToPlace({ context: 'author', placementId: 'beam-1', toPlace: false }),
        history.history.state.document,
      );
      expect(
        fixedAgain.status === 'accepted' &&
          fixedAgain.state.document.objects.find(({ id }) => id === 'beam-1'),
      ).toEqual(createLevel().objects.find(({ id }) => id === 'beam-1'));
      expect(undo(history.history).history.state.document).toEqual(createLevel());
    });

    it('ne marque ni l’objectif, ni un objet absent, ni hors du mode auteur', () => {
      expect(
        run(setPlacementToPlace({ context: 'author', placementId: 'ball-1', toPlace: true })),
      ).toEqual({ status: 'rejected', reason: 'goal-object-protected' });
      expect(
        run(setPlacementToPlace({ context: 'author', placementId: 'missing', toPlace: true })),
      ).toEqual({ status: 'rejected', reason: 'placement-not-found' });
      expect(
        run(setPlacementToPlace({ context: 'player', placementId: 'beam-1', toPlace: true })),
      ).toEqual({ status: 'rejected', reason: 'authoring-only' });
    });
  });

  describe('réglage « Fixe / À placer » d’un fil (U25)', () => {
    const wiredLevel = createLevel({
      objects: [...createLevel().objects, wiredLever, wiredConveyor],
      wires: [{ id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1' }],
    });
    const run = (command: Command<ConstructionAttempt>, document = wiredLevel) =>
      command.execute({ document, provenance: {} });

    it('marque un fil à placer, le remet fixe, et conserve les extrémités', () => {
      const marked = run(
        setControlWireToPlace({ context: 'author', wireId: 'wire-1', toPlace: true }),
      );
      expect(
        marked.status === 'accepted' &&
          marked.state.document.wires.find(({ id }) => id === 'wire-1'),
      ).toEqual({ id: 'wire-1', sourceId: 'lever-1', targetId: 'conveyor-1', toPlace: true });

      if (marked.status !== 'accepted') return;
      const fixed = run(
        setControlWireToPlace({ context: 'author', wireId: 'wire-1', toPlace: false }),
        marked.state.document,
      );
      expect(
        fixed.status === 'accepted' && fixed.state.document.wires.find(({ id }) => id === 'wire-1'),
      ).toEqual(wiredLevel.wires[0]);
    });

    it('refuse un fil absent ou une modification côté joueur', () => {
      expect(
        run(setControlWireToPlace({ context: 'author', wireId: 'missing', toPlace: true })),
      ).toEqual({ status: 'rejected', reason: 'wire-not-found' });
      expect(
        setControlWireToPlace({ context: 'player', wireId: 'wire-1', toPlace: true }).execute({
          document: wiredLevel,
          provenance: {},
        }),
      ).toEqual({ status: 'rejected', reason: 'authoring-only' });
    });
  });
});

describe('révéler la solution de l’auteur (M7, ADR 0015)', () => {
  /** A received or campaign puzzle: decor, inventory, the author's solution. */
  const source: LevelDocument = levelDocumentSchema.parse({
    schemaVersion: 3,
    id: 'recu-0123456789abcdef',
    metadata: { title: 'Le grand saut', author: 'Lili' },
    objects: [
      {
        id: 'ball',
        type: 'ball',
        props: {},
        transform: { position: { x: 1, y: 1 }, rotation: 0 },
        permissions: lockedPermissions,
      },
      {
        id: 'basket',
        type: 'basket',
        props: {},
        transform: { position: { x: 11, y: 6 }, rotation: 0 },
        permissions: lockedPermissions,
      },
      {
        id: 'decor-lever',
        type: 'lever',
        props: { position: 'left' },
        transform: { position: { x: 2, y: 6 }, rotation: 0 },
        permissions: lockedPermissions,
      },
      {
        id: 'decor-fan',
        type: 'fan',
        props: { state: 'off' },
        transform: { position: { x: 4, y: 6 }, rotation: 0 },
        permissions: lockedPermissions,
      },
      {
        id: 'decor-barrier',
        type: 'barrier',
        props: { state: 'closed' },
        transform: { position: { x: 6, y: 6 }, rotation: 0 },
        permissions: lockedPermissions,
      },
      {
        id: 'decor-conveyor',
        type: 'conveyor',
        props: { direction: 'stopped' },
        transform: { position: { x: 8, y: 6 }, rotation: 0 },
        permissions: lockedPermissions,
      },
    ],
    inventory: [
      {
        id: 'beams',
        type: 'beam',
        props: { size: 'medium' },
        quantity: 2,
        permissions: { move: true, rotate: true, remove: true },
      },
      {
        id: 'buttons',
        type: 'button',
        props: {},
        quantity: 1,
        permissions: { move: true, rotate: false, remove: true },
      },
      {
        id: 'wires',
        type: 'wire',
        props: {},
        quantity: 2,
        permissions: { move: false, rotate: false, remove: true },
      },
    ],
    goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
    buildZones: [{ min: { x: 0, y: 0 }, max: { x: 12, y: 7 } }],
    scene: { min: { x: 0, y: 0 }, max: { x: 12, y: 7 } },
    wires: [{ id: 'decor-wire', sourceId: 'decor-lever', targetId: 'decor-barrier' }],
    solution: {
      placements: [
        { inventoryId: 'beams', transform: { position: { x: 8.25, y: 3.75 }, rotation: 0.3 } },
        {
          inventoryId: 'buttons',
          placementId: 'auteur-bouton',
          transform: { position: { x: 7, y: 2 }, rotation: 0 },
        },
      ],
      wires: [
        {
          id: 'fil-bouton',
          inventoryId: 'wires',
          sourceId: 'auteur-bouton',
          targetId: 'decor-fan',
        },
        {
          id: 'fil-levier',
          inventoryId: 'wires',
          sourceId: 'decor-lever',
          targetId: 'decor-conveyor',
        },
      ],
    },
  });

  const creation = creationFromLevel(source, { createId: () => 'creation-m7' }).document;
  const attemptOf = (document: LevelDocument): ConstructionAttempt => ({
    document,
    provenance: {},
  });
  const reveal = revealAuthorSolution({ context: 'author', source });

  const revealedOn = (document: LevelDocument): LevelDocument => {
    const outcome = reveal.execute(attemptOf(document));
    if (outcome.status !== 'accepted') throw new Error(`reveal rejected: ${outcome.reason}`);
    return outcome.state.document;
  };

  it('sur une création intacte, pose ce que `workshopFromPuzzle` poserait, sans fil ignoré', () => {
    const asWorkshop = workshopFromPuzzle(source);

    const revealed = revealedOn(creation);

    expect(revealed.objects).toEqual(asWorkshop.objects);
    expect(revealed.wires).toEqual(asWorkshop.wires);
    expect(revealed.inventory).toEqual([]);
    expect(revealed.metadata).toEqual(creation.metadata);
    expect(revealed.solution).toBeUndefined();
    expect(reveal.ignoredWireCount(attemptOf(creation))).toBe(0);
  });

  it('ajoute sans rien retirer : les objets et fils du remixeur restent, identifiants dédoublonnés', () => {
    const remixed: LevelDocument = {
      ...creation,
      objects: [
        ...creation.objects,
        {
          id: 'beams-2',
          type: 'barrier',
          props: { state: 'open' },
          transform: { position: { x: 10, y: 6 }, rotation: 0 },
          permissions: lockedPermissions,
        },
      ],
      wires: [
        ...creation.wires,
        { id: 'fil-bouton', sourceId: 'decor-lever', targetId: 'beams-2' },
      ],
    };

    const revealed = revealedOn(remixed);

    expect(revealed.objects.slice(0, remixed.objects.length)).toEqual(remixed.objects);
    expect(revealed.wires.slice(0, remixed.wires.length)).toEqual(remixed.wires);
    expect(revealed.objects.slice(remixed.objects.length).map(({ id }) => id)).toEqual([
      'beams-3',
      'buttons-2',
    ]);
    expect(revealed.wires.slice(remixed.wires.length)).toEqual([
      { id: 'fil-bouton-2', sourceId: 'buttons-2', targetId: 'decor-fan', toPlace: true },
      { id: 'fil-levier', sourceId: 'decor-lever', targetId: 'decor-conveyor', toPlace: true },
    ]);
    expect(levelDocumentSchema.safeParse(revealed).success).toBe(true);
  });

  it('ignore le fil qui touchait un objet du décor supprimé et le compte', () => {
    const withoutConveyor: LevelDocument = {
      ...creation,
      objects: creation.objects.filter(({ id }) => id !== 'decor-conveyor'),
    };

    const revealed = revealedOn(withoutConveyor);

    expect(revealed.wires.map(({ id }) => id)).toEqual(['decor-wire', 'fil-bouton']);
    expect(reveal.ignoredWireCount(attemptOf(withoutConveyor))).toBe(1);
    expect(levelDocumentSchema.safeParse(revealed).success).toBe(true);
  });

  it('ignore le fil qui viserait un appareil déjà commandé et le compte (M7b)', () => {
    const remixWire = { id: 'fil-remix', sourceId: 'decor-lever', targetId: 'decor-fan' };
    const rewired: LevelDocument = { ...creation, wires: [...creation.wires, remixWire] };

    const revealed = revealedOn(rewired);

    expect(revealed.wires).toEqual([
      ...rewired.wires,
      { id: 'fil-levier', sourceId: 'decor-lever', targetId: 'decor-conveyor', toPlace: true },
    ]);
    expect(revealed.objects.slice(rewired.objects.length).map(({ id }) => id)).toEqual([
      'beams-2',
      'buttons-2',
    ]);
    expect(reveal.ignoredWireCount(attemptOf(rewired))).toBe(1);
    expect(levelDocumentSchema.safeParse(revealed).success).toBe(true);
  });

  it('agrandit une scène réduite par le remixeur comme une pose d’auteur (M7b)', () => {
    const narrowScene = { min: { x: 0, y: 0 }, max: { x: 8, y: 7 } };
    const narrowed: LevelDocument = {
      ...creation,
      objects: creation.objects.map((object) =>
        object.id === 'basket' || object.id === 'decor-conveyor'
          ? { ...object, transform: { ...object.transform, position: { x: 7.5, y: 4 } } }
          : object,
      ),
      buildZones: [narrowScene],
      scene: narrowScene,
    };
    const beamPose = { x: 8.25, y: 3.75 };
    const expected = addAuthoredPlacement({
      context: 'author',
      placementId: 'probe',
      type: 'beam',
      props: { size: 'medium' },
      transform: { position: beamPose, rotation: 0 },
    }).execute(attemptOf(narrowed));
    if (expected.status !== 'accepted') throw new Error('probe rejected');

    const revealed = revealedOn(narrowed);

    expect(revealed.scene).toEqual(expected.state.document.scene);
    expect(revealed.scene).toEqual({ min: { x: 0, y: 0 }, max: { x: 10, y: 7 } });
    expect(revealed.buildZones).toEqual([revealed.scene]);
    expect(revealed.objects.find(({ id }) => id === 'beams-2')?.transform.position).toEqual(
      beamPose,
    );
    expect(levelDocumentSchema.safeParse(revealed).success).toBe(true);
  });

  it('forme une seule entrée d’historique, annulable', () => {
    const history = createHistory(attemptOf(creation));

    const applied = executeCommand(history, reveal);

    expect(applied.status).toBe('accepted');
    if (applied.status !== 'accepted') return;
    expect(applied.recorded).toBe(true);
    expect(applied.history.past).toHaveLength(1);
    const undone = undo(applied.history);
    expect(undone.status).toBe('accepted');
    expect(undone.history.state.document).toEqual(creation);
    expect(undone.history.past).toHaveLength(0);
  });

  it('ne fige ni ne modifie le niveau source', () => {
    const pristine = structuredClone(source);

    executeCommand(createHistory(attemptOf(creation)), reveal);

    expect(source).toEqual(pristine);
    expect(Object.isFrozen(source.inventory[0]?.props)).toBe(false);
    expect(Object.isFrozen(source.solution?.placements[0]?.transform)).toBe(false);
  });

  it('est refusée en contexte joueur et quand la source n’a pas de solution', () => {
    expect(
      revealAuthorSolution({ context: 'player', source }).execute(attemptOf(creation)),
    ).toEqual({ status: 'rejected', reason: 'authoring-only' });
    const { solution: ignoredSolution, ...withoutSolution } = source;
    void ignoredSolution;
    expect(
      revealAuthorSolution({ context: 'author', source: withoutSolution }).execute(
        attemptOf(creation),
      ),
    ).toEqual({ status: 'rejected', reason: 'solution-not-found' });
  });
});
