// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CampaignProgress } from '../application/progression';
import type { ProgressRepository } from '../application/progression/progress-repository';
import { embeddedLevels } from '../content/embedded-levels';
import { renderStorageReady, storageAction } from './storage-test-fixture';
import { App } from './App';

const createRepository = (progress: CampaignProgress = {}): ProgressRepository => ({
  recordVictory: () => Promise.resolve({ status: 'ok', progress }),
  load: () => Promise.resolve({ status: 'ok', progress }),
  save: vi.fn((_progress: CampaignProgress) => {
    void _progress;
    return Promise.resolve({ status: 'ok' as const });
  }),
  clear: () => Promise.resolve({ status: 'ok' }),
});

const HERO_TITLE = 'Amène la balle jusqu’au panier.';

const destinations = (): HTMLElement =>
  screen.getByRole('navigation', { name: 'Explorer TinkerBolt' });

const campaignProgress = (): HTMLElement =>
  screen.getByRole('progressbar', { name: 'Progression de la campagne' });

describe('Accueil TinkerBolt (V7, maquette validée en V4)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });
  afterEach(cleanup);

  it('ouvre l’accueil à la racine avec le titre, le texte et les deux appels de la maquette', async () => {
    await renderStorageReady(<App progressRepository={createRepository()} />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: HERO_TITLE })).toBeVisible();
    });
    await waitFor(() => {
      expect(
        screen.getByText(
          'Poutres, tremplins, ventilateurs, leviers : place les pièces, lance la machine et regarde ce qui se passe. Raté ? Ajuste et relance.',
        ),
      ).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Jouer' })).toHaveAttribute('href', '/levels');
    });
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ou créer un niveau' })).toHaveAttribute(
        'href',
        '/editor',
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Plateau de jeu' })).not.toBeInTheDocument();
    });
  });

  it('montre l’aperçu réel du tutoriel 5, dessiné par le rendu du plateau', async () => {
    const { container } = await renderStorageReady(<App progressRepository={createRepository()} />);

    const hero = screen.getByRole('img', { name: 'Aperçu du niveau « La chaîne »' });
    await waitFor(() => {
      expect(hero.querySelector('.level-preview')).not.toBeNull();
    });
    // L'illustration composée et le décor de l'atelier ne sont plus utilisés.
    await waitFor(() => {
      expect(container.querySelector('.home-invention')).toBeNull();
    });
    await waitFor(() => {
      expect(container.innerHTML).not.toContain('board-workshop-day-v1.png');
    });
  });

  it('ouvre les trois destinations illustrées par un sprite, puis Paramètres en pied de page', async () => {
    await renderStorageReady(<App progressRepository={createRepository()} />);

    for (const { name, path, sprite } of [
      { name: 'Campagne', path: '/levels', sprite: 'basket' },
      { name: 'Atelier', path: '/editor', sprite: 'lever' },
      { name: 'Mes niveaux', path: '/my-levels', sprite: 'springboard' },
    ]) {
      const link = within(destinations()).getByRole('link', { name: new RegExp(`^${name}`, 'u') });
      await waitFor(() => {
        expect(link).toHaveAttribute('href', path);
      });
      await waitFor(() => {
        expect(within(link).getByRole('heading', { name })).toBeVisible();
      });
      const image = link.querySelector('img');
      await waitFor(() => {
        expect(image?.getAttribute('src')).toBe(`/assets/sprites/thumbs/${sprite}.png`);
      });
      await waitFor(() => {
        expect(image).toHaveAttribute('alt', '');
      });
    }
    await waitFor(() => {
      expect(within(destinations()).getAllByRole('link')).toHaveLength(3);
    });
    await waitFor(() => {
      expect(screen.getByText('Cinq niveaux pour découvrir chaque pièce.')).toBeVisible();
    });
    await waitFor(() => {
      expect(
        screen.getByText('Construis ton propre niveau, teste-le, puis envoie-le à qui tu veux.'),
      ).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByText('Tes créations et les niveaux qu’on t’a envoyés.')).toBeVisible();
    });

    const footer = screen
      .getByText('Les niveaux partagés sont sous licence CC BY 4.0.')
      .closest('footer');
    if (footer === null) throw new Error('Pied de page introuvable.');
    await waitFor(() => {
      expect(within(footer).getByRole('link', { name: 'Paramètres' })).toHaveAttribute(
        'href',
        '/settings',
      );
    });
  });

  it('n’a ni kicker, ni faits, ni carnet de bord, ni statistiques, ni titre au centre de l’en-tête', async () => {
    await renderStorageReady(<App progressRepository={createRepository()} />);

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Ton carnet de bord' })).toBeNull();
    });
    await waitFor(() => {
      expect(screen.queryByText(/Bienvenue dans l’atelier/u)).toBeNull();
    });
    await waitFor(() => {
      expect(screen.queryByText(/défis à résoudre/u)).toBeNull();
    });
    await waitFor(() => {
      expect(screen.queryByText(/Niveaux accessibles/u)).toBeNull();
    });
    await waitFor(() => {
      expect(screen.queryByText(/%/u)).toBeNull();
    });
    const header = screen.getByRole('banner');
    await waitFor(() => {
      expect(header).not.toHaveTextContent('Accueil');
    });
    await waitFor(() => {
      expect(header).not.toHaveTextContent('À toi d’inventer');
    });
  });

  it('montre dans la carte Campagne la progression résolus / total, en barre et en texte', async () => {
    await renderStorageReady(
      <App
        progressRepository={createRepository({
          'tuto-1': { resolved: true, bestObjectCount: 1 },
          'tuto-2': { resolved: true, bestObjectCount: 2 },
          'campagne-retiree': { resolved: true, bestObjectCount: 1 },
        })}
      />,
    );

    const campaign = within(destinations()).getByRole('link', { name: /^Campagne/u });
    await waitFor(() => {
      expect(within(campaign).getByText('2 / 5')).toBeVisible();
    });
    await waitFor(() => {
      expect(campaignProgress()).toHaveAttribute('value', '2');
    });
    await waitFor(() => {
      expect(campaignProgress()).toHaveAttribute('max', '5');
    });
    await waitFor(() => {
      expect(campaign).toContainElement(campaignProgress());
    });
  });

  it('commence à 0 / 5 et mène toujours à la campagne quand tout est résolu', async () => {
    await renderStorageReady(<App progressRepository={createRepository()} />);
    await waitFor(() => {
      expect(campaignProgress()).toHaveAttribute('value', '0');
    });
    await waitFor(() => {
      expect(within(destinations()).getByText('0 / 5')).toBeVisible();
    });
    cleanup();

    const progress = Object.fromEntries(
      embeddedLevels.map((level) => [level.id, { resolved: true, bestObjectCount: 1 }]),
    );
    await renderStorageReady(<App progressRepository={createRepository(progress)} />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Jouer' })).toHaveAttribute('href', '/levels');
    });
    await waitFor(() => {
      expect(campaignProgress()).toHaveAttribute('value', '5');
    });
    await waitFor(() => {
      expect(within(destinations()).getByText('5 / 5')).toBeVisible();
    });
  });

  it('garde les accès jouables et explique un stockage indisponible', async () => {
    await renderStorageReady(
      <App
        progressRepository={{
          recordVictory: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
          load: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
          save: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
          clear: () => Promise.resolve({ status: 'error', code: 'storage-unavailable' }),
        }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Jouer' })).toHaveAttribute('href', '/levels');
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'La progression ne peut pas être enregistrée sur cet appareil.',
      );
    });
  });

  it('signale une progression illisible sauvegardée par le repository', async () => {
    await renderStorageReady(
      <App
        progressRepository={{
          ...createRepository(),
          load: () =>
            Promise.resolve({ status: 'ok', progress: {}, warning: 'invalid-data-backed-up' }),
        }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Une ancienne sauvegarde illisible a été mise de côté.',
      );
    });
  });

  it('permet de revenir à l’accueil depuis le menu d’une autre route', async () => {
    window.history.replaceState(null, '', '/settings');
    await renderStorageReady(<App progressRepository={createRepository()} />);
    await storageAction(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' })),
    );
    await storageAction(() => fireEvent.click(screen.getByRole('button', { name: 'Accueil' })));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: HERO_TITLE })).toBeVisible();
    });
  });
});
