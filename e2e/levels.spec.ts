import { expect, test } from '@playwright/test';

const campaignIds = ['tuto-1', 'tuto-2', 'tuto-3', 'tuto-4', 'tuto-5', 'tuto-6', 'tuto-7'] as const;

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
