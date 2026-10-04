import { readFileSync } from 'node:fs';

import { expect, test, type Locator } from '@playwright/test';

import { levelDocumentSchema } from '../src/domain/level-document';
import { tapWorldPoint } from './puzzle-machine';

const tutorial = levelDocumentSchema.parse(
  JSON.parse(readFileSync('src/content/levels/tuto-1.json', 'utf8')),
);

const desktopFormats = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
] as const;

const expectWithinViewport = async (
  locator: Locator,
  viewport: (typeof desktopFormats)[number],
): Promise<void> => {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) throw new Error('L’élément doit être mesurable.');
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
};

for (const viewport of desktopFormats) {
  test(`C10 — vérifie l’accueil, le splash, les icônes et le résultat (${String(viewport.width)} × ${String(viewport.height)})`, async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'v1', 'Recette fonctionnelle desktop de la v1.');
    test.setTimeout(45_000);
    await page.setViewportSize(viewport);

    await page.goto('/');
    await expect(page.locator('#startup-splash')).toHaveCount(0);
    const homeBolt = page.locator('.home-bolt img');
    await expect(homeBolt).toHaveAttribute('alt', '');
    await expect
      .poll(() => homeBolt.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expectWithinViewport(page.getByRole('link', { name: 'Jouer', exact: true }), viewport);
    await expectWithinViewport(homeBolt, viewport);

    for (const size of ['16x16', '32x32', '48x48']) {
      const icon = page.locator(`link[rel="icon"][sizes="${size}"]`);
      await expect(icon).toHaveCount(1);
      const href = await icon.getAttribute('href');
      if (href === null) throw new Error(`Le favicon ${size} n’a pas de chemin.`);
      const response = await request.get(new URL(href, page.url()).toString());
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
    }

    await page.goto('/levels/tuto-1/play', { waitUntil: 'domcontentloaded' });
    const splash = page.locator('#startup-splash');
    await expect(splash).toBeVisible();
    const splashArt = splash.locator('.splash-art img');
    await expect
      .poll(() => splashArt.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect
      .poll(() => splashArt.evaluate((image) => (image as HTMLImageElement).currentSrc))
      .toContain('splash-screen-desktop.webp');
    await expect(splash.getByRole('progressbar', { name: 'Chargement' })).toBeVisible();
    await expect(splash.getByText('Créé par Alexis Flesch')).toBeVisible();
    await expectWithinViewport(splash.locator('.loading'), viewport);
    await expect(splash).toBeHidden({ timeout: 10_000 });

    const openCatalogue = page.getByRole('button', { name: 'Ouvrir le catalogue' });
    if (await openCatalogue.isVisible()) await openCatalogue.click();
    await page.getByRole('button', { name: /^Poutre courte/u }).click();
    const placement = tutorial.solution?.placements[0];
    if (placement === undefined) throw new Error('Solution du tutoriel 1 absente.');
    await tapWorldPoint(page, placement.transform.position.x, placement.transform.position.y);

    await page.clock.install({ time: new Date('2026-10-05T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-05T12:00:00Z'));
    await page.getByRole('button', { name: 'Lancer', exact: true }).click();
    await expect(page.getByText('Simulation en cours', { exact: true })).toBeVisible();
    await page.clock.runFor(10_000);

    const victory = page.getByRole('dialog', { name: 'Bravo !' });
    const simulationCanvas = page.getByRole('img', { name: 'Rendu du plateau' });
    const simulationState = `pas ${String(await simulationCanvas.getAttribute('data-simulation-step'))}, balle ${String(await simulationCanvas.getAttribute('data-simulation-ball-position'))}`;
    await expect(victory, simulationState).toBeVisible();
    const victoryBolt = victory.locator('.victory-bolt img');
    await expect(victoryBolt).toHaveAttribute('alt', '');
    await expect
      .poll(() => victoryBolt.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(victory.getByRole('button', { name: 'Recommencer' })).toBeVisible();
    await expectWithinViewport(victory, viewport);
  });
}
