// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { AppHeader } from './AppHeader';

describe('AppHeader — iconographie U27', () => {
  afterEach(cleanup);

  it('rend le bouton de menu avec une icône SVG Lucide, sans glyphe Unicode', () => {
    render(
      <MemoryRouter>
        <AppHeader title="Campagne" />
      </MemoryRouter>,
    );

    const menu = screen.getByRole('button', { name: 'Ouvrir le menu' });
    expect(menu.querySelector('svg.lucide-menu')).toBeInTheDocument();
    expect(menu).not.toHaveTextContent('☰');
  });
});

describe('AppHeader — navigation et lexique (V3)', () => {
  afterEach(cleanup);

  it('fait de la marque « TinkerBolt » un lien vers l’accueil', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/" element={<p>Page d’accueil</p>} />
          <Route path="/settings" element={<AppHeader title="Paramètres" />} />
        </Routes>
      </MemoryRouter>,
    );

    const brand = screen.getByRole('link', { name: 'TinkerBolt, accueil' });
    expect(brand).toHaveAttribute('href', '/');
    expect(within(brand).getByRole('heading', { name: 'TinkerBolt' })).toBeVisible();
    // Identité visuelle : le logo dessiné remplace la pastille « + » et le nom écrit.
    expect(brand.querySelector('.brand-logo')).toHaveAttribute('aria-hidden', 'true');
    expect(brand.querySelector('svg')).toBeNull();

    fireEvent.click(brand);
    expect(screen.getByText('Page d’accueil')).toBeVisible();
  });

  it('liste le menu dans l’ordre du lexique, sans les anciens libellés', () => {
    render(
      <MemoryRouter>
        <AppHeader title="Campagne" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));

    const entries = within(screen.getByRole('navigation', { name: 'Menu principal' }))
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(entries).toEqual(['Accueil', 'Campagne', 'Atelier', 'Mes niveaux', 'Paramètres']);
  });
});

describe('AppHeader — navigation principale de l’accueil', () => {
  afterEach(cleanup);

  it('n’affiche la navigation principale que sans titre de page', () => {
    const { unmount } = render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
    unmount();

    render(
      <MemoryRouter>
        <AppHeader title="Campagne" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).toBeNull();
  });
});

describe('AppHeader — titre en texte simple, « Titre · Contexte » (V7)', () => {
  afterEach(cleanup);

  const pageLabel = (): HTMLElement => {
    const label = screen.getByRole('banner').querySelector<HTMLElement>('.level-label');
    if (label === null) throw new Error('Titre de page introuvable dans l’en-tête.');
    return label;
  };

  it('écrit le titre puis le contexte sur une ligne, séparés par un point médian', () => {
    render(
      <MemoryRouter>
        <AppHeader title="Le grand détour" subtitle="Atelier" />
      </MemoryRouter>,
    );

    expect(pageLabel()).toHaveTextContent(/^Le grand détour · Atelier$/u);
    expect(screen.getByText('Atelier', { selector: '.level-mode' })).toBeVisible();
    // Le séparateur est visuel : les lecteurs d'écran lisent le titre puis le contexte.
    expect(pageLabel().querySelector('[aria-hidden="true"]')).toHaveTextContent('·');
  });

  it('garde « Niveau N · titre » en titre et ajoute « Campagne » en contexte', () => {
    render(
      <MemoryRouter>
        <AppHeader title="Niveau 1 · Le petit pont" subtitle="Campagne" />
      </MemoryRouter>,
    );

    expect(pageLabel()).toHaveTextContent(/^Niveau 1 · Le petit pont · Campagne$/u);
  });

  it('n’écrit que le titre quand il n’y a pas de contexte', () => {
    render(
      <MemoryRouter>
        <AppHeader title="Campagne" />
      </MemoryRouter>,
    );

    expect(pageLabel()).toHaveTextContent(/^Campagne$/u);
    expect(pageLabel().querySelector('.level-mode')).toBeNull();
  });

  it('montre l’auteur d’un niveau reçu à la place du contexte', () => {
    render(
      <MemoryRouter>
        <AppHeader title="La chaîne" subtitle="Mes niveaux" attribution="par Mila" />
      </MemoryRouter>,
    );

    expect(pageLabel()).toHaveTextContent(/^La chaîne · par Mila$/u);
  });

  it('n’a pas de titre au centre sans titre de page (accueil)', () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole('banner').querySelector('.level-label')).toBeNull();
    expect(screen.getByRole('link', { name: 'TinkerBolt, accueil' })).toBeVisible();
  });
});
