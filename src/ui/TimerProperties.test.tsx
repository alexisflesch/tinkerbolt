// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createConstructionAttempt } from '../application/construction';
import {
  currentEditorAttempt,
  createEditorSession,
  executeEditorCommand,
} from '../application/editor-session';
import { embeddedWorkshopDocument } from '../content/embedded-levels';
import { levelDocumentSchema } from '../domain/level-document';
import { ContextPanel } from './ContextPanel';

afterEach(cleanup);

describe('édition du minuteur', () => {
  it('permet à l’auteur de choisir un délai entier de 1 à 10 secondes', () => {
    const document = levelDocumentSchema.parse({
      ...embeddedWorkshopDocument,
      objects: [
        ...embeddedWorkshopDocument.objects,
        {
          id: 'timer-1',
          type: 'timer',
          props: { delaySeconds: 3 },
          permissions: { move: true, rotate: true, remove: true },
          transform: { position: { x: 6, y: 3 }, rotation: 0 },
        },
      ],
    });
    let session = {
      ...createEditorSession('creation', createConstructionAttempt(document)),
      selectedPlacementId: 'timer-1',
    };
    const onExecuteCommand = (command: Parameters<typeof executeEditorCommand>[1]) => {
      session = {
        ...executeEditorCommand(session, command).session,
        selectedPlacementId: 'timer-1',
      };
    };

    render(<ContextPanel session={session} onExecuteCommand={onExecuteCommand} />);

    const delay = screen.getByRole('combobox', { name: 'Délai du minuteur' });
    expect(delay).toHaveValue('3');
    expect(delay.querySelectorAll('option')).toHaveLength(10);
    fireEvent.change(delay, { target: { value: '10' } });
    expect(
      currentEditorAttempt(session).document.objects.find(({ id }) => id === 'timer-1')?.props,
    ).toEqual({ delaySeconds: 10 });
  });

  it('ne permet pas au joueur de modifier le délai fixé par le niveau', () => {
    const document = levelDocumentSchema.parse({
      ...embeddedWorkshopDocument,
      objects: [
        ...embeddedWorkshopDocument.objects,
        {
          id: 'timer-1',
          type: 'timer',
          props: { delaySeconds: 3 },
          permissions: { move: true, rotate: true, remove: true },
          transform: { position: { x: 6, y: 3 }, rotation: 0 },
        },
      ],
    });
    const session = {
      ...createEditorSession('resolution', createConstructionAttempt(document)),
      selectedPlacementId: 'timer-1',
    };

    render(<ContextPanel session={session} onExecuteCommand={() => undefined} />);

    expect(screen.queryByRole('combobox', { name: 'Délai du minuteur' })).toBeNull();
  });
});
