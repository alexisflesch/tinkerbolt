import { storedDraft } from './indexed-db-fixture';
import { mkdir, readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { decodeLevelFile } from '../src/infrastructure/level-file/level-file-codec';
import { machineBeam, machinePuzzle, tapWorldPoint } from './puzzle-machine';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

const captureFormats = async (page: Page, name: string): Promise<void> => {
  await mkdir('test-results/remix', { recursive: true });
  for (const viewport of formats) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `test-results/remix/${name}-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
      scale: 'css',
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
};

/** Where the world point lies on screen, from the camera the canvas exposes. */
const screenPoint = async (
  page: Page,
  x: number,
  y: number,
): Promise<{ readonly x: number; readonly y: number }> => {
  const canvas = page.getByRole('img', { name: 'Rendu du plateau' });
  const bounds = await canvas.boundingBox();
  const rawOrigin = await canvas.getAttribute('data-camera-origin');
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  if (bounds === null || rawOrigin === null || !(zoom > 0)) {
    throw new Error('Le repère caméra doit être disponible.');
  }
  const [originX, originY] = rawOrigin.split(',').map(Number);
  if (originX === undefined || originY === undefined) throw new Error('Origine caméra absente.');
  return { x: bounds.x + (x - originX) * zoom, y: bounds.y + (y - originY) * zoom };
};

/** A one-finger drag, through the browser's own touch events. */
const dragTouch = async (
  page: Page,
  start: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number },
): Promise<void> => {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 1, x: start.x, y: start.y, radiusX: 1, radiusY: 1, force: 1 }],
    });
    for (let step = 1; step <= 8; step += 1) {
      const progress = step / 8;
      await session.send('Input.dispatchTouchEvent', {
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
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
};

/** The x of the remixed beam (the only object to place) in the stored creation. */
const storedBeamX = async (page: Page, draftId: string): Promise<number | null> => {
  const draft = await storedDraft(page, draftId);
  return (
    draft?.document.objects.find(({ toPlace }) => toPlace === true)?.transform.position.x ?? null
  );
};

test('reçoit, gagne, remixe, déplace un objet et exporte au toucher (M11)', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours tactile est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/my-levels');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'machine.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(machinePuzzle)),
  });
  const card = page
    .getByRole('region', { name: 'Niveaux reçus' })
    .getByRole('region', { name: 'Fixture U22' });
  await card.getByRole('button', { name: 'Jouer' }).tap();

  await page.getByRole('button', { name: /^Poutre courte/u }).tap();
  await tapWorldPoint(page, machineBeam.x, machineBeam.y);
  await page.getByRole('button', { name: 'Lancer', exact: true }).tap();
  const dialog = page.getByRole('dialog', { name: 'Bravo !' });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole('button', { name: 'Remixer' })).toBeVisible();
  await captureFormats(page, 'remix-victory');

  await dialog.getByRole('button', { name: 'Remixer' }).tap();
  await expect(page).toHaveURL(/\/editor\?draft=creation-[0-9a-f]+$/u);
  await expect(page).toHaveURL(/\/editor\?draft=creation-[0-9a-f]+$/u);
  const draftId = new URL(page.url()).searchParams.get('draft') ?? '';
  expect(await storedBeamX(page, draftId)).toBeCloseTo(machineBeam.x, 1);
  await captureFormats(page, 'remix-workshop');

  const start = await screenPoint(page, machineBeam.x, machineBeam.y);
  const target = await screenPoint(page, machineBeam.x + 0.3, machineBeam.y);
  await dragTouch(page, start, target);
  await expect.poll(() => storedBeamX(page, draftId)).toBeGreaterThan(machineBeam.x + 0.1);
  await page.getByRole('button', { name: 'Exporter le niveau' }).tap();
  const exportDialog = page.getByRole('dialog', { name: 'Exporter le niveau' });
  await expect(exportDialog.getByText(/Puzzle vérifié/u)).toBeVisible({ timeout: 30_000 });
  const downloadPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Télécharger le fichier' }).tap();
  const decoded = decodeLevelFile(await readFile(await (await downloadPromise).path(), 'utf8'));
  expect(decoded.status).toBe('ok');
  if (decoded.status === 'ok') {
    expect(decoded.document.metadata.title).toBe('Fixture U22 (remix)');
    expect(decoded.document.metadata.basedOn).toEqual([{ title: 'Fixture U22' }]);
    const [pose] = decoded.document.solution?.placements ?? [];
    expect(pose?.transform.position.x).toBeGreaterThan(machineBeam.x + 0.1);
  }
});

test('désactive « Modifier » d’un niveau verrouillé et refuse son URL directe (M11)', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours tactile est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/levels');
  await expect(
    page.getByRole('button', { name: 'Modifier le niveau 1', exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Modifier le niveau 2' })).toBeDisabled();
  await captureFormats(page, 'levels-locked');

  await page.goto('/editor?draft=tuto-2-brouillon');
  await expect(page.getByText('Ce niveau est encore verrouillé.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Plateau de jeu' })).toHaveCount(0);
  await captureFormats(page, 'locked-draft');
  await page.getByRole('link', { name: 'Campagne', exact: true }).tap();
  await expect(page).toHaveURL(/\/levels$/u);
});
