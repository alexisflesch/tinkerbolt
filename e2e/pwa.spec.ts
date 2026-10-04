import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('ouvre le niveau 1 hors ligne après le premier chargement', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'TinkerBolt' })).toBeVisible();

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state === 'activated';
        }),
      { timeout: 15_000 },
    )
    .toBe(true);

  await page.goto('/levels/tuto-1/play');
  await expect(page.getByText(/^Niveau 1\b/)).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'TinkerBolt' })).toBeVisible();
  await expect(page.getByText(/^Niveau 1\b/)).toBeVisible();
});

test('ouvre « Mes niveaux » hors ligne après le premier chargement (V2c)', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state === 'activated';
        }),
      { timeout: 15_000 },
    )
    .toBe(true);

  await page.goto('/my-levels');
  await expect(page.getByRole('region', { name: 'Niveaux reçus' })).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('region', { name: 'Niveaux reçus' })).toBeVisible();
});

test('précache la police et les sprites, pas les fonds inutilisés (V7)', async ({ request }) => {
  const response = await request.get('/sw.js');
  expect(response.ok()).toBe(true);
  const serviceWorker = await response.text();

  expect(serviceWorker).toContain('fonts/Nunito.woff2');
  expect(serviceWorker).toContain('assets/sprites/thumbs/basket.png');
  expect(serviceWorker).toContain('assets/splash/splash-screen-desktop.webp');
  expect(serviceWorker).not.toContain('assets/backgrounds/');
});

test('publie le favicon et les icônes installables fournis pour C6', async ({ page, request }) => {
  await page.goto('/');

  for (const size of ['16x16', '32x32', '48x48']) {
    const faviconLink = page.locator(`link[rel="icon"][sizes="${size}"]`);
    await expect(faviconLink).toHaveCount(1);
    const faviconHref = await faviconLink.getAttribute('href');
    if (faviconHref === null) throw new Error(`Le favicon ${size} n’a pas de chemin.`);

    const faviconResponse = await request.get(new URL(faviconHref, page.url()).toString());
    expect(faviconResponse.ok()).toBe(true);
    expect(faviconResponse.headers()['content-type']).toContain('image/png');
  }

  const appleTouchIcon = page.locator('link[rel="apple-touch-icon"][sizes="180x180"]');
  await expect(appleTouchIcon).toHaveCount(1);
  const appleTouchHref = await appleTouchIcon.getAttribute('href');
  if (appleTouchHref === null) throw new Error('L’icône Apple n’a pas de chemin.');
  const appleTouchResponse = await request.get(new URL(appleTouchHref, page.url()).toString());
  expect(appleTouchResponse.ok()).toBe(true);
  expect(appleTouchResponse.headers()['content-type']).toContain('image/png');

  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  expect(await manifestResponse.json()).toMatchObject({
    icons: [
      { src: 'icons/tinkerbolt-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/tinkerbolt-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: 'icons/tinkerbolt-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  });

  for (const icon of [
    'icons/tinkerbolt-192.png',
    'icons/tinkerbolt-512.png',
    'icons/tinkerbolt-maskable-512.png',
  ]) {
    const response = await request.get(new URL(icon, manifestResponse.url()).toString());
    expect(response.ok(), `${icon} doit être publié avec le manifeste`).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }
});

test('garde le splash au démarrage direct jusqu’au rendu de la route et 1,2 s', async ({
  page,
}) => {
  const startedAt = Date.now();
  await page.goto('/levels/tuto-1/play', { waitUntil: 'domcontentloaded' });

  const splash = page.locator('#startup-splash');
  await expect(splash).toBeVisible();
  const appRoot = page.locator('#root');
  await expect(appRoot).not.toHaveAttribute('aria-hidden', 'true');
  await expect(splash).toBeHidden({ timeout: 10_000 });
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1_200);
  await expect(page.getByText(/^Niveau 1\b/)).toBeVisible();

  await page.evaluate(() => {
    window.history.pushState({}, '', '/settings');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/settings$/);
  await expect(splash).toHaveCount(0);
});

test('signale un échec de chargement après les 1,2 s minimales', async ({ page }) => {
  let applicationBundleAborted = false;
  await page.route('**/assets/index-*.js', (route) => {
    applicationBundleAborted = true;
    return route.abort();
  });
  const startedAt = Date.now();
  await page.goto('/levels/tuto-1/play', { waitUntil: 'domcontentloaded' });

  expect(applicationBundleAborted).toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const error = document.getElementById('startup-error');
          return (
            error !== null && !error.hidden && window.getComputedStyle(error).display !== 'none'
          );
        }),
      { timeout: 5_000 },
    )
    .toBe(true);
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1_200);
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  await expect(page.locator('#root')).toHaveAttribute('aria-hidden', 'true');
});
