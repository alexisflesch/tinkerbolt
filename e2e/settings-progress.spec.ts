import { mkdir, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  progressFixture,
  preferencesFixture,
  seedIndexedDB,
  storedEnvelope,
} from './indexed-db-fixture';

const saved = {
  'tuto-1': { resolved: true, bestObjectCount: 2 },
  'tuto-2': { resolved: true, bestObjectCount: 3 },
};
const file = (data: unknown) => ({
  name: 'progression.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({ kind: 'progress', version: 1, data })),
});

test('exporte, réimporte et fusionne la progression sans perdre un meilleur record', async ({
  page,
}) => {
  await page.goto('/settings');
  await seedIndexedDB(page, [
    await progressFixture(saved),
    await preferencesFixture({ author: 'Bolt' }),
  ]);
  await page.reload();
  await expect(page.locator('#startup-splash')).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter la progression' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('tinkerbolt-progression.json');
  const path = await download.path();
  const buffer = await readFile(path);
  expect(JSON.parse(buffer.toString())).toEqual({ kind: 'progress', version: 1, data: saved });
  await page.getByRole('button', { name: 'Remettre la progression à zéro' }).click();
  await page.getByRole('button', { name: 'Remettre à zéro', exact: true }).click();
  await expect(
    page.getByRole('progressbar', { name: 'Progression de la campagne' }),
  ).toHaveAttribute('value', '0');
  const chooseFile = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importer la progression' }).click();
  await (
    await chooseFile
  ).setFiles({ name: 'progression.json', mimeType: 'application/json', buffer });
  await expect(page.getByRole('status')).toContainText('Progression importée');
  await expect(
    page.getByRole('progressbar', { name: 'Progression de la campagne' }),
  ).toHaveAttribute('value', '2');
  await page.locator('input[type=file]').setInputFiles(
    file({
      'tuto-1': { resolved: true, bestObjectCount: 5 },
      'tuto-3': { resolved: true, bestObjectCount: 1 },
    }),
  );
  await expect(
    page.getByRole('progressbar', { name: 'Progression de la campagne' }),
  ).toHaveAttribute('value', '3');
  const expected = { ...saved, 'tuto-3': { resolved: true, bestObjectCount: 1 } };
  expect(await storedEnvelope(page, 'progress', 'campaign')).toEqual({
    kind: 'progress',
    version: 1,
    data: expected,
  });
  expect(await storedEnvelope(page, 'preferences', 'player')).toEqual({
    kind: 'preferences',
    version: 1,
    data: { author: 'Bolt' },
  });
  await page.reload();
  await expect(page.locator('#startup-splash')).toHaveCount(0);
  await expect(
    page.getByRole('progressbar', { name: 'Progression de la campagne' }),
  ).toHaveAttribute('value', '3');
  await page.goto('/levels');
  await expect(page.getByRole('button', { name: 'Jouer le niveau 4', exact: true })).toBeEnabled();
});

test('refuse un fichier invalide ou trop gros et permet de choisir le même fichier à nouveau', async ({
  page,
}) => {
  await page.goto('/settings');
  await seedIndexedDB(page, [await progressFixture(saved)]);
  await page.reload();
  await expect(page.locator('#startup-splash')).toHaveCount(0);
  const input = page.locator('input[type=file]');
  for (const invalid of [
    { name: 'cassé.json', mimeType: 'application/json', buffer: Buffer.from('{') },
    file({ 'tuto-1': { resolved: true, bestObjectCount: null } }),
    file({ 'tuto-1': { resolved: true, bestObjectCount: -2 } }),
    { name: 'gros.json', mimeType: 'application/json', buffer: Buffer.alloc(262145) },
  ]) {
    await input.setInputFiles(invalid);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('progressbar', { name: 'Progression de la campagne' }),
    ).toHaveAttribute('value', '2');
    expect(await storedEnvelope(page, 'progress', 'campaign')).toEqual({
      kind: 'progress',
      version: 1,
      data: saved,
    });
    await expect(input).toHaveValue('');
  }
  await input.setInputFiles(file({}));
  await expect(page.getByRole('status')).toContainText('Progression importée');
});

test('garde les textes droits et capture Paramètres et accueil aux deux formats desktop', async ({
  page,
}) => {
  await mkdir('tmp/settings-home', { recursive: true });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/settings');
    await seedIndexedDB(page, [
      await progressFixture(saved),
      await preferencesFixture({ author: 'Bolt' }),
    ]);
    await page.reload();
    await expect(page.locator('#startup-splash')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Pseudo retenu' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `tmp/settings-home/settings-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
    });
    await page.goto('/');
    await expect(page.locator('#startup-splash')).toHaveCount(0);
    await expect(page.locator('#home-title')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const rotated = await page.locator('#home-title').evaluate((title) => {
      for (let node: Element | null = title; node !== null; node = node.parentElement) {
        const transform = getComputedStyle(node).transform;
        if (transform !== 'none') {
          const matrix = new DOMMatrixReadOnly(transform);
          if (Math.abs(matrix.b) > 0.0001 || Math.abs(matrix.c) > 0.0001) return true;
        }
      }
      return false;
    });
    expect(rotated).toBe(false);
    await page.screenshot({
      path: `tmp/settings-home/home-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
    });
  }
});
