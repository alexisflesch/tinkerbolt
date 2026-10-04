import { expect, test } from '@playwright/test';

import { levelDocumentSchema } from '../src/domain/level-document';
import { encodeShareFragment } from '../src/infrastructure/level-share/level-share-codec';

const locked = { move: false, rotate: false, remove: false } as const;
const placed = (id: string, type: string, x: number, y: number, props: object = {}) => ({
  id,
  type,
  props,
  transform: { position: { x, y }, rotation: 0 },
  permissions: locked,
});

const sharedLevel = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'c10-familles-partagees',
  metadata: { title: 'Familles partagées' },
  objects: [
    placed('goal-ball', 'ball', 1, 1),
    placed('goal-basket', 'basket', 10.5, 6),
    placed('box-wood', 'box', 2.5, 6, { material: 'wood' }),
    placed('box-metal', 'box', 4, 6, { material: 'metal' }),
    placed('magnet', 'electro-magnet', 5.8, 6, { state: 'on' }),
    placed('piston', 'piston', 7.5, 6),
    placed('button', 'button', 1.8, 3),
    placed('timer', 'timer', 3.8, 3, { delaySeconds: 3 }),
    placed('fan', 'fan', 6, 3, { state: 'off' }),
  ],
  inventory: [],
  goal: { type: 'basket', ballId: 'goal-ball', basketId: 'goal-basket' },
  buildZones: [],
  scene: { min: { x: 0, y: 0 }, max: { x: 12, y: 8 } },
  wires: [{ id: 'wire-timed', sourceId: 'button', timerId: 'timer', targetId: 'fan' }],
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`C10 — ouvre un partage v3 avec les nouvelles familles (${String(viewport.width)} × ${String(viewport.height)})`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'v1', 'Parcours partagé desktop de la v1.');
    await page.setViewportSize(viewport);
    await page.goto(`/shared${await encodeShareFragment(sharedLevel)}`);
    await expect(page.getByText('Partage · Familles partagées')).toBeVisible();

    const canvas = page
      .getByRole('region', { name: 'Plateau de jeu' })
      .getByRole('img', { name: 'Rendu du plateau' });
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-wires', 'button>fan');

    const sceneObjects = page.getByRole('group', { name: 'Objets sur le plateau' });
    await sceneObjects.getByRole('button', { name: 'Objets sur le plateau' }).click();
    for (const name of [
      'Caisse en bois',
      'Caisse métallique',
      'Électroaimant',
      'Piston',
      'Minuteur',
      'Ventilateur',
    ]) {
      await expect(
        sceneObjects.getByRole('button', { name: `Sélectionner ${name}` }),
      ).toBeVisible();
    }
  });
}
