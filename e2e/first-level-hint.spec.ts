import { storedEnvelope } from './indexed-db-fixture';
import { mkdir } from 'node:fs/promises';

import { expect, test, type Locator, type Page } from '@playwright/test';

const levelOne = '/levels/tuto-1/play';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

const hintOf = (page: Page): Locator => page.getByRole('region', { name: 'Aide du niveau 1' });

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('Élément sans boîte : il doit être affiché.');
  return box;
};

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The hint never covers the board, the action bar or the drawer's handle. */
const expectBesideTheBoard = async (page: Page, hint: Locator): Promise<void> => {
  const hintBox = await boxOf(hint);
  const covered = [
    page.getByRole('region', { name: 'Plateau de jeu' }),
    page.getByRole('button', { name: 'Lancer' }),
    page.getByRole('button', { name: 'Recommencer le niveau' }),
  ];
  for (const element of covered) expect(overlaps(hintBox, await boxOf(element))).toBe(false);
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('Viewport inconnu.');
  expect(hintBox.x).toBeGreaterThanOrEqual(0);
  expect(hintBox.y).toBeGreaterThanOrEqual(0);
  expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(viewport.width);
  expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(viewport.height);
};

const storedPreferences = async (page: Page): Promise<unknown> => {
  return storedEnvelope(page, 'preferences', 'player');
};

test('U8 — sur le niveau 1 neuf, l’aide montre « Lancer » puis le tiroir, se ferme d’un toucher et ne revient plus', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(levelOne);

  const hint = hintOf(page);
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Lance la machine avec « Lancer » pour la voir tourner.');
  await expectBesideTheBoard(page, hint);

  await page.getByRole('button', { name: 'Lancer' }).tap();
  await expect(hint).toBeHidden();
  await page.getByRole('button', { name: 'Recommencer', exact: true }).tap();
  await expect(hint).toContainText('Prends un objet dans le catalogue, pose-le sur le plateau');
  await expectBesideTheBoard(page, hint);

  await hint.getByRole('button', { name: 'Masquer l’aide' }).tap();
  await expect(hint).toBeHidden();
  expect(await storedPreferences(page)).toEqual({
    kind: 'preferences',
    version: 1,
    data: { firstLevelHintDone: true },
  });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Lancer' })).toBeVisible();
  await expect(hint).toBeHidden();
});

test('U8 — l’aide disparaît à la première pose et ne revient pas au rechargement', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(levelOne);
  const hint = hintOf(page);
  await expect(hint).toBeVisible();

  await page.getByRole('button', { name: 'Ouvrir le catalogue' }).tap();
  await page.getByRole('button', { name: /^Poutre courte/ }).tap();
  const canvas = page
    .getByRole('region', { name: 'Plateau de jeu' })
    .getByRole('img', { name: 'Rendu du plateau' });
  const canvasBox = await boxOf(canvas);
  await page.touchscreen.tap(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeEnabled();
  await expect(hint).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Lancer' })).toBeVisible();
  await expect(hint).toBeHidden();
});

test('U8 — captures de l’aide du niveau 1 aux trois formats', async ({ page }, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Les captures sont prises sur le profil mobile.',
  );
  await mkdir('test-results/first-level-hint', { recursive: true });

  for (const viewport of formats) {
    const size = `${String(viewport.width)}x${String(viewport.height)}`;
    const shot = (name: string) =>
      page.screenshot({
        path: `test-results/first-level-hint/${name}-${size}.png`,
        fullPage: true,
        scale: 'css',
      });
    await page.setViewportSize(viewport);
    await page.goto(levelOne);
    const hint = hintOf(page);
    await expect(hint).toBeVisible();
    await expectBesideTheBoard(page, hint);
    await page.waitForTimeout(200);
    await shot('lancer');

    await page.getByRole('button', { name: 'Lancer' }).tap();
    await page.getByRole('button', { name: 'Recommencer', exact: true }).tap();
    await expect(hint).toContainText('Prends un objet dans le catalogue');
    await expectBesideTheBoard(page, hint);
    await page.waitForTimeout(200);
    await shot('tiroir');
  }
});
