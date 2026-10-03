import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { receiveLevel } from '../application/received/receive-level';
import type { LevelDocument } from '../domain/level-document';
import { decodeShareFragment } from '../infrastructure/level-share/level-share-codec';
import { AppFrame } from '../ui/AppFrame';
import { Panel } from '../ui/Panel';
import { notKeptNotice } from './not-kept-notice';
import { ReceivedLevelBoard } from './ReceivedLevelBoard';
import { fingerprintOf } from './fingerprint-of';
import { useReceivedLevelRepository } from './received-level-repository-context';

type SharedLevelState =
  | { readonly status: 'loading' }
  | { readonly status: 'invalid' }
  | { readonly status: 'workshop' }
  | {
      readonly status: 'loaded';
      readonly document: LevelDocument;
      /** The stored entry a victory updates (M10); `null` when the level was not kept. */
      readonly entryId: string | null;
    };

/** Composition point: the real clock stamps `receivedAt`, as `App` does for drafts. */
const systemClock = (): Date => new Date();

/**
 * `/shared` (ADR 0008, 0011, 0015 § Réception): the level decoded from the URL
 * hash is stored as a received level, then played; a storage failure only
 * shows a discreet status. A victory updates the stored entry (M10).
 */
export function SharedLevelPage() {
  const { hash } = useLocation();
  return <SharedLevel key={hash} hash={hash} />;
}

function SharedLevel({ hash }: { readonly hash: string }) {
  const repository = useReceivedLevelRepository();
  const [state, setState] = useState<SharedLevelState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });

    const open = async (): Promise<SharedLevelState> => {
      const decoded = await decodeShareFragment(hash);
      if (decoded.status !== 'ok') return { status: 'invalid' };
      const fingerprint = await fingerprintOf(decoded.document);
      if (!active) return { status: 'loading' };
      const received = await receiveLevel(
        repository,
        decoded.document,
        'link',
        fingerprint,
        systemClock,
      );
      if (received.status === 'refused') return { status: 'workshop' };
      return {
        status: 'loaded',
        document: decoded.document,
        entryId: received.status === 'received' ? received.level.id : null,
      };
    };

    void open()
      .then((next) => {
        if (active) setState(next);
      })
      .catch(() => {
        if (active) setState({ status: 'invalid' });
      });

    return () => {
      active = false;
    };
  }, [hash, repository]);

  if (state.status === 'loaded') {
    return (
      <ReceivedLevelBoard
        key={hash}
        document={state.document}
        title={`Partage · ${state.document.metadata.title}`}
        entryId={state.entryId}
        {...(state.entryId === null ? { notice: notKeptNotice } : {})}
      />
    );
  }

  return (
    <AppFrame title="Niveau partagé" subtitle="Mes niveaux" variant="page">
      <div className="page-content">
        <Panel
          label="Niveau partagé"
          title={state.status === 'loading' ? 'Ouverture du niveau partagé' : 'Lien invalide'}
        >
          {state.status === 'loading' ? (
            <p className="panel-note" role="status">
              Chargement du niveau partagé…
            </p>
          ) : (
            <>
              <p className="panel-note" role="alert">
                {state.status === 'workshop'
                  ? 'Ce lien est un atelier, pas un niveau à jouer.'
                  : 'Ce lien de partage est invalide ou ne peut plus être ouvert.'}
              </p>
              <Link className="btn btn-neutral" to="/levels">
                Campagne
              </Link>
            </>
          )}
        </Panel>
      </div>
    </AppFrame>
  );
}
