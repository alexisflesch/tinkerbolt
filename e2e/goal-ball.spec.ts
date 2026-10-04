import { mkdir } from 'node:fs/promises';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { levelDocumentSchema } from '../src/domain/level-document';
import { encodeShareFragment } from '../src/infrastructure/level-share/level-share-codec';
import { expectedPaperPixel, type Rgba } from './board-paper';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

type Point = { readonly x: number; readonly y: number };

// The pixel comparisons below were calibrated on a dense screen (Pixel 5, ratio 2.75): at a
// ratio of 1 the sprite's soft edge reaches the sampled corner by a few levels.
test.use({ deviceScaleFactor: 2.75 });

const locked = { move: false, rotate: false, remove: false } as const;
const placed = (id: string, type: string, x: number, y: number) => ({
  id,
  type,
  props: {},
  transform: { position: { x, y }, rotation: 0 },
  permissions: locked,
});

const goalBall = { x: 1.5, y: 1 } as const;
const blueBall = { x: 4.5, y: 1 } as const;

/** The goal's ball and a second ball, side by side, both free to fall once launched. */
const twoBallLevel = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'u7-goal-ball',
  metadata: { title: 'Balle suivie' },
  objects: [
    placed('ball-1', 'ball', goalBall.x, goalBall.y),
    placed('ball-2', 'ball', blueBall.x, blueBall.y),
    placed('basket-1', 'basket', 7.1, 4.7),
  ],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [{ min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } }],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  wires: [],
});

/** Where U7 used to add its ring: this must now show only the board. */
const ringRadius = (zoom: number): number => 0.3 * zoom + 5;

const camera = async (canvas: Locator) => {
  const [x, y] = ((await canvas.getAttribute('data-camera-origin')) ?? '').split(',').map(Number);
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  if (x === undefined || y === undefined || !(zoom > 0)) {
    throw new Error('Le repère caméra doit être disponible pour viser une coordonnée monde.');
  }
  return { origin: { x, y }, zoom };
};

/** The canvas's colour on the ring's right edge around a world point. */
const ringPixel = async (
  canvas: Locator,
  centre: Point,
  backgroundOnly = false,
  sample: 'ring' | 'corner' | 'centre' = 'ring',
): Promise<Rgba> => {
  const { origin, zoom } = await camera(canvas);
  const local = {
    x:
      (centre.x - origin.x) * zoom +
      (sample === 'ring' ? ringRadius(zoom) : sample === 'corner' ? 0.3 * zoom : 0),
    y: (centre.y - origin.y) * zoom + (sample === 'corner' ? 0.28 * zoom : 0),
  };
  if (backgroundOnly) return expectedPaperPixel(canvas, local);
  return canvas.evaluate((element, point): Rgba => {
    if (!(element instanceof HTMLCanvasElement)) return [0, 0, 0, 0];
    const context = element.getContext('2d');
    if (context === null) return [0, 0, 0, 0];
    const scale = element.width / element.getBoundingClientRect().width;
    const data = context.getImageData(
      Math.round(point.x * scale),
      Math.round(point.y * scale),
      1,
      1,
    ).data;
    return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 0];
  }, local);
};

const isRingRed = ([red, green, blue, alpha]: Rgba): boolean =>
  alpha > 200 && red > 150 && red - green > 80 && red - blue > 80;

const openLevel = async (page: Page): Promise<Locator> => {
  await page.goto(`/shared${await encodeShareFragment(twoBallLevel)}`);
  await expect(page.getByText('Partage · Balle suivie')).toBeVisible();
  const canvas = page
    .getByRole('region', { name: 'Plateau de jeu' })
    .getByRole('img', { name: 'Rendu du plateau' });
  await expect(canvas).toBeVisible();
  // The renderer draws nothing before every sprite is decoded.
  await expect
    .poll(async () => isRingRed(await ringPixel(canvas, goalBall, false, 'centre')))
    .toBe(true);
  return canvas;
};

/** Launches the machine and pauses it once both balls have fallen a little. */
const launchAndPause = async (page: Page, canvas: Locator): Promise<Point> => {
  // Under load, polling and then clicking could pause after the balls had
  // fallen out of the scene. Advance a known duration with the browser clock.
  const time = new Date('2026-10-02T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  await page.getByRole('button', { name: 'Lancer' }).click();
  await page.clock.runFor(400);
  await expect
    .poll(async () => Number((await canvas.getAttribute('data-simulation-step')) ?? '0'))
    .toBeGreaterThan(15);
  await page.getByRole('button', { name: 'Mettre en pause' }).click();
  await expect(page.getByText('Simulation en pause')).toBeVisible();
  const [x, y] = ((await canvas.getAttribute('data-simulation-ball-position')) ?? '')
    .split(',')
    .map(Number);
  if (x === undefined || y === undefined || Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error('La position simulée de la balle doit être exposée.');
  }
  return { x, y };
};

const expectNoDecoration = async (canvas: Locator, centre: Point): Promise<void> => {
  for (const sample of ['ring', 'corner'] as const) {
    const actual = await ringPixel(canvas, centre, false, sample);
    const background = await ringPixel(canvas, centre, true, sample);
    for (const channel of [0, 1, 2, 3] as const) {
      expect(Math.abs(actual[channel] - background[channel])).toBeLessThanOrEqual(3);
    }
  }
};

const selectGoalBall = async (page: Page, canvas: Locator): Promise<void> => {
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error('Le plateau doit être visible.');
  const { origin, zoom } = await camera(canvas);
  await page.touchscreen.tap(
    bounds.x + (goalBall.x - origin.x) * zoom,
    bounds.y + (goalBall.y - origin.y) * zoom,
  );
  // The tap opens the properties a render later: in a compact layout they are a sheet over the
  // toolbar, which a player closes before launching. Wait for the panel so that its close button,
  // when the layout has one, is tested once it is there and never skipped by an early look.
  await expect(page.getByRole('region', { name: 'Propriétés de Balle' })).toBeVisible();
  const close = page.getByRole('button', { name: 'Fermer les propriétés' });
  if (await close.isVisible()) await close.click();
  await expect(
    page.getByRole('complementary', { name: 'Inspecteur des propriétés' }),
  ).toBeVisible();
};

test('R1 — la balle cible et la bleue gardent leurs sprites sans anneau ni carré, même sélectionnées et en simulation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const canvas = await openLevel(page);
  await expect(canvas).not.toHaveAttribute('data-goal-ball-marker');
  await expect(canvas).toHaveAttribute('data-red-balls', 'ball-1');
  await expect(canvas).toHaveAttribute('data-blue-balls', 'ball-2');
  await expectNoDecoration(canvas, goalBall);
  await expectNoDecoration(canvas, blueBall);

  await selectGoalBall(page, canvas);
  await expectNoDecoration(canvas, goalBall);

  const paused = await launchAndPause(page, canvas);
  expect(paused.y).toBeGreaterThan(goalBall.y + 0.1);
  await expectNoDecoration(canvas, paused);
  await expectNoDecoration(canvas, goalBall);

  await page.getByRole('button', { name: 'Voir l’objectif' }).click();
  const objective = page.getByRole('dialog', { name: 'Objectif du niveau' });
  await expect(objective).toContainText('Seule la balle rouge compte.');
  await expect(objective).not.toContainText('anneau');
});

test('R1 — captures sans surcharge, au repos, après sélection et en simulation, aux trois formats', async ({
  page,
}) => {
  await mkdir('test-results/goal-ball', { recursive: true });

  for (const viewport of formats) {
    const size = `${String(viewport.width)}x${String(viewport.height)}`;
    const shot = (name: string) =>
      page.screenshot({
        path: `test-results/goal-ball/${name}-${size}.png`,
        fullPage: true,
        scale: 'css',
      });
    await page.setViewportSize(viewport);
    await page.goto('about:blank');
    const canvas = await openLevel(page);
    await expectNoDecoration(canvas, goalBall);
    await shot('repos');
    await selectGoalBall(page, canvas);
    await expectNoDecoration(canvas, goalBall);
    await shot('selection');

    const paused = await launchAndPause(page, canvas);
    await expectNoDecoration(canvas, paused);
    await shot('simulation');
  }
});
