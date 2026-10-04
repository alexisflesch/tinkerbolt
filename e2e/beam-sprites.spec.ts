import { mkdir } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

const none = { move: false, rotate: false, remove: false } as const;
const placement = (x: number, y: number, rotation = 0) => ({
  position: { x, y },
  rotation,
});

/**
 * Three beams, one per length, each carrying a ball that rests on its top
 * edge (the beam is 0,25 thick and a ball 0,6 across, so its centre sits
 * 0,425 above the beam's axis): the sprite's upper edge meets the ball
 * exactly where the physical box does.
 */
const threeBeams = {
  schemaVersion: 3,
  id: 'trois-poutres',
  metadata: { title: 'Trois poutres' },
  scene: { min: { x: 0, y: 0 }, max: { x: 16, y: 9 } },
  objects: [
    {
      id: 'beam-short',
      type: 'beam',
      props: { size: 'short' },
      transform: placement(3, 2.5),
      permissions: none,
    },
    {
      id: 'ball-short',
      type: 'ball',
      props: {},
      transform: placement(3, 2.5 - 0.425),
      permissions: none,
    },
    {
      id: 'beam-medium',
      type: 'beam',
      props: { size: 'medium' },
      transform: placement(6, 5),
      permissions: none,
    },
    {
      id: 'ball-medium',
      type: 'ball',
      props: {},
      transform: placement(6, 5 - 0.425),
      permissions: none,
    },
    {
      id: 'beam-long',
      type: 'beam',
      props: { size: 'long' },
      transform: placement(11, 7.5),
      permissions: none,
    },
    {
      id: 'ball-goal',
      type: 'ball',
      props: {},
      transform: placement(11, 7.5 - 0.425),
      permissions: none,
    },
    {
      // A tilted beam: the sprite turns with its physical box.
      id: 'beam-tilted',
      type: 'beam',
      props: { size: 'medium' },
      transform: placement(12, 3, Math.PI / 12),
      permissions: none,
    },
    { id: 'basket', type: 'basket', props: {}, transform: placement(14.5, 1.2), permissions: none },
  ],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball-goal', basketId: 'basket' },
  buildZones: [],
} as const;

const captureFormats = async (page: Page, name: string): Promise<void> => {
  await mkdir('test-results/beam-sprites', { recursive: true });
  for (const viewport of formats) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `test-results/beam-sprites/${name}-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
      scale: 'css',
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
};

test('dessine une poutre courte, moyenne et longue avec leur propre sprite (U12)', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours tactile est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/my-levels');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'trois-poutres.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(threeBeams)),
  });
  const card = page
    .getByRole('region', { name: 'Niveaux reçus' })
    .getByRole('region', { name: 'Trois poutres' });
  await card.getByRole('button', { name: 'Jouer' }).tap();

  const canvas = page.getByRole('img', { name: 'Rendu du plateau' });
  await expect(canvas).toBeVisible();
  // The renderer draws nothing before every sprite is decoded.
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) return 0;
        const context = element.getContext('2d');
        if (context === null) return 0;
        const { data } = context.getImageData(0, 0, element.width, element.height);
        return data.reduce(
          (opaque, value, index) => opaque + (index % 4 === 3 && value > 0 ? 1 : 0),
          0,
        );
      }),
    )
    .toBeGreaterThan(0);
  await captureFormats(page, 'beams');
});
