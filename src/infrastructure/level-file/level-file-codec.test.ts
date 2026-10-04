import { describe, expect, it } from 'vitest';

import { selfSolvingLevel } from '../../../test/fixtures/self-solving-level';
import {
  levelDocumentSchema,
  type LevelDocument,
  type LevelDocumentV1,
} from '../../domain/level-document';
import { decodeLevelFile, encodeLevelFile, MAX_LEVEL_FILE_SIZE_BYTES } from './level-file-codec';

const legacyDocument: LevelDocumentV1 = {
  schemaVersion: 1,
  id: 'legacy-level',
  metadata: { title: 'Niveau historique' },
  objects: [
    {
      id: 'ball-1',
      type: 'ball',
      transform: { position: { x: 0, y: 0 }, rotation: 0 },
      props: {},
      permissions: { move: false, rotate: false, remove: false },
    },
    {
      id: 'basket-1',
      type: 'basket',
      transform: { position: { x: 4, y: 2 }, rotation: 0 },
      props: {},
      permissions: { move: false, rotate: false, remove: false },
    },
  ],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [{ min: { x: 0, y: 0 }, max: { x: 4, y: 2 } }],
};

const getChallengeAndWiresLevel = () =>
  levelDocumentSchema.parse({
    ...selfSolvingLevel,
    inventory: [
      {
        id: 'inventory-beam',
        type: 'beam',
        props: { size: 'short' },
        quantity: 1,
        permissions: { move: true, rotate: true, remove: true },
      },
      {
        id: 'inventory-mass',
        type: 'mass',
        props: { weight: '10kg' },
        quantity: 1,
        permissions: { move: true, rotate: false, remove: true },
      },
    ],
    challenge: { elegantObjectCount: 2, minimalObjectCount: 1 },
  });

describe('codec de fichier de niveau', () => {
  it('encode en JSON indenté, avec une nouvelle ligne finale et les clés du schéma dans l’ordre', () => {
    const document = getChallengeAndWiresLevel();

    const text = encodeLevelFile(document);

    expect(text.endsWith('\n')).toBe(true);
    expect(text).toBe(`${JSON.stringify(document, null, 2)}\n`);
    const decoded = decodeLevelFile(text);
    expect(decoded.status).toBe('ok');
    if (decoded.status !== 'ok') return;
    expect(Object.keys(decoded.document)).toEqual([
      'schemaVersion',
      'id',
      'metadata',
      'objects',
      'inventory',
      'goal',
      'buildZones',
      'scene',
      'wires',
      'challenge',
    ]);

    const reorderedDocument: LevelDocument = {
      challenge: document.challenge,
      wires: document.wires,
      scene: document.scene,
      buildZones: document.buildZones,
      goal: document.goal,
      inventory: document.inventory,
      objects: document.objects,
      metadata: document.metadata,
      id: document.id,
      schemaVersion: document.schemaVersion,
    };
    expect(encodeLevelFile(reorderedDocument)).toBe(text);
  });

  it('fait un aller-retour identique d’un niveau embarqué avec challenge et wires', () => {
    const document = getChallengeAndWiresLevel();

    const result = decodeLevelFile(encodeLevelFile(document));

    expect(result).toEqual({ status: 'ok', document });
    if (result.status !== 'ok') return;
    expect(result.document.challenge).toEqual(document.challenge);
    expect(result.document.wires).toEqual(document.wires);
  });

  it('fait un aller-retour identique d’un document avec un fil en inventaire (U21)', () => {
    const level = getChallengeAndWiresLevel();
    const document: LevelDocument = {
      ...level,
      inventory: [
        ...level.inventory,
        {
          id: 'inventory-wire',
          type: 'wire',
          props: {},
          quantity: 2,
          permissions: { move: false, rotate: false, remove: true },
        },
      ],
    };

    expect(decodeLevelFile(encodeLevelFile(document))).toEqual({ status: 'ok', document });
  });

  it('fait un aller-retour identique d’un atelier avec un objet à placer (U22)', () => {
    const level = getChallengeAndWiresLevel();
    const document: LevelDocument = {
      ...level,
      objects: level.objects.map((object) =>
        object.id === 'lever' ? { ...object, toPlace: true } : object,
      ),
    };

    const result = decodeLevelFile(encodeLevelFile(document));

    expect(result).toEqual({ status: 'ok', document });
  });

  it('fait un aller-retour identique d’un puzzle avec sa solution de référence (U22)', () => {
    const document: LevelDocument = {
      ...getChallengeAndWiresLevel(),
      solution: {
        placements: [
          { inventoryId: 'inventory-beam', transform: { position: { x: 3, y: 2 }, rotation: 0.5 } },
        ],
      },
    };

    const text = encodeLevelFile(document);

    expect(text).toContain('"solution"');
    expect(decodeLevelFile(text)).toEqual({ status: 'ok', document });
  });

  it('fait un aller-retour identique d’un niveau sans auteur ni sources (M1)', () => {
    const document = getChallengeAndWiresLevel();

    const result = decodeLevelFile(encodeLevelFile(document));

    expect(result).toEqual({ status: 'ok', document });
    if (result.status !== 'ok') return;
    expect(result.document.metadata).not.toHaveProperty('author');
    expect(result.document.metadata).not.toHaveProperty('basedOn');
  });

  it('fait un aller-retour identique d’un niveau avec auteur et sources (M1)', () => {
    const level = getChallengeAndWiresLevel();
    const document: LevelDocument = {
      ...level,
      metadata: {
        ...level.metadata,
        author: 'Mira',
        basedOn: [{ title: 'Le sonneur (remix)', author: 'Zed' }, { title: 'Le sonneur' }],
      },
    };

    const text = encodeLevelFile(document);

    expect(text).toContain('"basedOn"');
    expect(decodeLevelFile(text)).toEqual({ status: 'ok', document });
  });

  it('fait un aller-retour identique d’un niveau avec description, puis sans description (M14b)', () => {
    const level = getChallengeAndWiresLevel();
    const described: LevelDocument = {
      ...level,
      metadata: { ...level.metadata, description: 'Une description de l’auteur.' },
    };
    const { description: ignored, ...metadataWithoutDescription } = described.metadata;
    void ignored;
    const bare: LevelDocument = { ...level, metadata: metadataWithoutDescription };

    expect(decodeLevelFile(encodeLevelFile(described))).toEqual({
      status: 'ok',
      document: described,
    });
    const reread = decodeLevelFile(encodeLevelFile(bare));
    expect(reread).toEqual({ status: 'ok', document: bare });
    expect(reread.status === 'ok' && 'description' in reread.document.metadata).toBe(false);
  });

  it('valide puis migre un document v1 vers un document v3 utilisable', () => {
    const result = decodeLevelFile(JSON.stringify(legacyDocument));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.document.schemaVersion).toBe(3);
    expect(result.document.id).toBe('legacy-level');
    expect(result.document.scene.min.x).toBeLessThanOrEqual(0);
    expect(result.document.scene.max.x).toBeGreaterThanOrEqual(4);
    expect(result.document.wires).toEqual([]);
  });

  it('refuse le dépassement de taille en octets avant d’essayer le JSON', () => {
    expect(decodeLevelFile(' '.repeat(MAX_LEVEL_FILE_SIZE_BYTES + 1))).toEqual({
      status: 'error',
      code: 'too-large',
    });
    expect(decodeLevelFile('é'.repeat(Math.floor(MAX_LEVEL_FILE_SIZE_BYTES / 2) + 1))).toEqual({
      status: 'error',
      code: 'too-large',
    });
  });

  it('renvoie une erreur contrôlée pour un JSON invalide', () => {
    expect(decodeLevelFile('{ JSON cassé')).toEqual({
      status: 'error',
      code: 'invalid-json',
    });
  });

  it('refuse une version de document inconnue', () => {
    expect(decodeLevelFile('{"schemaVersion":4}')).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
  });

  it('refuse un document hors scène avec les problèmes Zod', () => {
    const document = getChallengeAndWiresLevel();
    const invalidDocument = {
      ...document,
      objects: document.objects.map((object) =>
        object.type === 'ball'
          ? {
              ...object,
              transform: {
                ...object.transform,
                position: { ...object.transform.position, x: document.scene.min.x - 1 },
              },
            }
          : object,
      ),
    };

    const result = decodeLevelFile(JSON.stringify(invalidDocument));

    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.code).toBe('invalid-document');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['objects', 2, 'transform', 'position', 'x'],
        }),
      ]),
    );
  });
});
