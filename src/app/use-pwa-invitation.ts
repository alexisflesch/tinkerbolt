import { useCallback, useState } from 'react';

import { pwaInvitation, type PwaInvitationKind } from './pwa-invitation';
import { usePreferencesRepository } from './preferences-repository-context';
import { useStorageRead } from './use-storage-read';
import { usePwa } from './use-pwa';

interface BoardContext {
  /** `usePwaUpdateStatus(session)`: an update waits and the phase is safe. */
  readonly isUpdateOfferable: boolean;
  /** The attempt has changes that the update's reload would lose. */
  readonly hasUnsavedConstruction: boolean;
  readonly beforeReload?: (() => Promise<void>) | undefined;
}

interface PwaInvitationOffer {
  readonly kind: PwaInvitationKind;
  readonly onAccept: () => void;
  readonly onDismiss: () => void;
}

/**
 * U10: the PWA invitation of a screen — a board (`board` given) or the home
 * page (`null`). Declining the install invitation, in the card or in the
 * browser's own prompt, is kept in the local preferences (ADR 0012,
 * amendment of 2 Oct. 2026) with the other preferences untouched; a storage
 * failure only hides it for this visit. « Plus tard » on an update lasts
 * for the visit only.
 */
export function usePwaInvitation(board: BoardContext | null): PwaInvitationOffer | null {
  const pwa = usePwa();
  const preferences = usePreferencesRepository();
  const loaded = useStorageRead(useCallback(() => preferences.load(), [preferences]));
  const [declined, setDeclined] = useState(false);
  const isInstallDeclined =
    declined ||
    loaded === null ||
    (loaded.status === 'ok' && loaded.preferences.installInvitationDeclined === true);

  const kind = pwaInvitation({
    place: board === null ? 'home' : 'board',
    isUpdateOfferable: board === null ? pwa.isUpdateWaiting : board.isUpdateOfferable,
    isUpdateDismissed: pwa.isUpdateDismissed,
    hasUnsavedConstruction: board?.hasUnsavedConstruction ?? false,
    isInstallAvailable: pwa.isInstallAvailable,
    isInstallDeclined,
  });
  if (kind === null) return null;

  const declineInstall = (): void => {
    setDeclined(true);
    void preferences.patch({ installInvitationDeclined: true });
  };

  if (kind === 'update') {
    return {
      kind,
      onAccept: () => {
        if (board?.beforeReload === undefined) pwa.applyUpdate();
        else void board.beforeReload().then(pwa.applyUpdate);
      },
      onDismiss: pwa.dismissUpdate,
    };
  }
  return {
    kind,
    onAccept: () => {
      void pwa.install().then((outcome) => {
        if (outcome === 'dismissed') declineInstall();
      });
    },
    onDismiss: declineInstall,
  };
}
