import { progressFixture, seedIndexedDB } from './indexed-db-fixture';
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { levelDocumentSchema, type LevelDocument } from '../src/domain/level-document';
import { leverGeometry } from '../src/domain/family-geometry';
import { tapWorldPoint } from './puzzle-machine';

const tutorials = [1, 2, 3, 4, 5].map((number) =>
  levelDocumentSchema.parse(
    JSON.parse(readFileSync(`src/content/levels/tuto-${String(number)}.json`, 'utf8')),
  ),
);

const choose = async (page: Page, label: string): Promise<void> => {
  await expect(page.getByRole('img', { name: 'Rendu du plateau' })).toBeVisible();
  const open = page.getByRole('button', { name: 'Ouvrir le catalogue' });
  if (await open.isVisible()) await open.tap();
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).tap();
  const drawer = page.getByRole('region', { name: 'Objets disponibles' });
  await expect(drawer).toHaveClass(/object-drawer-collapsed/u);
  const peekHeight = await drawer.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).getPropertyValue('--drawer-peek-height')),
  );
  await expect
    .poll(() => drawer.evaluate((element) => element.getBoundingClientRect().height))
    .toBeCloseTo(peekHeight, 0);
};

const placeSolution = async (page: Page, level: LevelDocument): Promise<void> => {
  if (level.solution === undefined) throw new Error('Solution de référence absente.');
  const positions = new Map(level.objects.map(({ id, transform }) => [id, transform.position]));
  for (const placement of level.solution.placements) {
    const inventory = level.inventory.find(({ id }) => id === placement.inventoryId);
    if (inventory === undefined) throw new Error('Objet de solution absent de l’inventaire.');
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
      case 'wire':
        throw new Error(`Objet de tutoriel inattendu : ${inventory.type}`);
    }
    await choose(page, label);
    const { position, rotation } = placement.transform;
    await tapWorldPoint(page, position.x, position.y);
    // Selecting the new object opens its property panel automatically. Wait
    // for that stable state instead of tapping the transient open button.
    await expect(page.getByRole('region', { name: /^Propriétés de /u })).toBeVisible();
    if (placement.placementId !== undefined) positions.set(placement.placementId, position);
    const steps = Math.round(rotation / (Math.PI / 12));
    if (steps !== 0) {
      for (let step = 0; step < Math.abs(steps); step += 1) {
        await page
          .getByRole('button', { name: steps > 0 ? 'Rotation positive' : 'Rotation négative' })
          .tap();
      }
    }
    const close = page.getByRole('button', { name: 'Fermer les propriétés' });
    if (await close.isVisible()) await close.tap();
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
    await expect(victory).toBeVisible();
    const next = victory.getByRole('button', { name: 'Niveau suivant' });
    if (index < tutorials.length - 1) await expect(next).toBeEnabled();
    else await expect(next).toHaveCount(0);
    await page.screenshot({ path: `test-results/tutorials/${level.id}-victoire-390x844.png` });
    await page.goto('/levels');
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
