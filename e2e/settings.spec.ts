import { seedIndexedDB, browserRows } from './indexed-db-fixture';
import { mkdir } from 'node:fs/promises';

import { expect, test, type Locator, type Page } from '@playwright/test';
import { navigateTo } from './app-navigation';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

const progressEnvelope = {
  kind: 'progress',
  version: 1,
  data: {
    'tuto-1': { resolved: true, bestObjectCount: 2 },
    'tuto-2': { resolved: true, bestObjectCount: 3 },
  },
};

/** What a reset must leave alone (creations, received levels, preferences). */
const untouched = {
  'creations:tuto-2-brouillon': JSON.stringify('création du niveau 2'),
  'receivedLevels:recu-0123456789abcdef': JSON.stringify('niveau reçu'),
} as const;

const preferences = (data: Record<string, unknown>) => ({ kind: 'preferences', version: 1, data });

/** Seeds once (not an init script, which would seed again on every navigation). */
const seed = async (page: Page, entries: Readonly<Record<string, string>>): Promise<void> => {
  await page.goto('/');
  await seedIndexedDB(
    page,
    Object.entries(entries).map(([key, value]) => {
      const [table, id] = key.split(':');
      if (
        table !== 'creations' &&
        table !== 'receivedLevels' &&
        table !== 'progress' &&
        table !== 'preferences'
      )
        throw new Error('Table fixture invalide');
      const envelope: unknown = JSON.parse(value);
      return { table, value: { id, envelope } };
    }),
  );
};

const seededState = (): Record<string, string> => ({
  ...untouched,
  'progress:campaign': JSON.stringify(progressEnvelope),
  'preferences:player': JSON.stringify(
    preferences({ author: 'Lili', firstLevelHintDone: true, installInvitationDeclined: true }),
  ),
});

const stored = async (page: Page, key: string): Promise<string | null> => {
  const [table, id] = key.split(':');
  if (
    table !== 'creations' &&
    table !== 'receivedLevels' &&
    table !== 'progress' &&
    table !== 'preferences'
  )
    throw new Error('Table fixture invalide');
  const rows = await browserRows(page, table);
  const row = rows.find(
    (value) => typeof value === 'object' && value !== null && 'id' in value && value.id === id,
  );
  return typeof row === 'object' && row !== null && 'envelope' in row
    ? JSON.stringify(row.envelope)
    : null;
};

const storedJson = async (page: Page, key: string): Promise<unknown> => {
  const parsed: unknown = JSON.parse((await stored(page, key)) ?? 'null');
  return parsed;
};

const pseudoField = (page: Page): Locator => page.getByRole('textbox', { name: 'Pseudo retenu' });
const pseudoPanel = (page: Page): Locator => page.getByRole('region', { name: 'Pseudo' });
const progressPanel = (page: Page): Locator =>
  page.getByRole('region', { name: 'Progression de la campagne' });

const expectTouchTarget = async (locator: Locator): Promise<void> => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('Élément sans boîte : il doit être affiché.');
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
};

const expectNoHorizontalScroll = async (page: Page): Promise<void> => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

test('U11 — au toucher, le pseudo retenu se modifie et s’efface, et la progression se remet à zéro', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours est validé sur mobile.',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, seededState());
  await page.goto('/settings');

  await expect(pseudoField(page)).toHaveValue('Lili');
  await expectTouchTarget(pseudoField(page));
  for (const name of ['Enregistrer le pseudo', 'Effacer le pseudo']) {
    await expectTouchTarget(page.getByRole('button', { name }));
  }
  await expectTouchTarget(page.getByRole('button', { name: 'Remettre la progression à zéro' }));
  await expectNoHorizontalScroll(page);

  // Un pseudo invalide est dit sous le champ et rien n'est écrit.
  await pseudoField(page).tap();
  await pseudoField(page).fill('Li li');
  await expect(pseudoPanel(page).getByRole('alert')).toContainText('ni saut de ligne');
  await expect(page.getByRole('button', { name: 'Enregistrer le pseudo' })).toBeDisabled();

  // Modifier : espaces de bord retirés, autres préférences conservées.
  await pseudoField(page).fill('  Noé  ');
  await page.getByRole('button', { name: 'Enregistrer le pseudo' }).tap();
  await expect(pseudoPanel(page).getByRole('status')).toHaveText('Pseudo enregistré.');
  expect(await storedJson(page, 'preferences:player')).toEqual(
    preferences({ author: 'Noé', firstLevelHintDone: true, installInvitationDeclined: true }),
  );

  // Effacer : seul `author` disparaît.
  await page.getByRole('button', { name: 'Effacer le pseudo' }).tap();
  await expect(pseudoPanel(page).getByRole('status')).toHaveText('Pseudo effacé.');
  await expect(pseudoField(page)).toHaveValue('');
  expect(await storedJson(page, 'preferences:player')).toEqual(
    preferences({ firstLevelHintDone: true, installInvitationDeclined: true }),
  );

  // Annuler ne change rien.
  const resetButton = page.getByRole('button', { name: 'Remettre la progression à zéro' });
  await resetButton.tap();
  const dialog = page.getByRole('dialog', { name: 'Remettre la progression à zéro ?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Annuler' }).tap();
  await expect(dialog).toBeHidden();
  expect(await storedJson(page, 'progress:campaign')).toEqual(progressEnvelope);

  // Confirmer efface la progression, et elle seule.
  await resetButton.tap();
  await dialog.getByRole('button', { name: 'Remettre à zéro', exact: true }).tap();
  await expect(dialog).toBeHidden();
  await expect(progressPanel(page).getByRole('status')).toHaveText(
    'Progression remise à zéro : seul le niveau 1 est ouvert.',
  );
  await expect(progressPanel(page)).toContainText('Niveaux résolus : 0 sur 7.');
  expect(await stored(page, 'progress:campaign')).toBeNull();
  for (const [key, value] of Object.entries(untouched)) {
    expect(await stored(page, key)).toBe(value);
  }
  expect(await storedJson(page, 'preferences:player')).toEqual(
    preferences({ firstLevelHintDone: true, installInvitationDeclined: true }),
  );

  // Sans rechargement, la campagne est de nouveau verrouillée après le niveau 1.
  await navigateTo(page, 'Campagne');
  await expect(page.getByRole('button', { name: 'Jouer le niveau 1', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Jouer le niveau 2', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Jouer le niveau 3', exact: true })).toBeDisabled();
});

test('U11 — en paysage téléphone, la page défile jusqu’à la remise à zéro', async ({
  page,
}, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Le parcours est validé sur mobile.',
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await seed(page, seededState());
  await page.goto('/settings');

  await expect(pseudoField(page)).toHaveValue('Lili');
  await expectNoHorizontalScroll(page);
  const resetButton = page.getByRole('button', { name: 'Remettre la progression à zéro' });
  await resetButton.scrollIntoViewIfNeeded();
  await expect(resetButton).toBeInViewport();
  await resetButton.tap();
  const dialog = page.getByRole('dialog', { name: 'Remettre la progression à zéro ?' });
  const confirm = dialog.getByRole('button', { name: 'Remettre à zéro', exact: true });
  await confirm.scrollIntoViewIfNeeded();
  await expect(confirm).toBeInViewport();
  await confirm.tap();
  await expect(progressPanel(page).getByRole('status')).toBeVisible();
});

test('U11 — captures des paramètres aux trois formats', async ({ page }, testInfo) => {
  test.skip(
    !['mobile', 'v1'].includes(testInfo.project.name),
    'Les captures sont prises sur le profil mobile.',
  );
  await mkdir('test-results/settings', { recursive: true });

  for (const viewport of formats) {
    const size = `${String(viewport.width)}x${String(viewport.height)}`;
    const shot = (name: string) =>
      page.screenshot({
        path: `test-results/settings/${name}-${size}.png`,
        fullPage: true,
        scale: 'css',
      });
    await page.setViewportSize(viewport);
    await seed(page, seededState());
    await page.goto('/settings');
    await expect(pseudoField(page)).toHaveValue('Lili');
    await page.waitForTimeout(200);
    await shot('repos');

    await pseudoField(page).fill('Li li');
    await expect(pseudoPanel(page).getByRole('alert')).toBeVisible();
    await page.getByRole('heading', { name: 'Profil' }).tap();
    await page.waitForTimeout(200);
    await shot('pseudo-invalide');
    await pseudoField(page).fill('Lili');

    await page.getByRole('button', { name: 'Remettre la progression à zéro' }).tap();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `test-results/settings/confirmation-${size}.png`, scale: 'css' });

    await page.getByRole('button', { name: 'Remettre à zéro', exact: true }).tap();
    await expect(progressPanel(page).getByRole('status')).toBeVisible();
    await page.waitForTimeout(200);
    await shot('statut');
  }
});
