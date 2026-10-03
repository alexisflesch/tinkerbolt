// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CampaignProgress } from '../application/progression';
import { CampaignProgressProvider } from './CampaignProgressProvider';
import { renderStorageReady, testProgressRepository, storageAction } from './storage-test-fixture';
import { useCampaignProgress } from './use-campaign-progress';

const createRepository = (progress: CampaignProgress = {}) => {
  const repository = testProgressRepository(progress);
  return {
    ...repository,
    recordVictory: vi.fn((id: string, count: number) => repository.recordVictory(id, count)),
  };
};

function ProgressProbe() {
  const { levels, recordCampaignSuccess, unlockAllLevels } = useCampaignProgress();
  const first = levels['tuto-1'];
  const second = levels['tuto-2'];
  const challenged = levels['tuto-4'];

  return (
    <>
      <output data-testid="first-level">{JSON.stringify(first)}</output>
      <output data-testid="second-level">{JSON.stringify(second)}</output>
      <output data-testid="challenged-level">{JSON.stringify(challenged)}</output>
      <output data-testid="unlock-all-levels">{String(unlockAllLevels)}</output>
      <button
        type="button"
        onClick={() => {
          recordCampaignSuccess('tuto-1', 0);
        }}
      >
        Enregistrer la victoire
      </button>
    </>
  );
}

describe('useCampaignProgress', () => {
  it('expose les déblocages et persiste une réussite injectée, puis persiste une réussite injectée', async () => {
    const repository = createRepository({
      'tuto-4': { resolved: true, bestObjectCount: 3 },
    });

    const originalStorageDescriptor = Object.getOwnPropertyDescriptor(navigator, 'storage');
    const persist = vi.fn(() => Promise.resolve(false));
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist },
    });

    const { unmount } = await renderStorageReady(
      <CampaignProgressProvider repository={repository}>
        <ProgressProbe />
      </CampaignProgressProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('unlock-all-levels')).toHaveTextContent('false');
    });
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('first-level').textContent)).toMatchObject({
        unlocked: true,
        resolved: false,
        tier: null,
        nextChallengeHint: null,
      });
    });
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('second-level').textContent)).toMatchObject({
        unlocked: false,
        resolved: false,
      });
    });
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('challenged-level').textContent)).toMatchObject({
        unlocked: false,
        resolved: true,
        bestObjectCount: 3,
        tier: 'resolved',
        nextChallengeHint: null,
      });
    });

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la victoire' })),
    );

    await waitFor(() => {
      expect(repository.recordVictory).toHaveBeenCalledWith('tuto-1', 0);
    });
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la victoire' })),
    );
    await waitFor(() => {
      expect(persist).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('second-level').textContent)).toMatchObject({
        unlocked: true,
        resolved: false,
      });
    });

    unmount();
    if (originalStorageDescriptor === undefined) {
      Reflect.deleteProperty(navigator, 'storage');
    } else {
      Object.defineProperty(navigator, 'storage', originalStorageDescriptor);
    }
  });

  it('force le déblocage de tous les niveaux quand unlockAllLevels est vrai (mode développement)', async () => {
    const repository = createRepository();

    const { unmount } = await renderStorageReady(
      <CampaignProgressProvider repository={repository} unlockAllLevels>
        <ProgressProbe />
      </CampaignProgressProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('unlock-all-levels')).toHaveTextContent('true');
    });
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('second-level').textContent)).toMatchObject({
        unlocked: true,
        resolved: false,
      });
    });
    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('challenged-level').textContent)).toMatchObject({
        unlocked: true,
        resolved: false,
      });
    });

    unmount();
  });
});
