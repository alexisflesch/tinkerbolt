import { expect, test } from '@playwright/test';

import { progressFixture, seedIndexedDB } from './indexed-db-fixture';

const campaignIds = ['tuto-1', 'tuto-2', 'tuto-3', 'tuto-4', 'tuto-5', 'tuto-6', 'tuto-7'] as const;

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`feuilles de niveaux inclinées et fixées (${String(viewport.width)} × ${String(viewport.height)})`, async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'v1', 'Recette des cartes desktop.');
    await page.setViewportSize(viewport);
    await page.goto('/levels');
    await expect(page.locator('#startup-splash')).toBeHidden();
    const cards = page.locator('.level-card');
    await expect(cards).toHaveCount(7);
    await expect(page.locator('.level-preview-image')).toHaveCount(7);
    const styles = await cards.evaluateAll((elements) =>
      elements.map((card) => card.getAttribute('style')),
    );

    for (const card of await cards.all()) {
      const attachment = card.locator('.level-card-attachment');
      await expect(attachment).toHaveAttribute('aria-hidden', 'true');
      const decoration = await attachment.evaluate((element) => {
        const style = getComputedStyle(element);
        return { pointerEvents: style.pointerEvents, background: style.backgroundImage };
      });
      expect(decoration.pointerEvents).toBe('none');
      const asset = /url\("([^"]+)"\)/u.exec(decoration.background)?.[1];
      if (asset === undefined) throw new Error('Asset de fixation absent.');
      const response = await request.get(asset);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
      const transform = await card.evaluate((element) => getComputedStyle(element).transform);
      expect(transform).not.toBe('none');
      await card.hover();
      expect(await card.evaluate((element) => getComputedStyle(element).transform)).toBe(transform);
      const bounds = await card.boundingBox();
      if (bounds === null) throw new Error('Carte non mesurable.');
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    }
    await page.screenshot({
      path: `tmp/campaign-cards/levels-${String(viewport.width)}-locked.png`,
      fullPage: true,
    });

    await seedIndexedDB(page, [
      await progressFixture(
        Object.fromEntries(campaignIds.map((id) => [id, { resolved: true, bestObjectCount: 1 }])),
      ),
    ]);
    await page.reload();
    await expect(page.locator('#startup-splash')).toBeHidden();
    await expect(page.locator('.level-card-tier')).toHaveCount(7);
    await expect(page.locator('.level-preview-image')).toHaveCount(7);
    expect(
      await cards.evaluateAll((elements) => elements.map((card) => card.getAttribute('style'))),
    ).toEqual(styles);
    await page.screenshot({
      path: `tmp/campaign-cards/levels-${String(viewport.width)}-resolved.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Jouer le niveau 1', exact: true }).click();
    await expect(page).toHaveURL(/\/levels\/tuto-1\/play$/u);
  });
}

test('présente les sept tutoriels de Bolt dans un chapitre', async ({ page }) => {
  await page.goto('/levels');

  const levelList = page.getByRole('region', { name: 'Campagne' });
  await expect(levelList).toBeVisible();
  await expect(levelList.getByRole('region', { name: 'Chapitre 1 · Premiers pas' })).toBeVisible();

  for (const [index] of campaignIds.entries()) {
    await expect(
      levelList.getByRole('region', { name: `Niveau ${String(index + 1)}`, exact: true }),
    ).toBeVisible();
    const launch = levelList.getByRole('button', {
      name: 'Jouer le niveau ' + String(index + 1),
      exact: true,
    });
    if (index === 0) await expect(launch).toBeEnabled();
    else await expect(launch).toBeDisabled();
  }
  await expect(levelList.getByText('Esquisse non calibrée.')).toHaveCount(0);
  await expect(levelList.getByRole('region', { name: 'Niveau 8', exact: true })).toHaveCount(0);
});

test('ouvre le premier tutoriel jouable avec son inventaire tactile', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours tactile est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/levels/tuto-1/play');

  await expect(page).toHaveURL(/\/levels\/tuto-1\/play$/u);
  await expect(page.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
  const drawer = page.getByRole('region', { name: 'Objets disponibles' });
  await expect(drawer.getByRole('button', { name: /Poutre courte/ })).toBeVisible();
  await expect(drawer.getByRole('button', { name: /Tremplin/ })).toHaveCount(0);
});
