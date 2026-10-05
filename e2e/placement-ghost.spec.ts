import { mkdir } from 'node:fs/promises';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { levelDocumentSchema } from '../src/domain/level-document';
import { encodeShareFragment } from '../src/infrastructure/level-share/level-share-codec';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

const locked = { move: false, rotate: false, remove: false } as const;
const placed = (id: string, type: string, x: number, y: number) => ({
  id,
  type,
  props: {},
  transform: { position: { x, y }, rotation: 0 },
  permissions: locked,
});

/** A medium beam to place, a build zone on the left part of the scene only. */
const ghostLevel = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'u1-fantome',
  metadata: { title: 'Fantôme de placement' },
  objects: [placed('ball-1', 'ball', 0.6, 0.6), placed('basket-1', 'basket', 7.1, 4.7)],
  inventory: [
    {
      id: 'inventory-beam',
      type: 'beam',
      props: { size: 'medium' },
      quantity: 1,
      permissions: { move: true, rotate: true, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [{ min: { x: 0, y: 1.5 }, max: { x: 5, y: 5.5 } }],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  wires: [],
});

/** Inside the build zone, then outside it, in world units. */
const inside = { x: 2.6, y: 3 } as const;
const outside = { x: 6, y: 1 } as const;
/** The medium beam's footprint, 4 × 0,25 world units. */
const beamFootprint = { width: 4, height: 0.25 } as const;

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const camera = async (canvas: Locator) => {
  const bounds = await canvas.boundingBox();
  const rawOrigin = await canvas.getAttribute('data-camera-origin');
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  const [originX, originY] = (rawOrigin ?? '').split(',').map(Number);
  if (
    bounds === null ||
    originX === undefined ||
    originY === undefined ||
    !Number.isFinite(originX) ||
    !Number.isFinite(originY) ||
    !Number.isFinite(zoom) ||
    zoom <= 0
  ) {
    throw new Error('Le repère caméra doit être disponible pour viser une coordonnée monde.');
  }
  return { bounds, origin: { x: originX, y: originY }, zoom };
};

const screenPointForWorld = async (
  canvas: Locator,
  point: { readonly x: number; readonly y: number },
): Promise<{ readonly x: number; readonly y: number }> => {
  const { bounds, origin, zoom } = await camera(canvas);
  return { x: bounds.x + (point.x - origin.x) * zoom, y: bounds.y + (point.y - origin.y) * zoom };
};

const opaquePixels = (canvas: Locator): Promise<number> =>
  canvas.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) return 0;
    const context = element.getContext('2d');
    if (context === null) return 0;
    const { data } = context.getImageData(0, 0, element.width, element.height);
    let opaque = 0;
    for (let index = 3; index < data.length; index += 4) if ((data[index] ?? 0) > 0) opaque += 1;
    return opaque;
  });

/** Keeps the current canvas pixels as the reference later drawings are compared with. */
const keepReference = (canvas: Locator): Promise<void> =>
  canvas.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Le plateau n’est pas un canvas.');
    const context = element.getContext('2d');
    if (context === null) throw new Error('Le canvas n’a pas de contexte 2D.');
    Reflect.set(
      window,
      '__ghostReference',
      context.getImageData(0, 0, element.width, element.height).data,
    );
  });

/**
 * The box, in CSS pixels relative to the canvas, of every pixel that differs
 * from the reference inside `band` (CSS pixels too), or `null` when none does.
 */
const changedBox = (canvas: Locator, band: Box): Promise<Box | null> =>
  canvas.evaluate((element, area) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Le plateau n’est pas un canvas.');
    const context = element.getContext('2d');
    const reference: unknown = Reflect.get(window, '__ghostReference');
    if (context === null || !(reference instanceof Uint8ClampedArray)) return null;
    const scale = element.width / element.getBoundingClientRect().width;
    const { data } = context.getImageData(0, 0, element.width, element.height);
    const left = Math.max(0, Math.floor(area.x * scale));
    const right = Math.min(element.width, Math.ceil((area.x + area.width) * scale));
    const top = Math.max(0, Math.floor(area.y * scale));
    const bottom = Math.min(element.height, Math.ceil((area.y + area.height) * scale));
    let box: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const index = (y * element.width + x) * 4;
        let delta = 0;
        for (let channel = 0; channel < 4; channel += 1) {
          delta = Math.max(
            delta,
            Math.abs((data[index + channel] ?? 0) - (reference[index + channel] ?? 0)),
          );
        }
        if (delta < 24) continue;
        box =
          box === null
            ? { minX: x, minY: y, maxX: x, maxY: y }
            : {
                minX: Math.min(box.minX, x),
                minY: Math.min(box.minY, y),
                maxX: Math.max(box.maxX, x),
                maxY: Math.max(box.maxY, y),
              };
      }
    }
    if (box === null) return null;
    return {
      x: box.minX / scale,
      y: box.minY / scale,
      width: (box.maxX + 1 - box.minX) / scale,
      height: (box.maxY + 1 - box.minY) / scale,
    };
  }, band);

/** The beam's footprint at `point`, in CSS pixels relative to the canvas. */
const footprintBox = async (
  canvas: Locator,
  point: { readonly x: number; readonly y: number },
): Promise<Box> => {
  const { origin, zoom } = await camera(canvas);
  return {
    x: (point.x - beamFootprint.width / 2 - origin.x) * zoom,
    y: (point.y - beamFootprint.height / 2 - origin.y) * zoom,
    width: beamFootprint.width * zoom,
    height: beamFootprint.height * zoom,
  };
};

const grown = (box: Box, margin: number): Box => ({
  x: box.x - margin,
  y: box.y - margin,
  width: box.width + 2 * margin,
  height: box.height + 2 * margin,
});

const expectBoxNear = (actual: Box | null, expected: Box, tolerance: number): void => {
  expect(actual).not.toBeNull();
  if (actual === null) return;
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.x + actual.width - (expected.x + expected.width))).toBeLessThanOrEqual(
    tolerance,
  );
  expect(Math.abs(actual.y + actual.height - (expected.y + expected.height))).toBeLessThanOrEqual(
    tolerance,
  );
};

const openLevel = async (page: Page): Promise<Locator> => {
  await page.goto(`/shared${await encodeShareFragment(ghostLevel)}`);
  await expect(page.getByText('Partage · Fantôme de placement')).toBeVisible();
  const canvas = page
    .getByRole('region', { name: 'Plateau de jeu' })
    .getByRole('img', { name: 'Rendu du plateau' });
  await expect(canvas).toBeVisible();
  return canvas;
};

/** Picks the beam from the drawer; a wide screen shows the catalogue without a toggle. */
const chooseBeam = async (page: Page): Promise<void> => {
  const toggle = page.getByRole('button', { name: 'Ouvrir le catalogue' });
  const card = page.getByRole('button', { name: 'Poutre moyenne, quantité : 1' });
  await expect(toggle.or(card).first()).toBeVisible();
  const hasToggle = await toggle.isVisible();
  if (hasToggle) {
    await toggle.tap();
    await expect(page.getByRole('button', { name: 'Fermer le catalogue' })).toBeVisible();
    await page.waitForTimeout(300);
  }
  await card.tap();
  if (hasToggle) await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.placement-cancel')).toBeVisible();
};

const hover = async (canvas: Locator, page: Page, point: { x: number; y: number }) => {
  const screen = await screenPointForWorld(canvas, point);
  await page.mouse.move(screen.x, screen.y);
};

test('U1 — le fantôme de placement est l’objet, translucide, valide puis invalide, puis posé', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours tactile est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const canvas = await openLevel(page);
  await chooseBeam(page);
  // The renderer draws nothing before every sprite is decoded.
  await expect.poll(() => opaquePixels(canvas)).toBeGreaterThan(0);
  await expect(canvas).not.toHaveAttribute('data-placement-ghost');
  await keepReference(canvas);

  await hover(canvas, page, inside);
  await expect(canvas).toHaveAttribute('data-placement-ghost', 'valid');
  await expect(page.locator('.placement-preview')).toHaveCount(0);
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  await expect(board.getByRole('status')).toContainText('Aperçu de placement valide');

  const expected = await footprintBox(canvas, inside);
  const band = grown(expected, 12);
  // The ghost covers the beam's footprint at the camera's scale, plus its 2 px outline.
  await expect.poll(() => changedBox(canvas, band)).not.toBeNull();
  const ghostBox = await changedBox(canvas, band);
  expectBoxNear(ghostBox, expected, 3);

  await hover(canvas, page, outside);
  await expect(canvas).toHaveAttribute('data-placement-ghost', 'invalid');
  await expect(board.getByRole('status')).toHaveCount(0);

  // Back inside, then a tap places the beam where its ghost was.
  await hover(canvas, page, inside);
  await expect(canvas).toHaveAttribute('data-placement-ghost', 'valid');
  const tap = await screenPointForWorld(canvas, inside);
  await page.touchscreen.tap(tap.x, tap.y);
  await expect(canvas).not.toHaveAttribute('data-placement-ghost');
  await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeEnabled();
  // The placed beam is drawn over the ghost's box: same place, same size.
  // Only the beam's own rows are measured: the selected beam's rotation
  // handle hangs off its top-left corner, above the footprint.
  const beamRows = { ...band, y: expected.y + 1, height: expected.height - 2 };
  await expect
    .poll(async () => {
      const placedBox = await changedBox(canvas, beamRows);
      return placedBox === null
        ? Number.POSITIVE_INFINITY
        : Math.abs(placedBox.width - expected.width);
    })
    .toBeLessThanOrEqual(3);
  const placedBox = await changedBox(canvas, beamRows);
  expect(placedBox).not.toBeNull();
  if (placedBox !== null && ghostBox !== null) {
    expect(Math.abs(placedBox.x - ghostBox.x)).toBeLessThanOrEqual(3);
    expect(
      Math.abs(placedBox.x + placedBox.width - (ghostBox.x + ghostBox.width)),
    ).toBeLessThanOrEqual(3);
  }
  // The placed beam is selected: close its compact inspector to reach the drawer.
  const closeProperties = page.getByRole('button', { name: 'Fermer les propriétés' });
  if (await closeProperties.isVisible()) await closeProperties.tap();
  await page.getByRole('button', { name: 'Ouvrir le catalogue' }).tap();
  await expect(page.getByRole('button', { name: 'Poutre moyenne, quantité : 0' })).toBeDisabled();
});

test('U1 — captures du fantôme valide et invalide aux trois formats', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Les captures sont prises sur le profil mobile.',
  );
  await mkdir('test-results/placement-ghost', { recursive: true });

  for (const viewport of formats) {
    // Each format opens the level afresh: resizing mid-gesture cancels it, with a notice.
    await page.setViewportSize(viewport);
    // Same URL, same hash: leave first, or the app would keep its state.
    await page.goto('about:blank');
    const canvas = await openLevel(page);
    await chooseBeam(page);
    await expect.poll(() => opaquePixels(canvas)).toBeGreaterThan(0);
    for (const [state, point] of [
      ['valid', inside],
      ['invalid', outside],
    ] as const) {
      await hover(canvas, page, point);
      await expect(canvas).toHaveAttribute('data-placement-ghost', state);
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `test-results/placement-ghost/ghost-${state}-${String(viewport.width)}x${String(viewport.height)}.png`,
        fullPage: true,
        scale: 'css',
      });
    }
  }
});
