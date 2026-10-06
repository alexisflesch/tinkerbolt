// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProgressVictoryResult } from '../application/progression/progress-repository';
import { CampaignProgressProvider } from './CampaignProgressProvider';
import { renderStorageReady, testProgressRepository } from './storage-test-fixture';
import { useCampaignProgress } from './use-campaign-progress';

const imported = { 'tuto-2': { resolved: true, bestObjectCount: 1 } } as const;
function Probe() {
  const { progress, importCampaignProgress, recordCampaignSuccess, resetCampaignProgress } =
    useCampaignProgress();
  return (
    <>
      <output>{JSON.stringify(progress)}</output>
      <button
        onClick={() => {
          void importCampaignProgress(imported);
        }}
      >
        Importer
      </button>
      <button
        onClick={() => {
          recordCampaignSuccess('tuto-1', 2);
        }}
      >
        Gagner
      </button>
      <button
        onClick={() => {
          void resetCampaignProgress();
        }}
      >
        Effacer
      </button>
    </>
  );
}
afterEach(cleanup);

describe('contexte de progression importée', () => {
  it('garde la progression affichée jusqu’au succès et la conserve en cas de refus', async () => {
    const initial = { 'tuto-1': { resolved: true, bestObjectCount: 2 } } as const;
    const merge = vi.fn(() => Promise.reject(new Error('stockage bloqué')));
    await renderStorageReady(
      <CampaignProgressProvider repository={{ ...testProgressRepository(initial), merge }}>
        <Probe />
      </CampaignProgressProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Importer'));
      await Promise.resolve();
    });
    expect(merge).toHaveBeenCalledWith(imported);
    expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify(initial));
  });
  it('attend la victoire précédente et le reset attend la fusion avant de vider l’état', async () => {
    const events: string[] = [];
    let finishVictory: ((value: ProgressVictoryResult) => void) | undefined;
    let finishImport: ((value: ProgressVictoryResult) => void) | undefined;
    const repository = {
      ...testProgressRepository(),
      recordVictory: () => {
        events.push('victory');
        return new Promise<ProgressVictoryResult>((resolve) => {
          finishVictory = resolve;
        });
      },
      merge: () => {
        events.push('merge');
        return new Promise<ProgressVictoryResult>((resolve) => {
          finishImport = resolve;
        });
      },
      clear: () => {
        events.push('clear');
        return Promise.resolve({ status: 'ok' as const });
      },
    };
    await renderStorageReady(
      <CampaignProgressProvider repository={repository}>
        <Probe />
      </CampaignProgressProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText('Gagner'));
      fireEvent.click(screen.getByText('Importer'));
      await Promise.resolve();
    });
    expect(events).toEqual(['victory']);
    await act(async () => {
      finishVictory?.({ status: 'ok', progress: {} });
      await Promise.resolve();
    });
    expect(events).toEqual(['victory', 'merge']);
    await act(async () => {
      fireEvent.click(screen.getByText('Effacer'));
      await Promise.resolve();
    });
    expect(events).toEqual(['victory', 'merge']);
    await act(async () => {
      finishImport?.({ status: 'ok', progress: imported });
      await Promise.resolve();
    });
    expect(events).toEqual(['victory', 'merge', 'clear']);
    expect(screen.getByRole('status')).toHaveTextContent('{}');
  });
});
