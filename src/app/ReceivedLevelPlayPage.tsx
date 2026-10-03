import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AppFrame } from '../ui/AppFrame';
import { Panel } from '../ui/Panel';
import { useStorageRead } from './use-storage-read';
import { StorageLoading } from './StorageLoading';
import { ReceivedLevelBoard } from './ReceivedLevelBoard';
import { useReceivedLevelRepository } from './received-level-repository-context';

/**
 * `/my-levels/:id/play` (ADR 0008 amended): a received level, played. The id
 * comes from the URL and is untrusted: it only serves one repository read,
 * which validates it. A victory updates the entry (M10).
 */
export function ReceivedLevelPlayPage() {
  const { id = '' } = useParams();
  return <ReceivedLevelPlay key={id} id={id} />;
}

function ReceivedLevelPlay({ id }: { readonly id: string }) {
  const repository = useReceivedLevelRepository();
  const navigate = useNavigate();
  const result = useStorageRead(useCallback(() => repository.load(id), [repository, id]));
  if (result === null) return <StorageLoading title="Niveau reçu" />;
  const level = result.status === 'ok' ? result.level : null;

  if (level === null) {
    return (
      <AppFrame title="Mes niveaux" subtitle="Niveau reçu" variant="page">
        <div className="page-content">
          <Panel label="Niveau reçu" title="Niveau introuvable">
            <p className="panel-note" role="alert">
              Ce niveau reçu est introuvable ou ne peut pas être lu sur cet appareil.
            </p>
            <Link className="btn btn-neutral" to="/my-levels">
              Mes niveaux
            </Link>
          </Panel>
        </div>
      </AppFrame>
    );
  }

  return (
    <ReceivedLevelBoard
      document={level.document}
      title={level.document.metadata.title}
      entryId={level.id}
      exit={{
        label: 'Retour à Mes niveaux',
        shortLabel: 'Mes niveaux',
        onExit: () => {
          void navigate('/my-levels');
        },
      }}
    />
  );
}
