import { expect, test } from '@playwright/test';

import { machineBeam, markBeamToPlace, openMachineDraft, tapWorldPoint } from './puzzle-machine';

test('marque un objet à placer puis résout le puzzle comme un joueur, au toucher (U22)', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours de l’atelier est validé sur mobile.',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await openMachineDraft(page);
  await markBeamToPlace(page);

  await page.getByRole('button', { name: 'Essayer en joueur' }).tap();
  await expect(page.getByRole('button', { name: 'Retour à l’atelier' })).toBeVisible();
  await page.getByRole('button', { name: /^Poutre courte/u }).tap();
  await tapWorldPoint(page, machineBeam.x, machineBeam.y);
  await page.getByRole('button', { name: 'Lancer', exact: true }).tap();

  const actions = page.getByRole('toolbar', { name: 'Actions de simulation' });
  await expect(actions).toContainText('Gagné !', { timeout: 15_000 });
  await expect(page.getByRole('region', { name: 'Résultat du niveau' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retour à l’atelier' }).tap();

  await expect(page).toHaveURL(/\/editor\?draft=/u);
  await expect(page.getByRole('button', { name: 'Exporter le niveau' })).toBeVisible();
});
