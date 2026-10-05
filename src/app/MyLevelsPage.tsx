import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Copy,
  FilePlus2,
  FileUp,
  Gift,
  Pencil,
  Play,
  Settings,
  Share2,
  Trash2,
} from 'lucide-react';

import { createConstructionAttempt, type ConstructionAttempt } from '../application/construction';
import { campaignDraftId } from '../application/drafts/campaign-draft';
import type { DraftCreation } from '../application/drafts/draft-repository';
import { duplicateCreation } from '../application/drafts/duplicate-creation';
import { listCreations } from '../application/drafts/list-creations';
import { saveCreationFromLevel } from '../application/drafts/save-creation-from-level';
import type { Command } from '../application/history';
import { puzzleFromWorkshop } from '../application/puzzle/puzzle-workshop';
import { listReceivedLevels } from '../application/received/list-received-levels';
import { receiveLevel } from '../application/received/receive-level';
import type { ReceivedLevel } from '../application/received/received-level-repository';
import { embeddedLevels } from '../content/embedded-levels';
import type { LevelDocument } from '../domain/level-document';
import { AppFrame } from '../ui/AppFrame';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { useDraftRepository } from './draft-repository-context';
import { awaitDraftWrites } from './draft-writes';
import { fingerprintOf } from './fingerprint-of';
import { ImportToast } from './ImportToast';
import { LevelCard } from './LevelCard';
import { LevelExportDialog } from './LevelExportDialog';
import { LevelSection } from './LevelSection';
import { modifiedOn, receivedOn } from './modified-on';
import { notKeptNotice } from './not-kept-notice';
import { randomIdPart } from './random-id-part';
import { readLevelFile } from './read-level-file';
import { ReceivedLevelBoard } from './ReceivedLevelBoard';
import { ReceivedLevelShareDialog } from './ReceivedLevelShareDialog';
import { useReceivedLevelRepository } from './received-level-repository-context';
import { useCampaignProgress } from './use-campaign-progress';

/** Composition point: the real clock stamps `receivedAt`, as on `/shared`, and dates the creations. */
const systemClock = (): Date => new Date();

type PendingDeletion =
  | { readonly kind: 'creation'; readonly id: string; readonly title: string }
  | { readonly kind: 'received'; readonly id: string; readonly title: string };

type Sharing =
  | { readonly kind: 'creation'; readonly creation: DraftCreation }
  | { readonly kind: 'received'; readonly document: LevelDocument };

type Notice = { readonly tone: 'status' | 'alert'; readonly message: string } | null;

const storageMessage = (code: string): string =>
  code === 'quota-exceeded'
    ? 'L’espace de stockage de cet appareil est plein.'
    : 'Le stockage local de cet appareil est indisponible.';

/** ADR 0015: the campaign level a `<id>-brouillon` creation comes from, if any. */
const campaignLevelOf = (creationId: string): LevelDocument | undefined =>
  embeddedLevels.find((level) => campaignDraftId(level) === creationId);

/**
 * `/my-levels` (ADR 0008 amended, ADR 0015 § Page « Mes niveaux »): the
 * player's creations and the levels received by link or file, most recent
 * first. Every action is a plain button, usable by touch alone.
 */
export function MyLevelsPage() {
  const navigate = useNavigate();
  const drafts = useDraftRepository();
  const received = useReceivedLevelRepository();
  const { levels: campaignProgress, loading: campaignLoading } = useCampaignProgress();
  const [creations, setCreations] = useState<Awaited<ReturnType<typeof listCreations>> | null>(
    null,
  );
  const [receivedLevels, setReceivedLevels] = useState<Awaited<
    ReturnType<typeof listReceivedLevels>
  > | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const [sharing, setSharing] = useState<Sharing | null>(null);
  const [creationNotice, setCreationNotice] = useState<Notice>(null);
  const [importNotice, setImportNotice] = useState<Notice>(null);
  const [importToast, setImportToast] = useState<Notice>(null);
  const dismissImportToast = useCallback(() => {
    setImportToast(null);
  }, []);
  /** M10: an imported level that could not be kept, still playable once. */
  const [unkeptImport, setUnkeptImport] = useState<LevelDocument | null>(null);
  const [playingUnkept, setPlayingUnkept] = useState<LevelDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelDeletionRef = useRef<HTMLButtonElement>(null);

  const active = useRef(true);
  const revision = useRef(0);
  const refresh = useCallback(async (): Promise<void> => {
    const current = ++revision.current;
    await awaitDraftWrites(drafts);
    if (current !== revision.current) return;
    const [nextCreations, nextReceived] = await Promise.all([
      listCreations(drafts),
      listReceivedLevels(received),
    ]);
    if (!active.current || current !== revision.current) return;
    setCreations(nextCreations);
    setReceivedLevels(nextReceived);
  }, [drafts, received]);
  useEffect(() => {
    active.current = true;
    void refresh();
    return () => {
      active.current = false;
      revision.current += 1;
    };
  }, [refresh]);

  const isLocked = (creationId: string): boolean => {
    const level = campaignLevelOf(creationId);
    return level !== undefined && campaignProgress[level.id]?.unlocked !== true;
  };

  const confirmDeletion = async (): Promise<void> => {
    if (pendingDeletion === null) return;
    const result =
      pendingDeletion.kind === 'creation'
        ? await drafts.delete(pendingDeletion.id)
        : await received.delete(pendingDeletion.id);
    const setNotice = pendingDeletion.kind === 'creation' ? setCreationNotice : setImportNotice;
    if (pendingDeletion.kind === 'received') setUnkeptImport(null);
    setNotice(
      result.status === 'ok'
        ? null
        : { tone: 'alert', message: `${storageMessage(result.code)} Rien n’a été supprimé.` },
    );
    setPendingDeletion(null);
    await refresh();
  };

  /**
   * M14: « Partager » outside the workshop records the exported title and
   * pseudonym in the creation, as the workshop would, with its source kept.
   */
  const applyToCreation = async (
    creation: DraftCreation,
    commands: readonly Command<ConstructionAttempt>[],
  ): Promise<void> => {
    let attempt = createConstructionAttempt(creation.document);
    let changed = false;
    for (const command of commands) {
      const outcome = command.execute(attempt);
      if (outcome.status !== 'accepted' || outcome.state === attempt) continue;
      attempt = outcome.state;
      changed = true;
    }
    if (!changed) return;
    const result = await drafts.save({
      document: attempt.document,
      ...(creation.source === undefined ? {} : { source: creation.source }),
    });
    setCreationNotice(
      result.status === 'ok'
        ? null
        : {
            tone: 'alert',
            message: `${storageMessage(result.code)} Le titre, la description et le pseudo n’ont pas été enregistrés.`,
          },
    );
    await refresh();
  };

  const duplicate = async (id: string): Promise<void> => {
    const result = await duplicateCreation(drafts, id, randomIdPart);
    setCreationNotice(
      result.status === 'ok'
        ? null
        : { tone: 'alert', message: `${storageMessage(result.code)} La copie n’a pas été créée.` },
    );
    await refresh();
  };

  /** M11: « Modifier » a received level opens a new creation, its winning solution posed if solved. */
  const editReceived = async (level: ReceivedLevel): Promise<void> => {
    const result = await saveCreationFromLevel(drafts, level.document, {
      ...(level.solved && level.playerSolution !== undefined
        ? { playerSolution: level.playerSolution }
        : {}),
      createId: randomIdPart,
    });
    if (result.status === 'error') {
      setImportNotice({
        tone: 'alert',
        message: `${storageMessage(result.code)} La création n’a pas été créée.`,
      });
      return;
    }
    if (active.current) void navigate(`/editor?draft=${encodeURIComponent(result.draftId)}`);
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) return;

    setUnkeptImport(null);
    setImportToast(null);
    setImportNotice({ tone: 'status', message: 'Lecture du fichier…' });
    const read = await readLevelFile(file);
    if (read.status === 'error') {
      setImportNotice(null);
      setImportToast({ tone: 'alert', message: read.message });
      return;
    }
    const fingerprint = await fingerprintOf(read.document);
    const result = await receiveLevel(received, read.document, 'file', fingerprint, systemClock);
    setImportNotice(null);
    switch (result.status) {
      case 'received':
        setImportToast({
          tone: 'status',
          message: `« ${result.level.document.metadata.title} » est dans tes niveaux reçus.`,
        });
        break;
      case 'refused':
        setImportToast({
          tone: 'alert',
          message: 'Ce fichier est un atelier, pas un niveau à jouer.',
        });
        break;
      case 'not-kept':
        setImportToast({
          tone: 'alert',
          message:
            result.code === 'fingerprint-unavailable'
              ? 'Ce niveau n’a pas été gardé : cet appareil ne peut pas le reconnaître hors connexion sécurisée.'
              : `Ce niveau n’a pas été gardé. ${storageMessage(result.code)}`,
        });
        // ADR 0015 § Réception: a storage failure never prevents playing.
        setUnkeptImport(read.document);
        break;
    }
    await refresh();
  };

  const today = systemClock();

  const creationCard = ({ id, creation }: { id: string; creation: DraftCreation }) => {
    const { title } = creation.document.metadata;
    const locked = isLocked(id);
    const modified = modifiedOn(creation.updatedAt, today);
    const deleteAction = {
      label: 'Supprimer',
      icon: Trash2,
      danger: true,
      // ADR 0015: the creation of a locked campaign level can still be deleted.
      availableWhenLocked: true,
      onSelect: () => {
        setPendingDeletion({ kind: 'creation', id, title });
      },
    };
    return (
      <LevelCard
        key={id}
        document={creation.document}
        locked={locked}
        {...(modified === undefined ? {} : { meta: modified })}
        {...(locked
          ? {}
          : {
              primary: {
                label: 'Modifier',
                icon: Pencil,
                onSelect: () => {
                  void navigate(`/editor?draft=${encodeURIComponent(id)}`);
                },
              },
            })}
        actions={
          locked
            ? [deleteAction]
            : [
                {
                  label: 'Jouer',
                  icon: Play,
                  disabled: puzzleFromWorkshop(creation.document).status !== 'ok',
                  onSelect: () => {
                    // U22 « Jouer le puzzle », opened straight away from the workshop.
                    void navigate(`/editor?draft=${encodeURIComponent(id)}`, {
                      state: { playPuzzle: true },
                    });
                  },
                },
                {
                  label: 'Partager',
                  icon: Share2,
                  onSelect: () => {
                    setSharing({ kind: 'creation', creation });
                  },
                },
                {
                  label: 'Dupliquer',
                  icon: Copy,
                  onSelect: () => {
                    void duplicate(id);
                  },
                },
                deleteAction,
              ]
        }
      />
    );
  };

  const receivedCard = (level: ReceivedLevel) => {
    const { title } = level.document.metadata;
    const date = receivedOn(level.receivedAt, today);
    return (
      <LevelCard
        key={level.id}
        document={level.document}
        showAttribution
        {...(date === undefined ? {} : { meta: date })}
        {...(level.solved
          ? {
              tier: 'resolved' as const,
              ...(level.bestObjectCount === undefined
                ? {}
                : { objectCount: level.bestObjectCount }),
            }
          : { assistiveStatus: 'Pas encore résolu' })}
        primary={{
          label: 'Jouer',
          icon: Play,
          onSelect: () => {
            void navigate(`/my-levels/${encodeURIComponent(level.id)}/play`);
          },
        }}
        actions={[
          {
            label: 'Modifier',
            icon: Pencil,
            onSelect: () => {
              void editReceived(level);
            },
          },
          {
            label: 'Partager',
            icon: Share2,
            onSelect: () => {
              setSharing({ kind: 'received', document: level.document });
            },
          },
          {
            label: 'Supprimer',
            icon: Trash2,
            danger: true,
            onSelect: () => {
              setPendingDeletion({ kind: 'received', id: level.id, title });
            },
          },
        ]}
      />
    );
  };

  if (playingUnkept !== null) {
    // Played in place, like an unkept `/shared` link: nothing is recorded.
    return (
      <ReceivedLevelBoard
        document={playingUnkept}
        title={playingUnkept.metadata.title}
        entryId={null}
        notice={notKeptNotice}
        exit={{
          label: 'Retour à Mes niveaux',
          shortLabel: 'Mes niveaux',
          onExit: () => {
            setPlayingUnkept(null);
          },
        }}
      />
    );
  }

  return (
    <AppFrame
      title="Mes niveaux"
      variant="page"
      headerAction={
        <>
          <Button
            aria-label="Importer"
            onClick={() => {
              fileInputRef.current?.click();
            }}
          >
            <FileUp size={18} aria-hidden="true" />
            <span className="header-action-label">Importer</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            aria-label="Fichier de niveau JSON"
            hidden
            onChange={(event) => {
              void importFile(event);
            }}
          />
          <Button
            tone="go"
            aria-label="Nouveau niveau"
            onClick={() => {
              void navigate('/editor');
            }}
          >
            <FilePlus2 size={18} aria-hidden="true" />
            <span className="header-action-label">Nouveau niveau</span>
          </Button>
        </>
      }
    >
      <div className="page-content page-content-levels my-levels">
        <LevelSection
          title="Mes créations"
          className="my-levels-collection my-levels-creations"
          icon={Settings}
          description="Vos niveaux créés dans l’atelier"
          count={String(
            !campaignLoading && creations?.status === 'ok' ? creations.creations.length : '…',
          )}
        >
          {creationNotice !== null && (
            <p className="panel-note my-levels-notice" role={creationNotice.tone}>
              {creationNotice.message}
            </p>
          )}
          {creations === null || campaignLoading ? (
            <p role="status">Chargement des créations…</p>
          ) : creations.status === 'error' ? (
            <p className="panel-note my-levels-notice" role="alert">
              {storageMessage(creations.code)} Tes créations ne peuvent pas être lues.
            </p>
          ) : (
            <>
              {creations.warning !== undefined && (
                <p className="panel-note my-levels-notice" role="status">
                  Une création illisible a été mise de côté.
                </p>
              )}
              {creations.creations.length === 0 ? (
                <p className="my-levels-empty">
                  Tu n’as encore aucune création. Lance-toi avec « Nouveau niveau » !
                </p>
              ) : (
                <div className="level-cards">{creations.creations.map(creationCard)}</div>
              )}
            </>
          )}
        </LevelSection>

        <LevelSection
          title="Niveaux reçus"
          className="my-levels-collection my-levels-received"
          icon={Gift}
          description="Niveaux partagés avec vous"
          count={String(receivedLevels?.status === 'ok' ? receivedLevels.levels.length : '…')}
        >
          {importNotice !== null && (
            <p className="panel-note my-levels-notice" role={importNotice.tone}>
              {importNotice.message}
            </p>
          )}
          {unkeptImport !== null && (
            <Button
              tone="go"
              className="my-levels-play-anyway"
              onClick={() => {
                setPlayingUnkept(unkeptImport);
              }}
            >
              <Play size={18} aria-hidden="true" />
              Jouer quand même
            </Button>
          )}
          {receivedLevels === null ? (
            <p role="status">Chargement des niveaux reçus…</p>
          ) : receivedLevels.status === 'error' ? (
            <p className="panel-note my-levels-notice" role="alert">
              {storageMessage(receivedLevels.code)} Les niveaux reçus ne peuvent pas être lus.
            </p>
          ) : (
            <>
              {receivedLevels.warning !== undefined && (
                <p className="panel-note my-levels-notice" role="status">
                  Un niveau reçu illisible a été mis de côté.
                </p>
              )}
              {receivedLevels.levels.length === 0 ? (
                <p className="my-levels-empty">
                  Tu n’as aucun niveau reçu pour l’instant. Ouvre un lien de partage ou importe un
                  fichier.
                </p>
              ) : (
                <div className="level-cards">{receivedLevels.levels.map(receivedCard)}</div>
              )}
            </>
          )}
        </LevelSection>
      </div>

      {importToast !== null && <ImportToast notice={importToast} onDismiss={dismissImportToast} />}

      {pendingDeletion !== null && (
        <Dialog
          label="Confirmer la suppression"
          title="Supprimer ce niveau ?"
          closeLabel="Fermer sans supprimer"
          initialFocusRef={cancelDeletionRef}
          onClose={() => {
            setPendingDeletion(null);
          }}
        >
          <p className="dialog-text">
            « {pendingDeletion.title} » sera supprimé de cet appareil. Cette action est définitive.
          </p>
          <div className="level-result-actions">
            <Button
              ref={cancelDeletionRef}
              onClick={() => {
                setPendingDeletion(null);
              }}
            >
              Annuler
            </Button>
            <Button
              tone="reset"
              onClick={() => {
                void confirmDeletion();
              }}
            >
              <Trash2 size={18} aria-hidden="true" />
              Supprimer
            </Button>
          </div>
        </Dialog>
      )}
      {sharing?.kind === 'creation' && (
        <LevelExportDialog
          document={sharing.creation.document}
          onClose={() => {
            setSharing(null);
          }}
          onApplyAttribution={(commands) => {
            void applyToCreation(sharing.creation, commands);
          }}
        />
      )}
      {sharing?.kind === 'received' && (
        <ReceivedLevelShareDialog
          document={sharing.document}
          onClose={() => {
            setSharing(null);
          }}
        />
      )}
    </AppFrame>
  );
}
