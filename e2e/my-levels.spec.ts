import { mkdir, readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';
import { navigateTo } from './app-navigation';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

const captureFormats = async (page: Page, name: string): Promise<void> => {
  await mkdir('test-results/my-levels', { recursive: true });
  for (const viewport of formats) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `test-results/my-levels/${name}-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
      scale: 'css',
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
};

test('importe un fichier depuis « Mes niveaux » et le retrouve dans la liste (M9)', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours tactile est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await navigateTo(page, 'Mes niveaux');

  await expect(page).toHaveURL(/\/my-levels$/u);
  const received = page.getByRole('region', { name: 'Niveaux reçus' });
  await expect(received.getByText(/aucun niveau reçu/u)).toBeVisible();
  await captureFormats(page, 'my-levels-empty');

  const document = await readFile('test/fixtures/self-solving-level.json', 'utf8');
  await expect(page.getByRole('button', { name: 'Importer', exact: true })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'self-solving-level.json',
    mimeType: 'application/json',
    buffer: Buffer.from(document),
  });

  await expect(received.getByRole('status')).toHaveText(
    '« Machine en chaîne » est dans tes niveaux reçus.',
  );
  await expect(page).toHaveURL(/\/my-levels$/u);
  const card = received.getByRole('region', { name: 'Machine en chaîne' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Pas encore résolu')).toBeVisible();
  // M14b: the received level's description, as plain text, like `/levels`.
  await expect(
    card.getByText(
      'Une machine en chaîne qui montre toutes les familles d’objets : appuyez sur Lancer et regardez.',
    ),
  ).toBeVisible();
  await captureFormats(page, 'my-levels-received-description');

  // A creation too, for the filled page: the campaign's first level, edited.
  await page.goto('/levels');
  await page.getByRole('button', { name: 'Modifier le niveau 1', exact: true }).tap();
  await expect(page).toHaveURL(/\/editor\?draft=tuto-1-brouillon$/u);
  await page.goto('/my-levels');
  await expect(
    page
      .getByRole('region', { name: 'Mes créations' })
      .getByRole('region', { name: 'Le petit pont (remix)' }),
  ).toBeVisible();
  await expect(received.getByRole('region', { name: 'Machine en chaîne' })).toBeVisible();
  await captureFormats(page, 'my-levels-filled');

  await received
    .getByRole('region', { name: 'Machine en chaîne' })
    .getByRole('button', {
      name: 'Supprimer',
    })
    .tap();
  const dialog = page.getByRole('dialog', { name: 'Confirmer la suppression' });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: 'test-results/my-levels/my-levels-delete-390x844.png',
    scale: 'css',
  });
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).tap();
  await expect(received.getByText(/aucun niveau reçu/u)).toBeVisible();
});
