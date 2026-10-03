import { expect, test, type Page } from '@playwright/test';

const tapWorldPoint = async (page: Page, x: number, y: number): Promise<void> => {
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

/** M11: level 2 can only be modified once level 1 is resolved (ADR 0015, ADR 0010). */
const resolveLevelOne = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'tinkerbolt:progress',
      JSON.stringify({
        kind: 'progress',
        version: 1,
        data: { 'tuto-1': { resolved: true, bestObjectCount: 1 } },
      }),
    );
  });
};

const storedFloorX = (page: Page): Promise<number | null> =>
  page.evaluate(() => {
    const raw = localStorage.getItem('tinkerbolt:draft:tuto-2-brouillon');
    if (raw === null) return null;
    const envelope = JSON.parse(raw) as {
      data?: {
        document?: {
          objects?: Array<{ id?: string; transform?: { position?: { x?: number } } }>;
        };
      };
    };
    const document = envelope.data?.document ?? null;
    const floor = document?.objects?.find((object) => object.id === 'workshop-floor');
    return floor?.transform?.position?.x ?? null;
  });

test('édite un tutoriel de campagne au toucher et conserve le brouillon', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours d’édition est validé sur mobile.',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await resolveLevelOne(page);
  await page.goto('/levels');
  await page.getByRole('button', { name: 'Modifier le niveau 2' }).tap();
  // V7b removes the calibration guide from campaign drafts.
  await expect(page.getByText('Atelier', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Fiche de calibrage' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ouvrir le catalogue' }).tap();
  await expect(page.getByRole('button', { name: 'Ouvrir la fiche de calibrage' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fermer le catalogue' }).tap();

  await expect(page).toHaveURL(/\/editor\?draft=tuto-2-brouillon$/u);
  await expect(page.getByText('Atelier', { exact: true })).toBeVisible();
  expect(await storedFloorX(page)).toBe(8.195822458208895);

  await tapWorldPoint(page, 8.195822458208895, 7.974035655966092);
  const openProperties = page.getByRole('button', { name: 'Ouvrir les propriétés' });
  if (await openProperties.isVisible()) await openProperties.tap();
  await page.getByRole('button', { name: 'Vers la droite' }).tap();
  await expect.poll(() => storedFloorX(page)).toBeGreaterThan(8.195822458208895);

  await page.reload();
  await expect(page.getByText('Atelier', { exact: true })).toBeVisible();
  expect(await storedFloorX(page)).toBeGreaterThan(8.195822458208895);
  await expect(page.getByRole('button', { name: 'Exporter le niveau' })).toBeVisible();
});
