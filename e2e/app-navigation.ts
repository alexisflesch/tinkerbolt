import type { Locator, Page } from '@playwright/test';

const tap = async (locator: Locator): Promise<void> => {
  await locator.tap();
};

/** Navigate through the wide header links or the compact header menu. */
export const navigateTo = async (page: Page, destination: string): Promise<void> => {
  const viewport = page.viewportSize();
  if (viewport !== null && viewport.width > 760) {
    await tap(
      page
        .getByRole('navigation', { name: 'Navigation principale' })
        .getByRole('link', { name: destination, exact: true }),
    );
    return;
  }

  const menuToggle = page.getByRole('button', { name: 'Ouvrir le menu' });
  if ((await menuToggle.getAttribute('aria-expanded')) !== 'true') await tap(menuToggle);
  await tap(
    page
      .getByRole('navigation', { name: 'Menu principal' })
      .getByRole('button', { name: destination, exact: true }),
  );
};
