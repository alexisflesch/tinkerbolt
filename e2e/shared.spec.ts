import { browserRows } from './indexed-db-fixture';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

import sharedLevel from '../test/fixtures/campaign-sketches/campaign-02-par-dessus-le-mur.json' with { type: 'json' };
import { decodeLevelFile } from '../src/infrastructure/level-file/level-file-codec';
import { encodeShareFragment } from '../src/infrastructure/level-share/level-share-codec';

test('ouvre un lien partagé fabriqué par le codec sur mobile', async ({ page }, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours de partage est validé sur mobile.',
  );

  const fileResult = decodeLevelFile(JSON.stringify(sharedLevel));
  expect(fileResult.status).toBe('ok');
  if (fileResult.status !== 'ok') return;

  const fragment = await encodeShareFragment(fileResult.document);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/shared${fragment}`);

  await expect(page.getByText('Partage · Par-dessus le mur')).toHaveText(
    'Partage · Par-dessus le mur',
  );
  await expect(page.getByRole('button', { name: 'Lancer' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
  // M8 : le lien valide est gardé comme niveau reçu avant d’être joué.
  const receivedIndex = await browserRows(page, 'receivedLevels');
  expect(JSON.stringify(receivedIndex)).toMatch(/"recu-[0-9a-f]{16}"/);

  await mkdir('test-results/shared', { recursive: true });
  await page.screenshot({
    path: 'test-results/shared/shared-level-390x844.png',
    fullPage: true,
    scale: 'css',
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({
    path: 'test-results/shared/shared-level-844x390.png',
    fullPage: true,
    scale: 'css',
  });
});

test('affiche un message utile pour un partage invalide sur mobile', async ({ page }, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'La route de partage est validée sur mobile.',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shared#level=bad');
  await expect(page.getByRole('alert')).toHaveText(
    'Ce lien de partage est invalide ou ne peut plus être ouvert.',
  );
  await expect(page.getByRole('link', { name: 'Campagne', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Plateau de jeu' })).toHaveCount(0);

  await page.screenshot({
    path: 'test-results/shared/shared-error-390x844.png',
    fullPage: true,
    scale: 'css',
  });
});

test('joue un lien partagé et dit discrètement qu’il n’a pas été gardé quand le stockage est plein (M8)', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours de partage est validé sur mobile.',
  );

  const fileResult = decodeLevelFile(JSON.stringify(sharedLevel));
  expect(fileResult.status).toBe('ok');
  if (fileResult.status !== 'ok') return;
  const fragment = await encodeShareFragment(fileResult.document);
  await page.addInitScript(() => {
    for (const method of ['add', 'put'] as const) {
      IDBObjectStore.prototype[method] = () => {
        throw new DOMException('Quota dépassé', 'QuotaExceededError');
      };
    }
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/shared${fragment}`);

  await expect(page.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
  const notice = page.getByRole('status').filter({
    hasText: 'Ce niveau n’a pas été gardé sur cet appareil.',
  });
  await expect(notice).toBeVisible();

  await mkdir('test-results/shared', { recursive: true });
  for (const [width, height] of [
    [390, 844],
    [844, 390],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(notice).toBeVisible();
    await page.screenshot({
      path: `test-results/shared/shared-not-kept-${String(width)}x${String(height)}.png`,
      fullPage: true,
      scale: 'css',
    });
  }

  await page.getByRole('button', { name: 'Masquer le message' }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
});
