import { mkdir } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { creationFromLevel } from '../src/application/drafts/creation-from-level';
import { levelDocumentSchema, type LevelDocument } from '../src/domain/level-document';
import { creationFixture, seedIndexedDB } from './indexed-db-fixture';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

const captureFormats = async (page: Page, name: string): Promise<void> => {
  await mkdir('test-results/reveal', { recursive: true });
  for (const viewport of formats) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `test-results/reveal/${name}-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
      scale: 'css',
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
};

const locked = { move: false, rotate: false, remove: false } as const;

/** A received puzzle: a lever and a fan in the decor; the author's beam, button and two wires. */
const source: LevelDocument = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'recu-0123456789abcdef',
  metadata: { title: 'Le grand saut', author: 'Lili' },
  objects: [
    {
      id: 'ball',
      type: 'ball',
      props: {},
      transform: { position: { x: 1, y: 1 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'basket',
      type: 'basket',
      props: {},
      transform: { position: { x: 11, y: 6 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'decor-lever',
      type: 'lever',
      props: { position: 'left' },
      transform: { position: { x: 2, y: 6 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'decor-fan',
      type: 'fan',
      props: { state: 'off' },
      transform: { position: { x: 4, y: 6 }, rotation: 0 },
      permissions: locked,
    },
    {
      id: 'decor-conveyor',
      type: 'conveyor',
      props: { direction: 'stopped' },
      transform: { position: { x: 8, y: 6 }, rotation: 0 },
      permissions: locked,
    },
  ],
  inventory: [
    {
      id: 'beams',
      type: 'beam',
      props: { size: 'medium' },
      quantity: 1,
      permissions: { move: true, rotate: true, remove: true },
    },
    {
      id: 'buttons',
      type: 'button',
      props: {},
      quantity: 1,
      permissions: { move: true, rotate: false, remove: true },
    },
    {
      id: 'wires',
      type: 'wire',
      props: {},
      quantity: 2,
      permissions: { move: false, rotate: false, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball', basketId: 'basket' },
  buildZones: [{ min: { x: 0, y: 0 }, max: { x: 12, y: 7 } }],
  scene: { min: { x: 0, y: 0 }, max: { x: 12, y: 7 } },
  solution: {
    placements: [
      { inventoryId: 'beams', transform: { position: { x: 6, y: 3.75 }, rotation: 0.3 } },
      {
        inventoryId: 'buttons',
        placementId: 'auteur-bouton',
        transform: { position: { x: 7, y: 2 }, rotation: 0 },
      },
    ],
    wires: [
      { id: 'fil-bouton', inventoryId: 'wires', sourceId: 'auteur-bouton', targetId: 'decor-fan' },
      {
        id: 'fil-levier',
        inventoryId: 'wires',
        sourceId: 'decor-lever',
        targetId: 'decor-conveyor',
      },
    ],
  },
});

const creationId = 'creation-m12';

/** The remixer deleted the decor's fan: the author's button wire can no longer be laid. */
const openRemixWithoutFan = async (page: Page): Promise<void> => {
  const { document } = creationFromLevel(source, { createId: () => creationId });
  const row = await creationFixture({
    document: { ...document, objects: document.objects.filter(({ id }) => id !== 'decor-fan') },
    source,
  });
  await page.goto('/');
  await seedIndexedDB(page, [row]);
  await page.goto(`/editor?draft=${creationId}`);
};

test('révèle la solution de l’auteur depuis le menu de l’atelier, au toucher (M12)', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours tactile est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await openRemixWithoutFan(page);
  await expect(page.getByText('Atelier', { exact: true })).toBeVisible();
  const canvas = page.getByRole('img', { name: 'Rendu du plateau' });
  await expect(canvas).toHaveAttribute('data-wires', '');

  await page.getByRole('button', { name: 'Ouvrir le menu' }).tap();
  const entry = page
    .getByRole('navigation', { name: 'Menu principal' })
    .getByRole('button', { name: 'Révéler la solution de l’auteur' });
  await expect(entry).toBeVisible();
  const entryBox = await entry.boundingBox();
  expect(entryBox?.height).toBeGreaterThanOrEqual(44);
  await captureFormats(page, 'reveal-menu');
  // A landscape phone is shorter than the menu: it stays inside the screen and scrolls.
  await page.setViewportSize({ width: 844, height: 390 });
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  const menuBox = await menu.boundingBox();
  expect((menuBox?.y ?? Infinity) + (menuBox?.height ?? 0)).toBeLessThanOrEqual(390);
  expect(await menu.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
  await page.setViewportSize({ width: 390, height: 844 });

  await entry.tap();
  const dialog = page.getByRole('dialog', { name: 'Révéler la solution de l’auteur' });
  await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await captureFormats(page, 'reveal-confirm');

  await dialog.getByRole('button', { name: 'Révéler la solution' }).tap();
  await expect(dialog).toBeHidden();
  await expect(canvas).toHaveAttribute('data-wires', 'decor-lever>decor-conveyor');
  await expect(
    page.getByRole('status').filter({
      hasText: '1 fil de la solution de l’auteur n’a pas pu être posé.',
    }),
  ).toBeVisible();
  await captureFormats(page, 'reveal-workshop');

  await page.getByRole('button', { name: 'Annuler', exact: true }).tap();
  await expect(canvas).toHaveAttribute('data-wires', '');
});
