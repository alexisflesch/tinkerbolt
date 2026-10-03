import { browserRows } from './indexed-db-fixture';
import { expect, test, type Page } from '@playwright/test';

const draftKeys = (page: Page): Promise<unknown[]> => browserRows(page, 'creations');

test('M13 — l’atelier libre s’enregistre à la première modification, sans entrée d’historique', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Parcours critique tactile, sur mobile.',
  );

  await page.goto('/editor');
  await expect(page.getByText('Atelier', { exact: true })).toBeVisible();
  expect(await draftKeys(page)).toEqual([]);
  const entries = await page.evaluate(() => window.history.length);

  const openCatalogue = page.getByRole('button', { name: 'Ouvrir le catalogue' });
  if ((await openCatalogue.count()) > 0) await openCatalogue.click();
  await page.getByRole('button', { name: 'Poutre moyenne' }).tap();
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const bounds = await board.boundingBox();
  if (bounds === null) throw new Error('Le plateau doit être mesurable.');
  await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page.getByRole('region', { name: 'Propriétés de Poutre' })).toBeVisible();

  await expect(page).toHaveURL(/\/editor\?draft=creation-[0-9a-f]{32}$/u);
  expect(await draftKeys(page)).toHaveLength(1);
  expect(await page.evaluate(() => window.history.length)).toBe(entries);

  // The workshop was not remounted: its history is still there.
  await expect(page.getByRole('button', { name: 'Annuler' })).toBeEnabled();

  const url = page.url();
  await page.reload();
  await expect(page.getByText('Atelier', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(url);
  expect(await draftKeys(page)).toHaveLength(1);
});
