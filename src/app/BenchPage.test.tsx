// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { renderStorageReady, storageAction } from './storage-test-fixture';
import { App } from './App';
import { BenchPage } from './BenchPage';

afterEach(cleanup);

describe('page de mesure de performance (/bench, ADR 0002)', () => {
  it('mesure chaque pas de physique avec l’horloge injectée et rend un verdict lisible', async () => {
    let clock = 0;
    const now = (): number => {
      clock += 0.5;
      return clock;
    };
    // The dense scene's physics is covered by its own tests; here a stand-in
    // session keeps the page's timing logic fast and stable under load.
    let advanced = 0;
    const createSession = () => ({
      advanceFixedSteps: (count: number): void => {
        advanced += count;
      },
      destroy: (): void => undefined,
    });
    render(
      <MemoryRouter initialEntries={['/bench']}>
        <BenchPage now={now} createSession={createSession} />
      </MemoryRouter>,
    );

    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Mesurer la physique' })),
    );

    await waitFor(() => {
      expect(advanced).toBe(1200);
    });
    const result = screen.getByRole('region', { name: 'Résultat de la mesure' });
    await waitFor(() => {
      expect(within(result).getByText(/1200 pas/)).toBeVisible();
    });
    await waitFor(() => {
      expect(within(result).getByText(/95e centile : 0,50 ms/)).toBeVisible();
    });
    await waitFor(() => {
      expect(within(result).getByText('Physique : OK')).toBeVisible();
    });
  });

  it('propose de jouer la scène dense sur le vrai plateau', async () => {
    render(
      <MemoryRouter initialEntries={['/bench']}>
        <BenchPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jouer la scène sur le plateau' })).toBeVisible();
    });
  });

  it('joue la scène dense sur le plateau partagé avec un compteur d’images par seconde', async () => {
    window.history.replaceState(null, '', '/bench/play');
    await renderStorageReady(<App />);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Plateau de jeu' })).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Images par seconde' })).toHaveTextContent(
        /Images\/s/,
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Lancer' })).toBeVisible();
    });
  });
});
