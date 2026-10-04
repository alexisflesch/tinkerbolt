import { expect, test, type Locator, type Page } from '@playwright/test';

const essentialActionNames = [
  'Ouvrir le menu',
  'Voir l’objectif',
  'Annuler',
  'Rétablir',
  'Lancer',
  'Zoom arrière',
  'Ajuster à la scène',
  'Zoom avant',
] as const;

const openWorkshop = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: 'Atelier', exact: true }).click();
};

const bounds = async (locator: Locator) => {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) throw new Error('Élément de mise en page non mesurable.');
  return box;
};

const expectInViewport = async (
  locator: Locator,
  viewport: { readonly width: number; readonly height: number },
): Promise<void> => {
  await expect(locator).toBeVisible();
  const box = await bounds(locator);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
};

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
};

const expectStableSceneWhileTogglingCatalogue = async (
  page: Page,
  viewport: { readonly width: number; readonly height: number },
): Promise<void> => {
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const before = await bounds(board);
  const toggle = page.getByRole('button', { name: 'Ouvrir le catalogue' });

  await toggle.click();
  await expect(page.getByRole('button', { name: 'Replier le catalogue' })).toBeVisible();
  const afterOpening = await bounds(board);

  expect(afterOpening.x).toBeCloseTo(before.x, 0);
  expect(afterOpening.y).toBeCloseTo(before.y, 0);
  expect(afterOpening.width).toBeCloseTo(before.width, 0);
  expect(afterOpening.height).toBeCloseTo(before.height, 0);

  await page.getByRole('button', { name: 'Fermer le catalogue' }).click();
  await expect(page.getByRole('button', { name: 'Ouvrir le catalogue' })).toBeVisible();
  await expectInViewport(board, viewport);
};

const placeAndSelectMediumBeam = async (page: Page): Promise<Locator> => {
  const openCatalogue = page.getByRole('button', { name: 'Ouvrir le catalogue' });
  if ((await openCatalogue.count()) > 0) await openCatalogue.click();

  await page.getByRole('button', { name: 'Poutre moyenne' }).click();
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const boardBounds = await bounds(board);
  await board.click({
    position: { x: boardBounds.width / 2, y: boardBounds.height / 2 },
  });

  await page.getByRole('button', { name: 'Ouvrir les propriétés' }).click();
  const properties = page.getByRole('region', { name: 'Propriétés de Poutre' });
  await expect(properties).toBeVisible();
  return properties;
};

const expectStableSceneWhileTogglingProperties = async (
  page: Page,
  viewport: { readonly width: number; readonly height: number },
): Promise<void> => {
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const before = await bounds(board);

  const closeProperties = page.getByRole('button', { name: 'Fermer les propriétés' });
  await expect(closeProperties).toBeVisible();
  await closeProperties.click();
  await expect(page.getByRole('region', { name: 'Propriétés de Poutre' })).toHaveCount(0);
  const openProperties = page.getByRole('button', { name: 'Ouvrir les propriétés' });
  await expect(openProperties).toBeVisible();
  await openProperties.click();
  await expect(page.getByRole('region', { name: 'Propriétés de Poutre' })).toBeVisible();

  const after = await bounds(board);
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  expect(after.height).toBeCloseTo(before.height, 0);
  await expectInViewport(board, viewport);
};

test.describe('D4 — composition des grands formats', () => {
  [
    { width: 1440, height: 900 },
    { width: 1180, height: 820 },
  ].forEach((viewport) => {
    test(`conserve les rails et la scène centrale à ${String(viewport.width)} × ${String(viewport.height)}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openWorkshop(page);

      const catalogue = page.getByRole('region', { name: 'Objets disponibles' });
      const board = page.getByRole('region', { name: 'Plateau de jeu' });
      const catalogueBounds = await bounds(catalogue);
      const boardBounds = await bounds(board);

      // Le catalogue devient un rail gauche : pas un overlay couvrant le plateau.
      expect(catalogueBounds.x).toBeLessThan(boardBounds.x);
      expect(catalogueBounds.width).toBeLessThan(viewport.width / 2);
      // L'objectif n'a plus de carte permanente : il s'ouvre à la demande.
      await expect(page.getByRole('region', { name: 'Objectif du niveau' })).toHaveCount(0);
      await expectInViewport(board, viewport);
      await expectNoHorizontalOverflow(page);

      for (const actionName of essentialActionNames) {
        await expectInViewport(page.getByRole('button', { name: actionName }), viewport);
      }

      const sceneBeforeProperties = await bounds(board);
      const properties = await placeAndSelectMediumBeam(page);
      const propertiesBounds = await bounds(properties);
      const sceneAfterProperties = await bounds(board);
      expect(propertiesBounds.x).toBeGreaterThanOrEqual(
        sceneAfterProperties.x + sceneAfterProperties.width,
      );
      expect(sceneAfterProperties.x).toBeCloseTo(sceneBeforeProperties.x, 0);
      expect(sceneAfterProperties.y).toBeCloseTo(sceneBeforeProperties.y, 0);
      expect(sceneAfterProperties.width).toBeCloseTo(sceneBeforeProperties.width, 0);
      expect(sceneAfterProperties.height).toBeCloseTo(sceneBeforeProperties.height, 0);
    });
  });
});

test.describe('D4 — tiroirs superposés compacts', () => {
  [
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ].forEach((viewport) => {
    test(`emploie un bottom sheet sans déplacer la scène à ${String(viewport.width)} × ${String(viewport.height)}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openWorkshop(page);

      const catalogue = page.getByRole('region', { name: 'Objets disponibles' });
      await expect(catalogue).toHaveCSS('position', 'fixed');
      const catalogueBounds = await bounds(catalogue);
      expect(catalogueBounds.y + catalogueBounds.height).toBeCloseTo(viewport.height, 0);
      expect(catalogueBounds.width).toBeCloseTo(viewport.width, 0);

      await expectStableSceneWhileTogglingCatalogue(page, viewport);
      const properties = await placeAndSelectMediumBeam(page);
      await expect(properties).toHaveCSS('position', 'fixed');
      const propertiesBounds = await bounds(properties);
      expect(propertiesBounds.y + propertiesBounds.height).toBeCloseTo(viewport.height, 0);
      expect(propertiesBounds.width).toBeCloseTo(viewport.width, 0);
      await expectStableSceneWhileTogglingProperties(page, viewport);
      await expectNoHorizontalOverflow(page);
      for (const actionName of essentialActionNames) {
        await expectInViewport(page.getByRole('button', { name: actionName }), viewport);
      }
    });
  });
});

test('D4 — le bouton de fermeture appartient au tiroir des propriétés sur petit portrait', async ({
  page,
}) => {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await openWorkshop(page);

  const properties = await placeAndSelectMediumBeam(page);
  const closeProperties = properties.getByRole('button', { name: 'Fermer les propriétés' });

  // Le contrôle doit être annoncé dans la région qu’il ferme, pas dans un
  // conteneur inspecteur distinct.
  await expect(closeProperties).toHaveCount(1);

  const propertiesBounds = await bounds(properties);
  const closePropertiesBounds = await bounds(closeProperties);
  expect(closePropertiesBounds.x).toBeGreaterThanOrEqual(propertiesBounds.x);
  expect(closePropertiesBounds.y).toBeGreaterThanOrEqual(propertiesBounds.y);
  expect(closePropertiesBounds.x + closePropertiesBounds.width).toBeLessThanOrEqual(
    propertiesBounds.x + propertiesBounds.width + 1,
  );
  expect(closePropertiesBounds.y + closePropertiesBounds.height).toBeLessThanOrEqual(
    propertiesBounds.y + propertiesBounds.height + 1,
  );
});

test('D4 — le scrim des propriétés ferme le tiroir sans déplacer le plateau', async ({ page }) => {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await openWorkshop(page);

  const properties = await placeAndSelectMediumBeam(page);
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const before = await bounds(board);
  const propertiesScrim = page.getByRole('button', { name: 'Fermer', exact: true });

  // Le fond de fermeture doit être accessible et distinct du bouton du tiroir.
  await expect(propertiesScrim).toHaveCount(1);
  await propertiesScrim.click();
  await expect(properties).toHaveCount(0);

  const after = await bounds(board);
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  expect(after.height).toBeCloseTo(before.height, 0);
  await expectInViewport(board, viewport);
});

test('D4 — le téléphone paysage utilise un tiroir latéral et garde un plateau haut', async ({
  page,
}) => {
  const viewport = { width: 844, height: 390 };
  await page.setViewportSize(viewport);
  await openWorkshop(page);

  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const before = await bounds(board);
  await page.getByRole('button', { name: 'Ouvrir le catalogue' }).click();
  const catalogue = page.getByRole('region', { name: 'Objets disponibles' });
  const catalogueBounds = await bounds(catalogue);
  const boardBounds = await bounds(board);

  // Un tiroir latéral conserve la hauteur : il n'occupe pas toute la largeur
  // et s'étend sur la hauteur disponible, à gauche ou à droite de la scène.
  expect(catalogueBounds.width).toBeLessThan(viewport.width / 2);
  expect(catalogueBounds.height).toBeGreaterThanOrEqual(viewport.height - 1);
  expect(boardBounds.height).toBeGreaterThanOrEqual(viewport.height * 0.6);

  await page.getByRole('button', { name: 'Fermer le catalogue' }).click();
  const properties = await placeAndSelectMediumBeam(page);
  const propertiesBounds = await bounds(properties);
  expect(propertiesBounds.width).toBeLessThan(viewport.width / 2);
  expect(propertiesBounds.height).toBeGreaterThanOrEqual(viewport.height - 1);
  await expectStableSceneWhileTogglingProperties(page, viewport);
  const after = await bounds(board);
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  expect(after.height).toBeCloseTo(before.height, 0);

  await expectNoHorizontalOverflow(page);
  for (const actionName of essentialActionNames) {
    await expectInViewport(page.getByRole('button', { name: actionName }), viewport);
  }
});

test('D4 — retire les aides et le panneau contextuel historiques', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkshop(page);

  await expect(
    page.getByText('Astuce : tournez votre téléphone pour un plateau plus grand.'),
  ).toHaveCount(0);
  await expect(page.getByText(/^Objet sélectionné\s*:/)).toHaveCount(0);
});

test.describe('D4 — le mode placement ne déplace pas la scène', () => {
  [
    { width: 1440, height: 900 },
    { width: 1180, height: 820 },
    { width: 820, height: 1180 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ].forEach((viewport) => {
    test(`garde le plateau fixe quand « Annuler le placement » apparaît à ${String(viewport.width)} × ${String(viewport.height)}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openWorkshop(page);

      const board = page.getByRole('region', { name: 'Plateau de jeu' });
      const before = await bounds(board);

      const openCatalogue = page.getByRole('button', { name: 'Ouvrir le catalogue' });
      if ((await openCatalogue.count()) > 0) await openCatalogue.click();
      await page.getByRole('button', { name: 'Poutre moyenne' }).click();

      // Le contrôle d'annulation du placement apparaît sans réserver une
      // nouvelle rangée : le plateau garde exactement sa boîte.
      const cancelPlacement = page.getByRole('button', { name: 'Annuler le placement' });
      await expectInViewport(cancelPlacement, viewport);
      const during = await bounds(board);
      expect(during.x).toBeCloseTo(before.x, 0);
      expect(during.y).toBeCloseTo(before.y, 0);
      expect(during.width).toBeCloseTo(before.width, 0);
      expect(during.height).toBeCloseTo(before.height, 0);

      for (const actionName of ['Annuler', 'Rétablir', 'Lancer'] as const) {
        await expectInViewport(
          page.getByRole('button', { name: actionName, exact: true }),
          viewport,
        );
      }

      await cancelPlacement.click();
      await expect(cancelPlacement).toHaveCount(0);
      const after = await bounds(board);
      expect(after.y).toBeCloseTo(before.y, 0);
      expect(after.height).toBeCloseTo(before.height, 0);
      await expectNoHorizontalOverflow(page);
    });
  });
});

test.describe('Objectif — boîte de dialogue à la demande', () => {
  [
    { width: 1440, height: 900 },
    { width: 1180, height: 820 },
    { width: 820, height: 1180 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ].forEach((viewport) => {
    test(`ouvre et ferme l’objectif sans déplacer le plateau à ${String(viewport.width)} × ${String(viewport.height)}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/levels/tuto-1/play');

      const board = page.getByRole('region', { name: 'Plateau de jeu' });
      const before = await bounds(board);
      await expect(page.getByText('Faire entrer la balle dans le panier')).toHaveCount(0);

      await page.getByRole('button', { name: 'Voir l’objectif' }).click();
      const dialog = page.getByRole('dialog', { name: 'Objectif du niveau' });
      await expectInViewport(dialog, viewport);
      await expect(dialog).toContainText('Faire entrer la balle dans le panier');
      await expect(dialog.getByRole('button', { name: 'Fermer l’objectif' })).toBeFocused();

      // Toucher le fond, hors de la boîte, la ferme.
      await page.mouse.click(4, viewport.height - 4);
      await expect(dialog).toHaveCount(0);

      await page.getByRole('button', { name: 'Voir l’objectif' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Fermer l’objectif' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      const after = await bounds(board);
      expect(after.x).toBeCloseTo(before.x, 0);
      expect(after.y).toBeCloseTo(before.y, 0);
      expect(after.width).toBeCloseTo(before.width, 0);
      expect(after.height).toBeCloseTo(before.height, 0);
    });
  });
});
