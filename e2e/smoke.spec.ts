import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvasPixelAt, expectedPaperPixel } from './board-paper';

/**
 * On wide screens the workshop is in the header; on compact screens it is in
 * the menu.
 */
const openWorkshopFromMenu = async (page: Page): Promise<void> => {
  await page.goto('/editor');
  await expect(page.getByRole('region', { name: 'Objets disponibles' })).toBeVisible();
};

const differenceFromPaperAtWorldPoint = async (
  canvas: Locator,
  point: { readonly x: number; readonly y: number },
): Promise<number> => {
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  const [originX, originY] = ((await canvas.getAttribute('data-camera-origin')) ?? '')
    .split(',')
    .map(Number);
  if (!(zoom > 0) || originX === undefined || originY === undefined) {
    throw new Error('Le repère caméra doit être disponible pour lire le rendu.');
  }
  const local = { x: (point.x - originX) * zoom, y: (point.y - originY) * zoom };
  const actual = await canvasPixelAt(canvas, local);
  if (actual === null) throw new Error('Le point du niveau doit rester dans le canvas.');
  const expected = await expectedPaperPixel(canvas, local);
  return Math.max(...actual.map((channel, index) => Math.abs(channel - (expected[index] ?? 0))));
};

test('lance depuis l’accueil, par la campagne, le niveau 1', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('TinkerBolt');
  await expect(page.getByRole('heading', { name: 'TinkerBolt' })).toBeVisible();
  await page.getByRole('link', { name: 'Jouer', exact: true }).tap();
  await expect(page).toHaveURL(/\/levels$/);
  await page.getByRole('button', { name: 'Jouer le niveau 1', exact: true }).tap();
  await expect(page.getByText('Niveau 1 · Le petit pont')).toBeVisible();
  await expect(page.locator('.toolbar-title')).toHaveText('Niveau 1 · Le petit pont');
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  await expect(board).toBeVisible();
  await page.getByRole('button', { name: 'Voir l’objectif' }).click();
  await expect(page.getByRole('dialog', { name: 'Objectif du niveau' })).toContainText(
    'Faire entrer la balle dans le panier',
  );
  await page.getByRole('button', { name: 'Fermer l’objectif' }).click();
  await expect(board.getByRole('img', { name: 'Rendu du plateau' })).toBeVisible();

  // Level 1 provides one short beam; free editing history stays unavailable.
  await expect(page.getByRole('region', { name: 'Objets disponibles' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Poutre courte' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Annuler' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Rétablir' })).toBeDisabled();
});

test('ouvre l’atelier depuis le menu et expose les familles du catalogue', async ({ page }) => {
  await page.goto('/');
  await openWorkshopFromMenu(page);

  await expect(page.getByText('Éditeur de niveaux')).toHaveCount(0);
  await expect(page).toHaveURL(/\/editor$/u);
  await expect(page.getByRole('region', { name: 'Objets disponibles' })).toBeVisible();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `test-results/u23/atelier-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
    });
  }

  await expect(page.getByRole('button', { name: /Balle rouge/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Panier/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Balle' })).toBeVisible();
  for (const objectName of [
    'Poutre',
    'Bascule',
    'Masse',
    'Levier',
    'Convoyeur',
    'Bouton',
    'Ventilateur',
    'Barrière',
    'Tremplin',
  ]) {
    await expect(page.getByRole('button', { name: new RegExp(objectName) })).toBeVisible();
  }
});

test.describe('coque sur le petit viewport supporté', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 320, height: 568 },
  });

  test('le bandeau de victoire ne recouvre pas le plateau', async ({ page }) => {
    // A level that wins on its own, received from a file (V2a: the demo is gone).
    await page.goto('/my-levels');
    await page.locator('input[type="file"]').setInputFiles('test/fixtures/self-solving-level.json');
    await page
      .getByRole('region', { name: 'Niveaux reçus' })
      .getByRole('region', { name: 'Machine en chaîne' })
      .getByRole('button', { name: 'Jouer' })
      .tap();

    const board = page.getByRole('region', { name: 'Plateau de jeu' });
    await expect(board).toBeVisible();

    await page.getByRole('button', { name: 'Lancer' }).tap();

    const victory = page.getByRole('dialog', { name: 'Bravo !' });
    await expect(victory).toBeVisible({ timeout: 30_000 });
    await victory.getByRole('button', { name: 'Voir la scène' }).tap();

    const actions = page.getByRole('toolbar', { name: 'Actions de simulation' });
    await expect(actions).toContainText('Gagné !');
    await expect(page.getByRole('region', { name: 'Résultat du niveau' })).toHaveCount(0);
    await expect(board).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recommencer' })).toBeVisible();
  });

  test('conserve les actions essentielles et le catalogue dans l’atelier', async ({ page }) => {
    await page.goto('/');
    await openWorkshopFromMenu(page);

    const shellBounds = await page.locator('.app-shell').boundingBox();
    expect(shellBounds).not.toBeNull();
    if (shellBounds !== null) {
      expect(shellBounds.x).toBeGreaterThanOrEqual(0);
      expect(shellBounds.x + shellBounds.width).toBeLessThanOrEqual(320);
    }

    for (const actionName of [
      'Ouvrir le menu',
      'Annuler',
      'Rétablir',
      'Lancer',
      'Ajuster à la scène',
    ]) {
      const action = page.getByRole('button', { name: actionName });
      await expect(action).toBeVisible();
      const box = await action.boundingBox();
      expect(box).not.toBeNull();
      if (box !== null) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(568);
      }
    }

    const drawer = page.getByRole('region', { name: 'Objets disponibles' });
    await expect(drawer).toHaveCSS('position', 'relative');
    await expect(drawer.locator('.drawer-content')).toHaveCSS('overflow-x', 'auto');
    await expect(drawer.getByRole('button', { name: 'Balle' })).toBeVisible();
    await expect(page.locator('.drawer-scrim')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Zoom arrière' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Zoom avant' })).toHaveCount(0);

    const workspace = page.getByRole('region', { name: 'Espace de construction' });
    const workspaceBoundsBefore = await workspace.boundingBox();
    expect(workspaceBoundsBefore).not.toBeNull();

    const drawerBounds = await drawer.boundingBox();
    expect(drawerBounds).not.toBeNull();
    if (drawerBounds !== null) {
      expect(drawerBounds.x).toBeGreaterThanOrEqual(0);
      expect(drawerBounds.y + drawerBounds.height).toBeLessThanOrEqual(568);
    }

    const ballCard = drawer.getByRole('button', { name: 'Balle' });
    await ballCard.tap();
    await expect(ballCard).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Annuler le placement' })).toBeVisible();

    const workspaceBoundsAfter = await workspace.boundingBox();
    expect(workspaceBoundsAfter).not.toBeNull();
    if (workspaceBoundsBefore !== null && workspaceBoundsAfter !== null) {
      expect(workspaceBoundsAfter.x).toBeCloseTo(workspaceBoundsBefore.x);
      expect(workspaceBoundsAfter.y).toBeCloseTo(workspaceBoundsBefore.y);
      expect(workspaceBoundsAfter.width).toBeCloseTo(workspaceBoundsBefore.width);
      expect(workspaceBoundsAfter.height).toBeCloseTo(workspaceBoundsBefore.height);
    }

    await expect(ballCard).toBeVisible();
    await expect(drawer).toBeVisible();
  });

  test('affiche un aperçu valide avant le placement tactile dans la zone de construction', async ({
    page,
  }) => {
    await page.goto('/');
    await openWorkshopFromMenu(page);

    await page.getByRole('button', { name: 'Poutre moyenne' }).tap();

    const board = page.getByRole('region', { name: 'Plateau de jeu' });
    const renderer = board.getByRole('img', { name: 'Rendu du plateau' });
    const renderingBeforePreview = await renderer.screenshot();
    const bounds = await board.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds === null) {
      throw new Error('Le plateau doit avoir une zone tactile mesurable.');
    }

    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);

    await expect(page.getByRole('status')).toContainText('Aperçu de placement valide');
    // U1: the ghost is drawn by the renderer, no DOM overlay sits on the board.
    await expect(renderer).toHaveAttribute('data-placement-ghost', 'valid');
    await expect(board.locator('.placement-preview')).toHaveCount(0);
    const renderingWithPreview = await renderer.screenshot();
    expect(renderingWithPreview.equals(renderingBeforePreview)).toBe(false);
  });

  test('place au tactile puis annule le placement sans laisser l’objet dans le rendu', async ({
    page,
  }) => {
    await page.goto('/');
    await openWorkshopFromMenu(page);

    const board = page.getByRole('region', { name: 'Plateau de jeu' });
    const renderer = board.getByRole('img', { name: 'Rendu du plateau' });
    const renderingBeforePlacement = await renderer.screenshot();
    const boardBounds = await board.boundingBox();
    const canvasBounds = await renderer.boundingBox();
    const zoom = Number(await renderer.getAttribute('data-camera-zoom'));
    const [originX, originY] = ((await renderer.getAttribute('data-camera-origin')) ?? '')
      .split(',')
      .map(Number);
    expect(boardBounds).not.toBeNull();
    expect(canvasBounds).not.toBeNull();
    expect(zoom).toBeGreaterThan(0);
    expect(originX).not.toBeUndefined();
    expect(originY).not.toBeUndefined();
    if (
      boardBounds === null ||
      canvasBounds === null ||
      !(zoom > 0) ||
      originX === undefined ||
      originY === undefined
    ) {
      throw new Error('La scène doit exposer son repère pour vérifier la pose.');
    }
    const placementPoint = {
      x: originX + (boardBounds.x + 160 - canvasBounds.x) / zoom,
      y: originY + (boardBounds.y + 120 - canvasBounds.y) / zoom,
    };

    await page.getByRole('button', { name: 'Poutre moyenne' }).tap();
    await board.tap({ position: { x: 160, y: 120 } });

    await expect(page.getByRole('button', { name: 'Annuler' })).toBeEnabled();
    const renderingAfterPlacement = await renderer.screenshot();
    expect(renderingAfterPlacement.equals(renderingBeforePlacement)).toBe(false);
    await expect
      .poll(() => differenceFromPaperAtWorldPoint(renderer, placementPoint))
      .toBeGreaterThan(20);

    await page.getByRole('button', { name: 'Annuler' }).tap();
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeDisabled();
    await expect
      .poll(() => differenceFromPaperAtWorldPoint(renderer, placementPoint))
      .toBeLessThanOrEqual(5);
  });

  test('modifie visiblement le cadrage avec zoom puis ajustement au tactile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/levels/tuto-1/play');

    const renderer = page
      .getByRole('region', { name: 'Plateau de jeu' })
      .getByRole('img', { name: 'Rendu du plateau' });
    const initialRendering = await renderer.screenshot();

    await page.getByRole('button', { name: 'Zoom avant' }).tap();
    const zoomedRendering = await renderer.screenshot();
    expect(zoomedRendering.equals(initialRendering)).toBe(false);

    await page.getByRole('button', { name: 'Ajuster à la scène' }).tap();
    const adjustedRendering = await renderer.screenshot();
    expect(adjustedRendering.equals(zoomedRendering)).toBe(false);
  });
});
