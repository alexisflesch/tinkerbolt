import { mkdir, readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

const captureFormats = async (page: Page, name: string): Promise<void> => {
  await mkdir('test-results/received-play', { recursive: true });
  for (const viewport of formats) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `test-results/received-play/${name}-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
      scale: 'css',
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
};

/** The self-solving test machine wins on its own; it is given an author and a source (ADR 0016). */
const attributedMachine = async (): Promise<Buffer> => {
  const machine: unknown = JSON.parse(
    await readFile('test/fixtures/self-solving-level.json', 'utf8'),
  );
  if (typeof machine !== 'object' || machine === null) {
    throw new Error('self-solving-level.json illisible');
  }
  return Buffer.from(
    JSON.stringify({
      ...machine,
      metadata: {
        title: 'Machine en chaîne',
        author: 'Lili',
        basedOn: [{ title: 'La chute', author: 'Max' }],
      },
    }),
  );
};

const importMachine = async (page: Page): Promise<void> => {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'self-solving-level.json',
    mimeType: 'application/json',
    buffer: await attributedMachine(),
  });
};

test('joue un niveau reçu, montre son auteur et enregistre la victoire (M10)', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours tactile est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/my-levels');
  await importMachine(page);
  const received = page.getByRole('region', { name: 'Niveaux reçus' });
  const card = received.getByRole('region', { name: 'Machine en chaîne' });
  await expect(card.getByText('Pas encore résolu')).toBeVisible();

  await card.getByRole('button', { name: 'Jouer' }).tap();
  await expect(page).toHaveURL(/\/my-levels\/recu-[0-9a-f]{16}\/play$/u);
  await expect(page.getByText('par Lili · d’après La chute (par Max)')).toBeVisible();
  await captureFormats(page, 'received-header');

  await page.getByRole('button', { name: 'Lancer' }).tap();
  const dialog = page.getByRole('dialog', { name: 'Bravo !' });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole('listitem')).toHaveCount(1);
  await captureFormats(page, 'received-victory');

  await dialog.getByRole('button', { name: 'Voir la scène' }).tap();
  await page.getByRole('button', { name: 'Retour à Mes niveaux' }).tap();
  await expect(page).toHaveURL(/\/my-levels$/u);
  // V6: the record is part of the badge over the preview (« Résolu · 0 objet »).
  await expect(card.getByText('Résolu · 0 objet', { exact: true })).toBeVisible();
});

test('joue quand même un fichier importé que le stockage plein n’a pas gardé (M10)', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours tactile est validé sur mobile.',
  );
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('Quota dépassé', 'QuotaExceededError');
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/my-levels');
  await importMachine(page);

  await expect(page.getByRole('alert')).toContainText('Ce niveau n’a pas été gardé.');
  const playAnyway = page.getByRole('button', { name: 'Jouer quand même' });
  await expect(playAnyway).toBeVisible();
  await captureFormats(page, 'import-not-kept');

  await playAnyway.tap();
  await expect(page.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
  await expect(page.getByText('par Lili · d’après La chute (par Max)')).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Ce niveau n’a pas été gardé sur cet appareil.' }),
  ).toBeVisible();
  await captureFormats(page, 'import-not-kept-play');
});
