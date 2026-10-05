import { expect, type Page } from '@playwright/test';

import type { LevelDocument } from '../src/domain/level-document';
import { creationFixture, seedIndexedDB } from './indexed-db-fixture';
import { levelDocumentSchema } from '../src/domain/level-document';

// Playwright's loader does not import JSON modules: read level 1 through the L22 codec.
const levelOne = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'u22-fixture',
  metadata: { title: 'Fixture U22' },
  objects: [
    {
      id: 'ball-1',
      type: 'ball',
      props: {},
      transform: { position: { x: 2.3, y: 1.177 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
    {
      id: 'slope',
      type: 'beam',
      props: { size: 'medium' },
      transform: { position: { x: 2.2, y: 1.6 }, rotation: 0.2617993877991494 },
      permissions: { move: false, rotate: false, remove: false },
    },
    {
      id: 'basket-1',
      type: 'basket',
      props: {},
      transform: { position: { x: 6.9, y: 4.9 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
  ],
  inventory: [
    {
      id: 'inventory-beam',
      type: 'beam',
      props: { size: 'short' },
      quantity: 1,
      permissions: { move: true, rotate: false, remove: true },
    },
  ],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [{ min: { x: 3.6, y: 1.7 }, max: { x: 7, y: 2.9 } }],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
});
/** The puzzle itself: the player wins by laying the short beam at `machineBeam` (M11). */
export const machinePuzzle: LevelDocument = levelOne;

/** U22: level 1 with its reference beam in place, still fixed — the author's complete machine. */
const machine: LevelDocument = {
  ...levelOne,
  id: 'machine-u22',
  metadata: { title: 'Machine U22' },
  objects: [
    ...levelOne.objects,
    {
      id: 'placement-1',
      type: 'beam',
      props: { size: 'short' },
      transform: { position: { x: 5, y: 2.15 }, rotation: 0 },
      permissions: { move: false, rotate: false, remove: false },
    },
  ],
};

/** Where the machine's beam lies, in world units. */
export const machineBeam = { x: 5, y: 2.15 } as const;

/** Stores the machine as a draft through the app's own repository, then opens it. */
export const openMachineDraft = async (page: Page): Promise<void> => {
  const row = await creationFixture({ document: machine });
  await page.goto('/');
  await seedIndexedDB(page, [row]);
  await page.goto('/editor?draft=machine-u22');
};

export const tapWorldPoint = async (page: Page, x: number, y: number): Promise<void> => {
  const canvas = page.getByRole('img', { name: 'Rendu du plateau' });
  const bounds = await canvas.boundingBox();
  const rawOrigin = await canvas.getAttribute('data-camera-origin');
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  if (bounds === null || rawOrigin === null || !(zoom > 0)) {
    throw new Error('Le repère caméra doit être disponible.');
  }
  const [originX, originY] = rawOrigin.split(',').map(Number);
  if (originX === undefined || originY === undefined) throw new Error('Origine caméra absente.');
  await page.touchscreen.tap(bounds.x + (x - originX) * zoom, bounds.y + (y - originY) * zoom);
};

/** Selects the machine's beam and marks it « À placer » in the inspector, by touch. */
export const markBeamToPlace = async (page: Page): Promise<void> => {
  await tapWorldPoint(page, machineBeam.x, machineBeam.y);
  const objectBar = page.getByRole('toolbar', { name: 'Réglages de Poutre' });
  await expect(objectBar).toBeVisible();
  const toPlace = objectBar.getByRole('button', { name: 'À placer' });
  await toPlace.tap();
  await expect(toPlace).toHaveAttribute('aria-pressed', 'true');
};
