import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`catalogue en papier, catégories et recherche sans déplacer le plateau (${String(viewport.width)} × ${String(viewport.height)})`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'v1', 'Recette du catalogue desktop.');
    await page.setViewportSize(viewport);
    await page.goto('/editor');
    await expect(page.locator('#startup-splash')).toBeHidden();
    const drawer = page.getByRole('region', { name: 'Objets disponibles' });
    const board = page.getByRole('region', { name: 'Plateau de jeu' });
    const toolbar = page.locator('.workspace-toolbar');
    const originalBoard = await board.boundingBox();
    const originalToolbar = await toolbar.boundingBox();
    await expect(drawer.getByRole('heading', { name: 'Catalogue', exact: true })).toBeVisible();
    for (const category of ['Structures', 'Appareils', 'Commandes']) {
      const toggle = drawer.getByRole('button', { name: category, exact: true });
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(
        drawer.getByRole('group', { name: category }).locator('.object-group-panel'),
      ).toHaveCSS('height', '0px');
    }
    await expect(drawer.getByRole('button', { name: 'Balle', exact: true })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Masse', exact: true })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Électroaimant', exact: true })).toHaveCount(0);
    await expect
      .poll(() =>
        drawer
          .locator('.object-thumb img')
          .first()
          .evaluate((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
      )
      .toBe(true);
    await page.screenshot({ path: `tmp/catalogue/catalogue-${String(viewport.width)}.png` });
    expect(await board.boundingBox()).toEqual(originalBoard);
    expect(await toolbar.boundingBox()).toEqual(originalToolbar);

    await drawer.getByRole('button', { name: 'Rechercher un objet' }).click();
    const input = drawer.getByRole('searchbox', { name: 'Rechercher dans le catalogue' });
    await expect(input).toBeFocused();
    await input.fill('electroaimant');
    const magnet = drawer.getByRole('button', { name: 'Électroaimant', exact: true });
    await expect(magnet).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Balle', exact: true })).toHaveCount(0);
    await page.screenshot({ path: `tmp/catalogue/catalogue-${String(viewport.width)}-search.png` });
    expect(await board.boundingBox()).toEqual(originalBoard);
    expect(await toolbar.boundingBox()).toEqual(originalToolbar);

    await input.fill('rien-de-tel');
    await expect(drawer.getByText('Aucun objet ne correspond à ta recherche.')).toBeVisible();
    await input.press('Escape');
    await expect(drawer.getByRole('button', { name: 'Rechercher un objet' })).toBeFocused();
    await expect(drawer.getByRole('button', { name: 'Appareils', exact: true })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await drawer.getByRole('button', { name: 'Appareils', exact: true }).click();
    await drawer.getByRole('button', { name: 'Ventilateur', exact: true }).click();
    await expect(drawer.getByRole('button', { name: 'Ventilateur', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await board.boundingBox()).toEqual(originalBoard);
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`tiroirs horizontaux sur smartphone (${String(viewport.width)} × ${String(viewport.height)})`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'v1', 'Recette du catalogue responsive.');
    await page.setViewportSize(viewport);
    await page.goto('/editor');
    await expect(page.locator('#startup-splash')).toBeHidden();
    const drawer = page.getByRole('region', { name: 'Objets disponibles' });
    const board = page.getByRole('region', { name: 'Plateau de jeu' });
    const originalBoard = await board.boundingBox();
    for (const category of ['Structures', 'Appareils', 'Commandes']) {
      await drawer.getByRole('button', { name: category, exact: true }).click();
      await expect(
        drawer.getByRole('group', { name: category }).locator('.object-group-panel'),
      ).toHaveCSS('width', '0px');
    }
    await drawer.locator('.drawer-content').evaluate((element) => {
      element.scrollLeft = 0;
    });
    const group = drawer.getByRole('group', { name: 'Ce qui bouge' });
    const toggle = group.getByRole('button', { name: 'Ce qui bouge', exact: true });
    const ball = group.getByRole('button', { name: 'Balle', exact: true });
    const mass = group.getByRole('button', { name: 'Masse', exact: true });
    await expect(ball).toBeVisible();
    const ballBounds = await ball.boundingBox();
    const massBounds = await mass.boundingBox();
    const toggleBounds = await toggle.boundingBox();
    if (ballBounds === null || massBounds === null || toggleBounds === null)
      throw new Error('Tiroir absent');
    expect(ballBounds.y).toBeCloseTo(massBounds.y, 0);
    expect(toggleBounds.height).toBeCloseTo(ballBounds.height, 0);
    expect(toggleBounds.x + toggleBounds.width).toBeLessThanOrEqual(ballBounds.x);
    await drawer.locator('.drawer-content').evaluate((element) => {
      element.scrollLeft = 0;
    });
    await page.screenshot({ path: `tmp/catalogue/catalogue-${String(viewport.width)}-phone.png` });
    await toggle.click();
    await expect(ball).toHaveCount(0);
    await expect(group.locator('.object-group-panel')).toHaveCSS('width', '0px');
    await toggle.click();
    await expect(ball).toBeVisible();
    await ball.click();
    await expect(ball).toHaveAttribute('aria-pressed', 'true');
    expect(await board.boundingBox()).toEqual(originalBoard);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  });
}
