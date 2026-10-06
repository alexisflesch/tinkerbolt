import { describe, expect, it } from 'vitest';

import { embeddedWorkshopDocument } from '../content/embedded-levels';
import { isMachine, type LevelDocument } from '../domain/level-document';
import { decodeLevelFile } from '../infrastructure/level-file/level-file-codec';
import { decodeShareFragment } from '../infrastructure/level-share/level-share-codec';

import { sketchLevels as embeddedLevels } from '../../test/fixtures/sketch-campaign';

import {
  buildShareUrl,
  createShareLink,
  nameExportedLevel,
  prepareLevelExport,
  puzzleRefusalMessage,
} from './level-export';

const levelFour = embeddedLevels.find(({ id }) => id === 'campaign-04-retour-a-l-expediteur');
if (levelFour === undefined) throw new Error('Niveau 4 embarqué introuvable.');
const { solution: ignoredLevelFourSolution, ...levelFourWithoutSolution } = levelFour;
void ignoredLevelFourSolution;
const levelOne = embeddedLevels.find(({ id }) => id === 'campaign-01-la-bille-de-service');
if (levelOne === undefined) throw new Error('Niveau 1 embarqué introuvable.');
const { solution: ignoredSolution, ...levelOneWithoutSolution } = levelOne;
void ignoredSolution;

/** Level 1 as its author would build it: the reference beam in place, marked to place. */
const levelOneWorkshop: LevelDocument = {
  ...levelOneWithoutSolution,
  objects: [
    ...levelOneWithoutSolution.objects,
    {
      id: 'placement-1',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 5, y: 2.15 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
      toPlace: true,
    },
  ],
};

const successfulExportRun = (document: LevelDocument): 'won' | 'lost' =>
  document.objects.length > levelOne.objects.length ? 'won' : 'lost';

describe('export d’un niveau (U16, U22)', () => {
  it('exporte le puzzle vérifié : décor fixe, objets à placer en inventaire, solution de référence', () => {
    const result = prepareLevelExport(levelOneWorkshop, successfulExportRun);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.fileName).toBe('campaign-01-la-bille-de-service.json');
    expect(result.mimeType).toBe('application/json');
    const decoded = decodeLevelFile(result.fileText);
    expect(decoded).toEqual({ status: 'ok', document: result.puzzle });
    expect(result.puzzle.objects.map(({ id }) => id)).toEqual(levelOne.objects.map(({ id }) => id));
    expect(result.puzzle.inventory).toEqual([
      {
        id: 'beam-a-placer',
        type: 'beam',
        props: { size: 'short' },
        quantity: 1,
        permissions: { move: true, rotate: true, remove: true },
      },
    ]);
    expect(result.puzzle.solution).toEqual({
      placements: [
        {
          inventoryId: 'beam-a-placer',
          transform: { position: { x: 5, y: 2.15 }, rotation: 0 },
        },
      ],
    });
  });

  it('nomme le niveau exporté : titre, identifiant et fichier suivent le nom choisi', () => {
    const preparation = prepareLevelExport(levelOneWorkshop, successfulExportRun);
    if (preparation.status !== 'ready') throw new Error('Le puzzle du niveau 1 est refusé.');

    const named = nameExportedLevel(preparation.puzzle, '  Le Grand Saut de l’été !  ');

    expect(named).not.toBeNull();
    if (named === null) return;
    expect(named.puzzle.metadata.title).toBe('Le Grand Saut de l’été !');
    expect(named.puzzle.id).toBe('le-grand-saut-de-l-ete');
    expect(named.fileName).toBe('le-grand-saut-de-l-ete.json');
    expect(decodeLevelFile(named.fileText)).toEqual({ status: 'ok', document: named.puzzle });
    expect(named.puzzle.objects).toEqual(preparation.puzzle.objects);
  });

  it('refuse un nom vide et garde l’identifiant quand le nom n’a ni lettre ni chiffre', () => {
    const preparation = prepareLevelExport(levelOneWorkshop, successfulExportRun);
    if (preparation.status !== 'ready') throw new Error('Le puzzle du niveau 1 est refusé.');

    expect(nameExportedLevel(preparation.puzzle, '   ')).toBeNull();
    expect(nameExportedLevel(preparation.puzzle, '!?')?.puzzle.id).toBe(preparation.puzzle.id);
  });

  it('refuse un atelier sans objet à placer et invite à sélectionner ceux à poser (tutoiement, V7)', () => {
    expect(prepareLevelExport(embeddedWorkshopDocument)).toMatchObject({
      status: 'machine-only',
      refusal:
        'Aucun objet n’est à placer : sélectionne chaque objet que le joueur devra poser, puis choisis « À placer » dans ses propriétés.',
    });
  });

  it('offre la machine quand le défi est refusé, objectif conservé (ADR 0020)', () => {
    const result = prepareLevelExport(embeddedWorkshopDocument);

    if (result.status !== 'machine-only') throw new Error('Machine attendue.');
    expect(isMachine(result.machine)).toBe(true);
    expect(result.machine.goal).toEqual(embeddedWorkshopDocument.goal);
    expect(result.machine.objects.map(({ id }) => id)).toEqual(
      embeddedWorkshopDocument.objects.map(({ id }) => id),
    );
  });

  it('offre les deux types quand le puzzle est vérifié, la machine sans objet à placer', () => {
    const result = prepareLevelExport(levelOneWorkshop, successfulExportRun);

    if (result.status !== 'ready') throw new Error('Puzzle attendu.');
    expect(isMachine(result.machine)).toBe(true);
    expect(result.machine.objects).toHaveLength(levelOneWorkshop.objects.length);
    expect(result.machine.solution).toBeUndefined();
    expect(result.puzzle.solution).toBeDefined();
  });

  it('refuse le défi sans objectif complet avec une raison dédiée, et offre la machine', () => {
    const { goal: ignoredGoal, ...withoutGoal } = levelOneWorkshop;
    void ignoredGoal;
    const { inventory: ignoredInventory, ...rest } = withoutGoal;
    void ignoredInventory;
    const workshopWithoutGoal: LevelDocument = { ...rest, inventory: [] };

    const result = prepareLevelExport(workshopWithoutGoal, () => {
      throw new Error('La simulation ne doit pas être lancée.');
    });

    expect(result).toMatchObject({
      status: 'machine-only',
      refusal: 'L’objectif est incomplet : pose la balle rouge et le panier depuis le catalogue.',
    });
    if (result.status !== 'machine-only') return;
    expect(result.machine.goal).toBeUndefined();
  });

  it('refuse une machine complète qui ne gagne pas, ou un décor qui gagne seul', () => {
    expect(prepareLevelExport(levelOneWorkshop, () => 'lost')).toMatchObject({
      status: 'machine-only',
      refusal:
        'La machine complète ne gagne pas : avec tous les objets en place, la balle doit atteindre le panier.',
    });
    expect(prepareLevelExport(levelOneWorkshop, () => 'won')).toMatchObject({
      status: 'machine-only',
      refusal:
        'La balle atteint le panier sans les objets à placer : le joueur n’aurait rien à faire.',
    });
  });

  it('explique pourquoi un document invalide ne peut pas être exporté', () => {
    const depleted = {
      ...levelFourWithoutSolution,
      inventory: levelFour.inventory.map((entry) => ({ ...entry, quantity: 0 })),
    };

    const result = prepareLevelExport(depleted);

    expect(result).toMatchObject({
      status: 'machine-only',
      refusal:
        'Aucun objet n’est à placer : sélectionne chaque objet que le joueur devra poser, puis choisis « À placer » dans ses propriétés.',
    });
  });

  it('nomme une machine comme un puzzle : titre, identifiant, fichier relisible', () => {
    const result = prepareLevelExport(embeddedWorkshopDocument);
    if (result.status !== 'machine-only') throw new Error('Machine attendue.');

    const named = nameExportedLevel(result.machine, 'Ma machine', 'Lili', 'Elle roule.');

    if (named === null) throw new Error('Nom refusé.');
    expect(named.puzzle.id).toBe('ma-machine');
    expect(named.puzzle.metadata).toMatchObject({ title: 'Ma machine', author: 'Lili' });
    expect(decodeLevelFile(named.fileText)).toEqual({ status: 'ok', document: named.puzzle });
    expect(isMachine(named.puzzle)).toBe(true);
  });

  it('construit un lien /shared sous le chemin de base, décodable par le codec L23', async () => {
    const link = await createShareLink(
      embeddedWorkshopDocument,
      'https://exemple.test',
      '/tinkerbolt/',
    );

    expect(link.startsWith('https://exemple.test/tinkerbolt/shared#level=1.')).toBe(true);
    const fragment = new URL(link).hash;
    await expect(decodeShareFragment(fragment)).resolves.toEqual({
      status: 'ok',
      document: embeddedWorkshopDocument,
    });
  });

  it('accepte un chemin de base à la racine', () => {
    expect(buildShareUrl('#level=x', 'http://127.0.0.1:4173', '/')).toBe(
      'http://127.0.0.1:4173/shared#level=x',
    );
  });
});

describe('motifs de refus, au tutoiement (V7)', () => {
  it('demande de garder les objets à placer dans une zone de construction', () => {
    expect(puzzleRefusalMessage('solution-not-playable')).toBe(
      'Le joueur ne pourrait pas poser tous les objets à placer là où ils sont : garde-les dans une zone de construction.',
    );
  });
});
