import { afterEach, describe, expect, it, vi } from 'vitest';

import { selfSolvingLevel } from '../../../test/fixtures/self-solving-level';
import { levelDocumentSchema } from '../../domain/level-document';
import type { LevelDocument } from '../../domain/level-document';
import { encodeLevelFile } from '../level-file/level-file-codec';
import { crc32Ieee, decodeShareFragment, encodeShareFragment } from './level-share-codec';

const encodeBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
};

const compress = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const input = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
  const compressed = input.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
};

const levelTwelve = () =>
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('codec de partage par URL', () => {
  it('fait l’aller-retour d’une machine sans objectif (ADR 0020)', async () => {
    const { goal: ignoredGoal, ...rest } = selfSolvingLevel;
    void ignoredGoal;
    const machine = levelDocumentSchema.parse({ ...rest, inventory: [], solution: undefined });

    const result = await decodeShareFragment(await encodeShareFragment(machine));

    expect(result).toEqual({ status: 'ok', document: machine });
  });

  it('encode et décode un niveau avec challenge et wires', async () => {
    const document = levelTwelve();

    const fragment = await encodeShareFragment(document);
    const result = await decodeShareFragment(fragment);

    expect(fragment).toMatch(/^#level=1\.[0-9a-f]{8}\.\d+\.[A-Za-z0-9_-]+$/u);
    expect(result).toEqual({ status: 'ok', document });
    if (result.status !== 'ok') return;
    expect(result.document.challenge).toEqual(document.challenge);
    expect(result.document.wires).toEqual(document.wires);
  });

  it('encode et décode un niveau qui donne un fil au joueur (U21)', async () => {
    const level = levelTwelve();
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

    const result = await decodeShareFragment(await encodeShareFragment(document));

    expect(result).toEqual({ status: 'ok', document });
  });

  it('encode et décode un puzzle avec sa solution de référence (U22)', async () => {
    const document: LevelDocument = {
      ...levelTwelve(),
      solution: {
        placements: [
          { inventoryId: 'inventory-beam', transform: { position: { x: 3, y: 2 }, rotation: 0.5 } },
          { inventoryId: 'inventory-mass', transform: { position: { x: 5, y: 4 }, rotation: 0 } },
        ],
      },
    };

    const result = await decodeShareFragment(await encodeShareFragment(document));

    expect(result).toEqual({ status: 'ok', document });
  });

  it('encode et décode un niveau sans auteur ni sources, sans les ajouter (M1)', async () => {
    const document = levelTwelve();

    const result = await decodeShareFragment(await encodeShareFragment(document));

    expect(result).toEqual({ status: 'ok', document });
    if (result.status !== 'ok') return;
    expect(result.document.metadata).not.toHaveProperty('author');
    expect(result.document.metadata).not.toHaveProperty('basedOn');
  });

  it('encode et décode un niveau avec auteur et sources (M1)', async () => {
    const level = levelTwelve();
    const document: LevelDocument = {
      ...level,
      metadata: {
        ...level.metadata,
        author: 'Mira',
        basedOn: [{ title: 'Le sonneur (remix)', author: 'Zed' }, { title: 'Le sonneur' }],
      },
    };

    const result = await decodeShareFragment(await encodeShareFragment(document));

    expect(result).toEqual({ status: 'ok', document });
  });

  it('calcule le CRC-32 IEEE de référence', () => {
    expect(crc32Ieee(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926');
  });

  it('refuse une charge de plus de 16 384 caractères avant les autres contrôles', async () => {
    expect(await decodeShareFragment(`#level=${'x'.repeat(16_385)}`)).toEqual({
      status: 'error',
      code: 'too-large',
    });
  });

  it('refuse une version de format de partage inconnue', async () => {
    expect(await decodeShareFragment('#level=2.00000000.0.')).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
  });

  it('refuse une taille décompressée annoncée supérieure à 256 Kio', async () => {
    expect(await decodeShareFragment('#level=1.00000000.262145.')).toEqual({
      status: 'error',
      code: 'too-large',
    });
  });

  it('refuse un encodage base64url invalide', async () => {
    expect(await decodeShareFragment('#level=1.00000000.1.!')).toEqual({
      status: 'error',
      code: 'invalid-encoding',
    });
  });

  it('refuse une taille qui ne correspond pas aux octets décompressés', async () => {
    const documentBytes = new TextEncoder().encode(encodeLevelFile(levelTwelve()));
    const compressed = await compress(documentBytes);
    const fragment = `#level=1.${crc32Ieee(documentBytes).toString(16).padStart(8, '0')}.${String(documentBytes.length + 1)}.${encodeBase64Url(compressed)}`;

    expect(await decodeShareFragment(fragment)).toEqual({ status: 'error', code: 'size-mismatch' });
  });

  it('refuse un checksum CRC différent', async () => {
    const fragment = await encodeShareFragment(levelTwelve());
    const altered = fragment.replace(/^#level=1\.[0-9a-f]{8}\./u, '#level=1.00000000.');

    expect(await decodeShareFragment(altered)).toEqual({
      status: 'error',
      code: 'checksum-mismatch',
    });
  });

  it('renvoie l’erreur du codec pour un document compressé invalide', async () => {
    const invalidDocumentBytes = new TextEncoder().encode('{"schemaVersion":2}');
    const compressed = await compress(invalidDocumentBytes);
    const checksum = crc32Ieee(invalidDocumentBytes).toString(16).padStart(8, '0');
    const fragment = `#level=1.${checksum}.${String(invalidDocumentBytes.length)}.${encodeBase64Url(compressed)}`;

    expect(await decodeShareFragment(fragment)).toMatchObject({
      status: 'error',
      code: 'invalid-document',
    });
  });

  it('interrompt le flux de décompression dès que la bombe dépasse sa taille annoncée', async () => {
    const bomb = new Uint8Array(1_000_000);
    const compressed = await compress(bomb);
    let producedChunks = 0;
    let wasCancelled = false;
    class MeteredDecompressionStream {
      readonly readable = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            producedChunks += 1;
            controller.enqueue(new Uint8Array(producedChunks === 1 ? 1_001 : 999_000));
          },
          cancel() {
            wasCancelled = true;
          },
        },
        { highWaterMark: 0 },
      );
      readonly writable = new WritableStream<Uint8Array>();

      constructor(readonly format: CompressionFormat) {
        expect(format).toBe('deflate-raw');
      }
    }
    vi.stubGlobal('DecompressionStream', MeteredDecompressionStream);
    const checksum = crc32Ieee(bomb).toString(16).padStart(8, '0');
    const fragment = `#level=1.${checksum}.1000.${encodeBase64Url(compressed)}`;

    expect(await decodeShareFragment(fragment)).toEqual({ status: 'error', code: 'size-mismatch' });
    expect(producedChunks).toBe(1);
    expect(wasCancelled).toBe(true);
  });
});
