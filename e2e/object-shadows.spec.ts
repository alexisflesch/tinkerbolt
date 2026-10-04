import { mkdir } from 'node:fs/promises';

import { expect, test, type Locator, type Page } from '@playwright/test';
import { installPageClock, pausePageClock } from './page-clock';

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
const ballStart = { x: 1.5, y: 1.1 };
const inside = { x: 2.2, y: 4.5 };
const outside = { x: 5.8, y: 1.5 };
const shadowLevel = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'u3-sans-ombres',
  metadata: { title: 'Plateau sans ombres' },
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  objects: [
    {
      id: 'ball',
      type: 'ball',
      props: {},
      transform: { position: ballStart, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'basket',
      type: 'basket',
      props: {},
      transform: { position: { x: 7.1, y: 4.7 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'beam',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 2.2, y: 3.2 }, rotation: Math.PI / 12 },
      permissions: locked,
    },
    {
      id: 'mass',
      type: 'mass',
      props: { weight: '10kg' },
      transform: { position: { x: 5.3, y: 2.8 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'seesaw',
      type: 'seesaw',
      props: {},
      transform: { position: { x: 5, y: 4.1 }, rotation: 0 },
      permissions: locked,
    },
  ],
  inventory: [
    {
      id: 'inventory-beam',
      type: 'beam',
      props: { size: 'short' },
      quantity: 1,
      permissions: { move: true, rotate: true, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
  buildZones: [{ min: { x: 0, y: 2.5 }, max: { x: 4, y: 5.5 } }],
});

const camera = async (canvas: Locator) => {
  const bounds = await canvas.boundingBox();
  const [x, y] = ((await canvas.getAttribute('data-camera-origin')) ?? '').split(',').map(Number);
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  if (bounds === null || x === undefined || y === undefined || !(zoom > 0)) {
    throw new Error('La caméra doit être disponible.');
  }
  return { bounds, origin: { x, y }, zoom };
};

/** Red-channel darkening outside every sprite, against the parchment or the pre-ghost canvas. */
const darkening = async (
  canvas: Locator,
  point: Point,
  reference: 'background' | 'before-ghost' = 'background',
): Promise<number> => {
  const { origin, zoom } = await camera(canvas);
  const local = { x: (point.x - origin.x) * zoom, y: (point.y - origin.y) * zoom };
  const { actual, before } = await canvas.evaluate((element, at) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Canvas attendu.');
    const context = element.getContext('2d');
    if (context === null) throw new Error('Contexte 2D attendu.');
    const scale = element.width / element.getBoundingClientRect().width;
    const x = Math.round(at.x * scale);
    const y = Math.round(at.y * scale);
    const pixels: unknown = Reflect.get(window, '__shadowReference');
    return {
      actual: context.getImageData(x, y, 1, 1).data[0] ?? 0,
      before:
        pixels instanceof Uint8ClampedArray ? (pixels[(y * element.width + x) * 4] ?? 0) : null,
    };
  }, local);
  if (reference === 'before-ghost') {
    if (before === null) throw new Error('Référence du plateau absente.');
    return before - actual;
  }
  return (await expectedPaperPixel(canvas, local))[0] - actual;
};

const hover = async (page: Page, canvas: Locator, point: Point) => {
  const { bounds, origin, zoom } = await camera(canvas);
  await page.mouse.move(
    bounds.x + (point.x - origin.x) * zoom,
    bounds.y + (point.y - origin.y) * zoom,
  );
};

for (const viewport of formats) {
  test(`U3 abandonnée — aucune ombre au repos, en placement et en chute libre en ${String(viewport.width)} × ${String(viewport.height)}`, async ({
    page,
  }, testInfo) => {
    test.skip(!['mobile', 'v1'].includes(testInfo.project.name), 'Captures sur le profil tactile.');
    await installPageClock(page);
    await page.setViewportSize(viewport);
    await page.goto(`/shared${await encodeShareFragment(shadowLevel)}`);
    const canvas = page.getByRole('img', { name: 'Rendu du plateau' });
    await expect(canvas).toBeVisible();
    const ballShadow = { x: ballStart.x, y: ballStart.y + 0.3 + 0.08 };
    // These pixels would darken if the retained experiment were activated.
    await expect
      .poll(async () => Math.abs(await darkening(canvas, ballShadow)))
      .toBeLessThanOrEqual(3);
    for (const offset of [0.23, 0.35]) {
      expect(
        Math.abs(await darkening(canvas, { ...ballShadow, x: ballShadow.x + offset })),
      ).toBeLessThanOrEqual(3);
    }
    await mkdir('test-results/object-shadows-disabled', { recursive: true });
    const shot = (state: string) =>
      page.screenshot({
        path: `test-results/object-shadows-disabled/${state}-${String(viewport.width)}x${String(viewport.height)}.png`,
        fullPage: true,
        scale: 'css',
      });
    await shot('repos');

    const toggle = page.getByRole('button', { name: 'Ouvrir le catalogue' });
    if (await toggle.isVisible()) await toggle.tap();
    await page.getByRole('button', { name: 'Poutre courte, quantité : 1' }).tap();
    await expect(page.locator('.placement-cancel')).toBeVisible();
    await canvas.evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) throw new Error('Canvas attendu.');
      const context = element.getContext('2d');
      if (context === null) throw new Error('Contexte 2D attendu.');
      Reflect.set(
        window,
        '__shadowReference',
        context.getImageData(0, 0, element.width, element.height).data,
      );
    });
    await hover(page, canvas, inside);
    await expect(canvas).toHaveAttribute('data-placement-ghost', 'valid');
    await expect
      .poll(async () =>
        Math.abs(
          await darkening(canvas, { x: inside.x, y: inside.y + 0.125 + 0.08 }, 'before-ghost'),
        ),
      )
      .toBeLessThanOrEqual(3);
    await shot('fantome-valide');
    await hover(page, canvas, outside);
    await expect(canvas).toHaveAttribute('data-placement-ghost', 'invalid');
    await expect
      .poll(async () =>
        Math.abs(
          await darkening(canvas, { x: outside.x, y: outside.y + 0.125 + 0.08 }, 'before-ghost'),
        ),
      )
      .toBeLessThanOrEqual(3);
    await shot('fantome-invalide');
    await page.getByRole('button', { name: 'Annuler le placement' }).tap();

    await pausePageClock(page);
    await page.getByRole('button', { name: 'Lancer', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();
    await page.clock.runFor(400);
    await page.getByRole('button', { name: 'Mettre en pause' }).tap();
    await expect(page.getByText('Simulation en pause')).toBeVisible();
    const [x, y] = ((await canvas.getAttribute('data-simulation-ball-position')) ?? '')
      .split(',')
      .map(Number);
    if (x === undefined || y === undefined || !(y > ballStart.y + 0.1))
      throw new Error('La balle doit avoir chuté.');
    await expect
      .poll(async () => Math.abs(await darkening(canvas, { x, y: y + 0.3 + 0.08 })))
      .toBeLessThanOrEqual(3);
    await expect
      .poll(async () => Math.abs(await darkening(canvas, ballShadow)))
      .toBeLessThanOrEqual(3);
    await shot('simulation');
  });
}
