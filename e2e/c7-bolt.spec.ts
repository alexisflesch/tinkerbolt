import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { levelDocumentSchema } from '../src/domain/level-document';
import { tapWorldPoint } from './puzzle-machine';

const tutorial = levelDocumentSchema.parse(
  JSON.parse(readFileSync('src/content/levels/tuto-1.json', 'utf8')),
);

const captureFormats = async (page: Page, screen: 'accueil' | 'victoire'): Promise<void> => {
  await mkdir('tmp/c7/captures', { recursive: true });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `tmp/c7/captures/${screen}-${String(viewport.width)}x${String(viewport.height)}.png`,
      animations: 'disabled',
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
};

test('C7 : affiche Bolt sur l’accueil et à la victoire de campagne', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'v1', 'Recette C7 desktop.');
  test.setTimeout(45_000);

  await page.goto('/');
  const homeBolt = page.locator('.home-bolt img');
  await expect(homeBolt).toHaveAttribute('alt', '');
  await expect
    .poll(() => homeBolt.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await captureFormats(page, 'accueil');

  await page.getByRole('link', { name: 'Jouer', exact: true }).click();
  await page.getByRole('button', { name: 'Jouer le niveau 1', exact: true }).click();
  const openCatalog = page.getByRole('button', { name: 'Ouvrir le catalogue' });
  if (await openCatalog.isVisible()) await openCatalog.click();
  await page.getByRole('button', { name: /^Poutre courte/u }).click();

  const placement = tutorial.solution?.placements[0];
  if (placement === undefined) throw new Error('Solution du tutoriel 1 absente.');
  await tapWorldPoint(page, placement.transform.position.x, placement.transform.position.y);
  await page.clock.install({ time: new Date('2026-10-04T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-04T12:00:00Z'));
  await page.getByRole('button', { name: 'Lancer', exact: true }).click();
  await page.clock.runFor(10_000);

  const victory = page.getByRole('dialog', { name: 'Bravo !' });
  // On a loaded machine the first run of the clock can end before the
  // simulation has gone far enough: keep the clock running until the result.
  await expect(async () => {
    await page.clock.runFor(2_000);
    await expect(victory).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 20_000 });
  const victoryBolt = victory.locator('.victory-bolt img');
  await expect(victoryBolt).toHaveAttribute('alt', '');
  await expect
    .poll(() => victoryBolt.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(victory.getByRole('button', { name: 'Recommencer' })).toBeVisible();
  await captureFormats(page, 'victoire');
});
