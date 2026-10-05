import { progressFixture, seedIndexedDB } from './indexed-db-fixture';
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import {
  levelDocumentSchema,
  type LevelDocument,
  type PlaceableInventoryEntry,
} from '../src/domain/level-document';
import { leverGeometry } from '../src/domain/family-geometry';
import { placementFootprintCorners } from '../src/domain/placement-footprint';
import { ROTATION_HANDLE_CORNER_OFFSET_CSS_PIXELS } from '../src/presentation/rotation-handle-metrics';
import { tapWorldPoint } from './puzzle-machine';

// tuto-6 and tuto-7 are replayed by the unit tests of their reference solution:
// at 390 px their buttons sit under the touch target of a neighbouring object.
const tutorials = [1, 2, 3, 4, 5].map((number) =>
  levelDocumentSchema.parse(
    JSON.parse(readFileSync(`src/content/levels/tuto-${String(number)}.json`, 'utf8')),
  ),
);

const choose = async (page: Page, label: string): Promise<void> => {
  await expect(page.getByRole('img', { name: 'Rendu du plateau' })).toBeVisible();
  const card = page.getByRole('button', { name: new RegExp(`^${label}`) });
  await card.tap();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
};

const rotateByHandle = async (
  page: Page,
  inventory: PlaceableInventoryEntry,
  position: { readonly x: number; readonly y: number },
  startRotation: number,
  targetRotation: number,
): Promise<void> => {
  const canvas = page.getByRole('img', { name: 'Rendu du plateau' });
  // Placement leaves the toolbar closed; select the placed object with the
  // ordinary tap that exposes its direct-manipulation rotation handle.
  await tapWorldPoint(page, position.x, position.y);
  await expect(page.getByRole('toolbar', { name: /^Réglages de /u })).toBeVisible();
  const corners = placementFootprintCorners(inventory, {
    position: { x: 0, y: 0 },
    rotation: 0,
  });
  const topLeft = corners[0];
  if (topLeft === undefined) throw new Error('Empreinte de placement absente.');
  const readCamera = async () => {
    const currentBounds = await canvas.boundingBox();
    const currentOrigin = await canvas.getAttribute('data-camera-origin');
    const currentZoom = Number(await canvas.getAttribute('data-camera-zoom'));
    if (currentBounds === null || currentOrigin === null || !(currentZoom > 0)) {
      throw new Error('Le repère caméra doit rester disponible pour tourner l’objet.');
    }
    const [currentOriginX, currentOriginY] = currentOrigin.split(',').map(Number);
    if (currentOriginX === undefined || currentOriginY === undefined) {
      throw new Error('Origine caméra absente.');
    }
    return {
      bounds: currentBounds,
      originX: currentOriginX,
      originY: currentOriginY,
      zoom: currentZoom,
    };
  };
  let camera = await readCamera();
  const pointAt = (rotation: number) => {
    const local = {
      x: topLeft.x * camera.zoom - ROTATION_HANDLE_CORNER_OFFSET_CSS_PIXELS,
      y: topLeft.y * camera.zoom - ROTATION_HANDLE_CORNER_OFFSET_CSS_PIXELS,
    };
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const offset = {
      x: local.x * cosine - local.y * sine,
      y: local.x * sine + local.y * cosine,
    };
    return {
      x: camera.bounds.x + (position.x - camera.originX) * camera.zoom + offset.x,
      y: camera.bounds.y + (position.y - camera.originY) * camera.zoom + offset.y,
    };
  };
  let start = pointAt(startRotation);
  // A solution object can sit close enough to the scene edge that its direct
  // rotation handle falls just off-screen. Zoom out until its 44 px target is
  // reachable, as a player can from the framing controls.
  for (
    let attempt = 0;
    attempt < 4 &&
    (start.x < camera.bounds.x ||
      start.x > camera.bounds.x + camera.bounds.width ||
      start.y < camera.bounds.y ||
      start.y > camera.bounds.y + camera.bounds.height);
    attempt += 1
  ) {
    await page.getByRole('button', { name: 'Zoom arrière' }).tap();
    camera = await readCamera();
    start = pointAt(startRotation);
  }
  expect(start.x).toBeGreaterThanOrEqual(camera.bounds.x);
  expect(start.x).toBeLessThanOrEqual(camera.bounds.x + camera.bounds.width);
  expect(start.y).toBeGreaterThanOrEqual(camera.bounds.y);
  expect(start.y).toBeLessThanOrEqual(camera.bounds.y + camera.bounds.height);
  const target = pointAt(targetRotation);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
};

const placeSolution = async (page: Page, level: LevelDocument): Promise<void> => {
  if (level.solution === undefined) throw new Error('Solution de référence absente.');
  const positions = new Map(level.objects.map(({ id, transform }) => [id, transform.position]));
  for (const placement of level.solution.placements) {
    const inventory = level.inventory.find(({ id }) => id === placement.inventoryId);
    if (inventory === undefined) throw new Error('Objet de solution absent de l’inventaire.');
    if (inventory.type === 'wire') throw new Error('Un fil ne peut pas être posé comme objet.');
    let label: string;
    switch (inventory.type) {
      case 'beam':
        label = `Poutre ${inventory.props.size === 'short' ? 'courte' : inventory.props.size === 'medium' ? 'moyenne' : 'longue'}`;
        break;
      case 'box':
        label = inventory.props.material === 'wood' ? 'Caisse en bois' : 'Caisse métallique';
        break;
      case 'mass':
        label = 'Masse';
        break;
      case 'fan':
        label = 'Ventilateur';
        break;
      case 'electro-magnet':
        label = 'Électroaimant';
        break;
      case 'piston':
        label = 'Piston';
        break;
      case 'timer':
        label = 'Minuteur';
        break;
      case 'springboard':
        label = 'Tremplin';
        break;
      case 'ball':
        label = 'Balle';
        break;
      case 'basket':
      case 'button':
      case 'seesaw':
      case 'lever':
      case 'conveyor':
      case 'barrier':
        throw new Error(`Objet de tutoriel inattendu : ${inventory.type}`);
    }
    await choose(page, label);
    const { position, rotation } = placement.transform;
    await tapWorldPoint(page, position.x, position.y);
    if (placement.placementId !== undefined) positions.set(placement.placementId, position);
    if (rotation !== 0) await rotateByHandle(page, inventory, position, 0, rotation);
  }
  for (const wire of level.solution.wires ?? []) {
    await choose(page, 'Fil de commande');
    for (const id of [
      wire.sourceId,
      ...(wire.timerId === undefined ? [] : [wire.timerId]),
      wire.targetId,
    ]) {
      const point = positions.get(id);
      if (point === undefined) throw new Error('Extrémité de fil introuvable.');
      const controller = level.objects.find((object) => object.id === id);
      // Aim at the exposed button base or lever handle, away from overlapping objects.
      if (controller?.type === 'button') {
        await tapWorldPoint(page, point.x, point.y + 0.2);
      } else if (controller?.type === 'conveyor') {
        await tapWorldPoint(page, point.x - 0.75, point.y);
      } else if (controller?.type === 'lever') {
        const knobY = leverGeometry.handle.knobCenterY;
        await tapWorldPoint(
          page,
          point.x - knobY * Math.sin(controller.transform.rotation),
          point.y + knobY * Math.cos(controller.transform.rotation),
        );
      } else await tapWorldPoint(page, point.x, point.y);
    }
    await expect(page.getByRole('group', { name: 'Pose d’un fil' })).toBeHidden();
  }
};

for (const [index, level] of tutorials.entries()) {
  test(`N2 : résout ${level.id} au toucher et mémorise sa victoire`, async ({ page }, testInfo) => {
    test.skip(!['mobile', 'v1'].includes(testInfo.project.name), 'Parcours tactile sur téléphone.');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await seedIndexedDB(page, [
      await progressFixture(
        Object.fromEntries(
          tutorials.slice(0, index).map(({ id }) => [id, { resolved: true, bestObjectCount: 1 }]),
        ),
      ),
    ]);
    await page.goto(`/levels/${level.id}/play`);
    await placeSolution(page, level);
    await mkdir('test-results/tutorials', { recursive: true });
    await page.screenshot({ path: `test-results/tutorials/${level.id}-solution-390x844.png` });
    await page.clock.install({ time: new Date('2026-10-02T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-02T12:00:00Z'));
    await page.getByRole('button', { name: 'Lancer', exact: true }).tap();
    await expect(page.getByRole('img', { name: 'Rendu du plateau' })).toHaveAttribute(
      'data-simulation-step',
      '0',
    );
    await page.clock.runFor(10_000);
    const victory = page.getByRole('dialog', { name: 'Bravo !' });
    // The launch waits for the asynchronous save: on a loaded machine the
    // first run of the clock can end before the simulation has started.
    await expect(async () => {
      await page.clock.runFor(2_000);
      await expect(victory).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 20_000 });
    const next = victory.getByRole('button', { name: 'Niveau suivant' });
    // Each of these five tutorials has a successor in the seven-level campaign.
    await expect(next).toBeEnabled();
    await page.screenshot({ path: `test-results/tutorials/${level.id}-victoire-390x844.png` });
    await page.goto('/levels');
    // A full navigation starts the static splash again; release its minimum
    // duration on this test's paused clock before checking the campaign card.
    await page.clock.runFor(1_200);
    await expect(
      page.getByRole('region', { name: `Niveau ${String(index + 1)}`, exact: true }),
    ).toContainText('Résolu');
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
]) {
  test(`N2 : présente la campagne à ${String(viewport.width)} × ${String(viewport.height)}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/levels');
    await expect(page.getByRole('heading', { name: 'Premiers pas' })).toBeVisible();
    await mkdir('test-results/tutorials', { recursive: true });
    await page.screenshot({
      path: `test-results/tutorials/campagne-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
    });
  });
}
