// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InspectorDrawer } from './InspectorDrawer';

const renderOpenSheet = (onCloseProperties: () => void) =>
  render(
    <InspectorDrawer
      isWideLayout={false}
      isPropertiesOpen
      placements={[]}
      selectedPlacementId={null}
      isSceneSelectionDisabled={false}
      onOpenProperties={() => undefined}
      onCloseProperties={onCloseProperties}
      onSelectPlacement={() => undefined}
      properties={<section aria-label="Propriétés de Levier" />}
      result={null}
    />,
  );

describe('InspectorDrawer — scrim du tiroir compact (G2)', () => {
  afterEach(cleanup);

  it('ignore le clic d’un toucher commencé sur le plateau avant l’ouverture du tiroir', () => {
    const onCloseProperties = vi.fn();
    renderOpenSheet(onCloseProperties);

    // Le toucher a sélectionné l’objet et ouvert le tiroir sous le doigt :
    // le clic émis par le navigateur à la fin du toucher arrive sur le scrim
    // sans que la pression y ait commencé.
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }), { detail: 1 });

    expect(onCloseProperties).not.toHaveBeenCalled();
  });

  it('ferme le tiroir quand le toucher commence et finit sur le scrim', () => {
    const onCloseProperties = vi.fn();
    renderOpenSheet(onCloseProperties);
    const scrim = screen.getByRole('button', { name: 'Fermer' });

    fireEvent.pointerDown(scrim);
    fireEvent.click(scrim, { detail: 1 });

    expect(onCloseProperties).toHaveBeenCalledTimes(1);
  });

  it('ferme le tiroir quand le scrim est activé au clavier', () => {
    const onCloseProperties = vi.fn();
    renderOpenSheet(onCloseProperties);

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }), { detail: 0 });

    expect(onCloseProperties).toHaveBeenCalledTimes(1);
  });
});
