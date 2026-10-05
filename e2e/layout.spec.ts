import { expect, test, type Locator, type Page } from '@playwright/test';
import { navigateTo } from './app-navigation';

const essentialActionNames = [
  'Voir l’objectif',
  'Annuler',
  'Rétablir',
  'Lancer',
  'Zoom arrière',
  'Ajuster à la scène',
  'Zoom avant',
] as const;

const actionsAtViewport = (width: number): readonly string[] =>
  width <= 359
    ? essentialActionNames.filter((name) => !['Zoom arrière', 'Zoom avant'].includes(name))
    : essentialActionNames;

const openWorkshop = async (page: Page): Promise<void> => {
  await page.goto('/');
  await navigateTo(page, 'Atelier');
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

const expectStableSceneWhileChoosingObject = async (
  page: Page,
  viewport: { readonly width: number; readonly height: number },
): Promise<void> => {
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const before = await bounds(board);
  const card = page.getByRole('button', { name: 'Poutre moyenne' });
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Annuler le placement' })).toBeVisible();
  const afterChoosing = await bounds(board);
  expect(afterChoosing.x).toBeCloseTo(before.x, 0);
  expect(afterChoosing.y).toBeCloseTo(before.y, 0);
  expect(afterChoosing.width).toBeCloseTo(before.width, 0);
  expect(afterChoosing.height).toBeCloseTo(before.height, 0);
  await page.getByRole('button', { name: 'Annuler le placement' }).click();
  await expect(card).toHaveAttribute('aria-pressed', 'false');
  await expectInViewport(board, viewport);
};

const placeAndSelectMediumBeam = async (page: Page): Promise<Locator> => {
  await page.getByRole('button', { name: 'Poutre moyenne' }).click();
  const canvas = page.getByRole('img', { name: 'Rendu du plateau' });
  const canvasBounds = await bounds(canvas);
  const center = {
    x: canvasBounds.x + canvasBounds.width / 2,
    y: canvasBounds.y + canvasBounds.height / 2,
  };
  // The scene frame owns pointer events and forwards them to the renderer;
  // targeting the nested canvas locator is intercepted by its parent.
  await page.mouse.click(center.x, center.y);
  await page.mouse.click(center.x, center.y);

  const objectBar = page.getByRole('toolbar', { name: 'Réglages de Poutre' });
  await expect(objectBar).toBeVisible();
  return objectBar;
};

const expectStableSceneWithObjectBar = async (
  page: Page,
  viewport: { readonly width: number; readonly height: number },
): Promise<void> => {
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const before = await bounds(board);
  const objectBar = page.getByRole('toolbar', { name: 'Réglages de Poutre' });
  const barBounds = await bounds(objectBar);
  expect(barBounds.x).toBeGreaterThanOrEqual(0);
  expect(barBounds.y).toBeGreaterThanOrEqual(0);
  expect(barBounds.x + barBounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(barBounds.y + barBounds.height).toBeLessThanOrEqual(viewport.height + 1);
  await expect(page.getByRole('region', { name: /^Propriétés de /u })).toHaveCount(0);

  const after = await bounds(board);
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  expect(after.height).toBeCloseTo(before.height, 0);
  await expectInViewport(board, viewport);
};

test.describe('C7b — composition des grands formats', () => {
  [
    { width: 1440, height: 900 },
    { width: 1180, height: 820 },
  ].forEach((viewport) => {
    test(`conserve le catalogue latéral et la scène à ${String(viewport.width)} × ${String(viewport.height)}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openWorkshop(page);

      const catalogue = page.getByRole('region', { name: 'Objets disponibles' });
      const board = page.getByRole('region', { name: 'Plateau de jeu' });
      const catalogueBounds = await bounds(catalogue);
      const boardBounds = await bounds(board);

      // Le catalogue reste un rail gauche, sans recouvrir le plateau.
      expect(catalogueBounds.x).toBeLessThan(boardBounds.x);
      expect(catalogueBounds.width).toBeLessThan(viewport.width / 2);
      // L'objectif n'a plus de carte permanente : il s'ouvre à la demande.
      await expect(page.getByRole('region', { name: 'Objectif du niveau' })).toHaveCount(0);
      await expectInViewport(board, viewport);
      await expectNoHorizontalOverflow(page);

      for (const actionName of actionsAtViewport(viewport.width)) {
        await expectInViewport(page.getByRole('button', { name: actionName }), viewport);
      }

      const sceneBeforePlacement = await bounds(board);
      const objectBar = await placeAndSelectMediumBeam(page);
      await expect(objectBar.getByRole('group', { name: 'Pour le joueur' })).toBeVisible();
      const sceneAfterPlacement = await bounds(board);
      expect(sceneAfterPlacement.x).toBeCloseTo(sceneBeforePlacement.x, 0);
      expect(sceneAfterPlacement.y).toBeCloseTo(sceneBeforePlacement.y, 0);
      expect(sceneAfterPlacement.width).toBeCloseTo(sceneBeforePlacement.width, 0);
      expect(sceneAfterPlacement.height).toBeCloseTo(sceneBeforePlacement.height, 0);
    });
  });
});

test.describe('C7b — catalogue persistant aux formats compacts', () => {
  [
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ].forEach((viewport) => {
    test(`garde le catalogue disponible sans déplacer la scène à ${String(viewport.width)} × ${String(viewport.height)}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openWorkshop(page);

      const catalogue = page.getByRole('region', { name: 'Objets disponibles' });
      await expect(catalogue).toHaveCSS('position', 'relative');
      const catalogueBounds = await bounds(catalogue);
      expect(catalogueBounds.x).toBeGreaterThanOrEqual(0);
      expect(catalogueBounds.y).toBeGreaterThanOrEqual(0);
      expect(catalogueBounds.x + catalogueBounds.width).toBeLessThanOrEqual(viewport.width + 1);
      await expectStableSceneWhileChoosingObject(page, viewport);
      await placeAndSelectMediumBeam(page);
      await expectStableSceneWithObjectBar(page, viewport);
      await expectNoHorizontalOverflow(page);
      for (const actionName of actionsAtViewport(viewport.width)) {
        await expectInViewport(page.getByRole('button', { name: actionName }), viewport);
      }
    });
  });
});

test('C7b — les réglages de l’objet flottent près du plateau sur petit portrait', async ({
  page,
}) => {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await openWorkshop(page);

  const properties = await placeAndSelectMediumBeam(page);
  await expect(properties).toBeVisible();
  await expect(properties.getByRole('button', { name: 'À placer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ouvrir les propriétés' })).toHaveCount(0);
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const boardBounds = await bounds(board);
  const barBounds = await bounds(properties);
  expect(barBounds.y + barBounds.height).toBeLessThanOrEqual(boardBounds.y + boardBounds.height);
});

test('C7b — le clic sur le plateau ferme les réglages sans déplacer la scène', async ({ page }) => {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await openWorkshop(page);

  const properties = await placeAndSelectMediumBeam(page);
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const before = await bounds(board);
  const canvas = page.getByRole('img', { name: 'Rendu du plateau' });
  const canvasBounds = await bounds(canvas);
  await page.mouse.click(canvasBounds.x + 8, canvasBounds.y + 8);
  await expect(properties).toHaveCount(0);

  const after = await bounds(board);
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  expect(after.height).toBeCloseTo(before.height, 0);
  await expectInViewport(board, viewport);
});

test('C7b — le téléphone paysage garde le catalogue et la scène visibles', async ({ page }) => {
  const viewport = { width: 844, height: 390 };
  await page.setViewportSize(viewport);
  await openWorkshop(page);

  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const before = await bounds(board);
  const catalogue = page.getByRole('region', { name: 'Objets disponibles' });
  const catalogueBounds = await bounds(catalogue);
  const boardBounds = await bounds(board);

  // En paysage téléphone, le catalogue reste un rail à gauche de la scène.
  expect(catalogueBounds.x).toBeLessThan(boardBounds.x);
  expect(catalogueBounds.width).toBeLessThan(viewport.width / 2);
  expect(catalogueBounds.height).toBeGreaterThanOrEqual(boardBounds.height - 1);
  expect(boardBounds.height).toBeGreaterThanOrEqual(viewport.height * 0.6);

  const objectBar = await placeAndSelectMediumBeam(page);
  await expect(objectBar).toBeVisible();
  await expectStableSceneWithObjectBar(page, viewport);
  const after = await bounds(board);
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  expect(after.height).toBeCloseTo(before.height, 0);

  await expectNoHorizontalOverflow(page);
  for (const actionName of actionsAtViewport(viewport.width)) {
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
