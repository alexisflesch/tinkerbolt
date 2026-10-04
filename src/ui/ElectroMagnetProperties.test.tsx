// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { embeddedWorkshopDocument } from '../content/embedded-levels';
import { createConstructionAttempt, placeFromInventory } from '../application/construction';
import {
  currentEditorAttempt,
  createEditorSession,
  executeEditorCommand,
} from '../application/editor-session';
import { levelDocumentSchema } from '../domain/level-document';
import { ContextPanel } from './ContextPanel';

const document = levelDocumentSchema.parse({
  ...embeddedWorkshopDocument,
  objects: [
    ...embeddedWorkshopDocument.objects,
    {
      id: 'magnet',
      type: 'electro-magnet',
      props: { state: 'on' },
      permissions: { move: true, rotate: true, remove: true },
      transform: { position: { x: 6, y: 3 }, rotation: 0 },
    },
  ],
});
afterEach(cleanup);
describe('édition de l’électroaimant', () => {
  it.each(['creation', 'resolution'] as const)(
    'offre rotation et retrait en %s, avec état initial réglable uniquement par l’auteur',
    (mode) => {
      const initial = levelDocumentSchema.parse({
        ...document,
        objects: document.objects.filter((object) => object.id !== 'magnet'),
        inventory: [
          {
            id: 'magnet-stock',
            type: 'electro-magnet',
            props: { state: 'on' },
            permissions: { move: true, rotate: true, remove: true },
            quantity: 1,
          },
        ],
      });
      const placed = placeFromInventory({
        context: mode === 'resolution' ? 'player' : 'author',
        inventoryEntryId: 'magnet-stock',
        placementId: 'magnet',
        transform: { position: { x: 6, y: 3 }, rotation: 0 },
      }).execute(createConstructionAttempt(initial));
      expect(placed.status).toBe('accepted');
      if (placed.status !== 'accepted') return;
      let session = {
        ...createEditorSession(mode, placed.state),
        selectedPlacementId: 'magnet',
      };
      const onExecuteCommand = (command: Parameters<typeof executeEditorCommand>[1]) => {
        session = {
          ...executeEditorCommand(session, command).session,
          selectedPlacementId: 'magnet',
        };
      };
      const view = render(<ContextPanel session={session} onExecuteCommand={onExecuteCommand} />);
      if (mode === 'creation') {
        expect(screen.getByRole('combobox', { name: 'État de départ' })).toHaveValue('on');
        fireEvent.change(screen.getByRole('combobox', { name: 'État de départ' }), {
          target: { value: 'off' },
        });
        expect(
          currentEditorAttempt(session).document.objects.find((object) => object.id === 'magnet')
            ?.props,
        ).toEqual({ state: 'off' });
      } else expect(screen.queryByRole('combobox', { name: 'État de départ' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Rotation positive' }));
      expect(
        currentEditorAttempt(session).document.objects.find((object) => object.id === 'magnet')
          ?.transform.rotation,
      ).toBeCloseTo(Math.PI / 12);
      view.rerender(<ContextPanel session={session} onExecuteCommand={onExecuteCommand} />);
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer l’électroaimant' }));
      expect(
        currentEditorAttempt(session).document.objects.some((object) => object.id === 'magnet'),
      ).toBe(false);
    },
  );
});
