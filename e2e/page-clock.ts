import type { Page } from '@playwright/test';

const CLOCK_START = new Date('2030-10-02T12:00:00Z');

/** Install the clock before navigation so page animations use its RAF implementation. */
export const installPageClock = async (page: Page): Promise<void> => {
  await page.clock.install({ time: CLOCK_START });
};

/** Pause at the current fake time after the application has finished loading. */
export const pausePageClock = async (page: Page): Promise<void> => {
  const currentTime = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(currentTime + 1000);
};
