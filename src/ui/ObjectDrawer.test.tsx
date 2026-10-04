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
      isDrawerOpen
      isSideLayout={false}
      isPlacementActive={false}
      onToggleDrawer={() => undefined}
      onCloseDrawer={() => undefined}
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

  it('ne propose à l’auteur ni balle rouge ni panier : l’objectif est déjà posé, et unique', () => {
    const drawer = renderDrawer('creation');

    const blue = within(drawer).getByRole('button', { name: 'Balle' });
    expect(thumbnailOf(blue)).toMatch(/\/thumbs\/second-ball\.png$/);
    expect(within(drawer).queryByRole('button', { name: /Balle rouge/ })).toBeNull();
    expect(within(drawer).queryByRole('button', { name: /Panier/ })).toBeNull();
    expect(within(drawer).getByText('15 objets')).toBeTruthy();
  });

  it('propose à l’auteur la carte Fil, qui lance le câblage (U15)', () => {
    const onSelectWire = vi.fn();
    const drawer = renderDrawer('creation', onSelectWire);

    const wire = within(drawer).getByRole('button', { name: 'Fil de commande' });
    expect(wire.textContent).toContain('Relie un levier ou un bouton à un appareil');
    expect(wire.querySelector('svg')).not.toBeNull();
    fireEvent.click(wire);
    expect(onSelectWire).toHaveBeenCalledOnce();
    expect(within(drawer).getByText('15 objets')).toBeTruthy();
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
