// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LevelResult, type CampaignResult } from './LevelResult';

const won = { outcome: 'won' } as const;

const renderVictory = (campaign?: CampaignResult): HTMLElement => {
  render(
    <LevelResult
      outcome={won}
      isCreation={false}
      onReplay={() => undefined}
      onReturnToLevels={() => undefined}
      {...(campaign === undefined ? {} : { campaign })}
    />,
  );
  return screen.getByRole('region', { name: 'Résultat du niveau' });
};

describe('LevelResult — bandeau de victoire (U4, U4b)', () => {
  afterEach(() => {
    cleanup();
  });

  it('n’affiche ni palier ni compte hors campagne', () => {
    const result = renderVictory();

    expect(result).toHaveTextContent('Victoire');
    expect(result).not.toHaveAttribute('data-level-tier');
    expect(within(result).queryByText(/Résolu/)).not.toBeInTheDocument();
    expect(within(result).queryByRole('button', { name: 'Niveau suivant' })).toBeNull();
    expect(within(result).getByRole('button', { name: 'Retour aux niveaux' })).toBeVisible();
  });

  it('réduit la victoire de campagne à rouvrir le résultat ou recommencer (U4b)', () => {
    const onOpenResult = vi.fn();
    const result = renderVictory({ tier: 'elegant', onOpenResult });

    expect(result).toHaveTextContent('Victoire');
    expect(result).toHaveAttribute('data-level-tier', 'elegant');
    expect(within(result).getAllByRole('button', { name: /Recommencer/ })).toHaveLength(1);
    expect(within(result).queryByRole('button', { name: 'Retour aux niveaux' })).toBeNull();
    expect(within(result).queryByRole('button', { name: 'Niveau suivant' })).toBeNull();

    fireEvent.click(within(result).getByRole('button', { name: 'Voir le résultat' }));
    expect(onOpenResult).toHaveBeenCalledTimes(1);
  });
});
