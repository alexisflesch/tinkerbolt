import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  type RenderResult,
} from '@testing-library/react';
import { awaitDraftWrites } from './draft-writes';
import type { ReactElement } from 'react';
import type { CampaignProgress } from '../application/progression';
import { recordSuccess } from '../application/progression';
import type { ProgressRepository } from '../application/progression/progress-repository';
import { createTinkerboltDatabase } from '../infrastructure/storage/tinkerbolt-database';
import { createIndexedDBDraftRepository } from '../infrastructure/storage/indexed-db-draft-repository';
import { createIndexedDBReceivedLevelRepository } from '../infrastructure/storage/indexed-db-received-level-repository';
import { createIndexedDBPreferencesRepository } from '../infrastructure/storage/indexed-db-preferences-repository';

export const testDatabase = () => createTinkerboltDatabase({ indexedDB, IDBKeyRange });
export const testDraftRepository = (clock = () => new Date()) =>
  createIndexedDBDraftRepository(testDatabase(), clock);
export const testReceivedRepository = () =>
  createIndexedDBReceivedLevelRepository(testDatabase(), () => new Date());
export const testPreferencesRepository = () =>
  createIndexedDBPreferencesRepository(testDatabase(), () => new Date());
export const mergeCampaignProgressForTest = (
  current: CampaignProgress,
  imported: CampaignProgress,
): CampaignProgress => {
  let merged = current;
  for (const [id, candidate] of Object.entries(imported)) {
    if (candidate === undefined) continue;
    const result = candidate;
    const previous = Object.hasOwn(merged, id) ? merged[id] : undefined;
    if (result.resolved && result.bestObjectCount !== null) {
      const bestObjectCount =
        previous?.resolved === true && previous.bestObjectCount !== null
          ? Math.min(previous.bestObjectCount, result.bestObjectCount)
          : result.bestObjectCount;
      merged = { ...merged, [id]: { resolved: true, bestObjectCount } };
    } else if (previous === undefined) {
      merged = { ...merged, [id]: result };
    }
  }
  return merged;
};
export const testProgressRepository = (initial: CampaignProgress = {}): ProgressRepository => {
  let progress = initial;
  return {
    load: () => Promise.resolve({ status: 'ok', progress }),
    save: (value) => {
      progress = value;
      return Promise.resolve({ status: 'ok' });
    },
    merge: (imported) => {
      progress = mergeCampaignProgressForTest(progress, imported);
      return Promise.resolve({ status: 'ok', progress });
    },
    recordVictory: (id, count) => {
      progress = recordSuccess(progress, id, count);
      return Promise.resolve({ status: 'ok', progress });
    },
    clear: () => {
      progress = {};
      return Promise.resolve({ status: 'ok' });
    },
  };
};
export async function renderStorageReady(element: ReactElement): Promise<RenderResult> {
  let rendered: RenderResult | undefined;
  await act(async () => {
    rendered = render(element);
    await Promise.resolve();
  });
  if (screen.queryAllByText(/^Chargement/u).length > 0)
    await waitFor(() => {
      if (screen.queryAllByText(/^Chargement/u).length > 0)
        throw new Error('Lecture encore en cours');
    });
  await act(async () => {
    await Promise.resolve();
  });
  if (rendered === undefined) throw new Error('Écran non monté');
  return rendered;
}

export async function storageAction(action: () => unknown = () => undefined): Promise<void> {
  await act(async () => {
    action();
    await Promise.resolve();
  });
  await act(async () => {
    await awaitDraftWrites();
  });
  if (screen.queryAllByText(/^Chargement/u).length > 0)
    await waitFor(() => {
      if (screen.queryAllByText(/^Chargement/u).length > 0)
        throw new Error('Lecture encore en cours');
    });
  await act(async () => {
    await Promise.resolve();
  });
}

export async function activeStoredRowCount(): Promise<number> {
  const db = testDatabase();
  const counts = await Promise.all(
    ['creations', 'receivedLevels', 'progress', 'preferences'].map((name) =>
      db.table(name).count(),
    ),
  );
  db.close();
  return counts.reduce((sum, count) => sum + count, 0);
}

/**
 * A level card's action by name: on the card itself, or in its « ⋯ » menu,
 * which is opened first. Inside an `act` callback the opening is only rendered
 * afterwards, so the menu's button is looked up even while still hidden.
 */
export function cardAction(card: HTMLElement, name: string): HTMLElement {
  const direct = within(card).queryByRole('button', { name });
  if (direct !== null) return direct;
  fireEvent.click(within(card).getByRole('button', { name: 'Autres actions' }));
  return within(card).getByRole('button', { name, hidden: true });
}
