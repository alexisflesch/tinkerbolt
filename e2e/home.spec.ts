import { progressFixture, seedIndexedDB } from './indexed-db-fixture';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { navigateTo } from './app-navigation';

const HERO_TITLE = 'Amène la balle jusqu’au panier.';

/**
 * Identité visuelle : sous 861 px, les boutons de la feuille disparaissent et
 * la carte « Campagne » devient l'appel principal.
 */
const launchCommand = (page: Page, width: number): Locator =>
  width > 860
    ? page.getByRole('link', { name: 'Jouer', exact: true })
    : page
        .getByRole('navigation', { name: 'Explorer TinkerBolt' })
        .getByRole('link', { name: /^Campagne/u });

test('présente l’accueil sans débordement et mène à la campagne au tactile', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: HERO_TITLE })).toBeVisible();
    await expect(
      page.getByRole('progressbar', { name: 'Progression de la campagne' }),
    ).toHaveAttribute('value', '0');
    // V7 : les vignettes des trois lieux et l'aperçu réel du tutoriel 5.
    await expect
      .poll(() =>
        page
          .locator('.home-place img, .home-board img')
          .evaluateAll(
            (images) =>
              images.length === 4 &&
              images.every(
                (image) =>
                  image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
              ),
          ),
      )
      .toBe(true);
    // V7 : la police Nunito est déclarée et servie par l'application, sans réseau tiers.
    // (Son état de chargement n'est pas vérifié : le Chromium de certains bacs à sable
    // refuse toute police distante déclarée en CSS, quelle qu'elle soit.)
    expect(
      await page.evaluate(() =>
        [...document.fonts].some((font) => font.family.replaceAll('"', '') === 'Nunito'),
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
    const launch = launchCommand(page, viewport.width);
    const bounds = await launch.boundingBox();
    if (bounds === null) throw new Error('La commande principale doit être visible.');
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: `test-results/home/accueil-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
    });
  }
  const font = await page.request.get('/fonts/Nunito.woff2');
  expect(font.ok()).toBe(true);
  expect(font.headers()['content-type']).toBe('font/woff2');
  await launchCommand(page, 320).tap();
  await expect(page).toHaveURL(/\/levels$/);
  await expect(page.getByRole('region', { name: 'Campagne' })).toBeVisible();
});

test('ouvre chaque destination et revient à l’accueil depuis la navigation', async ({ page }) => {
  await page.goto('/');
  for (const { destination, path } of [
    { destination: 'Campagne', path: '/levels' },
    { destination: 'Atelier', path: '/editor' },
    { destination: 'Mes niveaux', path: '/my-levels' },
    { destination: 'Paramètres', path: '/settings' },
  ]) {
    await navigateTo(page, destination);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await navigateTo(page, 'Accueil');
    await expect(page.getByRole('heading', { name: HERO_TITLE })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Créer un niveau' }).tap();
  await expect(page).toHaveURL(/\/editor$/);

  // Start a clean history sequence after the route coverage loop above.
  await page.goto('/settings');
  await navigateTo(page, 'Accueil');
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
});

test('reprend la progression enregistrée après rechargement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await seedIndexedDB(page, [
    await progressFixture({ 'tuto-1': { resolved: true, bestObjectCount: 1 } }),
  ]);
  await page.reload();
  await expect(
    page
      .getByRole('navigation', { name: 'Explorer TinkerBolt' })
      .getByRole('link', { name: /^Campagne/u }),
  ).toContainText('1 / 7');
  await expect(
    page.getByRole('progressbar', { name: 'Progression de la campagne' }),
  ).toHaveAttribute('value', '1');
  await page.screenshot({
    path: 'test-results/home/accueil-progression-390x844.png',
    fullPage: true,
  });
  await launchCommand(page, 390).tap();
  await expect(page).toHaveURL(/\/levels$/);
  await expect(page.getByRole('button', { name: 'Jouer le niveau 2', exact: true })).toBeEnabled();
});
