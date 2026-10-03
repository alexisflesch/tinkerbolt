import { storedEnvelope, seedIndexedDB, preferencesFixture } from './indexed-db-fixture';
import { mkdir } from 'node:fs/promises';

import { expect, test, type Locator, type Page } from '@playwright/test';

const formats = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
] as const;

const updateInvitation = (page: Page): Locator =>
  page.getByRole('region', { name: 'Mise à jour de TinkerBolt' });
const installInvitation = (page: Page): Locator =>
  page.getByRole('region', { name: 'Installer TinkerBolt' });

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('Élément sans boîte : il doit être affiché.');
  return box;
};

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The invitation never covers the board nor its actions. */
const expectBesideTheBoard = async (page: Page, invitation: Locator): Promise<void> => {
  const invitationBox = await boxOf(invitation);
  const covered = [
    page.getByRole('region', { name: 'Plateau de jeu' }),
    page.getByRole('button', { name: 'Lancer' }),
    page.getByRole('button', { name: 'Recommencer le niveau' }),
  ];
  for (const element of covered) {
    expect(overlaps(invitationBox, await boxOf(element))).toBe(false);
  }
};

const hideFirstLevelHint = async (page: Page): Promise<void> => {
  await seedIndexedDB(page, [await preferencesFixture({ firstLevelHintDone: true })]);
};

const storedPreferences = async (page: Page): Promise<unknown> => {
  return storedEnvelope(page, 'preferences', 'player');
};

let nextVersion = 0;

/**
 * A real waiting update, in the real build: once the production service
 * worker is active, another script registered on the same scope is a new
 * version that `registerSW` reports through `onNeedRefresh`.
 */
const publishNewVersion = async (page: Page): Promise<void> => {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state === 'activated';
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
  nextVersion += 1;
  await page.evaluate(async (version) => {
    await navigator.serviceWorker.register(`/sw.js?u10=${String(version)}`, { scope: '/' });
  }, nextVersion);
};

/** Chrome on Android hands the page a `beforeinstallprompt`; here, a faithful stand-in. */
const offerInstall = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    });
    window.dispatchEvent(event);
  });
};

test.describe('mise à jour (U10)', () => {
  test.use({ serviceWorkers: 'allow' });

  test('propose la nouvelle version à l’accueil puis hors du plateau, la tait pendant la simulation', async ({
    page,
  }, testInfo) => {
    test.skip(
      !['mobile', 'v1'].includes(testInfo.project.name),
      'Le parcours est validé sur mobile.',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await hideFirstLevelHint(page);
    await publishNewVersion(page);

    const invitation = updateInvitation(page);
    await expect(invitation).toBeVisible({ timeout: 15_000 });
    await expect(invitation).toContainText('Nouvelle version disponible.');
    await expect(invitation.getByRole('button', { name: 'Mettre à jour' })).toBeVisible();

    await page.getByRole('link', { name: 'Jouer', exact: true }).tap();
    await page.getByRole('button', { name: 'Jouer le niveau 1', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Lancer' })).toBeVisible();
    await expect(invitation).toBeVisible();
    await expectBesideTheBoard(page, invitation);

    await page.getByRole('button', { name: 'Lancer' }).tap();
    await expect(invitation).toBeHidden();
    await page.getByRole('button', { name: 'Recommencer', exact: true }).tap();
    await expect(invitation).toBeVisible();

    await invitation.getByRole('button', { name: 'Plus tard' }).tap();
    await expect(invitation).toBeHidden();
  });

  test('captures de l’invitation de mise à jour aux trois formats', async ({ page }, testInfo) => {
    test.skip(
      !['mobile', 'v1'].includes(testInfo.project.name),
      'Les captures sont prises sur le profil mobile.',
    );
    await mkdir('test-results/pwa-invitation', { recursive: true });

    for (const viewport of formats) {
      const size = `${String(viewport.width)}x${String(viewport.height)}`;
      const shot = (name: string) =>
        page.screenshot({
          path: `test-results/pwa-invitation/${name}-${size}.png`,
          fullPage: true,
          scale: 'css',
        });
      await page.setViewportSize(viewport);
      await page.goto('/');
      await hideFirstLevelHint(page);
      await publishNewVersion(page);
      const invitation = updateInvitation(page);
      await expect(invitation).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(200);
      await shot('mise-a-jour-accueil');

      await page.getByRole('link', { name: 'Jouer', exact: true }).click();
      await page.getByRole('button', { name: 'Jouer le niveau 1', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Lancer' })).toBeVisible();
      await expect(invitation).toBeVisible();
      await expectBesideTheBoard(page, invitation);
      await page.waitForTimeout(200);
      await shot('mise-a-jour-plateau');
    }
  });
});

test.describe('installation (U10)', () => {
  test('propose l’installation à l’accueil quand le navigateur la permet, et retient le refus', async ({
    page,
  }, testInfo) => {
    test.skip(
      !['mobile', 'v1'].includes(testInfo.project.name),
      'Le parcours est validé sur mobile.',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'TinkerBolt' })).toBeVisible();
    await expect(installInvitation(page)).toBeHidden();

    await offerInstall(page);
    const invitation = installInvitation(page);
    await expect(invitation).toBeVisible();
    await expect(invitation.getByRole('button', { name: 'Installer', exact: true })).toBeVisible();

    await invitation.getByRole('button', { name: 'Ne pas installer' }).tap();
    await expect(invitation).toBeHidden();
    expect(await storedPreferences(page)).toEqual({
      kind: 'preferences',
      version: 1,
      data: { installInvitationDeclined: true },
    });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'TinkerBolt' })).toBeVisible();
    await offerInstall(page);
    await expect(page.getByRole('link', { name: 'Jouer', exact: true })).toBeVisible();
    await expect(invitation).toBeHidden();
  });

  test('captures de l’invitation d’installation aux trois formats', async ({ page }, testInfo) => {
    test.skip(
      !['mobile', 'v1'].includes(testInfo.project.name),
      'Les captures sont prises sur le profil mobile.',
    );
    await mkdir('test-results/pwa-invitation', { recursive: true });

    for (const viewport of formats) {
      const size = `${String(viewport.width)}x${String(viewport.height)}`;
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'TinkerBolt' })).toBeVisible();
      await offerInstall(page);
      await expect(installInvitation(page)).toBeVisible();
      await page.waitForTimeout(200);
      await page.screenshot({
        path: `test-results/pwa-invitation/installation-accueil-${size}.png`,
        fullPage: true,
        scale: 'css',
      });
    }
  });
});
