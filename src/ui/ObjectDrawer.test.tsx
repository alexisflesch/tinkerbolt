// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConstructionAttempt } from '../application/construction';
import { createEditorSession } from '../application/editor-session';
import { embeddedWorkshopDocument } from '../content/embedded-levels';
import type { LevelDocument } from '../domain/level-document';
import { ObjectDrawer } from './ObjectDrawer';

const withWires = (quantity: number): LevelDocument => ({
  ...embeddedWorkshopDocument,
  inventory: [
    ...embeddedWorkshopDocument.inventory,
    {
      id: 'inventory-wire',
      type: 'wire',
      props: {},
      quantity,
      permissions: { move: false, rotate: false, remove: true },
    },
  ],
});

const renderDrawer = (
  mode: 'resolution' | 'creation',
  onSelectWire: (inventoryEntryId?: string) => void = () => undefined,
  document: LevelDocument = embeddedWorkshopDocument,
): HTMLElement => {
  render(
    <ObjectDrawer
      session={createEditorSession(mode, createConstructionAttempt(document))}
      selectedObject={undefined}
      selectedEntryKey={undefined}
      onSelectKind={() => undefined}
      isWiringActive={false}
      onSelectWire={onSelectWire}
    />,
  );
  return screen.getByRole('region', { name: 'Objets disponibles' });
};

const thumbnailOf = (card: HTMLElement): string =>
  card.querySelector('img')?.getAttribute('src') ?? '';

describe('ObjectDrawer', () => {
  afterEach(cleanup);

  it('propose les deux variantes de caisse avec leurs vignettes', () => {
    const drawer = renderDrawer('creation');
    expect(thumbnailOf(within(drawer).getByRole('button', { name: 'Caisse en bois' }))).toMatch(
      /\/thumbs\/box-wood\.png$/,
    );
    expect(thumbnailOf(within(drawer).getByRole('button', { name: 'Caisse métallique' }))).toMatch(
      /\/thumbs\/box-metal\.png$/,
    );
  });

  it('propose l’électroaimant avec sa vignette en marche', () => {
    const drawer = renderDrawer('creation');
    expect(thumbnailOf(within(drawer).getByRole('button', { name: 'Électroaimant' }))).toMatch(
      /\/thumbs\/electro-magnet\.png$/,
    );
  });

  it('propose le piston avec sa vignette', () => {
    const drawer = renderDrawer('creation');
    expect(thumbnailOf(within(drawer).getByRole('button', { name: 'Piston' }))).toMatch(
      /\/thumbs\/piston\.png$/,
    );
  });

  it('propose le minuteur avec sa vignette', () => {
    const drawer = renderDrawer('creation');
    expect(thumbnailOf(within(drawer).getByRole('button', { name: 'Minuteur' }))).toMatch(
      /\/thumbs\/timer\.png$/,
    );
  });

  it('montre en bleu la balle de l’inventaire du joueur : elle n’est jamais l’objectif', () => {
    const drawer = renderDrawer('resolution');

    const ball = within(drawer).getByRole('button', { name: /^Balle, quantité/ });
    expect(thumbnailOf(ball)).toMatch(/\/thumbs\/second-ball\.png$/);
  });

  it('propose à l’auteur la balle rouge et le panier, une balle bleue en plus (ADR 0020)', () => {
    const { goal: ignoredGoal, inventory: ignoredInventory, ...bare } = embeddedWorkshopDocument;
    void ignoredGoal;
    void ignoredInventory;
    const drawer = renderDrawer('creation', undefined, {
      ...bare,
      objects: [],
      inventory: [],
    });

    const red = within(drawer).getByRole('button', { name: 'Balle rouge' });
    expect(thumbnailOf(red)).toMatch(/\/thumbs\/ball\.png$/);
    expect(red).toHaveProperty('disabled', false);
    expect(within(drawer).getByRole('button', { name: 'Panier' })).toHaveProperty(
      'disabled',
      false,
    );
    const blue = within(drawer).getByRole('button', { name: 'Balle' });
    expect(thumbnailOf(blue)).toMatch(/\/thumbs\/second-ball\.png$/);
    expect(within(drawer).getByText('17 objets')).toBeTruthy();
  });

  it('désactive la balle rouge et le panier une fois posés : un exemplaire de chacun', () => {
    const drawer = renderDrawer('creation');

    expect(within(drawer).getByRole('button', { name: 'Balle rouge' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(within(drawer).getByRole('button', { name: 'Panier' })).toHaveProperty('disabled', true);
    expect(within(drawer).getByRole('button', { name: 'Balle' })).toHaveProperty('disabled', false);
  });

  it('ne désactive que l’entrée dont l’objet est déjà désigné', () => {
    const goal = embeddedWorkshopDocument.goal;
    if (goal?.ballId === undefined) throw new Error('Atelier sans balle.');
    const drawer = renderDrawer('creation', undefined, {
      ...embeddedWorkshopDocument,
      inventory: [],
      goal: { type: 'basket', ballId: goal.ballId },
    });

    expect(within(drawer).getByRole('button', { name: 'Balle rouge' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(within(drawer).getByRole('button', { name: 'Panier' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('range le catalogue de l’auteur en quatre catégories, chaque carte avec sa description', () => {
    const drawer = renderDrawer('creation');

    const groups = within(drawer)
      .getAllByRole('group')
      .map((group) => [
        group.getAttribute('aria-label'),
        within(group)
          .getAllByRole('button')
          .filter((button) => button.classList.contains('object-card'))
          .map((card) => card.getAttribute('aria-label')),
      ]);
    expect(groups).toEqual([
      [
        'Ce qui bouge',
        ['Balle rouge', 'Balle', 'Panier', 'Masse', 'Caisse en bois', 'Caisse métallique'],
      ],
      ['Structures', ['Poutre moyenne', 'Bascule', 'Tremplin']],
      ['Appareils', ['Convoyeur', 'Ventilateur', 'Électroaimant', 'Piston', 'Barrière']],
      ['Commandes', ['Levier', 'Bouton', 'Minuteur', 'Fil de commande']],
    ]);
    expect(within(drawer).getByRole('button', { name: 'Caisse métallique' }).textContent).toContain(
      'Une caisse que l’électroaimant attire',
    );
    expect(within(drawer).getByRole('button', { name: 'Caisse en bois' }).textContent).toContain(
      'Une caisse à pousser ou à transporter',
    );
  });

  it('laisse l’inventaire du joueur sans catégories', () => {
    const drawer = renderDrawer('resolution');

    expect(within(drawer).queryAllByRole('group')).toHaveLength(0);
  });

  it('replie et rouvre une catégorie avec son bouton accessible', () => {
    const drawer = renderDrawer('creation');
    const toggle = within(drawer).getByRole('button', { name: 'Ce qui bouge' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(drawer).queryByRole('button', { name: 'Balle' })).toBeNull();
    expect(within(drawer).getByRole('button', { name: 'Poutre moyenne' })).toBeTruthy();
    fireEvent.click(toggle);
    expect(within(drawer).getByRole('button', { name: 'Balle' })).toBeTruthy();
  });

  it('recherche sans tenir compte de la casse et des accents, y compris dans les groupes repliés', () => {
    const drawer = renderDrawer('creation');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Appareils' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Rechercher un objet' }));
    const input = within(drawer).getByRole('searchbox', { name: 'Rechercher dans le catalogue' });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: '  ELECTROAIMANT  ' } });
    expect(within(drawer).getByRole('button', { name: 'Électroaimant' })).toBeTruthy();
    expect(within(drawer).queryByRole('button', { name: 'Balle' })).toBeNull();
    expect(within(drawer).getAllByRole('group')).toHaveLength(1);
    fireEvent.change(input, { target: { value: 'introuvable' } });
    expect(within(drawer).getByText('Aucun objet ne correspond à ta recherche.')).toBeTruthy();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Fermer la recherche' }));
    expect(within(drawer).queryByRole('searchbox')).toBeNull();
    expect(within(drawer).getByRole('button', { name: 'Balle' })).toBeTruthy();
    expect(
      within(drawer).getByRole('button', { name: 'Appareils' }).getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('garde le contenu monté pour animer les tiroirs et le retire des interactions quand ils sont fermés', () => {
    const drawer = renderDrawer('creation');
    const group = within(drawer).getByRole('group', { name: 'Ce qui bouge' });
    const panel = group.querySelector('.object-group-panel');
    const cards = group.querySelector('.object-group-cards');
    expect(panel?.getAttribute('data-expanded')).toBe('true');
    fireEvent.click(within(group).getByRole('button', { name: 'Ce qui bouge' }));
    expect(panel?.getAttribute('data-expanded')).toBe('false');
    expect(cards?.hasAttribute('inert')).toBe(true);
    expect(cards?.getAttribute('aria-hidden')).toBe('true');
    expect(cards?.querySelectorAll('.object-card')).toHaveLength(6);
    expect(within(group).queryByRole('button', { name: 'Balle' })).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: 'Ce qui bouge' }));
    expect(cards?.hasAttribute('inert')).toBe(false);
    expect(within(group).getByRole('button', { name: 'Balle' })).toBeTruthy();
  });

  it('permet de trouver le fil et garde la quantité de l’inventaire du joueur', () => {
    const onSelectWire = vi.fn();
    const drawer = renderDrawer('resolution', onSelectWire, withWires(2));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Rechercher un objet' }));
    fireEvent.change(within(drawer).getByRole('searchbox'), { target: { value: 'fil' } });
    expect(within(drawer).queryByRole('button', { name: /^Balle/ })).toBeNull();
    const wire = within(drawer).getByRole('button', { name: 'Fil de commande, quantité : 2' });
    fireEvent.click(wire);
    expect(onSelectWire).toHaveBeenCalledWith('inventory-wire');
    expect(within(drawer).getByText('Quantité : 2')).toBeTruthy();
  });

  it('propose à l’auteur la carte Fil, qui lance le câblage (U15)', () => {
    const onSelectWire = vi.fn();
    const drawer = renderDrawer('creation', onSelectWire);

    const wire = within(drawer).getByRole('button', { name: 'Fil de commande' });
    expect(wire.textContent).toContain('Relie une commande à un appareil');
    expect(wire.querySelector('svg')).not.toBeNull();
    fireEvent.click(wire);
    expect(onSelectWire).toHaveBeenCalledOnce();
    expect(within(drawer).getByText('17 objets')).toBeTruthy();
  });

  it('ne montre pas de carte Fil au joueur dont l’inventaire n’a pas de fil', () => {
    const drawer = renderDrawer('resolution');

    expect(within(drawer).queryByRole('button', { name: /Fil/ })).toBeNull();
  });

  it('montre au joueur la carte Fil de son inventaire, avec sa quantité (U21)', () => {
    const onSelectWire = vi.fn();
    const drawer = renderDrawer('resolution', onSelectWire, withWires(2));

    const wire = within(drawer).getByRole('button', { name: 'Fil de commande, quantité : 2' });
    expect(wire.textContent).toContain('Quantité : 2');
    expect(wire.querySelector('svg')).not.toBeNull();
    expect(wire.hasAttribute('disabled')).toBe(false);
    fireEvent.click(wire);
    expect(onSelectWire).toHaveBeenCalledWith('inventory-wire');
    expect(within(drawer).getByText('12 entrées')).toBeTruthy();
  });

  it('désactive la carte Fil épuisée, comme les autres (U21)', () => {
    const drawer = renderDrawer('resolution', undefined, withWires(0));

    expect(
      within(drawer)
        .getByRole('button', { name: 'Fil de commande, quantité : 0' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('ne montre à l’auteur que sa propre carte Fil, même quand l’inventaire en contient', () => {
    const drawer = renderDrawer('creation', undefined, withWires(2));

    expect(within(drawer).getAllByRole('button', { name: /^Fil/ })).toHaveLength(1);
    expect(within(drawer).getByRole('button', { name: 'Fil de commande' })).toBeTruthy();
  });
});
