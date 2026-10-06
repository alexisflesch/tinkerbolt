import type { Locator } from '@playwright/test';

/** Opens a level card's « Autres actions » menu, then presses the action named `name` in it. */
export const pressCardAction = async (
  card: Locator,
  name: string | RegExp,
  gesture: 'click' | 'tap' = 'click',
): Promise<void> => {
  await card.getByRole('button', { name: 'Autres actions' })[gesture]();
  await card.getByRole('button', { name, exact: typeof name === 'string' })[gesture]();
};
