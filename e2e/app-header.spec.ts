import { mkdir } from 'node:fs/promises';

import { expect, test, type Locator, type Page } from '@playwright/test';

const waitForFonts = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    // Wait for either the bundled font or its fallback before comparing text widths.
    await Promise.allSettled([document.fonts.load('700 16px Nunito')]);
    await document.fonts.ready;
  });
};

const bounds = async (locator: Locator) => {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (box === null) throw new Error('Élément d’en-tête sans dimensions.');
  return box;
};

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
]) {
  test(`garde la même barre de navigation entre les pages à ${String(viewport.width)} × ${String(viewport.height)}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const header = page.getByRole('banner');
    const brand = header.getByRole('link', { name: 'TinkerBolt, accueil' });
    const navigation = header.getByRole('navigation', { name: 'Navigation principale' });
    const menu = header.getByRole('button', { name: 'Ouvrir le menu' });
    const compact = viewport.width <= 760;
    await expect(header).toBeVisible();
    await expect(compact ? menu : navigation).toBeVisible();
    await waitForFonts(page);
    const referenceLinks = compact ? [] : await navigation.getByRole('link').all();
    const reference = {
      header: await bounds(header),
      brand: await bounds(brand),
      controls: await bounds(compact ? menu : navigation),
      links: await Promise.all(referenceLinks.map(bounds)),
      color: await brand.evaluate((element) => getComputedStyle(element).color),
    };
    await mkdir('tmp/top-bar', { recursive: true });

    for (const { path, section, shot } of [
      { path: '/', section: 'Accueil', shot: 'accueil' },
      { path: '/levels', section: 'Campagne', shot: 'campagne' },
      { path: '/my-levels', section: 'Mes niveaux', shot: 'mes-niveaux' },
      { path: '/settings', section: 'Paramètres', shot: 'parametres' },
      ...(compact ? [] : [{ path: '/editor', section: 'Atelier', shot: 'atelier' }]),
    ]) {
      await page.goto(path);
      await expect(header).toBeVisible();
      await waitForFonts(page);
      expect(await bounds(header), path).toEqual(reference.header);
      expect(await bounds(brand), path).toEqual(reference.brand);
      expect(await bounds(compact ? menu : navigation), path).toEqual(reference.controls);
      await expect(brand).toHaveCSS('color', reference.color);
      if (compact) {
        await expect(navigation).toBeHidden();
        await menu.click();
        const popup = header.getByRole('navigation', { name: 'Menu principal' });
        await expect(popup.getByRole('button', { name: section, exact: true })).toHaveAttribute(
          'aria-current',
          'page',
        );
        const popupBounds = await bounds(popup);
        expect(popupBounds.x).toBeGreaterThanOrEqual(0);
        expect(popupBounds.x + popupBounds.width).toBeLessThanOrEqual(viewport.width);
        await menu.click();
      } else {
        await expect(menu).toBeHidden();
        await expect(navigation.getByRole('link', { name: section, exact: true })).toHaveAttribute(
          'aria-current',
          'page',
        );
        const links = await navigation.getByRole('link').all();
        expect(await Promise.all(links.map(bounds)), path).toEqual(reference.links);
      }
      await page.screenshot({
        path: `tmp/top-bar/${shot}-${String(viewport.width)}x${String(viewport.height)}.png`,
      });
    }
  });
}
