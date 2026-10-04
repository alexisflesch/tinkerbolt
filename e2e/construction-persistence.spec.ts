import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { levelFingerprint } from '../src/infrastructure/level-file/level-fingerprint';
import { encodeShareFragment } from '../src/infrastructure/level-share/level-share-codec';
import { decodeLevelFile } from '../src/infrastructure/level-file/level-file-codec';
import { decodePlayerConstructionRow } from '../src/infrastructure/player-construction/player-construction-codec';
import { browserRows, storedDraft } from './indexed-db-fixture';

const clickWorld = async (page: Page, x: number, y: number) => {
  const canvas = page.getByRole('img', { name: 'Rendu du plateau' });
  const box = await canvas.boundingBox();
  const origin = await canvas.getAttribute('data-camera-origin');
  const zoom = Number(await canvas.getAttribute('data-camera-zoom'));
  const [ox, oy] = (origin ?? '').split(',').map(Number);
  if (box === null || ox === undefined || oy === undefined || !(zoom > 0))
    throw new Error('Caméra indisponible');
  await page.mouse.click(box.x + (x - ox) * zoom, box.y + (y - oy) * zoom);
};
const catalogue = async (page: Page, name: RegExp) => {
  const open = page.getByRole('button', { name: 'Ouvrir le catalogue' });
  if (await open.isVisible()) await open.click();
  await page.getByRole('button', { name }).click();
};
const menu = async (page: Page, name: string) => {
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name, exact: true }).click();
};
const construction = async (
  page: Page,
  scope: 'campaign' | 'received' = 'campaign',
  id = 'tuto-1',
) => {
  const rows = await browserRows(page, 'playerConstructions');
  const row = rows.find((raw) => decodePlayerConstructionRow(raw, scope, id) !== null);
  return decodePlayerConstructionRow(row, scope, id)?.data.attempt ?? null;
};

test('C3 : navigation et reload reprennent la construction, simulation et victoire la conservent', async ({
  page,
}) => {
  const decoded = decodeLevelFile(await readFile('src/content/levels/tuto-1.json', 'utf8'));
  if (decoded.status !== 'ok') throw new Error('Tutoriel invalide');
  const position = decoded.document.solution?.placements[0]?.transform.position;
  if (position === undefined) throw new Error('Solution absente');
  await page.goto('/levels/tuto-1/play');
  await catalogue(page, /^Poutre courte/u);
  await clickWorld(page, position.x, position.y);
  await expect
    .poll(async () => (await construction(page))?.document.inventory[0]?.quantity)
    .toBe(0);
  const saved = await construction(page);
  await menu(page, 'Campagne');
  await page.getByRole('button', { name: 'Jouer le niveau 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeDisabled();
  expect(await construction(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Lancer', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Rendu du plateau' })).toHaveAttribute(
    'data-simulation-step',
  );
  await page.reload();
  await expect(page.getByRole('img', { name: 'Rendu du plateau' })).not.toHaveAttribute(
    'data-simulation-step',
  );
  expect(await construction(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Lancer', exact: true }).click();
  const victory = page.getByRole('dialog', { name: 'Bravo !' });
  await expect(victory).toBeVisible({ timeout: 20_000 });
  expect(await construction(page)).toEqual(saved);
  await victory.getByRole('button', { name: 'Voir la scène' }).click();
  await page.reload();
  await expect(page.getByRole('img', { name: 'Rendu du plateau' })).not.toHaveAttribute(
    'data-simulation-step',
  );
  expect(await construction(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Recommencer le niveau', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Recommencer le niveau' })
    .getByRole('button', { name: 'Recommencer le niveau', exact: true })
    .click();
  await expect.poll(() => construction(page)).toBeNull();
  await menu(page, 'Campagne');
  await expect(page.getByRole('region', { name: 'Niveau 1', exact: true })).toContainText('Résolu');
});

test('C3 : Atelier conserve déplacement, rotation, propriété et métadonnées engagés', async ({
  page,
}) => {
  const decoded = decodeLevelFile(await readFile('src/content/levels/tuto-1.json', 'utf8'));
  if (decoded.status !== 'ok') throw new Error('Tutoriel invalide');
  const point = decoded.document.solution?.placements[0]?.transform.position;
  if (point === undefined) throw new Error('Solution absente');
  await page.goto('/levels');
  await page.getByRole('button', { name: 'Modifier le niveau 1', exact: true }).click();
  await catalogue(page, /^Poutre moyenne/u);
  await clickWorld(page, point.x, point.y);
  await page.getByRole('button', { name: 'Ouvrir les propriétés' }).click();
  await page.getByRole('button', { name: 'Vers la droite' }).click();
  await page.getByRole('button', { name: 'Rotation positive' }).click();
  await page.getByRole('combobox', { name: 'Longueur de la poutre' }).selectOption('short');
  await expect
    .poll(
      async () =>
        (await storedDraft(page, 'tuto-1-brouillon'))?.document.objects.at(-1)?.transform.rotation,
    )
    .toBeCloseTo(Math.PI / 12);
  const edited = await storedDraft(page, 'tuto-1-brouillon');
  await menu(page, 'Mes niveaux');
  await page.goto('/editor?draft=tuto-1-brouillon');
  await expect(page.getByRole('img', { name: 'Rendu du plateau' })).toBeVisible();
  expect((await storedDraft(page, 'tuto-1-brouillon'))?.document).toEqual(edited?.document);
  const beam = edited?.document.objects.at(-1);
  if (beam === undefined) throw new Error('Poutre absente');
  await clickWorld(page, beam.transform.position.x, beam.transform.position.y);
  await expect(page.getByRole('combobox', { name: 'Longueur de la poutre' })).toHaveValue('short');
  // Revenir à la solution physique pour rendre les métadonnées exportables.
  await page.getByRole('button', { name: 'Rotation négative' }).click();
  await page.getByRole('button', { name: 'Vers la gauche' }).click();
  await page.getByRole('button', { name: 'À placer', exact: true }).click();
  await page.getByRole('button', { name: 'Exporter le niveau' }).click();
  const dialog = page.getByRole('dialog', { name: 'Exporter le niveau' });
  await expect(dialog.getByText(/Puzzle vérifié/u)).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole('textbox', { name: 'Nom du niveau' }).fill('Pont conservé');
  await dialog.getByRole('textbox', { name: 'Pseudo (facultatif)' }).fill('Camille');
  await dialog.getByRole('button', { name: 'Télécharger le fichier' }).click();
  await expect
    .poll(async () => (await storedDraft(page, 'tuto-1-brouillon'))?.document.metadata.title)
    .toBe('Pont conservé');
  const saved = await storedDraft(page, 'tuto-1-brouillon');
  await dialog.getByRole('button', { name: 'Fermer l’export' }).click();
  await page.reload();
  await expect(page.getByRole('banner')).toContainText('Pont conservé');
  expect((await storedDraft(page, 'tuto-1-brouillon'))?.document).toEqual(saved?.document);
});

test('C3 : /shared et Mes niveaux reprennent la même construction reçue avant et après victoire', async ({
  page,
}) => {
  const decoded = decodeLevelFile(await readFile('src/content/levels/tuto-1.json', 'utf8'));
  if (decoded.status !== 'ok') throw new Error('Tutoriel invalide');
  const point = decoded.document.solution?.placements[0]?.transform.position;
  if (point === undefined) throw new Error('Solution absente');
  const id = `recu-${await levelFingerprint(decoded.document)}`;
  const shared = `/shared${await encodeShareFragment(decoded.document)}`;
  await page.goto(shared);
  await catalogue(page, /^Poutre courte/u);
  await clickWorld(page, point.x, point.y);
  await expect
    .poll(async () => (await construction(page, 'received', id))?.document.inventory[0]?.quantity)
    .toBe(0);
  const saved = await construction(page, 'received', id);
  expect(Object.keys(saved?.provenance ?? {})).toHaveLength(1);
  await menu(page, 'Mes niveaux');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/my-levels/${id}/play$`));
  await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeDisabled();
  expect(await construction(page, 'received', id)).toEqual(saved);
  await page.getByRole('button', { name: 'Lancer', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Rendu du plateau' })).toHaveAttribute(
    'data-simulation-step',
  );
  await page.reload();
  await expect(page.getByRole('img', { name: 'Rendu du plateau' })).not.toHaveAttribute(
    'data-simulation-step',
  );
  expect(await construction(page, 'received', id)).toEqual(saved);
  await page.getByRole('button', { name: 'Lancer', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Bravo !' })).toBeVisible({ timeout: 20_000 });
  expect(await construction(page, 'received', id)).toEqual(saved);
  await page.goto(shared);
  await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeDisabled();
  expect(await construction(page, 'received', id)).toEqual(saved);
  expect((await browserRows(page, 'playerConstructions')).length).toBe(1);
});
