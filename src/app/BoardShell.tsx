import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleQuestionMark, Eye, Gamepad2, Upload } from 'lucide-react';

import { revealAuthorSolution } from '../application/construction/authoring-commands';
import { createConstructionAttempt } from '../application/construction/construction-attempt';
import {
  createEditorSession,
  currentEditorAttempt,
  selectEditorPlacement,
} from '../application/editor-session/editor-session';
import type { EditorSession } from '../application/editor-session/editor-session';
import { puzzleFromWorkshop } from '../application/puzzle/puzzle-workshop';
import type { LevelDocument } from '../domain/level-document';
import type { AttemptOutcome } from '../domain/attempt-failure-evaluator';
import type { ConstructionAttempt } from '../application/construction';
import { AppFrame } from '../ui/AppFrame';
import { BoardView } from '../ui/BoardView';
import { ContextPanel } from '../ui/ContextPanel';
import { CampaignVictoryDialog, type CampaignVictory } from '../ui/CampaignVictoryDialog';
import { LevelResult } from '../ui/LevelResult';
import { InspectorDrawer } from '../ui/InspectorDrawer';
import { Button } from '../ui/Button';
import { ObjectDrawer } from '../ui/ObjectDrawer';
import { Dialog } from '../ui/Dialog';
import { SimulationControls } from '../ui/SimulationControls';
import { FirstLevelHint } from '../ui/FirstLevelHint';
import { PwaInvitation } from '../ui/PwaInvitation';
import { firstLevelHintStep } from './first-level-hint';
import { usePwaInvitation } from './use-pwa-invitation';
import { usePwaUpdateStatus } from './use-pwa-update-status';
import { useBoardCamera } from './use-board-camera';
import { placementSourceKey, useBoardPointers } from './use-board-pointers';
import { LevelExportDialog } from './LevelExportDialog';
import { puzzleRefusalMessage } from './level-export';
import { useWiringTool, wiringGuide } from './use-wiring-tool';
import { useEditorSession } from './use-editor-session';
import { useIsSideLayout } from './use-side-layout';
import { useVictoryDialog } from './use-victory-dialog';
import { useSimulationRunner } from './use-simulation-runner';

interface BoardShellProps {
  readonly initialAttempt?: ConstructionAttempt | undefined;
  readonly onAttemptCommitted?: ((attempt: ConstructionAttempt) => void) | undefined;
  readonly beforeSimulation?: ((attempt: ConstructionAttempt) => Promise<void>) | undefined;
  readonly beforeRestart?: (() => Promise<boolean>) | undefined;
  readonly initialDocument: LevelDocument;
  readonly mode: EditorSession['mode'];
  readonly title: string;
  readonly subtitle: string;
  /** ADR 0016 § Affichage: author and first source of a received level, in the header. */
  readonly attribution?: string | undefined;
  readonly onSimulationLaunched?: (attempt: ConstructionAttempt) => void;
  readonly onSimulationCompleted?: (outcome: AttemptOutcome) => void;
  /** Called with each newly committed author document (U17 draft autosave). */
  readonly onDocumentCommitted?: (document: LevelDocument) => void;
  /** U4, U4b: tier, object count and next level after a campaign victory, shown in a dialog. */
  readonly campaignVictory?: CampaignVictory | null;
  /** « Remettre à zéro » goes back to it; `initialDocument` when absent. */
  readonly resetDocument?: LevelDocument;
  /** U22, workshop only: plays the puzzle the committed workshop gives. */
  readonly onPlayAsPlayer?: (puzzle: LevelDocument) => void;
  /**
   * U22: replaces « Retour aux niveaux », in the header and the result banner.
   * `shortLabel` is the header's visible text (« Atelier » by default).
   */
  readonly exit?: {
    readonly label: string;
    readonly shortLabel?: string;
    readonly onExit: () => void;
  };
  /** A discreet status over the board until dismissed (M8: a shared level not kept). */
  readonly notice?: string | undefined;
  readonly storageError?: string | undefined;
  readonly saveNotice?: string | undefined;
  readonly beforeLeave?: (() => Promise<void>) | undefined;
  /**
   * ADR 0015 § Révéler: the level a creation comes from. When it carries a
   * solution, the workshop's menu offers to reveal it.
   */
  readonly authorSource?: LevelDocument | undefined;
  /**
   * U8: offers level 1's hint. `onDone` is called once, when the player
   * closes it or first acts on the board, so it never comes back.
   */
  readonly firstLevelHint?: { readonly onDone: () => void } | undefined;
}

const revealLabel = 'Révéler la solution de l’auteur';

/** ADR 0015 § Révéler: how many of the author's wires could not be laid again. */
const ignoredWiresNotice = (count: number): string =>
  count === 1
    ? '1 fil de la solution de l’auteur n’a pas pu être posé.'
    : `${String(count)} fils de la solution de l’auteur n’ont pas pu être posés.`;

/**
 * The shared plateau screen: header, catalogue drawer, board and
 * inspector/result slot. `PlayLevelPage` and `EditorPage` (ADR 0008) mount
 * this with a `key` tied to the route, so a level or workshop change remounts
 * it with a fresh `EditorSession` instead of this component reacting to a
 * changed `initialDocument` prop mid-life.
 */
export function BoardShell({
  initialAttempt,
  onAttemptCommitted,
  beforeSimulation,
  beforeRestart,
  initialDocument,
  mode,
  title,
  subtitle,
  attribution,
  onSimulationLaunched,
  onSimulationCompleted,
  onDocumentCommitted,
  campaignVictory = null,
  resetDocument = initialDocument,
  onPlayAsPlayer,
  exit,
  notice,
  authorSource,
  firstLevelHint,
  storageError,
  saveNotice,
  beforeLeave,
}: BoardShellProps) {
  const navigate = useNavigate();
  const [isNoticeDismissed, setIsNoticeDismissed] = useState(false);
  const [revealNotice, setRevealNotice] = useState<string | null>(null);
  const {
    session,
    sessionRef,
    feedback,
    setFeedback,
    updateSession,
    reportRefusal,
    currentScene,
    undo,
    redo,
    executeCommand,
    selectPlacement,
  } = useEditorSession(
    () => createEditorSession(mode, initialAttempt ?? createConstructionAttempt(initialDocument)),
    (attempt) => {
      onDocumentCommitted?.(attempt.document);
      onAttemptCommitted?.(attempt);
    },
  );
  const boardCamera = useBoardCamera(currentScene);
  const clearSelection = useCallback((): void => {
    updateSession(selectEditorPlacement(sessionRef.current, null));
  }, [updateSession, sessionRef]);
  const wiring = useWiringTool({
    sessionRef,
    executeCommand,
    setFeedback,
    onFirstChosen: selectPlacement,
    // The first object was only marked for the gesture: the next tap opens an object.
    onWireLaid: clearSelection,
  });
  const pointers = useBoardPointers({
    sessionRef,
    updateSession,
    setFeedback,
    reportRefusal,
    currentScene,
    cameraRef: boardCamera.cameraRef,
    updateCamera: boardCamera.updateCamera,
    readCanvasRect: boardCamera.readCanvasRect,
    readCanvasSizeInCss: boardCamera.readCanvasSizeInCss,
    isWiringRef: wiring.isWiringRef,
    onWiringTap: wiring.handleWiringTap,
  });
  const simulation = useSimulationRunner({
    sessionRef,
    updateSession,
    setFeedback,
    pointers,
    ...(onSimulationLaunched === undefined ? {} : { onSimulationLaunched }),
    ...(onSimulationCompleted === undefined ? {} : { onSimulationCompleted }),
  });
  const isSideLayout = useIsSideLayout();

  // U8: « Lancer » first, then the drawer once the machine has run.
  const [hasLaunched, setHasLaunched] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const launchGeneration = useRef(0);
  const launchPending = useRef(false);
  useEffect(
    () => () => {
      launchGeneration.current += 1;
    },
    [],
  );
  const hasActed = session.history.past.length > 0;
  const hintStep =
    firstLevelHint === undefined
      ? null
      : firstLevelHintStep({ phase: session.phase, hasLaunched, hasActed });
  // U10 (ADR 0012): a waiting update is offered only in a safe phase, and
  // only while its reload would lose nothing (no command on this board yet).
  const isUpdateOfferable = usePwaUpdateStatus(session);
  const pwaInvitation = usePwaInvitation({
    isUpdateOfferable,
    hasUnsavedConstruction: hasActed,
    beforeReload: beforeLeave,
  });
  const onHintDoneRef = useRef(firstLevelHint?.onDone);
  useEffect(() => {
    onHintDoneRef.current = firstLevelHint?.onDone;
  });
  useEffect(() => {
    if (hasActed) onHintDoneRef.current?.();
  }, [hasActed]);

  // Escape drops the active placement tool, like « Annuler le placement ».
  const isPlacementActive = pointers.placementTool !== null;
  const cancelPlacementRef = useRef(pointers.cancelPlacement);
  cancelPlacementRef.current = pointers.cancelPlacement;
  useEffect(() => {
    if (!isPlacementActive) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') cancelPlacementRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isPlacementActive]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isObjectiveOpen, setIsObjectiveOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const resetDialogCancelRef = useRef<HTMLButtonElement>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isRevealDialogOpen, setIsRevealDialogOpen] = useState(false);
  const revealDialogCancelRef = useRef<HTMLButtonElement>(null);
  const shownCampaignVictory =
    simulation.attemptOutcome?.outcome === 'won' ? campaignVictory : null;
  const victoryDialog = useVictoryDialog(shownCampaignVictory !== null);

  // B1 (plan-remise-en-jeu.md § 4, `initial-progression.md` § Niveau 1):
  // level 1 declares `inventory: []`, so the catalogue drawer must not
  // appear at all — not collapsed, not empty — for it. Read from the
  // current attempt rather than special-casing the level id, so this stays
  // correct for any future level that also ships without an inventory.
  // The author's catalogue does not depend on the inventory: a creation has
  // none (ADR 0015 § Ouvrir dans l'atelier) and still places from it.
  const hasDrawer =
    mode === 'creation' || currentEditorAttempt(session).document.inventory.length > 0;

  const hasSelection = session.selectedPlacementId !== null && session.phase === 'construction';

  const resetDialogCopy =
    mode === 'creation'
      ? {
          label: 'Remise à zéro de l’atelier',
          title: 'Remettre l’atelier à zéro ?',
          closeLabel: 'Fermer la remise à zéro',
          description:
            'Cette action efface tous les objets ajoutés, leurs positions, leurs réglages et leurs fils. L’atelier reviendra à son document de départ.',
          confirmLabel: 'Remettre l’atelier à zéro',
        }
      : {
          label: 'Recommencer le niveau',
          title: 'Recommencer le niveau depuis le début ?',
          closeLabel: 'Fermer le recommencement du niveau',
          description:
            'Cette action efface tous les objets ajoutés, leurs positions, leurs réglages et leurs fils. Le niveau reviendra à son document de départ.',
          confirmLabel: 'Recommencer le niveau',
        };

  // Only committed history states are reported: gesture previews and the
  // simulation snapshot never reach the draft.

  // While wiring, the selection only marks the chosen source: the compact
  // inspector stays shut so the devices remain reachable (U15).
  useEffect(() => {
    if (hasSelection && !wiring.isWiringRef.current) setIsInspectorOpen(true);
  }, [hasSelection, wiring.isWiringRef]);

  const [isRestarting, setIsRestarting] = useState(false);
  const resetToInitialAttempt = (): void => {
    if (isRestarting) return;
    launchGeneration.current += 1;
    launchPending.current = false;
    setIsLaunching(false);
    const reset = (): void => {
      wiring.cancelWiring();
      simulation.disposeSimulationSession();
      updateSession(
        createEditorSession(mode, createConstructionAttempt(resetDocument)),
        mode === 'creation',
      );
      pointers.clearPlacementTool();
      simulation.clearAttemptOutcome();
      setIsDrawerOpen(false);
      setIsInspectorOpen(false);
      setIsResetDialogOpen(false);
      setFeedback(null);
      boardCamera.fitCameraToCurrentScene();
    };
    if (beforeRestart === undefined) {
      reset();
      return;
    }
    setIsRestarting(true);
    void beforeRestart()
      .then((success) => {
        if (success) reset();
        else setFeedback('Le niveau n’a pas été recommencé : ta construction est conservée.');
      })
      .finally(() => {
        setIsRestarting(false);
      });
  };

  // ADR 0015 § Révéler: an author command, in the menu rather than the action bar.
  const revealSource =
    mode === 'creation' && session.phase === 'construction' && authorSource?.solution !== undefined
      ? authorSource
      : undefined;

  const revealSolution = (): void => {
    setIsRevealDialogOpen(false);
    if (revealSource === undefined) return;
    wiring.cancelWiring();
    pointers.cancelPlacement();
    const command = revealAuthorSolution({ context: 'author', source: revealSource });
    // Counted on the state the command is about to run on (M7).
    const ignoredWireCount = command.ignoredWireCount(sessionRef.current.history.state);
    const result = executeCommand(command);
    setRevealNotice(
      result.status === 'accepted' && ignoredWireCount > 0
        ? ignoredWiresNotice(ignoredWireCount)
        : null,
    );
  };

  const shownNotice = revealNotice ?? (isNoticeDismissed ? undefined : notice);

  const returnToLevels = (): void => {
    void (async () => {
      await beforeLeave?.();
      if (exit !== undefined) {
        exit.onExit();
        return;
      }
      void navigate('/levels');
    })();
  };

  const playAsPlayer = (): void => {
    if (onPlayAsPlayer === undefined) return;
    const conversion = puzzleFromWorkshop(session.history.state.document);
    if (conversion.status === 'refused') {
      setFeedback(puzzleRefusalMessage(conversion.reason));
      return;
    }
    wiring.cancelWiring();
    void (async () => {
      await beforeLeave?.();
      onPlayAsPlayer(conversion.puzzle);
    })();
  };

  return (
    <AppFrame
      title={title}
      subtitle={subtitle}
      attribution={attribution}
      variant="board"
      beforeNavigate={beforeLeave}
      {...(revealSource === undefined
        ? {}
        : {
            menuActions: [
              {
                label: revealLabel,
                icon: <Eye size={18} aria-hidden="true" />,
                onSelect: () => {
                  setIsRevealDialogOpen(true);
                },
              },
            ],
          })}
      headerAction={
        <>
          {exit !== undefined && (
            <button
              className="icon-button objective-button"
              type="button"
              aria-label={exit.label}
              onClick={returnToLevels}
            >
              <span className="objective-button-glyph" aria-hidden="true">
                <ArrowLeft size={18} />
              </span>
              <span className="objective-button-label" aria-hidden="true">
                {exit.shortLabel ?? 'Atelier'}
              </span>
            </button>
          )}
          {onPlayAsPlayer !== undefined && (
            // U22: the author solves the puzzle as the player will. Named apart from « Lancer »,
            // which only runs the machine.
            <button
              className="icon-button objective-button"
              type="button"
              aria-label="Essayer en joueur"
              onClick={playAsPlayer}
            >
              <span className="objective-button-glyph" aria-hidden="true">
                <Gamepad2 size={18} />
              </span>
              <span className="objective-button-label" aria-hidden="true">
                Essayer en joueur
              </span>
            </button>
          )}
          {mode === 'creation' && (
            // U16: exporting is an author command, absent from player screens.
            <button
              className="icon-button objective-button export-button"
              type="button"
              aria-label="Exporter le niveau"
              aria-haspopup="dialog"
              onClick={() => {
                setIsExportOpen(true);
              }}
            >
              <span className="objective-button-glyph" aria-hidden="true">
                <Upload size={18} />
              </span>
              <span className="objective-button-label" aria-hidden="true">
                Exporter
              </span>
            </button>
          )}
          {/* The objective is reachable on demand rather than permanently on
          screen (`mobile-editor-interactions.md` § Organisation de l'écran:
          « un accès à l'objectif »), so the board keeps all remaining space. */}
          <button
            className="icon-button objective-button"
            type="button"
            aria-label="Voir l’objectif"
            aria-haspopup="dialog"
            onClick={() => {
              setIsObjectiveOpen(true);
            }}
          >
            <span className="objective-button-glyph" aria-hidden="true">
              <CircleQuestionMark size={18} />
            </span>
            <span className="objective-button-label" aria-hidden="true">
              Objectif
            </span>
          </button>
        </>
      }
    >
      {hasDrawer && (
        <ObjectDrawer
          session={session}
          selectedObject={pointers.placementTool?.kind}
          selectedEntryKey={
            pointers.placementTool === null
              ? undefined
              : placementSourceKey(pointers.placementTool.source)
          }
          isDrawerOpen={isDrawerOpen}
          isSideLayout={isSideLayout}
          isPlacementActive={pointers.placementTool !== null}
          onToggleDrawer={() => {
            setIsDrawerOpen((current) => !current);
          }}
          onCloseDrawer={() => {
            setIsDrawerOpen(false);
          }}
          onSelectKind={(kind, source) => {
            wiring.cancelWiring();
            // Touching the active card again puts the tool down.
            const activeTool = pointers.placementTool;
            if (
              activeTool !== null &&
              activeTool.kind === kind &&
              placementSourceKey(activeTool.source) === placementSourceKey(source)
            ) {
              pointers.cancelPlacement();
            } else {
              pointers.activatePlacement(kind, source);
            }
            setIsDrawerOpen(false);
          }}
          isWiringActive={wiring.wiringStep !== null}
          onSelectWire={(inventoryEntryId) => {
            // U15: the wire card is a tool like a placement card. It drops
            // the selection so the compact inspector leaves the board clear.
            if (pointers.placementTool !== null) pointers.cancelPlacement();
            updateSession(selectEditorPlacement(sessionRef.current, null));
            wiring.startWiring(inventoryEntryId);
            setIsDrawerOpen(false);
          }}
        />
      )}
      <section
        className={`workspace${hasDrawer ? '' : ' workspace-no-drawer'}`}
        aria-label="Espace de construction"
      >
        <SimulationControls
          isLaunching={isLaunching}
          isCreation={mode === 'creation'}
          session={session}
          feedback={feedback}
          notice={
            shownNotice === undefined
              ? undefined
              : {
                  message: shownNotice,
                  onDismiss: () => {
                    if (revealNotice === null) setIsNoticeDismissed(true);
                    else setRevealNotice(null);
                  },
                }
          }
          activePlacementKind={pointers.placementTool?.kind ?? null}
          wiringGuide={wiring.wiringStep === null ? null : wiringGuide(wiring.wiringStep)}
          onExitWiring={wiring.cancelWiring}
          onUndo={undo}
          onRedo={redo}
          onCancelPlacement={pointers.cancelPlacement}
          onLaunchSimulation={() => {
            if (launchPending.current) return;
            wiring.cancelWiring();
            const launch = () => {
              setHasLaunched(true);
              simulation.launchSimulation();
            };
            if (beforeSimulation === undefined && beforeLeave === undefined) {
              launch();
              return;
            }
            const generation = ++launchGeneration.current;
            launchPending.current = true;
            setIsLaunching(true);
            setFeedback('Chargement de la simulation…');
            void (async () => {
              if (beforeSimulation !== undefined)
                await beforeSimulation(sessionRef.current.history.state);
              else await beforeLeave?.();
              if (launchGeneration.current !== generation) return;
              launchPending.current = false;
              setIsLaunching(false);
              launch();
            })();
          }}
          onPause={simulation.pauseCurrentSimulation}
          onResume={simulation.resumeCurrentSimulation}
          onRestoreConstruction={simulation.restoreConstruction}
          onResetDocument={() => {
            setIsResetDialogOpen(true);
          }}
        />
        <BoardView
          session={session}
          simulationState={simulation.simulationState}
          camera={boardCamera.camera}
          sessionRef={sessionRef}
          simulationStateRef={simulation.simulationStateRef}
          cameraRef={boardCamera.cameraRef}
          boardCanvasRef={boardCamera.boardCanvasRef}
          boardPointerHandlers={pointers.boardPointerHandlers}
          onZoomIn={boardCamera.zoomIn}
          onZoomOut={boardCamera.zoomOut}
          onFitToScene={boardCamera.fitCameraToCurrentScene}
          onWheelZoom={boardCamera.zoomWithWheel}
        />
        <div className="status-slot">
          {storageError !== undefined && <p role="alert">{storageError}</p>}
          {saveNotice !== undefined && <p role="status">{saveNotice}</p>}
          {pwaInvitation !== null && (
            <PwaInvitation
              kind={pwaInvitation.kind}
              onAccept={pwaInvitation.onAccept}
              onDismiss={pwaInvitation.onDismiss}
            />
          )}
          {hintStep !== null && firstLevelHint !== undefined && (
            <FirstLevelHint step={hintStep} onDismiss={firstLevelHint.onDone} />
          )}
          <InspectorDrawer
            isWideLayout={isSideLayout}
            isPropertiesOpen={isInspectorOpen}
            onOpenProperties={() => {
              setIsInspectorOpen(true);
            }}
            onCloseProperties={() => {
              setIsInspectorOpen(false);
            }}
            properties={
              hasSelection ? (
                <ContextPanel
                  session={session}
                  onExecuteCommand={executeCommand}
                  {...(!isSideLayout
                    ? {
                        onClose: () => {
                          setIsInspectorOpen(false);
                        },
                      }
                    : {})}
                />
              ) : null
            }
            result={
              <LevelResult
                outcome={simulation.attemptOutcome}
                isCreation={mode === 'creation'}
                onReplay={resetToInitialAttempt}
                onReset={simulation.restoreConstruction}
                onReturnToLevels={returnToLevels}
                {...(exit === undefined ? {} : { returnLabel: exit.label })}
                {...(shownCampaignVictory === null
                  ? {}
                  : {
                      campaign: {
                        tier: shownCampaignVictory.tier,
                        areActionsAvailable: victoryDialog.areActionsAvailable,
                        onOpenResult: victoryDialog.open,
                      },
                    })}
              />
            }
          />
        </div>
      </section>
      {isObjectiveOpen && (
        <Dialog
          label="Objectif du niveau"
          title="Objectif"
          closeLabel="Fermer l’objectif"
          onClose={() => {
            setIsObjectiveOpen(false);
          }}
        >
          <p className="dialog-text">Faire entrer la balle dans le panier</p>
          {/* The objective remains explicit when other balls also appear on the board. */}
          {currentEditorAttempt(session).document.objects.filter(({ type }) => type === 'ball')
            .length > 1 && <p className="dialog-text">Seule la balle rouge compte.</p>}
        </Dialog>
      )}
      {isResetDialogOpen && (
        <Dialog
          label={resetDialogCopy.label}
          title={resetDialogCopy.title}
          closeLabel={resetDialogCopy.closeLabel}
          initialFocusRef={resetDialogCancelRef}
          onClose={() => {
            setIsResetDialogOpen(false);
          }}
        >
          <p className="dialog-text">{resetDialogCopy.description}</p>
          <div className="level-result-actions">
            <Button
              ref={resetDialogCancelRef}
              onClick={() => {
                setIsResetDialogOpen(false);
              }}
            >
              Annuler
            </Button>
            <Button tone="reset" disabled={isRestarting} onClick={resetToInitialAttempt}>
              {resetDialogCopy.confirmLabel}
            </Button>
          </div>
        </Dialog>
      )}
      {isRevealDialogOpen && revealSource !== undefined && (
        <Dialog
          title={revealLabel}
          closeLabel="Fermer la révélation"
          initialFocusRef={revealDialogCancelRef}
          onClose={() => {
            setIsRevealDialogOpen(false);
          }}
        >
          <p className="dialog-text">
            La solution de l’auteur sera posée sur le plateau, en objets à placer, à côté de ce qui
            s’y trouve déjà. «&nbsp;Annuler&nbsp;» dans l’atelier la retire.
          </p>
          <div className="level-result-actions">
            <Button
              ref={revealDialogCancelRef}
              onClick={() => {
                setIsRevealDialogOpen(false);
              }}
            >
              Annuler
            </Button>
            <Button tone="go" onClick={revealSolution}>
              Révéler la solution
            </Button>
          </div>
        </Dialog>
      )}
      {victoryDialog.isOpen && shownCampaignVictory !== null && (
        <CampaignVictoryDialog
          campaign={shownCampaignVictory}
          onReplay={resetToInitialAttempt}
          onClose={victoryDialog.close}
        />
      )}
      {isExportOpen && (
        <LevelExportDialog
          // The committed history state is the author's document: a running
          // simulation works on its own snapshot and a gesture on a preview.
          document={session.history.state.document}
          onClose={() => {
            setIsExportOpen(false);
          }}
          // M14: the exported title and pseudonym go through the workshop's history.
          onApplyAttribution={(commands) => {
            for (const command of commands) executeCommand(command);
          }}
        />
      )}
    </AppFrame>
  );
}
