import { expect, test, type Locator, type Page } from '@playwright/test';

import { leverFootprint } from '../src/domain/family-geometry';
import { ROTATION_HANDLE_CORNER_OFFSET_CSS_PIXELS } from '../src/presentation/rotation-handle-metrics';
import { navigateTo } from './app-navigation';

const openWorkshop = async (page: Page): Promise<void> => {
  await page.goto('/');
  await navigateTo(page, 'Atelier');
  await expect(page).toHaveURL(/\/editor$/u);
  await expect(page.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
};

const boardBounds = async (board: Locator) => {
  await expect(board).toBeVisible();
  const bounds = await board.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) throw new Error('Le plateau doit avoir une zone tactile mesurable.');
  return bounds;
};

const screenPointForWorld = async (
  canvas: Locator,
  point: { readonly x: number; readonly y: number },
): Promise<{ readonly x: number; readonly y: number }> => {
  const bounds = await canvas.boundingBox();
  const rawOrigin = await canvas.getAttribute('data-camera-origin');
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  expect(bounds).not.toBeNull();
  expect(rawOrigin).not.toBeNull();
  expect(Number.isFinite(zoom) && zoom > 0).toBe(true);
  if (bounds === null || rawOrigin === null || !Number.isFinite(zoom) || zoom <= 0) {
    throw new Error('Le repère caméra doit être disponible pour viser une coordonnée monde.');
  }
  const [originX, originY] = rawOrigin.split(',').map(Number);
  expect(Number.isFinite(originX) && Number.isFinite(originY)).toBe(true);
  if (originX === undefined || originY === undefined) {
    throw new Error('L’origine caméra doit contenir les deux coordonnées.');
  }
  return {
    x: bounds.x + (point.x - originX) * zoom,
    y: bounds.y + (point.y - originY) * zoom,
  };
};

const closeCompactProperties = async (page: Page): Promise<void> => {
  await expect(page.getByRole('region', { name: /^Propriétés de /u })).toHaveCount(0);
};

const clearBoardSelection = async (page: Page, canvas: Locator): Promise<void> => {
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) throw new Error('Le canvas du plateau doit avoir une zone mesurable.');
  await page.mouse.click(bounds.x + 24, bounds.y + 24);
  await expect(page.getByRole('toolbar', { name: /^Réglages de /u })).toHaveCount(0);
};

const waitForCatalogueToCollapse = async (page: Page): Promise<void> => {
  const drawer = page.getByRole('region', { name: 'Objets disponibles' });
  await expect(drawer).toBeVisible();
};

const openSelectedProperties = async (page: Page): Promise<void> => {
  await expect(page.getByRole('toolbar', { name: /^Réglages de /u })).toBeVisible();
};

const chooseMediumBeam = async (page: Page): Promise<void> => {
  const beam = page.getByRole('button', { name: 'Poutre moyenne' });
  await expect(beam).toBeVisible();
  await beam.click();
};

const placeBeamAtBoardCenter = async (page: Page): Promise<Locator> => {
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const bounds = await boardBounds(board);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await page.mouse.click(center.x, center.y);
  // Placement leaves the floating settings closed; a plain click on the
  // already placed object opens them.
  await page.mouse.click(center.x, center.y);
  await openSelectedProperties(page);
  return page.getByRole('toolbar', { name: 'Réglages de Poutre' });
};

const dragTouchPoints = async (
  page: Page,
  start: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number },
): Promise<void> => {
  const touchSession = await page.context().newCDPSession(page);
  let touchStarted = false;
  try {
    await touchSession.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x: start.x, y: start.y, radiusX: 1, radiusY: 1, force: 1 }],
    });
    touchStarted = true;
    for (let step = 1; step <= 8; step += 1) {
      const progress = step / 8;
      await touchSession.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            id: 1,
            x: start.x + (target.x - start.x) * progress,
            y: start.y + (target.y - start.y) * progress,
            radiusX: 1,
            radiusY: 1,
            force: 1,
          },
        ],
      });
    }
  } finally {
    if (touchStarted) {
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await touchSession.detach();
  }
};

// Compared at CSS resolution: on a phone viewport a device-pixel capture is
// several times larger, and under load a single one could outlast the poll
// budget although the canvas had already reached the expected state (G2).
const canvasPixels = (canvas: Locator): Promise<Buffer> => canvas.screenshot({ scale: 'css' });

const waitForCanvasToMatch = async (canvas: Locator, expected: Buffer): Promise<void> => {
  await expect
    .poll(async () => (await canvasPixels(canvas)).equals(expected), { timeout: 2_000 })
    .toBe(true);
};

const waitForCanvasToDiffer = async (canvas: Locator, expected: Buffer): Promise<Buffer> => {
  let latest = await canvasPixels(canvas);
  await expect
    .poll(
      async () => {
        latest = await canvasPixels(canvas);
        return !latest.equals(expected);
      },
      { timeout: 2_000 },
    )
    .toBe(true);
  return latest;
};

const runConstructionInteractions = async (page: Page): Promise<void> => {
  await openWorkshop(page);
  await chooseMediumBeam(page);
  await placeBeamAtBoardCenter(page);

  // Close the inspector overlay so the next contact reaches the board itself
  // on phone-sized viewports.
  await closeCompactProperties(page);

  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const canvas = board.getByRole('img', { name: 'Rendu du plateau' });
  const beforeMoveBounds = await boardBounds(board);
  const start = {
    x: beforeMoveBounds.x + beforeMoveBounds.width / 2,
    y: beforeMoveBounds.y + beforeMoveBounds.height / 2,
  };

  // Selection is not a history command. This is the placed beam already
  // visible on the canvas, selected through the same user input as a player.
  await page.mouse.click(start.x, start.y);
  await openSelectedProperties(page);
  await expect(page.getByRole('toolbar', { name: 'Réglages de Poutre' })).toBeVisible();
  await closeCompactProperties(page);
  await clearBoardSelection(page, canvas);

  const beforeDrag = await canvasPixels(canvas);
  const delta = Math.min(80, Math.max(28, beforeMoveBounds.width * 0.15));
  const target = {
    x: Math.min(beforeMoveBounds.x + beforeMoveBounds.width - 16, start.x + delta),
    y: start.y,
  };

  // page.mouse emits real browser pointer events; no React handler or
  // internal state is invoked by the test.
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
  await clearBoardSelection(page, canvas);

  const undo = page.getByRole('button', { name: 'Annuler', exact: true });
  const redo = page.getByRole('button', { name: 'Rétablir', exact: true });
  await expect(undo).toBeEnabled();
  await expect(redo).toBeDisabled();
  const afterDrag = await waitForCanvasToDiffer(canvas, beforeDrag);

  // One undo restores the exact pre-drag rendering and consumes the only
  // redoable move (the earlier placement remains undoable); one redo restores
  // the post-drag rendering.
  await undo.click();
  await expect(redo).toBeEnabled();
  await clearBoardSelection(page, canvas);
  await waitForCanvasToMatch(canvas, beforeDrag);

  await redo.click();
  await expect(undo).toBeEnabled();
  await expect(redo).toBeDisabled();
  await clearBoardSelection(page, canvas);
  await waitForCanvasToMatch(canvas, afterDrag);

  await page.mouse.click(target.x, target.y);
  await openSelectedProperties(page);
  const objectBar = page.getByRole('toolbar', { name: 'Réglages de Poutre' });
  const toPlace = objectBar.getByRole('button', { name: 'À placer' });
  await toPlace.click();
  await expect(toPlace).toHaveAttribute('aria-pressed', 'true');
  const afterRoleChange = await canvasPixels(canvas);
  await objectBar.getByRole('button', { name: 'Supprimer la poutre', exact: true }).click();
  await expect(objectBar).toHaveCount(0);
  await waitForCanvasToDiffer(canvas, afterRoleChange);

  await expect(undo).toBeEnabled();
  await undo.click();
  // Removing clears the ephemeral selection. Select the restored beam again so
  // the exact canvas comparison uses the same selected state as afterRoleChange.
  await page.mouse.click(target.x, target.y);
  await expect(objectBar).toBeVisible();
  await waitForCanvasToMatch(canvas, afterRoleChange);
};

test('C3 — place, déplace, modifie et supprime une poutre dans Chromium desktop', async ({
  page,
}, testInfo) => {
  test.skip(
    !['desktop', 'v1'].includes(testInfo.project.name),
    'Ce parcours est la validation Chromium desktop.',
  );
  await runConstructionInteractions(page);
});

test('L17b — tourne le levier de 90° dans chaque sens au tactile', async ({ page }, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'La poignée tactile du levier est testée sur mobile.',
  );
  await openWorkshop(page);
  await page.getByRole('button', { name: 'Levier' }).click();

  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const canvas = board.getByRole('img', { name: 'Rendu du plateau' });
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) throw new Error('Le canvas du plateau doit être visible.');
  const centre = await screenPointForWorld(canvas, { x: 8, y: 4.5 });
  await page.touchscreen.tap(centre.x, centre.y);
  await closeCompactProperties(page);
  const initial = await canvasPixels(canvas);
  await canvas.screenshot({ path: 'test-results/levels/lever-rotation-0deg.png' });
  const undo = page.getByRole('button', { name: 'Annuler', exact: true });
  const redo = page.getByRole('button', { name: 'Rétablir', exact: true });

  // The lever turns only from its round knob, drawn off the footprint's
  // top-left corner; a drag that starts on the footprint moves the lever
  // instead (G2). The turn follows the pointer's angle around the centre.
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  const footprint = leverFootprint('center');
  const knobOffset = {
    x: footprint.x * zoom - ROTATION_HANDLE_CORNER_OFFSET_CSS_PIXELS,
    y: footprint.y * zoom - ROTATION_HANDLE_CORNER_OFFSET_CSS_PIXELS,
  };
  const knob = { x: centre.x + knobOffset.x, y: centre.y + knobOffset.y };
  // The knob's own place, a quarter turn clockwise then anticlockwise.
  const right = { x: centre.x - knobOffset.y, y: centre.y + knobOffset.x };
  const left = { x: centre.x + knobOffset.y, y: centre.y - knobOffset.x };
  await dragTouchPoints(page, knob, right);
  const positiveRotation = await waitForCanvasToDiffer(canvas, initial);
  await canvas.screenshot({ path: 'test-results/levels/lever-rotation-positive-90deg.png' });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(redo).toBeEnabled();
  await waitForCanvasToMatch(canvas, initial);

  await dragTouchPoints(page, knob, left);
  // A new committed turn drops the redoable one: the history shows it.
  await expect(redo).toBeDisabled();
  const negativeRotation = await waitForCanvasToDiffer(canvas, initial);
  await canvas.screenshot({ path: 'test-results/levels/lever-rotation-negative-90deg.png' });
  expect(negativeRotation.equals(positiveRotation)).toBe(false);
  await undo.click();
  await waitForCanvasToMatch(canvas, initial);
});

test('U6 — remet l’atelier à zéro après confirmation au tactile', async ({ page }, testInfo) => {
  test.skip(
    !['mobile', 'desktop', 'v1'].includes(testInfo.project.name),
    'Le parcours U6 est capturé sur mobile et Chromium desktop.',
  );

  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  );
  await openWorkshop(page);

  const reset = page.getByRole('button', { name: 'Remettre l’atelier à zéro' });
  const tester = page.getByRole('button', { name: 'Lancer' });
  await expect(reset).toBeVisible();
  await expect(tester).toBeVisible();

  const resetBounds = await reset.boundingBox();
  const testerBounds = await tester.boundingBox();
  expect(resetBounds).not.toBeNull();
  expect(testerBounds).not.toBeNull();
  if (resetBounds === null || testerBounds === null) {
    throw new Error('Les commandes U6 doivent être mesurables.');
  }
  expect(resetBounds.x + resetBounds.width).toBeLessThanOrEqual(testerBounds.x + 1);

  const activate = async (control: Locator): Promise<void> => {
    if (testInfo.project.name === 'mobile') {
      await control.tap();
    } else {
      await control.click();
    }
  };

  if (testInfo.project.name === 'mobile') {
    await page.screenshot({ path: 'test-results/u6/390x844.png', fullPage: true });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(reset).toBeVisible();
    await page.screenshot({ path: 'test-results/u6/844x390.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  } else {
    await page.screenshot({ path: 'test-results/u6/1440x900.png', fullPage: true });
  }

  await activate(reset);
  const dialog = page.getByRole('dialog', { name: 'Remise à zéro de l’atelier' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('efface tous les objets ajoutés');
  const cancel = dialog.getByRole('button', { name: 'Annuler' });
  await expect(cancel).toBeFocused();
  await activate(cancel);
  await expect(dialog).toHaveCount(0);

  await chooseMediumBeam(page);
  await placeBeamAtBoardCenter(page);
  await expect(page.getByRole('toolbar', { name: 'Réglages de Poutre' })).toBeVisible();

  await activate(reset);
  await activate(dialog.getByRole('button', { name: 'Remettre l’atelier à zéro' }));
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('toolbar', { name: 'Réglages de Poutre' })).toHaveCount(0);
});

test('U6 — permet de recommencer un puzzle depuis son document initial', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'desktop', 'v1'].includes(testInfo.project.name),
    'Le reset de puzzle est capturé sur mobile et Chromium desktop.',
  );
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  );
  await page.goto('/levels/tuto-1/play');

  const reset = page.getByRole('button', { name: 'Recommencer le niveau' });
  const tester = page.getByRole('button', { name: 'Lancer' });
  await expect(reset).toBeVisible();
  await expect(tester).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(reset).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });

  const resetBounds = await reset.boundingBox();
  const testerBounds = await tester.boundingBox();
  expect(resetBounds).not.toBeNull();
  expect(testerBounds).not.toBeNull();
  if (resetBounds === null || testerBounds === null) {
    throw new Error('Les commandes du puzzle doivent être mesurables.');
  }
  expect(resetBounds.x + resetBounds.width).toBeLessThanOrEqual(testerBounds.x + 1);

  const activate = async (control: Locator): Promise<void> => {
    if (testInfo.project.name === 'mobile') {
      await control.tap();
    } else {
      await control.click();
    }
  };

  if (testInfo.project.name === 'mobile') {
    await page.screenshot({ path: 'test-results/u6/puzzle-390x844.png', fullPage: true });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(reset).toBeVisible();
    await page.screenshot({ path: 'test-results/u6/puzzle-844x390.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  } else {
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(reset).toBeVisible();
    await page.screenshot({ path: 'test-results/u6/puzzle-1440x900.png', fullPage: true });
  }

  await activate(reset);
  const dialog = page.getByRole('dialog', { name: 'Recommencer le niveau' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await activate(dialog.getByRole('button', { name: 'Annuler' }));
  await expect(dialog).toHaveCount(0);

  await activate(reset);
  await activate(dialog.getByRole('button', { name: 'Recommencer le niveau' }));
  await expect(dialog).toHaveCount(0);
});

test('U15 — relie un levier à un convoyeur par la carte Fil, au tactile', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le câblage tactile est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkshop(page);
  const board = page.getByRole('region', { name: 'Plateau de jeu' });
  const canvas = board.getByRole('img', { name: 'Rendu du plateau' });
  const pick = async (card: string): Promise<void> => {
    await page.getByRole('button', { name: card, exact: true }).tap();
    await waitForCatalogueToCollapse(page);
  };
  const tapWorld = async (x: number, y: number): Promise<void> => {
    const point = await screenPointForWorld(canvas, { x, y });
    await page.touchscreen.tap(point.x, point.y);
  };

  await pick('Levier');
  await tapWorld(4, 4.5);
  await closeCompactProperties(page);
  await pick('Convoyeur');
  await tapWorld(11, 4.5);
  await closeCompactProperties(page);
  await expect(canvas).toHaveAttribute('data-wires', '');

  await pick('Fil de commande');
  const guide = page.getByRole('group', { name: 'Pose d’un fil' });
  await expect(guide).toContainText('Choisis une commande ou l’appareil à relier');

  // L’appareil d’abord : l’ordre est libre.
  await tapWorld(11, 4.5);
  await expect(guide).toContainText('Choisis le levier ou le bouton qui le commande');
  // The wiring guide remains available with the catalogue while selecting endpoints.
  await expect(page.getByRole('region', { name: 'Objets disponibles' })).toBeVisible();
  await tapWorld(4, 4.5);
  await expect(canvas).toHaveAttribute('data-wires', /^placement-\d+>placement-\d+$/u);
  const wired = await canvas.getAttribute('data-wires');
  // Le fil posé termine le geste.
  await expect(guide).toBeHidden();

  await page.getByRole('button', { name: 'Annuler', exact: true }).tap();
  await expect(canvas).toHaveAttribute('data-wires', '');
  await page.getByRole('button', { name: 'Rétablir', exact: true }).tap();
  await expect(canvas).toHaveAttribute('data-wires', wired ?? '');

  // Annuler le geste ne pose rien.
  await pick('Fil de commande');
  await guide.getByRole('button', { name: 'Annuler le fil' }).tap();
  await expect(guide).toBeHidden();
  await expect(canvas).toHaveAttribute('data-wires', wired ?? '');
  await tapWorld(7.5, 4.5);
  const wireBar = page.getByRole('toolbar', { name: 'Réglages du fil' });
  await expect(wireBar).toBeVisible();
  const wireRole = wireBar.getByRole('group', { name: 'Pour le joueur' });
  await wireRole.getByRole('button', { name: 'À placer' }).tap();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `test-results/u25/fil-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
    });
  }
});
