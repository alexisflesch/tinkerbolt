import { mkdir, readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';
import { navigateTo } from './app-navigation';
import { creationFromLevel } from '../src/application/drafts/creation-from-level';
import { levelDocumentSchema } from '../src/domain/level-document';
import { creationFixture, seedIndexedDB } from './indexed-db-fixture';
import { pressCardAction } from './card-menu';

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

  await expect(page.locator('.import-toast').getByRole('status')).toHaveText(
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
  await pressCardAction(
    page.getByRole('region', { name: 'Niveau 1', exact: true }),
    'Modifier le niveau 1',
    'tap',
  );
  await expect(page).toHaveURL(/\/editor\?draft=tuto-1-brouillon$/u);
  await page.goto('/my-levels');
  await expect(
    page
      .getByRole('region', { name: 'Mes créations' })
      .getByRole('region', { name: 'Le petit pont (remix)' }),
  ).toBeVisible();
  await expect(received.getByRole('region', { name: 'Machine en chaîne' })).toBeVisible();
  await captureFormats(page, 'my-levels-filled');

  const receivedCard = received.getByRole('region', { name: 'Machine en chaîne' });
  await receivedCard.getByRole('button', { name: 'Autres actions' }).tap();
  await receivedCard.getByRole('button', { name: 'Supprimer' }).tap();
  const dialog = page.getByRole('dialog', { name: 'Confirmer la suppression' });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: 'test-results/my-levels/my-levels-delete-390x844.png',
    scale: 'css',
  });
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).tap();
  await expect(received.getByText(/aucun niveau reçu/u)).toBeVisible();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1672, height: 941 },
]) {
  test(`collections papier et bleu, notifications d’import (${String(viewport.width)} × ${String(viewport.height)})`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'v1', 'Recette visuelle desktop de Mes niveaux.');
    await page.setViewportSize(viewport);
    await page.goto('/my-levels');
    await expect(page.locator('#startup-splash')).toBeHidden();
    await expect(page.getByText(/aucune création/u)).toBeVisible();
    await page.screenshot({ path: `tmp/my-levels/my-levels-${String(viewport.width)}-empty.png` });
    const rows = await Promise.all(
      [1, 2, 3, 4].map(async (number, index) => {
        const level = levelDocumentSchema.parse(
          JSON.parse(await readFile(`src/content/levels/tuto-${String(number)}.json`, 'utf8')),
        );
        const content = creationFromLevel(level, {
          createId: () => `creation-capture-${String(index)}`,
          ...(level.solution === undefined ? {} : { playerSolution: level.solution }),
        });
        return creationFixture({
          ...content,
          document: {
            ...content.document,
            metadata: { title: `Nouveau niveau ${String(index + 1)}` },
          },
        });
      }),
    );
    await seedIndexedDB(page, rows);
    await page.reload();
    await expect(page.locator('#startup-splash')).toBeHidden();
    const creations = page.getByRole('region', { name: 'Mes créations', exact: true });
    const received = page.getByRole('region', { name: 'Niveaux reçus', exact: true });
    await expect(creations.getByText('Vos niveaux créés dans l’atelier')).toBeVisible();
    await expect(received.getByText('Niveaux partagés avec vous')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles('src/content/levels/tuto-4.json');
    const toast = page.locator('.import-toast');
    await expect(toast.getByRole('status')).toContainText('est dans tes niveaux reçus');
    await page.screenshot({
      path: `tmp/my-levels/my-levels-${String(viewport.width)}-success-toast.png`,
    });
    await toast.getByRole('button', { name: 'Fermer la notification' }).click();
    await expect(toast).toHaveCount(0);
    await expect(page.locator('.level-preview-image')).toHaveCount(5);
    for (const card of await page.locator('.level-card').all()) {
      await expect(card.locator('.level-card-attachment')).toBeVisible();
      // Only the paper tilts: the card's content stays straight, hence sharp.
      expect(await card.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
      expect(
        await card.evaluate((element) => getComputedStyle(element, '::before').transform),
      ).not.toBe('none');
      expect(
        await card.evaluate((element) => getComputedStyle(element, '::before').maskImage),
      ).toContain('paper-edge.svg');
      // No row of buttons: the preview acts, and the other actions sit in a menu.
      await expect(card.locator('.btn')).toHaveCount(0);
      const menu = card.getByRole('button', { name: 'Autres actions' });
      const menuBounds = await menu.boundingBox();
      if (menuBounds === null) throw new Error('Menu des actions non mesurable.');
      expect(menuBounds.x).toBeGreaterThanOrEqual(0);
      expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(viewport.width);
    }
    await page.screenshot({
      path: `tmp/my-levels/my-levels-${String(viewport.width)}-filled.png`,
      fullPage: true,
    });
    await page.locator('input[type="file"]').setInputFiles({
      name: 'invalide.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{oops'),
    });
    await expect(toast.getByRole('alert')).toContainText('JSON valide');
    await expect(received.getByRole('alert')).toHaveCount(0);
    await page.screenshot({
      path: `tmp/my-levels/my-levels-${String(viewport.width)}-error-toast.png`,
    });
    await toast.getByRole('button', { name: 'Fermer la notification' }).click();
    const firstCreation = creations.getByRole('region', { name: 'Nouveau niveau 1', exact: true });
    await firstCreation.getByRole('button', { name: 'Autres actions' }).click();
    await firstCreation.getByRole('button', { name: 'Dupliquer' }).click();
    await expect(
      creations.getByRole('region', { name: 'Nouveau niveau 1 (copie)', exact: true }),
    ).toBeVisible();
    await received.getByRole('button', { name: 'Autres actions' }).click();
    await received.getByRole('button', { name: 'Modifier', exact: true }).click();
    await expect(page).toHaveURL(/\/editor\?draft=/u);
  });
}
