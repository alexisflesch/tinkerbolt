import { mkdir } from 'node:fs/promises';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { levelDocumentSchema } from '../src/domain/level-document';
import { encodeShareFragment } from '../src/infrastructure/level-share/level-share-codec';
import { expectedPaperPixel } from './board-paper';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

type Point = { readonly x: number; readonly y: number };

const locked = { move: false, rotate: false, remove: false } as const;
const placed = (id: string, type: string, x: number, y: number) => ({
  id,
  type,
  props: {},
  transform: { position: { x, y }, rotation: 0 },
  permissions: locked,
});

/** A short beam the player may move, inside a build zone on the left part of the scene. */
const zoneLevel = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'u13-zones',
  metadata: { title: 'Zones de construction' },
  objects: [
    placed('ball-1', 'ball', 0.6, 0.6),
    placed('basket-1', 'basket', 7.1, 4.7),
    {
      id: 'beam-1',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 2, y: 3 }, rotation: 0 },
      permissions: { move: true, rotate: true, remove: false },
    },
  ],
  // An inventory gives the player the undo button the test reads.
  inventory: [
    {
      id: 'inventory-mass',
      type: 'mass',
      props: { weight: '10kg' },
      quantity: 1,
      permissions: { move: true, rotate: false, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [{ min: { x: 0, y: 1.5 }, max: { x: 5, y: 5.5 } }],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  wires: [],
});

const beamStart = { x: 2, y: 3 } as const;
/** Past the zone's right edge (x = 5), on an empty part of the scene. */
const outside = { x: 6.4, y: 2.6 } as const;
/** Still inside the zone: the short beam spans 2,5 to 4,5. */
const inside = { x: 3.5, y: 4 } as const;
/** Empty points, in and out of the zone, to read the canvas's own pixels. */
const emptyInZone = { x: 4.4, y: 2.4 } as const;
const emptyOutOfZone = { x: 6.4, y: 1.2 } as const;

const screenPointForWorld = async (canvas: Locator, point: Point): Promise<Point> => {
  const bounds = await canvas.boundingBox();
  const [originX, originY] = ((await canvas.getAttribute('data-camera-origin')) ?? '')
    .split(',')
    .map(Number);
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  if (bounds === null || originX === undefined || originY === undefined || !(zoom > 0)) {
    throw new Error('Le repère caméra doit être disponible pour viser une coordonnée monde.');
  }
  return { x: bounds.x + (point.x - originX) * zoom, y: bounds.y + (point.y - originY) * zoom };
};

/** The canvas is opaque: compare its pixel with the untinted parchment and grid (V2b). */
const differenceFromBackgroundAt = async (canvas: Locator, point: Point): Promise<number> => {
  const bounds = await canvas.boundingBox();
  const screen = await screenPointForWorld(canvas, point);
  if (bounds === null) return Number.NaN;
  const local = { x: screen.x - bounds.x, y: screen.y - bounds.y };
  const pixel = await canvas.evaluate((element, at) => {
    if (!(element instanceof HTMLCanvasElement)) return null;
    const context = element.getContext('2d');
    if (context === null) return null;
    const scale = element.width / element.getBoundingClientRect().width;
    return Array.from(
      context.getImageData(Math.round(at.x * scale), Math.round(at.y * scale), 1, 1).data,
    );
  }, local);
  if (pixel === null) return Number.NaN;
  if (pixel[3] !== 255) return -1;
  const original = await expectedPaperPixel(canvas, local);
  return [0, 1, 2].reduce(
    (difference, channel) =>
      difference + Math.abs((pixel[channel] ?? 0) - (original[channel] ?? 0)),
    0,
  );
};

/** A one-finger drag through the browser's own touch events, held at the end for `whileHeld`. */
const dragTouch = async (
  page: Page,
  start: Point,
  target: Point,
  whileHeld?: () => Promise<void>,
): Promise<void> => {
  const session = await page.context().newCDPSession(page);
  let started = false;
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x: start.x, y: start.y, radiusX: 1, radiusY: 1, force: 1 }],
    });
    started = true;
    for (let step = 1; step <= 10; step += 1) {
      const progress = step / 10;
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            id: 1,
            x: start.x + (target.x - start.x) * progress,
            y: start.y + (target.y - start.y) * progress,
            radiusX: 1,
            radiusY: 1,
            force: 1,
          },
        ],
      });
    }
    await whileHeld?.();
  } finally {
    if (started)
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  }
};

const openLevel = async (page: Page): Promise<Locator> => {
  await page.goto(`/shared${await encodeShareFragment(zoneLevel)}`);
  await expect(page.getByText('Partage · Zones de construction')).toHaveText(
    'Partage · Zones de construction',
  );
  const canvas = page
    .getByRole('region', { name: 'Plateau de jeu' })
    .getByRole('img', { name: 'Rendu du plateau' });
  await expect(canvas).toBeVisible();
  // The renderer draws nothing before every sprite is decoded.
  await expect.poll(() => differenceFromBackgroundAt(canvas, beamStart)).toBeGreaterThan(20);
  return canvas;
};

/** Selects the beam so the player can begin a direct drag. */
const selectBeam = async (page: Page, canvas: Locator): Promise<void> => {
  const tap = await screenPointForWorld(canvas, beamStart);
  await page.touchscreen.tap(tap.x, tap.y);
  const objectBar = page.getByRole('toolbar', { name: 'Réglages de Poutre' });
  await expect(objectBar).toBeVisible();
  const clearPoint = await screenPointForWorld(canvas, emptyOutOfZone);
  await page.touchscreen.tap(clearPoint.x, clearPoint.y);
  await expect(objectBar).toHaveCount(0);
};

test('U13 — zone visible ; hors zone l’objet suit le doigt, puis revient avec un seul refus ; dans la zone, accepté', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours tactile est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const canvas = await openLevel(page);

  // The zone tints the scene inside it; the background stays unchanged outside.
  await expect(canvas).toHaveAttribute('data-build-zones', '1');
  expect(await differenceFromBackgroundAt(canvas, emptyInZone)).toBeGreaterThan(10);
  expect(await differenceFromBackgroundAt(canvas, emptyOutOfZone)).toBeLessThanOrEqual(3);

  await selectBeam(page, canvas);
  const refusal = page.getByText(/Action refusée/);
  const undo = page.getByRole('button', { name: 'Annuler', exact: true });
  await expect(undo).toBeDisabled();

  const start = await screenPointForWorld(canvas, beamStart);
  const target = await screenPointForWorld(canvas, outside);
  await dragTouch(page, start, target, async () => {
    // Still under the finger, out of the zone, as the invalid ghost; no message yet.
    await expect(canvas).toHaveAttribute('data-placement-ghost', 'invalid');
    const [x, y] = ((await canvas.getAttribute('data-placement-ghost-position')) ?? '')
      .split(',')
      .map(Number);
    expect(x).toBeCloseTo(outside.x, 1);
    expect(y).toBeCloseTo(outside.y, 1);
    await expect(refusal).toHaveCount(0);
  });

  // Lifted out of the zone: one refusal for the gesture, the beam back where it was.
  await expect(refusal).toHaveCount(1);
  await expect(canvas).not.toHaveAttribute('data-placement-ghost');
  await expect(undo).toBeDisabled();
  // Selection decoration may change around the beam during a refused drag;
  // verify the object remains at its source and no object appears outside.
  await expect.poll(() => differenceFromBackgroundAt(canvas, beamStart)).toBeGreaterThan(20);
  await expect
    .poll(() => differenceFromBackgroundAt(canvas, emptyOutOfZone))
    .toBeLessThanOrEqual(3);
  await page.waitForTimeout(300);
  await expect(refusal).toHaveCount(1);

  // Dragged inside the zone: accepted in one command, the refusal cleared.
  await dragTouch(page, start, await screenPointForWorld(canvas, inside), async () => {
    await expect(canvas).not.toHaveAttribute('data-placement-ghost');
  });
  await expect(undo).toBeEnabled();
  await expect(refusal).toHaveCount(0);
  await expect.poll(() => differenceFromBackgroundAt(canvas, inside)).toBeGreaterThan(20);
});

test('U13 — captures de la zone, du fantôme hors zone et du refus aux trois formats', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Les captures sont prises sur le profil mobile.',
  );
  await mkdir('test-results/build-zones', { recursive: true });

  for (const viewport of formats) {
    const size = `${String(viewport.width)}x${String(viewport.height)}`;
    const shot = (name: string) =>
      page.screenshot({
        path: `test-results/build-zones/${name}-${size}.png`,
        fullPage: true,
        scale: 'css',
      });
    await page.setViewportSize(viewport);
    // Same URL, same hash: leave first, or the app would keep its state.
    await page.goto('about:blank');
    const canvas = await openLevel(page);
    await expect(canvas).toHaveAttribute('data-build-zones', '1');
    await page.waitForTimeout(200);
    await shot('zone');

    await selectBeam(page, canvas);
    const start = await screenPointForWorld(canvas, beamStart);
    await dragTouch(page, start, await screenPointForWorld(canvas, outside), async () => {
      await expect(canvas).toHaveAttribute('data-placement-ghost', 'invalid');
      await page.waitForTimeout(200);
      await shot('hors-zone');
    });
    await expect(page.getByText(/Action refusée/)).toHaveCount(1);
    await page.waitForTimeout(200);
    await shot('refus');
  }
});
