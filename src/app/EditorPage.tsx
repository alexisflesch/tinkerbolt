import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { campaignDraftId } from '../application/drafts/campaign-draft';
import { lastEditableCreationId } from '../application/drafts/last-editable-creation';
import { saveFreeCreation, startFreeCreation } from '../application/drafts/save-free-creation';
import { puzzleFromWorkshop } from '../application/puzzle/puzzle-workshop';
import { embeddedLevels, embeddedWorkshopDocument } from '../content/embedded-levels';
import type { LevelDocument } from '../domain/level-document';
import { AppFrame } from '../ui/AppFrame';
import { Panel } from '../ui/Panel';
import { BoardShell } from './BoardShell';
import { awaitDraftWrites, orderDraftWrite } from './draft-writes';
import { StorageLoading } from './StorageLoading';
import { useStorageRead } from './use-storage-read';
import { useDraftRepository } from './draft-repository-context';
import { LockedLevelPage } from './LockedLevelPage';
import { randomIdPart } from './random-id-part';
import { useCampaignProgress } from './use-campaign-progress';

/**
 * The free workshop's life on `/editor`. Its first committed change stores it
 * as a creation and replaces the URL by `?draft=<id>` (ADR 0015 § Atelier
 * libre): the same workshop then stays mounted under that URL, with its undo
 * history and selection. `fromKey` is the router location it started on,
 * which the replacement has not yet reached when the creation is adopted.
 */
interface FreeSession {
  /** Changes when a new free workshop begins, so that it mounts afresh. */
  readonly generation: number;
  /** Started on `?new`: a blank workshop, whatever is stored. */
  readonly explicit: boolean;
  readonly adopted: { readonly draftId: string; readonly fromKey: string } | null;
}

/**
 * `/editor` (ADR 0008): with `?draft=<id>` an author draft (U17), with `?new`
 * a blank free workshop, and bare the last modified creation (ADR 0015,
 * amendment of 6 Oct. 2026). The id comes from the URL and is untrusted: the
 * draft repository validates it and decodes the stored document with the L22
 * codec.
 */
export function EditorPage() {
  const [searchParams] = useSearchParams();
  const locationKey = useLocation().key;
  const draftId = searchParams.get('draft');
  const asksNew = draftId === null && searchParams.has('new');
  const [freeSession, setFreeSession] = useState<FreeSession>({
    generation: 0,
    explicit: asksNew,
    adopted: null,
  });
  const { adopted } = freeSession;

  // The free workshop keeps the URL it created; going anywhere else, even
  // back to a bare `/editor` from the menu, ends it.
  const ownsUrl =
    adopted !== null &&
    (draftId === adopted.draftId || (draftId === null && locationKey === adopted.fromKey));
  const endsFreeSession =
    adopted === null ? draftId === null && freeSession.explicit !== asksNew : !ownsUrl;
  if (endsFreeSession) {
    setFreeSession({ generation: freeSession.generation + 1, explicit: asksNew, adopted: null });
  }

  if (draftId === null || ownsUrl) {
    return (
      <LastCreationGate key={freeSession.generation} skip={freeSession.explicit}>
        <FreeEditor
          onCreated={(createdId) => {
            setFreeSession((current) => ({
              ...current,
              adopted: { draftId: createdId, fromKey: locationKey },
            }));
          }}
        />
      </LastCreationGate>
    );
  }

  return <DraftEditor key={draftId} draftId={draftId} />;
}

/**
 * ADR 0015 (amendment of 6 Oct. 2026): a bare `/editor` reopens the last
 * modified creation, replacing the URL. Without one, the free workshop opens;
 * the choice is made once, so the workshop is never left for the creation it
 * stores afterwards.
 */
function LastCreationGate({
  skip,
  children,
}: {
  readonly skip: boolean;
  readonly children: ReactNode;
}) {
  const drafts = useDraftRepository();
  const { levels: levelProgress, loading } = useCampaignProgress();
  const [choice, setChoice] = useState<'pending' | 'free' | { readonly draftId: string }>(
    skip ? 'free' : 'pending',
  );
  const isPending = choice === 'pending';

  useEffect(() => {
    if (!isPending || loading) return undefined;
    let active = true;
    const isLocked = (creationId: string): boolean => {
      const level = embeddedLevels.find((candidate) => campaignDraftId(candidate) === creationId);
      return level !== undefined && levelProgress[level.id]?.unlocked !== true;
    };
    void (async () => {
      await awaitDraftWrites(drafts);
      return lastEditableCreationId(drafts, isLocked);
    })()
      .catch(() => null)
      .then((draftId) => {
        if (active) setChoice(draftId === null ? 'free' : { draftId });
      });
    return () => {
      active = false;
    };
  }, [isPending, loading, drafts, levelProgress]);

  if (choice === 'pending') return <StorageLoading title="Atelier" />;
  if (choice === 'free') return children;
  return <Navigate to={`/editor?draft=${encodeURIComponent(choice.draftId)}`} replace />;
}

/**
 * ADR 0015 § Atelier libre: nothing is stored until a first change is
 * committed. A failed save changes nothing, the URL included, and the next
 * committed change tries again (like a draft's, a failure never blocks editing).
 */
function FreeEditor({ onCreated }: { readonly onCreated: (draftId: string) => void }) {
  const drafts = useDraftRepository();
  const navigate = useNavigate();
  const createdIdRef = useRef<string | null>(null);
  const queueKey = useRef(Symbol('free-editor'));
  const active = useRef(true);
  const [unsaved, setUnsaved] = useState(false);
  const [isStored, setIsStored] = useState(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <Workshop
      initialDocument={embeddedWorkshopDocument}
      unsaved={unsaved}
      beforeLeave={() => awaitDraftWrites(drafts)}
      isStored={isStored}
      onDocumentCommitted={(document) => {
        void orderDraftWrite(drafts, queueKey.current, async () => {
          if (createdIdRef.current !== null)
            return saveFreeCreation(drafts, createdIdRef.current, document);
          const started = await startFreeCreation(drafts, document, randomIdPart);
          if (started.status === 'ok') {
            createdIdRef.current = started.draftId;
            if (active.current) {
              setIsStored(true);
              onCreated(started.draftId);
              void navigate(`/editor?draft=${encodeURIComponent(started.draftId)}`, {
                replace: true,
              });
            }
          }
          return started;
        }).then((result) => {
          if (active.current) setUnsaved(result.status === 'error');
        });
      }}
    />
  );
}

interface WorkshopProps {
  readonly initialDocument: LevelDocument;
  readonly beforeLeave?: (() => Promise<void>) | undefined;
  readonly unsaved?: boolean;
  /** The creation exists in storage: « Nouveau niveau » has something to leave behind. */
  readonly isStored: boolean;
  readonly onDocumentCommitted?: (document: LevelDocument) => void;
  /** « Jouer » from « Mes niveaux » (M9): open on the puzzle when there is one. */
  readonly startPlaying?: boolean;
  /** ADR 0015 § Révéler: the creation's source, offered to the workshop only. */
  readonly authorSource?: LevelDocument | undefined;
}

/** Navigation state is untrusted: only a literal `{ playPuzzle: true }` asks to play. */
const asksToPlayPuzzle = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && 'playPuzzle' in state && state.playPuzzle === true;

/** V3: the header shows the title of the level being edited, « Sans titre » when blank. */
const workshopTitle = ({ metadata }: LevelDocument): string =>
  metadata.title.trim() === '' ? 'Sans titre' : metadata.title;

/**
 * U22: the workshop, and the author's puzzle played « comme un joueur » on
 * an ephemeral copy. Coming back remounts the workshop on its last committed
 * document; its undo history starts again from there.
 */
function Workshop({
  initialDocument,
  onDocumentCommitted,
  startPlaying = false,
  authorSource,
  beforeLeave,
  unsaved = false,
  isStored,
}: WorkshopProps) {
  const navigate = useNavigate();
  const [workshopDocument, setWorkshopDocument] = useState(initialDocument);
  const [playtest, setPlaytest] = useState<LevelDocument | null>(() => {
    if (!startPlaying) return null;
    const conversion = puzzleFromWorkshop(initialDocument);
    return conversion.status === 'ok' ? conversion.puzzle : null;
  });

  if (playtest !== null) {
    return (
      <BoardShell
        key="playtest"
        initialDocument={playtest}
        mode="resolution"
        title={`Test joueur · ${playtest.metadata.title}`}
        subtitle="Atelier"
        exit={{
          label: 'Retour à l’atelier',
          onExit: () => {
            setPlaytest(null);
          },
        }}
      />
    );
  }

  return (
    <BoardShell
      key="workshop"
      initialDocument={workshopDocument}
      resetDocument={initialDocument}
      mode="creation"
      title={workshopTitle(workshopDocument)}
      subtitle="Atelier"
      onDocumentCommitted={(document) => {
        setWorkshopDocument(document);
        onDocumentCommitted?.(document);
      }}
      onPlayAsPlayer={setPlaytest}
      authorSource={authorSource}
      beforeLeave={beforeLeave}
      levelInfo={{
        defaultTitle: embeddedWorkshopDocument.metadata.title,
        onNewLevel: isStored
          ? () => {
              void navigate('/editor?new');
            }
          : undefined,
      }}
      saveNotice={
        unsaved ? 'Dernières modifications non enregistrées sur cet appareil.' : undefined
      }
    />
  );
}

/**
 * ADR 0015 § Un niveau de campagne verrouillé: the creation of a locked
 * campaign level is refused before it is even read (a read may rewrite an
 * old envelope), whatever is stored. The lock is recomputed from progress.
 */
function DraftEditor({ draftId }: { readonly draftId: string }) {
  const { levels: levelProgress, loading } = useCampaignProgress();
  const levelIndex = embeddedLevels.findIndex((level) => campaignDraftId(level) === draftId);
  const campaignLevel = embeddedLevels[levelIndex];

  if (loading) return <StorageLoading title="Brouillon" />;

  if (campaignLevel !== undefined && levelProgress[campaignLevel.id]?.unlocked !== true) {
    return (
      <LockedLevelPage
        title={`Niveau ${String(levelIndex + 1)} · ${campaignLevel.metadata.title}`}
      />
    );
  }

  return <StoredDraftEditor draftId={draftId} />;
}

function StoredDraftEditor({ draftId }: { readonly draftId: string }) {
  const drafts = useDraftRepository();
  // `location.state` is typed `any`: read it as `unknown` and narrow it.
  const navigationState: unknown = useLocation().state;
  const [unsaved, setUnsaved] = useState(false);
  const loaded = useStorageRead(
    useCallback(async () => {
      await awaitDraftWrites(drafts);
      return drafts.load(draftId);
    }, [drafts, draftId]),
  );
  if (loaded === null) return <StorageLoading title="Brouillon" />;
  const draft = loaded.status === 'ok' ? loaded.creation : null;

  if (draft === null) {
    return (
      <AppFrame title="Brouillon" subtitle="Atelier" variant="page">
        <div className="page-content">
          <Panel label="Brouillon" title="Brouillon introuvable">
            <p className="panel-note" role="alert">
              Ce brouillon est introuvable ou ne peut pas être lu sur cet appareil.
            </p>
            <Link className="btn btn-neutral" to="/levels">
              Campagne
            </Link>
          </Panel>
        </div>
      </AppFrame>
    );
  }

  return (
    <Workshop
      initialDocument={draft.document}
      unsaved={unsaved}
      isStored
      beforeLeave={() => awaitDraftWrites(drafts)}
      startPlaying={asksToPlayPuzzle(navigationState)}
      authorSource={draft.source}
      onDocumentCommitted={(document) => {
        // Best effort, like progress (ADR 0011): a failed save never blocks editing.
        // The creation's source (ADR 0015) is kept as loaded.
        void orderDraftWrite(drafts, draftId, () =>
          drafts.save({
            document: { ...document, id: draftId },
            ...(draft.source === undefined ? {} : { source: draft.source }),
          }),
        ).then((result) => {
          setUnsaved(result.status === 'error');
        });
      }}
    />
  );
}
