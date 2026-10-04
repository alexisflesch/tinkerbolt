/**
 * Sprite layers of each family, back to front (ADR 0007 § Convention de
 * sprite). A family drawn from several layers is split so that a part can
 * move on its own: the seesaw's board pivots over a still fulcrum, and the
 * ball's pattern spins under fixed shading and highlight.
 */
const spriteAssetsByFamily = {
  // Both balls are loaded: the goal's ball is red, any other one blue.
  ball: [
    'ball-base',
    'ball-spin',
    'ball-highlight',
    'second-ball-base',
    'second-ball-spin',
    'second-ball-highlight',
  ],
  basket: ['basket-back', 'basket-front'],
  // Three drawings, one per length: a beam is never one sprite stretched.
  beam: ['beam-short', 'beam-medium', 'beam-long'],
  seesaw: ['seesaw-fulcrum', 'seesaw-beam'],
  mass: ['mass-10kg'],
  box: ['box-wood', 'box-metal'],
  'electro-magnet': ['electro-magnet-off', 'electro-magnet-on'],
  piston: ['piston-rod', 'piston-housing', 'piston-plate'],
  lever: ['lever-base', 'lever-handle'],
  // Both belts are loaded: which one is drawn depends on the belt's direction.
  conveyor: ['conveyor-belt', 'conveyor-belt-left', 'conveyor-frame'],
  button: ['button-base', 'button-cap'],
  // The blades turn behind the body and show through the ring's opening.
  fan: ['fan-blades', 'fan-body'],
  // The bar slides behind the pillar, into it.
  barrier: ['barrier-bar', 'barrier-pillar'],
  // The spring's foot hides in the base; the platform sits on its top.
  springboard: ['springboard-spring', 'springboard-base', 'springboard-platform'],
} as const;

export type SpriteFamily = keyof typeof spriteAssetsByFamily;
export type SpriteAsset = (typeof spriteAssetsByFamily)[SpriteFamily][number];
type SpriteScale = 2 | 3;
type SpriteLoadState = 'idle' | 'loading' | 'ready' | 'failed';

const MAX_SPRITE_LOAD_ATTEMPTS = 3;

export const spriteAssetsForFamily = (family: SpriteFamily): readonly SpriteAsset[] =>
  spriteAssetsByFamily[family];

/**
 * A `public/` path under the deployment's base path (`/` locally, `/tinkerbolt/`
 * on GitHub Pages). Asset paths stay absolute from the site root on purpose:
 * a relative path would break under nested routes (ADR 0008).
 */
export const publicAssetUrl = (path: string, basePath: string): string =>
  `${basePath.replace(/\/$/, '')}${path}`;

const deploymentBasePath = import.meta.env.BASE_URL;

/** A family's picture, plus the blue ball: a ball that is not the goal's. */
export type SpriteThumbnail =
  | Exclude<SpriteFamily, 'box'>
  | 'second-ball'
  | 'box-wood'
  | 'box-metal';

/** One pre-composed picture per family, for catalogue cards (built by `art/build-sprites.py`). */
export const spriteThumbnailPath = (thumbnail: SpriteThumbnail): string =>
  publicAssetUrl(`/assets/sprites/thumbs/${thumbnail}.png`, deploymentBasePath);

export type DecodedSprite = Readonly<{
  readonly width: number;
  readonly height: number;
  /** The decoded bitmap handed to the canvas port's `drawImage`. */
  readonly source: unknown;
}>;

export type SpriteDecoder = (path: string) => Promise<DecodedSprite>;

type MaybePromise<T> = T | PromiseLike<T>;

type SpriteAssetResponse<TBlob> = Readonly<{
  readonly ok: boolean;
  readonly blob: () => Promise<TBlob>;
}>;

type SpriteBitmap<TSource> = Readonly<{
  readonly width: number;
  readonly height: number;
  readonly source: TSource;
}>;

type ImageBitmapSpriteDecoderOptions<TBlob, TSource> = Readonly<{
  readonly fetchAsset: (path: string) => MaybePromise<SpriteAssetResponse<TBlob>>;
  readonly createImageBitmap: (blob: TBlob) => MaybePromise<SpriteBitmap<TSource>>;
}>;

type SpriteLoaderOptions = Readonly<{
  readonly scale: SpriteScale;
  readonly decode: SpriteDecoder;
}>;

export type SpriteLoader = Readonly<{
  readonly getState: (family: SpriteFamily) => SpriteLoadState;
  readonly getSprite: (asset: SpriteAsset) => DecodedSprite | undefined;
  readonly loadForFamilies: (families: readonly SpriteFamily[]) => Promise<void>;
}>;

type SpriteRecord = {
  state: SpriteLoadState;
  attempts: number;
  sprite: DecodedSprite | undefined;
  error: Error | undefined;
  promise: Promise<void> | undefined;
};

const createSpriteRecord = (): SpriteRecord => ({
  state: 'idle',
  attempts: 0,
  sprite: undefined,
  error: undefined,
  promise: undefined,
});

const createRecords = (): ReadonlyMap<SpriteAsset, SpriteRecord> =>
  new Map(
    Object.values(spriteAssetsByFamily)
      .flat()
      .map((asset) => [asset, createSpriteRecord()]),
  );

export const spriteAssetPath = (asset: SpriteAsset, scale: SpriteScale): string =>
  publicAssetUrl(`/assets/sprites/${asset}@${String(scale)}x.png`, deploymentBasePath);

const toError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(String(reason));

const rejectedPromise = (reason: Error): Promise<void> => Promise.reject(reason);

export const createImageBitmapSpriteDecoder =
  <TBlob, TSource>({
    fetchAsset,
    createImageBitmap,
  }: ImageBitmapSpriteDecoderOptions<TBlob, TSource>): SpriteDecoder =>
  async (path: string): Promise<DecodedSprite> => {
    try {
      const response = await fetchAsset(path);
      if (!response.ok) {
        throw new Error(`Impossible de charger l'asset local: ${path}`);
      }

      const blob = await response.blob();
      return await createImageBitmap(blob);
    } catch (error: unknown) {
      throw toError(error);
    }
  };

export const createSpriteLoader = ({ scale, decode }: SpriteLoaderOptions): SpriteLoader => {
  const records = createRecords();

  const recordFor = (asset: SpriteAsset): SpriteRecord => {
    const record = records.get(asset);
    if (record === undefined) throw new Error(`Sprite inconnu : ${asset}`);
    return record;
  };

  const loadAsset = (asset: SpriteAsset): Promise<void> => {
    const record = recordFor(asset);

    if (record.state === 'ready') {
      return Promise.resolve();
    }

    if (record.state === 'failed' && record.attempts >= MAX_SPRITE_LOAD_ATTEMPTS) {
      return rejectedPromise(record.error ?? new Error('Le sprite est en échec de chargement.'));
    }

    if (record.state === 'loading' && record.promise !== undefined) {
      return record.promise;
    }

    record.state = 'loading';
    record.attempts += 1;
    record.error = undefined;
    record.promise = undefined;

    let decoded: Promise<DecodedSprite>;
    try {
      decoded = decode(spriteAssetPath(asset, scale));
    } catch (error: unknown) {
      const failure = toError(error);
      record.sprite = undefined;
      record.error = failure;
      record.state = 'failed';
      return rejectedPromise(failure);
    }

    record.promise = decoded
      .then((sprite) => {
        record.sprite = sprite;
        record.error = undefined;
        record.state = 'ready';
      })
      .catch((error: unknown) => {
        const failure = toError(error);
        record.sprite = undefined;
        record.error = failure;
        record.state = 'failed';
        throw failure;
      });

    return record.promise;
  };

  const getState = (family: SpriteFamily): SpriteLoadState => {
    const states = spriteAssetsForFamily(family).map((asset) => recordFor(asset).state);
    if (states.some((state) => state === 'failed')) return 'failed';
    if (states.every((state) => state === 'ready')) return 'ready';
    if (states.some((state) => state === 'loading')) return 'loading';
    return 'idle';
  };

  const getSprite = (asset: SpriteAsset): DecodedSprite | undefined => {
    const record = recordFor(asset);
    return record.state === 'ready' ? record.sprite : undefined;
  };

  const loadForFamilies = async (families: readonly SpriteFamily[]): Promise<void> => {
    const uniqueAssets = [...new Set(families.flatMap((family) => spriteAssetsForFamily(family)))];
    await Promise.all(uniqueAssets.map(loadAsset));
  };

  return {
    getState,
    getSprite,
    loadForFamilies,
  };
};
