// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImportToast } from './ImportToast';

describe('notification d’import JSON', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each(['status', 'alert'] as const)(
    'annonce %s puis disparaît après six secondes sans déplacer le focus',
    (tone) => {
      vi.useFakeTimers();
      const onDismiss = vi.fn();
      const opener = document.createElement('button');
      document.body.append(opener);
      opener.focus();
      render(
        <ImportToast notice={{ tone, message: 'Résultat de l’import' }} onDismiss={onDismiss} />,
      );
      expect(screen.getByRole(tone)).toHaveTextContent('Résultat de l’import');
      expect(opener).toHaveFocus();
      act(() => {
        vi.advanceTimersByTime(5999);
      });
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
      opener.remove();
    },
  );

  it('referme immédiatement la notification au clic et annule son minuteur au démontage', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { unmount } = render(
      <ImportToast notice={{ tone: 'alert', message: 'Échec' }} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la notification' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    unmount();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('accorde six secondes au nouvel import, même si le message est identique', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(
      <ImportToast notice={{ tone: 'status', message: 'Importé' }} onDismiss={onDismiss} />,
    );
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    rerender(<ImportToast notice={{ tone: 'status', message: 'Importé' }} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
