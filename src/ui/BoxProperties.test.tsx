// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { embeddedWorkshopDocument } from '../content/embedded-levels';
import { createConstructionAttempt } from '../application/construction';
import { createEditorSession, executeEditorCommand } from '../application/editor-session';
import { levelDocumentSchema } from '../domain/level-document';
import { ContextPanel } from './ContextPanel';

const document = levelDocumentSchema.parse({
  ...embeddedWorkshopDocument,
  objects: [
    ...embeddedWorkshopDocument.objects,
    {
      id: 'box',
      type: 'box',
      props: { material: 'wood' },
      permissions: { move: true, rotate: true, remove: true },
      transform: { position: { x: 6, y: 3 }, rotation: 0 },
    },
  ],
});
afterEach(cleanup);
describe('propriétés de caisse', () => {
  it('change le matériau en Atelier par une commande validée', () => {
    let session = {
      ...createEditorSession('creation', createConstructionAttempt(document)),
      selectedPlacementId: 'box',
    };
    const view = render(
      <ContextPanel
        session={session}
        onExecuteCommand={(command) => {
          session = {
            ...executeEditorCommand(session, command).session,
            selectedPlacementId: 'box',
          };
        }}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Matériau de la caisse' }), {
      target: { value: 'metal' },
    });
    view.rerender(<ContextPanel session={session} onExecuteCommand={() => undefined} />);
    expect(screen.getByRole('combobox', { name: 'Matériau de la caisse' })).toHaveValue('metal');
  });
  it('garde le matériau fixé dans un puzzle', () => {
    render(
      <ContextPanel
        session={{
          ...createEditorSession('resolution', createConstructionAttempt(document)),
          selectedPlacementId: 'box',
        }}
        onExecuteCommand={() => undefined}
      />,
    );
    expect(screen.queryByRole('combobox', { name: 'Matériau de la caisse' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Rotation positive' })).toBeVisible();
  });
});
