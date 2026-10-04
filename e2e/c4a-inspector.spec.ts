import { expect, test } from '@playwright/test';
import { ROTATION_HANDLE_KNOB_RADIUS_CSS_PIXELS } from '../src/presentation/rotation-handle-metrics';

const desktopFormats = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
] as const;

for (const viewport of desktopFormats) {
  test(`C4a — le redimensionnement se fait par glissement, sans ouvrir le sélecteur (${String(viewport.width)} × ${String(viewport.height)})`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'v1', 'Ce parcours vérifie l’inspecteur desktop.');
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await page.getByRole('button', { name: 'Atelier', exact: true }).click();

    const openCatalogue = page.getByRole('button', { name: 'Ouvrir le catalogue' });
    if (await openCatalogue.isVisible()) await openCatalogue.click();
    await page.getByRole('button', { name: 'Poutre moyenne' }).click();

    const board = page.getByRole('region', { name: 'Plateau de jeu' });
    const boardBounds = await board.boundingBox();
    expect(boardBounds).not.toBeNull();
    if (boardBounds === null) throw new Error('Le plateau doit être mesurable.');
    const centre = {
      x: boardBounds.x + boardBounds.width / 2,
      y: boardBounds.y + boardBounds.height / 2,
    };
    const properties = page.getByRole('region', { name: 'Propriétés de Poutre' });
    const openProperties = page.getByRole('button', { name: 'Ouvrir les propriétés' });

    await page.mouse.click(centre.x, centre.y);
    await expect(properties).toHaveCount(0);
    await expect(openProperties).toBeVisible();

    // Clicking the size handle alone does not open a selector or the panel.
    const sizeHandle = page.getByRole('button', { name: 'Redimensionner la poutre' });
    await expect
      .poll(() => sizeHandle.evaluate((handle) => getComputedStyle(handle, '::before').width))
      .toBe(`${String(ROTATION_HANDLE_KNOB_RADIUS_CSS_PIXELS * 2)}px`);
    await sizeHandle.click();
    await expect(properties).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Longueur de la poutre' })).toHaveCount(0);

    // A simple click on the object opens its properties; closing keeps the
    // selection so the following drag starts from the same beam.
    await page.mouse.click(centre.x, centre.y);
    await expect(properties).toBeVisible();
    await properties.getByRole('button', { name: 'Fermer les propriétés' }).click();
    await expect(properties).toHaveCount(0);

    const canvas = board.getByRole('img', { name: 'Rendu du plateau' });
    const pixelsPerWorldUnit = Number(await canvas.getAttribute('data-camera-zoom'));
    expect(pixelsPerWorldUnit).toBeGreaterThan(0);
    const handleBounds = await sizeHandle.boundingBox();
    expect(handleBounds).not.toBeNull();
    if (handleBounds === null) throw new Error('La poignée doit être mesurable.');
    const handleCentre = {
      x: handleBounds.x + handleBounds.width / 2,
      y: handleBounds.y + handleBounds.height / 2,
    };
    await page.mouse.move(handleCentre.x, handleCentre.y);
    await page.mouse.down();
    // One world unit of travel changes the beam length by two units, taking
    // the medium beam from 4 to the available long size at 6 world units.
    await page.mouse.move(handleCentre.x + pixelsPerWorldUnit, handleCentre.y, { steps: 6 });
    await page.mouse.up();

    await expect(properties).toHaveCount(0);
    await expect(openProperties).toBeVisible();
    await page.mouse.click(centre.x, centre.y);
    await expect(properties).toBeVisible();
    await expect(properties.getByRole('combobox', { name: 'Longueur de la poutre' })).toHaveValue(
      'long',
    );
  });
}
