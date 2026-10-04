import { mkdir } from 'node:fs/promises';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { levelDocumentSchema } from '../src/domain/level-document';
import { encodeShareFragment } from '../src/infrastructure/level-share/level-share-codec';
import { canvasPixelAt, expectedPaperPixel } from './board-paper';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

const level = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'v2b-paper',
  metadata: { title: 'Le parchemin suit la caméra' },
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  objects: [
    {
      id: 'ball',
      type: 'ball',
      props: {},
      transform: { position: { x: 0.6, y: 0.6 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
    {
      id: 'basket',
      type: 'basket',
      props: {},
      transform: { position: { x: 7.1, y: 4.7 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
  ],
  inventory: [],
  buildZones: [],
  goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
});

interface PaperCheck {
  /** Points whose pixel differs from the plain parchment and grid by more than the tolerance. */
  readonly mismatches: number;
  readonly insideScene: number;
  readonly outsideScene: number;
}

/**
 * Compares real pixels with the repainted parchment and grid at empty, off-grid
 * points inside the scene and just outside its four edges: nothing, not even a
 * change of colour, may mark where the scene ends (V2b).
 */
const checkPaper = async (canvas: Locator): Promise<PaperCheck> => {
  const [ox, oy] = ((await canvas.getAttribute('data-camera-origin')) ?? '').split(',').map(Number);
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  if (ox === undefined || oy === undefined || !(zoom > 0)) {
    throw new Error('Le repère caméra doit être disponible.');
  }
  const inside = [
    { x: 3.3, y: 2.3 },
    { x: 4.6, y: 3.4 },
    { x: 0.3, y: 0.3 },
    { x: 7.7, y: 5.2 },
  ];
  const outside = [
    { x: -0.3, y: 2.3 },
    { x: 8.3, y: 3.4 },
    { x: 4.3, y: -0.4 },
    { x: 3.7, y: 5.9 },
  ];
  let mismatches = 0;
  let insideScene = 0;
  let outsideScene = 0;
  for (const [points, isInside] of [
    [inside, true],
    [outside, false],
  ] as const) {
    for (const point of points) {
      const local = { x: (point.x - ox) * zoom, y: (point.y - oy) * zoom };
      const actual = await canvasPixelAt(canvas, local);
      if (actual === null) continue;
      // Only empty spots: the ball and the basket stand at the scene's corners.
      if (isInside && (point.x < 1 || point.x > 7)) continue;
      if (isInside) insideScene += 1;
      else outsideScene += 1;
      const expected = await expectedPaperPixel(canvas, local);
      if (![0, 1, 2, 3].every((c) => Math.abs((actual[c] ?? 0) - (expected[c] ?? 0)) <= 3)) {
        mismatches += 1;
      }
    }
  }
  return { mismatches, insideScene, outsideScene };
};

const paperMatchesCamera = async (canvas: Locator): Promise<boolean> => {
  const { mismatches, insideScene } = await checkPaper(canvas);
  return insideScene > 0 && mismatches === 0;
};

const pan = async (page: Page, canvas: Locator) => {
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error('Plateau absent.');
  const touch = await page.context().newCDPSession(page);
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  try {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x, y }],
    });
    for (let step = 1; step <= 6; step += 1) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ id: 1, x: x + step * 6, y: y + step * 3 }],
      });
    }
  } finally {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
  }
};

for (const viewport of formats) {
  test(`V2b — parchemin uni et grille sur tout le viewport, sans bordure, avec zoom et panoramique à ${String(viewport.width)} × ${String(viewport.height)}`, async ({
    page,
  }) => {
    await mkdir('test-results/board-paper', { recursive: true });
    await page.setViewportSize(viewport);
    await page.goto(`/shared${await encodeShareFragment(level)}`);
    const board = page.getByRole('region', { name: 'Plateau de jeu' });
    const canvas = board.getByRole('img', { name: 'Rendu du plateau' });
    await expect(canvas).toBeVisible();
    await expect(board).toHaveCSS('background-image', 'none');
    await expect.poll(() => paperMatchesCamera(canvas)).toBe(true);
    // At the default fit the scene never fills the canvas exactly: at least one
    // point just outside it is checked, and it shows the same parchment.
    const fitted = await checkPaper(canvas);
    expect(fitted.outsideScene).toBeGreaterThan(0);
    expect(fitted.mismatches).toBe(0);
    const size = `${String(viewport.width)}x${String(viewport.height)}`;
    const shot = (name: string) =>
      page.screenshot({
        path: `test-results/board-paper/${name}-${size}.png`,
        fullPage: true,
        scale: 'css',
      });
    await shot('ajuste');
    const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
    await page.getByRole('button', { name: 'Zoom avant', exact: true }).tap();
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-camera-zoom')))
      .toBeGreaterThan(zoom);
    await expect.poll(() => paperMatchesCamera(canvas)).toBe(true);
    await shot('zoom');
    const origin = await canvas.getAttribute('data-camera-origin');
    await pan(page, canvas);
    await expect(canvas).not.toHaveAttribute('data-camera-origin', origin ?? '');
    await expect.poll(() => paperMatchesCamera(canvas)).toBe(true);
    await shot('panoramique');
    await page.getByRole('button', { name: 'Ajuster à la scène', exact: true }).tap();
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-camera-zoom')))
      .toBeCloseTo(zoom);
    await expect.poll(() => paperMatchesCamera(canvas)).toBe(true);
  });
}
