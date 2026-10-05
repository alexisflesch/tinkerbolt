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

const timerLevel = levelDocumentSchema.parse({
  schemaVersion: 3,
  id: 'c9d-minuteur-affichage',
  metadata: { title: 'Minuteur' },
  objects: [
    placed('ball-1', 'ball', 0.6, 0.6),
    placed('basket-1', 'basket', 7.1, 4.7),
    placed('button-1', 'button', 1.8, 3.4),
    placed('timer-1', 'timer', 3.6, 3.4, { delaySeconds: 3 }),
    placed('fan-1', 'fan', 5.4, 3.4, { state: 'off' }),
  ],
  inventory: [],
  goal: { type: 'basket', ballId: 'ball-1', basketId: 'basket-1' },
  buildZones: [],
  scene: { min: { x: 0, y: 0 }, max: { x: 8, y: 5.5 } },
  wires: [{ id: 'wire-1', sourceId: 'button-1', timerId: 'timer-1', targetId: 'fan-1' }],
});

test('C9d — affiche les secondes sur le cadran et montre la liaison avec minuteur', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'v1', 'Capture de validation sur le poste desktop de la v1.');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/shared${await encodeShareFragment(timerLevel)}`);
  await expect(page.getByText('Partage · Minuteur')).toHaveText('Partage · Minuteur');

  const canvas = page
    .getByRole('region', { name: 'Plateau de jeu' })
    .getByRole('img', { name: 'Rendu du plateau' });
  await expect(canvas).toHaveAttribute('data-wires', 'button-1>fan-1');
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) return 0;
        const context = element.getContext('2d');
        if (context === null) return 0;
        const origin = element.dataset.cameraOrigin?.split(',').map(Number);
        const zoom = Number(element.dataset.cameraZoom);
        const bounds = element.getBoundingClientRect();
        const originX = origin?.[0];
        const originY = origin?.[1];
        if (
          originX === undefined ||
          originY === undefined ||
          !Number.isFinite(originX) ||
          !Number.isFinite(originY) ||
          !Number.isFinite(zoom) ||
          zoom <= 0
        ) {
          return 0;
        }
        const scaleX = element.width / bounds.width;
        const scaleY = element.height / bounds.height;
        const centerX = (3.6 + 0.1768 - originX) * zoom * scaleX;
        const centerY = (3.4 + 0.0039 - originY) * zoom * scaleY;
        const radiusX = 0.24 * zoom * scaleX;
        const radiusY = 0.12 * zoom * scaleY;
        const left = Math.max(0, Math.floor(centerX - radiusX));
        const top = Math.max(0, Math.floor(centerY - radiusY));
        const width = Math.min(element.width - left, Math.ceil(2 * radiusX));
        const height = Math.min(element.height - top, Math.ceil(2 * radiusY));
        if (width <= 0 || height <= 0) return 0;
        const { data } = context.getImageData(left, top, width, height);
        let amberPixels = 0;
        for (let index = 0; index < data.length; index += 4) {
          const red = data[index] ?? 0;
          const green = data[index + 1] ?? 0;
          const blue = data[index + 2] ?? 0;
          if (red > 240 && green > 150 && green < 220 && blue < 130) amberPixels += 1;
        }
        return amberPixels;
      }),
    )
    .toBeGreaterThan(20);

  await canvas.screenshot({ path: 'test-results/c9d/timer-desktop.png' });
});
