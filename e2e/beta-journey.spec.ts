import { mkdir, readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import { decodeLevelFile } from '../src/infrastructure/level-file/level-file-codec';
import { decodeShareFragment } from '../src/infrastructure/level-share/level-share-codec';
import { navigateTo } from './app-navigation';

const formats = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

const capture = async (page: Page, name: string): Promise<void> => {
  await mkdir('tmp/v8/captures', { recursive: true });
  for (const viewport of formats) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `tmp/v8/captures/${name}-${String(viewport.width)}x${String(viewport.height)}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
};

const clickWorld = async (page: Page, point: { x: number; y: number }): Promise<void> => {
  const canvas = page.getByRole('img', { name: 'Rendu du plateau' });
  const bounds = await canvas.boundingBox();
  const origin = await canvas.getAttribute('data-camera-origin');
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  if (bounds === null || origin === null || !(zoom > 0)) throw new Error('Caméra indisponible');
  const [x, y] = origin.split(',').map(Number);
  if (x === undefined || y === undefined) throw new Error('Origine indisponible');
  await page.mouse.click(bounds.x + (point.x - x) * zoom, bounds.y + (point.y - y) * zoom);
};

const chooseBeam = async (page: Page, label: string): Promise<void> => {
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
};

const menu = async (page: Page, destination: string): Promise<void> => {
  await navigateTo(page, destination);
};

// Read-only oracle: coordinates come from the shipped tutorial, validated by its codec.
// All construction, progression, receiving and remixing happen through the UI.
test('V8 : joue, crée, partage, reçoit et remixe un vrai puzzle depuis un appareil vierge', async ({
  page,
  context,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'v1', 'Recette desktop v1.');
  test.setTimeout(120_000);
  const tutorial = decodeLevelFile(await readFile('src/content/levels/tuto-1.json', 'utf8'));
  if (tutorial.status !== 'ok') throw new Error('Tutoriel embarqué invalide');
  const placement = tutorial.document.solution?.placements[0];
  if (placement === undefined) throw new Error('Solution du tutoriel absente');
  const point = placement.transform.position;
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(
    page.getByRole('progressbar', { name: 'Progression de la campagne' }),
  ).toHaveAttribute('value', '0');
  await capture(page, 'accueil');
  await page.getByRole('link', { name: 'Jouer', exact: true }).click();
  await page.getByRole('button', { name: 'Jouer le niveau 1', exact: true }).click();
  await chooseBeam(page, 'Poutre courte');
  await clickWorld(page, point);
  await page.getByRole('button', { name: 'Lancer', exact: true }).click();
  const victory = page.getByRole('dialog', { name: 'Bravo !' });
  await expect(victory).toBeVisible({ timeout: 20_000 });
  await victory.getByRole('button', { name: 'Voir la scène' }).click();
  await menu(page, 'Campagne');
  await expect(page.getByRole('region', { name: 'Niveau 1', exact: true })).toContainText('Résolu');
  await page.getByRole('button', { name: 'Modifier le niveau 1', exact: true }).click();
  await expect(page).toHaveURL(/\/editor\?draft=tuto-1-brouillon$/u);
  await expect(page.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
  // A production campaign draft must open without the hidden solution.
  await expect(page.getByRole('button', { name: 'À placer', exact: true })).toHaveCount(0);
  await capture(page, 'atelier-sans-solution');
  await page.getByRole('button', { name: 'Essayer en joueur' }).click();
  await expect(page.getByText(/^Aucun objet n’est à placer/u)).toContainText(
    'Aucun objet n’est à placer',
  );
  await expect(page.getByText(/^Aucun objet n’est à placer/u)).toContainText('propriétés');
  await page.getByRole('button', { name: 'Exporter le niveau' }).click();
  const dialog = page.getByRole('dialog', { name: 'Exporter le niveau' });
  await expect(dialog.getByRole('alert')).toContainText('Aucun objet n’est à placer');
  await capture(page, 'refus-explique');
  await dialog.getByRole('button', { name: 'Fermer l’export' }).click();
  await chooseBeam(page, 'Poutre moyenne');
  await clickWorld(page, point);
  const sizeHandle = page.getByRole('button', { name: 'Redimensionner la poutre' });
  await expect(sizeHandle).toBeVisible();
  await sizeHandle.press('ArrowLeft');
  await clickWorld(page, point);
  const objectBar = page.getByRole('toolbar', { name: 'Réglages de Poutre' });
  const toPlace = objectBar.getByRole('button', { name: 'À placer', exact: true });
  await toPlace.click();
  await expect(toPlace).toHaveAttribute('aria-pressed', 'true');
  await capture(page, 'atelier-puzzle');
  await page.getByRole('button', { name: 'Exporter le niveau' }).click();
  await expect(dialog.getByText(/Puzzle vérifié/u)).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole('textbox', { name: 'Nom du niveau' }).fill('Le pont de Camille');
  await dialog.getByRole('textbox', { name: 'Pseudo (facultatif)' }).fill('Camille');
  await capture(page, 'export-verifie');
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Télécharger le fichier' }).click();
  const download = await downloadPromise;
  const file = await download.path();
  const exported = decodeLevelFile(await readFile(file, 'utf8'));
  if (exported.status !== 'ok') throw new Error('Export invalide');
  expect(exported.document.metadata.title).toBe('Le pont de Camille');
  expect(exported.document.metadata.author).toBe('Camille');
  expect(exported.document.objects).toHaveLength(tutorial.document.objects.length);
  expect(exported.document.objects.every((object) => object.toPlace === undefined)).toBe(true);
  expect(exported.document.solution?.placements).toHaveLength(1);
  expect(exported.document.inventory[0]).toMatchObject({
    type: 'beam',
    props: { size: 'short' },
    quantity: 1,
  });
  await dialog.getByRole('button', { name: 'Copier le lien de partage' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Lien copié');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const decodedLink = await decodeShareFragment(new URL(link).hash);
  expect(decodedLink).toEqual(exported);

  const baseURL = testInfo.project.use.baseURL;
  if (baseURL === undefined) throw new Error('URL de preview absente');
  const recipient = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 900 },
  });
  const linkRecipient = await browser.newContext({
    baseURL,
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 900 },
  });
  try {
    const receivedPage = await recipient.newPage();
    await receivedPage.goto('/');
    await receivedPage
      .getByRole('navigation', { name: 'Explorer TinkerBolt' })
      .getByRole('link', { name: /^Mes niveaux/u })
      .click();
    const chooserPromise = receivedPage.waitForEvent('filechooser');
    await receivedPage.getByRole('button', { name: 'Importer', exact: true }).click();
    await (await chooserPromise).setFiles(file);
    const received = receivedPage.getByRole('region', { name: 'Niveaux reçus' });
    const card = received.getByRole('region', { name: 'Le pont de Camille', exact: true });
    await expect(card).toContainText('Pas encore résolu');
    await expect(card).toContainText('par Camille');
    await capture(receivedPage, 'reception-fichier');
    await card.getByRole('button', { name: 'Jouer', exact: true }).click();
    await chooseBeam(receivedPage, 'Poutre courte');
    await clickWorld(receivedPage, point);
    await receivedPage.getByRole('button', { name: 'Lancer', exact: true }).click();
    const receivedVictory = receivedPage.getByRole('dialog', { name: 'Bravo !' });
    await expect(receivedVictory).toBeVisible({ timeout: 20_000 });
    await receivedVictory.getByRole('button', { name: 'Remixer' }).click();
    await expect(receivedPage).toHaveURL(/\/editor\?draft=creation-/u);
    await clickWorld(receivedPage, point);
    const remixedBeamBar = receivedPage.getByRole('toolbar', { name: 'Réglages de Poutre' });
    await expect(remixedBeamBar.getByRole('button', { name: 'À placer' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await capture(receivedPage, 'remix-gagnant');
    await receivedPage.goto(link);
    await expect(receivedPage.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    await menu(receivedPage, 'Mes niveaux');
    await expect(
      received.getByRole('region', { name: 'Le pont de Camille', exact: true }),
    ).toHaveCount(1);
    await expect(card).toContainText('Résolu · 1 objet');

    const linkedPage = await linkRecipient.newPage();
    await linkedPage.goto(link);
    await expect(linkedPage.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    await expect(linkedPage.getByRole('button', { name: 'Exporter le niveau' })).toHaveCount(0);
    await expect(linkedPage.getByRole('button', { name: /Révéler la solution/u })).toHaveCount(0);
    await capture(linkedPage, 'reception-lien-joueur');
    await menu(linkedPage, 'Mes niveaux');
    await expect(
      linkedPage.getByRole('region', { name: 'Le pont de Camille', exact: true }),
    ).toContainText('Pas encore résolu');
    await expect(
      linkedPage
        .getByRole('region', { name: 'Mes créations' })
        .getByRole('region', { name: /remix/u }),
    ).toHaveCount(0);
  } finally {
    await recipient.close();
    await linkRecipient.close();
  }
});
