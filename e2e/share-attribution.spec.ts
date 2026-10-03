import { storedEnvelope } from './indexed-db-fixture';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';

import { decodeLevelFile } from '../src/infrastructure/level-file/level-file-codec';
import { markBeamToPlace, openMachineDraft } from './puzzle-machine';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

const captureFormats = async (page: Page, name: string): Promise<void> => {
  await mkdir('test-results/share', { recursive: true });
  for (const viewport of formats) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `test-results/share/${name}-${String(viewport.width)}x${String(viewport.height)}.png`,
      scale: 'css',
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
};

/**
 * A phone keyboard over 390 × 844: with `interactive-widget=resizes-content`,
 * the layout viewport shrinks to what the keyboard leaves visible.
 */
const keyboardOpenViewport = { width: 390, height: 844 - 336 } as const;

const expectWithinViewport = async (page: Page, locator: Locator): Promise<void> => {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (box === null || viewport === null) throw new Error('Élément ou écran sans dimensions.');
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
};

const licenceNotice =
  'En partageant ce niveau, tu le places sous licence CC BY 4.0 : d’autres pourront le modifier et le republier en te citant.';

test('partage avec un pseudo, refuse un pseudo invalide et le retient (M14)', async ({
  page,
}, testInfo) => {
  test.skip(!['mobile', 'v1'].includes(testInfo.project.name), 'Le partage est validé sur mobile.');

  await page.setViewportSize({ width: 390, height: 844 });
  await openMachineDraft(page);
  await expect(page.getByText('Atelier', { exact: true })).toBeVisible();
  await markBeamToPlace(page);

  await page.getByRole('button', { name: 'Exporter le niveau' }).tap();
  const dialog = page.getByRole('dialog', { name: 'Exporter le niveau' });
  await expect(dialog.getByText(/Puzzle vérifié/u)).toBeVisible();
  await expect(dialog.getByText(licenceNotice)).toBeVisible();
  const pseudo = dialog.getByRole('textbox', { name: 'Pseudo (facultatif)' });
  await expect(pseudo).toHaveValue('');
  await expect(pseudo).toHaveAccessibleDescription('Un pseudo, pas ton vrai nom');

  await dialog.getByRole('textbox', { name: 'Nom du niveau' }).fill('Le grand saut');
  await pseudo.fill('Lili');
  await captureFormats(page, 'share-fields');

  // The keyboard opens on the field: it and the export button stay in sight.
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /interactive-widget=resizes-content/u,
  );
  await pseudo.tap();
  await page.setViewportSize(keyboardOpenViewport);
  await expectWithinViewport(page, pseudo);
  await expectWithinViewport(page, dialog.getByRole('button', { name: 'Télécharger le fichier' }));
  await page.screenshot({ path: 'test-results/share/share-keyboard-390x508.png', scale: 'css' });
  await page.setViewportSize({ width: 390, height: 844 });

  await pseudo.fill('Li li');
  await expect(dialog.getByRole('alert')).toHaveText(
    'Le pseudo ne doit contenir ni saut de ligne ni caractère de contrôle.',
  );
  await expect(dialog.getByRole('button', { name: 'Télécharger le fichier' })).toBeDisabled();
  await captureFormats(page, 'share-invalid-pseudo');

  await pseudo.fill('  Lili ');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Télécharger le fichier' }).tap();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('le-grand-saut.json');
  const decoded = decodeLevelFile(await readFile(await download.path(), 'utf8'));
  expect(decoded.status === 'ok' && decoded.document.metadata).toEqual({
    title: 'Le grand saut',
    author: 'Lili',
  });

  await page.reload();
  await expect(page.getByText('Atelier', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exporter le niveau' }).tap();
  await expect(
    page
      .getByRole('dialog', { name: 'Exporter le niveau' })
      .getByRole('textbox', { name: 'Pseudo (facultatif)' }),
  ).toHaveValue('Lili');
  const preferences = await storedEnvelope(page, 'preferences', 'player');
  expect(preferences).toEqual({
    kind: 'preferences',
    version: 1,
    data: { author: 'Lili' },
  });
});

test('saisit une description au toucher et la retrouve dans le fichier (M14b)', async ({
  page,
}, testInfo) => {
  test.skip(!['mobile', 'v1'].includes(testInfo.project.name), 'Le partage est validé sur mobile.');

  await page.setViewportSize({ width: 390, height: 844 });
  await openMachineDraft(page);
  await expect(page.getByText('Atelier', { exact: true })).toBeVisible();
  await markBeamToPlace(page);

  await page.getByRole('button', { name: 'Exporter le niveau' }).tap();
  const dialog = page.getByRole('dialog', { name: 'Exporter le niveau' });
  await expect(dialog.getByText(/Puzzle vérifié/u)).toBeVisible();
  const description = dialog.getByRole('textbox', { name: 'Description (facultatif)' });
  await expect(description).toHaveValue('');

  await dialog.getByRole('textbox', { name: 'Nom du niveau' }).fill('Le grand saut');
  await dialog.getByRole('textbox', { name: 'Pseudo (facultatif)' }).fill('Lili');
  await description.tap();
  await description.fill('  Fais rebondir la bille jusqu’au panier.  ');
  await captureFormats(page, 'share-description');

  // The keyboard opens on the description: it and the export button stay in sight.
  await description.tap();
  await page.setViewportSize(keyboardOpenViewport);
  await expectWithinViewport(page, description);
  await expectWithinViewport(page, dialog.getByRole('button', { name: 'Télécharger le fichier' }));
  await page.screenshot({
    path: 'test-results/share/share-description-keyboard-390x508.png',
    scale: 'css',
  });
  await page.setViewportSize({ width: 390, height: 844 });

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Télécharger le fichier' }).tap();
  const download = await downloadPromise;
  const decoded = decodeLevelFile(await readFile(await download.path(), 'utf8'));
  expect(decoded.status === 'ok' && decoded.document.metadata).toEqual({
    title: 'Le grand saut',
    description: 'Fais rebondir la bille jusqu’au panier.',
    author: 'Lili',
  });
});
