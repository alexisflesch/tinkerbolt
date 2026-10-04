import { expect, test, type Locator } from '@playwright/test';

import { levelDocumentSchema } from '../src/domain/level-document';
import { encodeShareFragment } from '../src/infrastructure/level-share/level-share-codec';

const screenPointForWorld = async (
  canvas: Locator,
  point: { readonly x: number; readonly y: number },
): Promise<{ readonly x: number; readonly y: number }> => {
  const bounds = await canvas.boundingBox();
  const rawOrigin = await canvas.getAttribute('data-camera-origin');
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  if (bounds === null || rawOrigin === null || !Number.isFinite(zoom) || zoom <= 0) {
    throw new Error('Le repère caméra doit être disponible pour viser une coordonnée monde.');
  }
  const [originX, originY] = rawOrigin.split(',').map(Number);
  if (originX === undefined || originY === undefined) {
    throw new Error('L’origine caméra doit contenir les deux coordonnées.');
  }
  return {
    x: bounds.x + (point.x - originX) * zoom,
    y: bounds.y + (point.y - originY) * zoom,
  };
};

const locked = { move: false, rotate: false, remove: false } as const;
const placed = (id: string, type: string, x: number, y: number, props: object = {}) => ({
  id,
  type,
  props,
  transform: { position: { x, y }, rotation: 0 },
  permissions: locked,
});

/** A lever and a conveyor for the player to wire, and a level wire button → fan. */
const wiredLevel = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'u21-fil-joueur',
  metadata: { title: 'Fil du joueur' },
  objects: [
    placed('ball-1', 'ball', 0.6, 0.6),
    placed('basket-1', 'basket', 7.1, 4.7),
    placed('lever-1', 'lever', 1.8, 3.4, { position: 'center' }),
    placed('conveyor-1', 'conveyor', 5.4, 3.4, { direction: 'stopped' }),
    placed('button-1', 'button', 1.8, 1.6),
    placed('fan-1', 'fan', 5.4, 1.4, { state: 'off' }),
  ],
  inventory: [
    {
      id: 'inventory-wire',
      type: 'wire',
      props: {},
      quantity: 1,
      permissions: { move: false, rotate: false, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  wires: [{ id: 'level-wire', sourceId: 'button-1', targetId: 'fan-1' }],
});

test('U21 — le joueur relie avec le fil de son inventaire, puis le délie, au tactile', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le câblage tactile est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/shared${await encodeShareFragment(wiredLevel)}`);
  await expect(page.getByText('Partage · Fil du joueur')).toBeVisible();

  const canvas = page
    .getByRole('region', { name: 'Plateau de jeu' })
    .getByRole('img', { name: 'Rendu du plateau' });
  const openCatalogue = page.getByRole('button', { name: 'Ouvrir le catalogue' });
  const tapWorld = async (x: number, y: number): Promise<void> => {
    const point = await screenPointForWorld(canvas, { x, y });
    await page.touchscreen.tap(point.x, point.y);
  };
  await expect(canvas).toHaveAttribute('data-wires', 'button-1>fan-1');

  await openCatalogue.tap();
  await page.getByRole('button', { name: 'Fil de commande, quantité : 1' }).tap();
  const guide = page.getByRole('group', { name: 'Pose d’un fil' });
  await expect(guide).toContainText('Choisis une commande ou l’appareil à relier');
  await tapWorld(1.8, 3.4);
  await expect(guide).toContainText('Choisis l’appareil à commander');
  await tapWorld(5.4, 3.4);

  await expect(canvas).toHaveAttribute('data-wires', 'button-1>fan-1 lever-1>conveyor-1');
  await expect(guide).toBeHidden();
  // La tentative reprise garde le fil et sa provenance, mais aucun historique.
  await page.reload();
  await expect(canvas).toHaveAttribute('data-wires', 'button-1>fan-1 lever-1>conveyor-1');
  await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeDisabled();
  await openCatalogue.tap();
  await expect(page.getByRole('button', { name: 'Fil de commande, quantité : 0' })).toBeDisabled();
  await page.getByRole('button', { name: 'Fermer le catalogue' }).tap();
  await expect(page.getByRole('button', { name: 'Fermer le catalogue' })).toBeHidden();

  // Un fil du niveau ne se délie pas.
  await tapWorld(1.8, 1.6);
  const buttonPanel = page.getByRole('region', { name: 'Propriétés de Bouton' });
  await expect(buttonPanel.getByText(/^Fil du circuit A/)).toBeVisible();
  await expect(buttonPanel.getByRole('button', { name: /Délier/ })).toHaveCount(0);

  // L’inspecteur compact couvre le bas du plateau : le fermer, toucher le
  // levier, puis rouvrir ses propriétés.
  await page.getByRole('button', { name: 'Fermer les propriétés' }).tap();
  await tapWorld(1.8, 3.4);
  const openProperties = page.getByRole('button', { name: 'Ouvrir les propriétés' });
  if (await openProperties.isVisible()) await openProperties.tap();
  await page
    .getByRole('region', { name: 'Propriétés de Levier' })
    .getByRole('button', { name: 'Délier le circuit B' })
    .tap();
  await expect(canvas).toHaveAttribute('data-wires', 'button-1>fan-1');
  await page.getByRole('button', { name: 'Annuler', exact: true }).tap();
  await expect(canvas).toHaveAttribute('data-wires', 'button-1>fan-1 lever-1>conveyor-1');
  await page.getByRole('button', { name: 'Rétablir', exact: true }).tap();
  await expect(canvas).toHaveAttribute('data-wires', 'button-1>fan-1');
  const closeProperties = page.getByRole('button', { name: 'Fermer les propriétés' });
  if (await closeProperties.isVisible()) await closeProperties.tap();
  await openCatalogue.tap();
  await expect(page.getByRole('button', { name: 'Fil de commande, quantité : 1' })).toBeEnabled();
  await page.reload();
  await expect(canvas).toHaveAttribute('data-wires', 'button-1>fan-1');
  await openCatalogue.tap();
  await expect(page.getByRole('button', { name: 'Fil de commande, quantité : 1' })).toBeEnabled();
});
