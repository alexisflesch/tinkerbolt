import { describe, expect, it } from 'vitest';

import { embeddedLevels } from '../content/embedded-levels';
import { levelDocumentSchema, type LevelDocument } from '../domain/level-document';
import { worldToPixels, type BoardCanvasContext } from './board-renderer';
import {
  LEVEL_PREVIEW_REFERENCE_WIDTH,
  previewViewport,
  renderLevelPreview,
} from './level-preview';
import type { DecodedSprite, SpriteAsset, SpriteFamily, SpriteLoader } from './sprite-loader';

type Operation =
  | { readonly kind: 'setTransform'; readonly values: readonly number[] }
  | { readonly kind: 'fillRect'; readonly values: readonly number[]; readonly style: unknown }
  | { readonly kind: 'drawImage'; readonly values: readonly unknown[] }
  | { readonly kind: 'moveTo'; readonly values: readonly number[] }
  | { readonly kind: 'lineTo'; readonly values: readonly number[] }
  | { readonly kind: 'other'; readonly name: string };

/** A recording Canvas 2D double: every operation the renderer may call is there. */
const createContext = (): {
  readonly context: BoardCanvasContext;
  readonly operations: Operation[];
} => {
  const operations: Operation[] = [];
  const other = (name: string): void => {
    operations.push({ kind: 'other', name });
  };
  let fillStyle: string | CanvasGradient = '';
  const context = {
    save: (): void => {
      other('save');
    },
    restore: (): void => {
      other('restore');
    },
    setTransform: (...values: [number, number, number, number, number, number]): void => {
      operations.push({ kind: 'setTransform', values });
    },
    translate: (): void => {
      other('translate');
    },
    rotate: (): void => {
      other('rotate');
    },
    scale: (): void => {
      other('scale');
    },
    lineWidth: 1,
    globalAlpha: 1,
    strokeStyle: '',
    lineCap: 'butt',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    get fillStyle(): string | CanvasGradient {
      return fillStyle;
    },
    set fillStyle(value: string | CanvasGradient) {
      fillStyle = value;
    },
    fillRect: (...values: [number, number, number, number]): void => {
      operations.push({ kind: 'fillRect', values, style: fillStyle });
    },
    strokeRect: (): void => {
      other('strokeRect');
    },
    setLineDash: (): void => {
      other('setLineDash');
    },
    drawImage: (...values: readonly unknown[]): void => {
      operations.push({ kind: 'drawImage', values });
    },
    drawImageRegion: (...values: readonly unknown[]): void => {
      operations.push({ kind: 'drawImage', values });
    },
    beginPath: (): void => {
      other('beginPath');
    },
    moveTo: (...values: [number, number]): void => {
      operations.push({ kind: 'moveTo', values });
    },
    lineTo: (...values: [number, number]): void => {
      operations.push({ kind: 'lineTo', values });
    },
    arc: (): void => {
      other('arc');
    },
    ellipse: (): void => {
      other('ellipse');
    },
    stroke: (): void => {
      other('stroke');
    },
    fill: (): void => {
      other('fill');
    },
    fillText: (): void => {
      other('fillText');
    },
  } satisfies BoardCanvasContext;

  return { context, operations };
};

/** Every sprite is ready at once; the requested families are recorded. */
const createSpriteLoader = (): {
  readonly loader: SpriteLoader;
  readonly requested: SpriteFamily[];
} => {
  const requested: SpriteFamily[] = [];
  const sprite = (asset: SpriteAsset): DecodedSprite => ({ width: 64, height: 32, source: asset });
  return {
    requested,
    loader: {
      getState: () => 'ready',
      getSprite: sprite,
      loadForFamilies: (families) => {
        requested.push(...families);
        return Promise.resolve();
      },
    },
  };
};

const tutorial = (index: number): LevelDocument => {
  const level = embeddedLevels[index];
  if (level === undefined) throw new Error(`Tutoriel ${String(index + 1)} introuvable.`);
  return level;
};

const WORLD_EPSILON = 1e-9;

describe('previewViewport — cadrage de l’aperçu (V5)', () => {
  it('fait tenir toute la scène dans une vignette 16:9, centrée, sans marge', () => {
    const scene = tutorial(0).scene;
    const viewport = previewViewport(scene, { width: 320, height: 180 }, 2);
    const topLeft = worldToPixels(scene.min, viewport);
    const bottomRight = worldToPixels(scene.max, viewport);

    expect(viewport.cssWidth).toBe(LEVEL_PREVIEW_REFERENCE_WIDTH);
    expect(topLeft.x).toBeCloseTo(0, 6);
    expect(topLeft.y).toBeCloseTo(0, 6);
    expect(bottomRight.x).toBeCloseTo(viewport.cssWidth, 6);
    expect(bottomRight.y).toBeCloseTo(viewport.cssHeight, 6);
  });

  it('garde toute la scène visible et centrée quand le ratio diffère de 16:9', () => {
    const scene = { min: { x: 0, y: 0 }, max: { x: 16, y: 9 } };
    const square = previewViewport(scene, { width: 200, height: 200 }, 1);
    const topLeft = worldToPixels(scene.min, square);
    const bottomRight = worldToPixels(scene.max, square);

    expect(topLeft.x).toBeGreaterThanOrEqual(-WORLD_EPSILON);
    expect(bottomRight.x).toBeLessThanOrEqual(square.cssWidth + WORLD_EPSILON);
    expect(topLeft.y).toBeGreaterThan(0);
    expect(bottomRight.y).toBeLessThan(square.cssHeight);
    // Centred: as much paper above as below.
    expect(topLeft.y).toBeCloseTo(square.cssHeight - bottomRight.y, 6);

    const wide = previewViewport(scene, { width: 400, height: 100 }, 1);
    const wideTopLeft = worldToPixels(scene.min, wide);
    const wideBottomRight = worldToPixels(scene.max, wide);
    expect(wideTopLeft.y).toBeGreaterThanOrEqual(-WORLD_EPSILON);
    expect(wideBottomRight.y).toBeLessThanOrEqual(wide.cssHeight + WORLD_EPSILON);
    expect(wideTopLeft.x).toBeGreaterThan(0);
    expect(wideTopLeft.x).toBeCloseTo(wide.cssWidth - wideBottomRight.x, 6);
  });

  it('ne dépend pas de la taille de la vignette : le dessin garde les proportions de la grille', () => {
    const scene = tutorial(0).scene;
    const small = previewViewport(scene, { width: 160, height: 90 }, 1);
    const large = previewViewport(scene, { width: 640, height: 360 }, 1);

    expect(small.pixelsPerWorldUnit).toBe(large.pixelsPerWorldUnit);
    expect(small.pixelsPerWorldUnit).toBeGreaterThan(24);
  });

  it('donne à l’image la taille CSS × densité de pixels', () => {
    const scene = tutorial(0).scene;
    const viewport = previewViewport(scene, { width: 320, height: 180 }, 2);

    expect(viewport.cssWidth * viewport.devicePixelRatio).toBeCloseTo(640, 6);
    expect(viewport.cssHeight * viewport.devicePixelRatio).toBeCloseTo(360, 6);
  });
});

describe('renderLevelPreview — aperçu d’un document (V5)', () => {
  const render = async (
    document: LevelDocument,
    size = { width: 320, height: 180 },
    devicePixelRatio = 2,
  ) => {
    const { context, operations } = createContext();
    const { loader, requested } = createSpriteLoader();
    const canvas = { width: 0, height: 0 };
    await renderLevelPreview({
      document,
      cssWidth: size.width,
      cssHeight: size.height,
      devicePixelRatio,
      canvas,
      context,
      spriteLoader: loader,
    });
    return { canvas, operations, requested };
  };

  it('dimensionne le canevas à la taille CSS × densité', async () => {
    const { canvas } = await render(tutorial(0), { width: 320, height: 180 }, 2);

    expect(canvas).toEqual({ width: 640, height: 360 });
  });

  it('peint le parchemin sur toute la vignette, puis la grille, sans image de fond', async () => {
    const { operations } = await render(tutorial(0));
    const fills = operations.filter((operation) => operation.kind === 'fillRect');
    const viewport = previewViewport(tutorial(0).scene, { width: 320, height: 180 }, 2);

    expect(fills).toHaveLength(1);
    expect(fills[0]).toMatchObject({
      values: [0, 0, viewport.cssWidth, viewport.cssHeight],
      style: '#f6ead3',
    });
    expect(operations.some((operation) => operation.kind === 'lineTo')).toBe(true);
  });

  it('dessine chaque couche de sprite à l’intérieur de la vignette', async () => {
    const level = tutorial(0);
    const { operations, requested } = await render(level);
    const drawn = operations.filter((operation) => operation.kind === 'drawImage');

    expect(drawn.length).toBeGreaterThanOrEqual(level.objects.length);
    expect(new Set(requested)).toEqual(new Set(level.objects.map(({ type }) => type)));
  });

  it('dessine les sept tutoriels sans lever d’erreur', async () => {
    for (const index of [0, 1, 2, 3, 4]) {
      const { operations } = await render(tutorial(index));
      expect(operations.some((operation) => operation.kind === 'drawImage')).toBe(true);
    }
  });

  it('ne dessine ni sélection, ni poignée, ni contour pointillé, même pour un objet à placer', async () => {
    const level = tutorial(2);
    const first = level.objects.find(
      ({ id }) => id !== level.goal?.ballId && id !== level.goal?.basketId,
    );
    if (first === undefined) throw new Error('Le tutoriel 3 devrait avoir un objet décoratif.');
    const workshop = levelDocumentSchema.parse({
      ...level,
      solution: undefined,
      objects: level.objects.map((object) =>
        object.id === first.id ? { ...object, toPlace: true } : object,
      ),
    });

    const { operations } = await render(workshop);
    const names = operations.map((operation) =>
      operation.kind === 'other' ? operation.name : operation.kind,
    );

    expect(names).not.toContain('setLineDash');
    expect(names).not.toContain('strokeRect');
    expect(names).not.toContain('arc');
  });

  it('est déterministe : deux rendus du même document produisent les mêmes opérations', async () => {
    const first = await render(tutorial(3));
    const second = await render(tutorial(3));

    expect(second.operations).toEqual(first.operations);
  });

  it('applique la densité de pixels à la transformation', async () => {
    const { operations } = await render(tutorial(0), { width: 320, height: 180 }, 2);
    const transform = operations.find((operation) => operation.kind === 'setTransform');

    // 640 device pixels over the 640-unit reference width.
    expect(transform).toEqual({ kind: 'setTransform', values: [1, 0, 0, 1, 0, 0] });
  });
});
