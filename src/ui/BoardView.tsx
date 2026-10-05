import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Maximize2, MoveHorizontal, ZoomIn, ZoomOut } from 'lucide-react';

import type { BeamSize, BeamSizeChoice } from '../application/construction';
import {
  currentEditorAttempt,
  type EditorSession,
} from '../application/editor-session/editor-session';
import { highlightedBuildZones } from '../app/build-zone-highlight';
import { placementGhost } from '../app/placement-ghost';
import { screenPointToWorld } from '../app/screen-point-to-world';
import type { BoardPointerHandlers } from '../app/use-board-pointers';
import {
  createBoardRenderer,
  beamSizeHandleGeometry,
  projectLevel,
  withAuthorRotation,
  type BoardDeviceView,
  type BoardSimulationView,
} from '../presentation/board-renderer';
import type { Camera } from '../presentation/board-camera';
import {
  projectPendingWire,
  projectWires,
  type ProjectedWireSegment,
} from '../presentation/control-wires';
import { wireRoutes } from '../presentation/wire-hit-test';
import { createSpriteLoader, type SpriteLoader } from '../presentation/sprite-loader';
import { type SimulationSnapshot } from '../simulation/simulation-session';
import type { LevelDocument } from '../domain/level-document';
import { createCanvasContextAdapter, createCanvasSpriteDecoder } from './board-canvas';

const beamLength: Readonly<Record<BeamSize, number>> = { short: 2, medium: 4, long: 6 };

interface BoardPoint {
  readonly x: number;
  readonly y: number;
}

interface WiringAnchor {
  readonly firstId: string;
  readonly timerId?: string;
}

interface BeamSizePreview {
  readonly placementId: string;
  readonly size: BeamSize;
}

const withBeamSize = (document: LevelDocument, preview: BeamSizePreview | null): LevelDocument => {
  if (preview === null) return document;
  return {
    ...document,
    objects: document.objects.map((object) =>
      object.id === preview.placementId && object.type === 'beam'
        ? { ...object, props: { size: preview.size } }
        : object,
    ),
  };
};

const closestAvailableBeamSize = (length: number, choices: readonly BeamSizeChoice[]): BeamSize => {
  const available = choices.filter((choice) => choice.isAvailable);
  const closest = available.reduce<BeamSizeChoice | undefined>((best, choice) => {
    if (best === undefined) return choice;
    return Math.abs(beamLength[choice.size] - length) < Math.abs(beamLength[best.size] - length)
      ? choice
      : best;
  }, undefined);
  return closest?.size ?? 'short';
};

/**
 * Collects what a running simulation moves — the ball, the seesaw's board,
 * a lever's handle, a conveyor's belt, a button's cap, a fan's blades, a
 * barrier's bar, a springboard's spring, a piston's rod and plate. The simulated document itself is
 * never rewritten: static parts keep reading their placement.
 */
const simulationView = (simulation: SimulationSnapshot): BoardSimulationView => ({
  bodyPoses: new Map(
    simulation.bodies
      .filter((body) => body.role !== 'base')
      .map((body) => [body.placementId, { position: body.position, rotation: body.rotation }]),
  ),
  conveyorBelts: new Map(
    simulation.devices.flatMap((device) =>
      device.kind === 'conveyor'
        ? [[device.placementId, { offset: device.beltOffset, facing: device.facing }] as const]
        : [],
    ),
  ),
  devices: new Map(
    simulation.devices.flatMap((device): (readonly [string, BoardDeviceView])[] => {
      switch (device.kind) {
        case 'button':
          return [[device.placementId, { kind: 'button', pressed: device.pressed }]];
        case 'electro-magnet':
          return [[device.placementId, { kind: 'electro-magnet', active: device.active }]];
        case 'fan':
          return [[device.placementId, { kind: 'fan', bladeAngle: device.bladeAngle }]];
        case 'barrier':
          return [[device.placementId, { kind: 'barrier', retraction: device.retraction }]];
        case 'springboard':
          return [[device.placementId, { kind: 'springboard', compression: device.compression }]];
        case 'timer':
          return [
            [
              device.placementId,
              {
                kind: 'timer',
                remainingSeconds: device.remainingSeconds,
                handAngle: device.handAngle,
              },
            ],
          ];
        case 'piston':
          return [];
        case 'lever':
        case 'conveyor':
          return [];
      }
    }),
  ),
});

interface BoardViewProps {
  readonly session: EditorSession;
  readonly simulationState: SimulationSnapshot | null;
  readonly camera: Camera;
  readonly sessionRef: RefObject<EditorSession>;
  readonly simulationStateRef: RefObject<SimulationSnapshot | null>;
  readonly cameraRef: RefObject<Camera>;
  readonly boardCanvasRef: RefObject<HTMLCanvasElement | null>;
  readonly boardPointerHandlers: BoardPointerHandlers;
  readonly beamSizeChoices: readonly BeamSizeChoice[] | null;
  /** The wire being laid: its first object and, once linked, its timer. */
  readonly wiringAnchor: WiringAnchor | null;
  readonly onBeamSizeChange: (size: BeamSize) => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onFitToScene: () => void;
  readonly onWheelZoom: (event: WheelEvent) => void;
  /** False when the framing commands live in the toolbar (wide layout). */
  readonly showCameraControls?: boolean;
  /** The selected wire, drawn highlighted along its route. */
  readonly highlightedWireId?: string | null;
  /**
   * A card of commands floating over the board, anchored at a world point
   * (the selected object or wire): above it, or below when the top is too near.
   */
  readonly floatingBar?: {
    readonly anchor: { readonly x: number; readonly y: number };
    /** World units left clear between the anchor and the bar. */
    readonly clearance: number;
    readonly content: ReactNode;
  } | null;
}

/** Room, in CSS pixels, a floating bar needs above or below its anchor, and beside it. */
const FLOATING_BAR_CLEARANCE = { height: 140, side: 120, edge: 8 } as const;

/**
 * The board itself: the canvas and its sprite-pipeline rendering (ADR 0006,
 * ADR 0007), including the placement ghost (C1, U1), and the camera zoom
 * controls.
 * The player-facing board removed the debug "scene objects" pip list
 * that used to sit under the canvas — a leftover pre-A5 inspection layer, not
 * part of the player-facing UI. Tests that need to read or select a placed
 * object now go through the canvas's own `data-*` attributes; on-canvas
 * selection is C3's job.
 */
export function BoardView({
  session,
  simulationState,
  camera,
  sessionRef,
  simulationStateRef,
  cameraRef,
  boardCanvasRef,
  boardPointerHandlers,
  beamSizeChoices,
  wiringAnchor,
  onBeamSizeChange,
  onZoomIn,
  onZoomOut,
  onFitToScene,
  onWheelZoom,
  showCameraControls = true,
  highlightedWireId = null,
  floatingBar = null,
}: BoardViewProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const beamSizeHandleRef = useRef<HTMLButtonElement>(null);
  const beamSizeDragRef = useRef<{
    readonly pointerId: number;
    readonly placementId: string;
    readonly startX: number;
    readonly startY: number;
    readonly startSize: BeamSize;
    readonly rotation: number;
    readonly pixelsPerWorldUnit: number;
    readonly choices: readonly BeamSizeChoice[];
    previewSize: BeamSize;
  } | null>(null);
  const beamSizePreviewRef = useRef<BeamSizePreview | null>(null);
  const [beamSizePreview, setBeamSizePreview] = useState<BeamSizePreview | null>(null);
  // Where the pointer last was, in world units, while a wire is being laid.
  const [wiringCursor, setWiringCursor] = useState<BoardPoint | null>(null);
  const wiringAnchorRef = useRef(wiringAnchor);
  wiringAnchorRef.current = wiringAnchor;
  const pendingWireRef = useRef<readonly ProjectedWireSegment[] | null>(null);
  const spriteLoaderRef = useRef<SpriteLoader | null>(null);
  const boardRenderRef = useRef<(() => void) | null>(null);
  const boardRenderQueueRef = useRef<Promise<void>>(Promise.resolve());

  const simulationBallId = session.simulationSnapshot?.document.goal.ballId;
  const simulationBall = simulationState?.bodies.find(
    (body) => body.placementId === simulationBallId && body.role === 'primary',
  );

  // The build zones shown to the player (U13), counted for tests and tools.
  const buildZoneCount = highlightedBuildZones(session).length;

  // The placement a gesture projects, or a refused move (U13), drawn as a
  // ghost by the renderer and exposed for tests and tools like the balls below.
  const ghost = session.phase === 'construction' ? placementGhost(session) : null;
  const ghostPlacement =
    ghost === null
      ? undefined
      : currentEditorAttempt(session).document.objects.find(
          ({ id }) => id === ghost.ghostPlacementId,
        );

  // Which balls the board draws red (the goal's) and blue, exposed for tests
  // and tools: the same projection the renderer draws.
  const shownDocument = (session.simulationSnapshot ?? currentEditorAttempt(session)).document;
  const shownProjection = projectLevel(withBeamSize(shownDocument, beamSizePreview));
  const projectedLayers = shownProjection.objects;
  const pendingWire =
    wiringAnchor === null || wiringCursor === null || session.phase !== 'construction'
      ? null
      : projectPendingWire(shownDocument, wiringAnchor, wiringCursor);
  pendingWireRef.current = pendingWire;
  const pendingWireEnds =
    pendingWire === null ? undefined : [pendingWire[0]?.from, pendingWire.at(-1)?.to];
  const selectedPlacementId = session.selectedPlacementId;
  const selectedPlacement =
    selectedPlacementId === null
      ? undefined
      : currentEditorAttempt(session).document.objects.find(({ id }) => id === selectedPlacementId);
  const selectedBeam = selectedPlacement?.type === 'beam' ? selectedPlacement : undefined;
  const selectedBeamProjection =
    selectedBeam === undefined
      ? undefined
      : projectedLayers.find(({ id, family }) => id === selectedBeam.id && family === 'beam');
  const canvasBounds = boardCanvasRef.current?.getBoundingClientRect();
  const frameBounds = boardRef.current?.getBoundingClientRect();
  const beamSizeGeometry =
    selectedBeamProjection !== undefined &&
    canvasBounds !== undefined &&
    canvasBounds.width > 0 &&
    canvasBounds.height > 0 &&
    beamSizeChoices !== null &&
    session.phase === 'construction' &&
    session.manipulation === null
      ? beamSizeHandleGeometry(selectedBeamProjection, {
          cssWidth: canvasBounds.width,
          cssHeight: canvasBounds.height,
          origin: camera.origin,
          pixelsPerWorldUnit: camera.pixelsPerWorldUnit,
          devicePixelRatio: 1,
        })
      : null;
  const frameOffset =
    canvasBounds === undefined || frameBounds === undefined
      ? { x: 0, y: 0 }
      : { x: canvasBounds.left - frameBounds.left, y: canvasBounds.top - frameBounds.top };
  const sizeHandleStyle =
    beamSizeGeometry === null
      ? undefined
      : {
          left: frameOffset.x + beamSizeGeometry.bounds.x + beamSizeGeometry.bounds.width / 2,
          top: frameOffset.y + beamSizeGeometry.bounds.y + beamSizeGeometry.bounds.height / 2,
        };
  const sizeStemStyle =
    beamSizeGeometry === null || selectedBeamProjection === undefined
      ? undefined
      : {
          left: frameOffset.x + beamSizeGeometry.stem.start.x,
          top: frameOffset.y + beamSizeGeometry.stem.start.y,
          width: Math.hypot(
            beamSizeGeometry.stem.end.x - beamSizeGeometry.stem.start.x,
            beamSizeGeometry.stem.end.y - beamSizeGeometry.stem.start.y,
          ),
          transform: `rotate(${String(selectedBeamProjection.rotation)}rad)`,
        };
  // Overlays over the canvas: world units to CSS pixels inside the frame.
  const toFramePixels = (point: { readonly x: number; readonly y: number }) => ({
    x: frameOffset.x + (point.x - camera.origin.x) * camera.pixelsPerWorldUnit,
    y: frameOffset.y + (point.y - camera.origin.y) * camera.pixelsPerWorldUnit,
  });
  const highlightedWire =
    highlightedWireId === null || session.phase !== 'construction'
      ? undefined
      : projectWires(shownDocument).find(({ id }) => id === highlightedWireId);
  const floatingBarPosition =
    floatingBar === null || frameBounds === undefined ? null : toFramePixels(floatingBar.anchor);
  // Above the anchor when there is room, else below it; on a board too low for
  // either, as high as the frame allows, so the bar is never cut by its edge.
  const floatingBarGap =
    floatingBar === null ? 0 : floatingBar.clearance * camera.pixelsPerWorldUnit;
  const isFloatingBarBelow =
    floatingBarPosition !== null &&
    floatingBarPosition.y - floatingBarGap < FLOATING_BAR_CLEARANCE.height;
  const floatingBarTop =
    floatingBarPosition === null || frameBounds === undefined
      ? 0
      : isFloatingBarBelow
        ? Math.max(
            FLOATING_BAR_CLEARANCE.edge,
            Math.min(
              floatingBarPosition.y + floatingBarGap,
              frameBounds.height - FLOATING_BAR_CLEARANCE.height - FLOATING_BAR_CLEARANCE.edge,
            ),
          )
        : floatingBarPosition.y - floatingBarGap;
  const ballColourIds = (assetKey: 'ball-base' | 'second-ball-base'): string =>
    projectedLayers
      .filter((object) => object.assetKey === assetKey)
      .map(({ id }) => id)
      .join(',');

  beamSizePreviewRef.current = beamSizePreview;

  const previewBeamSizeAt = (clientX: number, clientY: number): BeamSize | null => {
    const drag = beamSizeDragRef.current;
    if (drag === null) return null;
    const distanceAlongBeam =
      ((clientX - drag.startX) * Math.cos(drag.rotation) +
        (clientY - drag.startY) * Math.sin(drag.rotation)) /
      drag.pixelsPerWorldUnit;
    return closestAvailableBeamSize(
      beamLength[drag.startSize] + distanceAlongBeam * 2,
      drag.choices,
    );
  };

  const clearBeamSizeDrag = (): void => {
    beamSizeDragRef.current = null;
    beamSizePreviewRef.current = null;
    setBeamSizePreview(null);
  };

  // React's `onWheel` is passive: only a native listener can keep the page from scrolling.
  const onWheelZoomRef = useRef(onWheelZoom);
  onWheelZoomRef.current = onWheelZoom;
  useEffect(() => {
    const board = boardRef.current;
    if (board === null) return undefined;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      onWheelZoomRef.current(event);
    };
    board.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      board.removeEventListener('wheel', onWheel);
    };
  }, []);

  useEffect(() => {
    const canvas = boardCanvasRef.current;
    const decode = createCanvasSpriteDecoder();
    if (canvas === null || decode === null) return;

    const context = canvas.getContext('2d');
    if (context === null) return;

    const spriteLoader = spriteLoaderRef.current ?? createSpriteLoader({ scale: 2, decode });
    spriteLoaderRef.current = spriteLoader;
    let isMounted = true;
    const render = (): void => {
      boardRenderQueueRef.current = boardRenderQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (!isMounted) return;

          const bounds = canvas.getBoundingClientRect();
          if (bounds.width <= 0 || bounds.height <= 0) return;

          const renderer = createBoardRenderer({
            canvas,
            context: createCanvasContextAdapter(context),
            viewport: {
              cssWidth: bounds.width,
              cssHeight: bounds.height,
              origin: cameraRef.current.origin,
              pixelsPerWorldUnit: cameraRef.current.pixelsPerWorldUnit,
              devicePixelRatio: window.devicePixelRatio > 0 ? window.devicePixelRatio : 1,
            },
            spriteLoader,
          });

          const currentSession = sessionRef.current;
          const simulation = simulationStateRef.current;
          const simulationAttempt = currentSession.simulationSnapshot;
          const displayedDocument = withBeamSize(
            (simulationAttempt ?? currentEditorAttempt(currentSession)).document,
            beamSizePreviewRef.current,
          );
          const ghostView =
            currentSession.phase === 'construction' ? placementGhost(currentSession) : null;
          const projection = projectLevel(
            displayedDocument,
            simulationAttempt !== null && simulation !== null
              ? simulationView(simulation)
              : undefined,
            ghostView ?? undefined,
          );
          const selectedPlacementId = currentSession.selectedPlacementId;
          const projectionWithEffectiveCapabilities =
            currentSession.mode === 'creation' && selectedPlacementId !== null
              ? {
                  ...projection,
                  objects: withAuthorRotation(projection.objects),
                }
              : projection;
          const constructionView =
            currentSession.phase === 'construction'
              ? {
                  ...(selectedPlacementId !== null && { selectedPlacementId }),
                  buildZones: highlightedBuildZones(currentSession),
                }
              : {};
          const pending = pendingWireRef.current;
          await renderer.render({
            ...projectionWithEffectiveCapabilities,
            ...constructionView,
            ...(pending !== null && { pendingWire: pending }),
          });
        })
        .catch(() => undefined);
    };

    boardRenderRef.current = render;
    window.addEventListener('resize', render);
    window.addEventListener('orientationchange', render);
    return () => {
      isMounted = false;
      if (boardRenderRef.current === render) boardRenderRef.current = null;
      window.removeEventListener('resize', render);
      window.removeEventListener('orientationchange', render);
    };
    // `sessionRef`, `boardCanvasRef`, `cameraRef` and `simulationStateRef`
    // come from hooks (`useEditorSession`, `useBoardCamera`,
    // `useSimulationRunner`): each is a plain `useRef` internally, so it is
    // referentially stable across renders even though eslint cannot see that
    // through the hook boundary. Listing them here does not make this effect
    // (re)subscribe any more often — it still only runs once per mount.
  }, [sessionRef, boardCanvasRef, cameraRef, simulationStateRef]);

  useEffect(() => {
    boardRenderRef.current?.();
  }, [session, simulationState, camera, beamSizePreview, wiringCursor, wiringAnchor]);

  useEffect(() => {
    // A finished or cancelled wire leaves no stale cursor for the next one.
    if (wiringAnchor === null) setWiringCursor(null);
  }, [wiringAnchor]);

  const trackWiringCursor = (event: { readonly clientX: number; readonly clientY: number }) => {
    if (wiringAnchorRef.current === null) return;
    const bounds = boardCanvasRef.current?.getBoundingClientRect();
    if (bounds === undefined) return;
    const { origin, pixelsPerWorldUnit } = cameraRef.current;
    setWiringCursor(
      screenPointToWorld(
        { x: event.clientX, y: event.clientY },
        bounds,
        pixelsPerWorldUnit,
        origin,
      ),
    );
  };

  return (
    <>
      {/*
        The layout (arbitrated by the product owner): the
        frame fills all the space the surrounding chrome leaves, so no dead
        zone is left around the board; the camera's own `fitCameraToScene`
        "contain" keeps the whole scene visible and centred inside it.
      */}
      <div className="board-scene-row">
        <div
          className="scene-frame"
          ref={boardRef}
          role="region"
          aria-label="Plateau de jeu"
          {...boardPointerHandlers}
          onPointerMove={(event) => {
            trackWiringCursor(event);
            boardPointerHandlers.onPointerMove(event);
          }}
        >
          <canvas
            ref={boardCanvasRef}
            className="board-canvas"
            role="img"
            aria-label="Rendu du plateau"
            data-simulation-step={
              simulationState === null ? undefined : String(simulationState.fixedStep)
            }
            data-simulation-ball-position={
              simulationBall === undefined
                ? undefined
                : `${String(simulationBall.position.x)},${String(simulationBall.position.y)}`
            }
            data-red-balls={ballColourIds('ball-base')}
            data-blue-balls={ballColourIds('second-ball-base')}
            data-wires={currentEditorAttempt(session)
              .document.wires.map(({ sourceId, targetId }) => `${sourceId}>${targetId}`)
              .join(' ')}
            data-pending-wire={
              pendingWireEnds?.[0] === undefined || pendingWireEnds[1] === undefined
                ? undefined
                : `${String(pendingWireEnds[0].x)},${String(pendingWireEnds[0].y)}>${String(
                    pendingWireEnds[1].x,
                  )},${String(pendingWireEnds[1].y)}`
            }
            data-camera-zoom={String(camera.pixelsPerWorldUnit)}
            data-camera-origin={`${String(camera.origin.x)},${String(camera.origin.y)}`}
            data-build-zones={buildZoneCount === 0 ? undefined : String(buildZoneCount)}
            data-placement-ghost={
              ghost === null ? undefined : ghost.isGhostValid ? 'valid' : 'invalid'
            }
            data-placement-ghost-position={
              ghostPlacement === undefined
                ? undefined
                : `${String(ghostPlacement.transform.position.x)},${String(
                    ghostPlacement.transform.position.y,
                  )}`
            }
          />
          {beamSizeGeometry !== null &&
            selectedBeam !== undefined &&
            beamSizeChoices !== null &&
            sizeHandleStyle !== undefined && (
              <>
                {sizeStemStyle !== undefined && (
                  <span
                    className="beam-size-handle-stem"
                    style={sizeStemStyle}
                    aria-hidden="true"
                  />
                )}
                <button
                  ref={beamSizeHandleRef}
                  className="beam-size-handle"
                  type="button"
                  style={sizeHandleStyle}
                  aria-label="Redimensionner la poutre"
                  aria-description="Faire glisser le long de la poutre pour la redimensionner, ou utiliser les flèches du clavier."
                  aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (event.button !== 0 || selectedBeamProjection === undefined) return;
                    event.currentTarget.focus();
                    if (typeof event.currentTarget.setPointerCapture === 'function') {
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }
                    beamSizeDragRef.current = {
                      pointerId: event.pointerId,
                      placementId: selectedBeam.id,
                      startX: event.clientX,
                      startY: event.clientY,
                      startSize: selectedBeam.props.size,
                      rotation: selectedBeamProjection.rotation,
                      pixelsPerWorldUnit: camera.pixelsPerWorldUnit,
                      choices: beamSizeChoices,
                      previewSize: selectedBeam.props.size,
                    };
                  }}
                  onPointerMove={(event) => {
                    event.stopPropagation();
                    const drag = beamSizeDragRef.current;
                    if (drag === null || drag.pointerId !== event.pointerId) return;
                    const size = previewBeamSizeAt(event.clientX, event.clientY);
                    if (size === null || size === drag.previewSize) return;
                    drag.previewSize = size;
                    const preview = { placementId: drag.placementId, size };
                    beamSizePreviewRef.current = preview;
                    setBeamSizePreview(preview);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    const drag = beamSizeDragRef.current;
                    if (drag === null || drag.pointerId !== event.pointerId) return;
                    const size =
                      previewBeamSizeAt(event.clientX, event.clientY) ?? drag.previewSize;
                    clearBeamSizeDrag();
                    if (size !== drag.startSize) onBeamSizeChange(size);
                  }}
                  onPointerCancel={(event) => {
                    event.stopPropagation();
                    if (beamSizeDragRef.current?.pointerId === event.pointerId) clearBeamSizeDrag();
                  }}
                  onKeyDown={(event) => {
                    const direction =
                      event.key === 'ArrowRight' || event.key === 'ArrowDown'
                        ? 1
                        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                          ? -1
                          : 0;
                    if (direction === 0) return;
                    event.preventDefault();
                    const availableSizes = beamSizeChoices
                      .filter((choice) => choice.isAvailable)
                      .map((choice) => choice.size);
                    const currentIndex = availableSizes.indexOf(selectedBeam.props.size);
                    const targetSize = availableSizes[currentIndex + direction];
                    if (targetSize !== undefined) onBeamSizeChange(targetSize);
                  }}
                  onLostPointerCapture={(event) => {
                    if (beamSizeDragRef.current?.pointerId === event.pointerId) clearBeamSizeDrag();
                  }}
                >
                  <MoveHorizontal size={16} aria-hidden="true" />
                </button>
              </>
            )}
          {highlightedWire !== undefined && (
            <svg className="wire-selection" aria-hidden="true">
              {wireRoutes(highlightedWire).map((route) => {
                const points = route
                  .map(toFramePixels)
                  .map(({ x, y }) => `${String(x)},${String(y)}`)
                  .join(' ');
                return <polyline key={points} points={points} />;
              })}
            </svg>
          )}
          {floatingBar !== null && floatingBarPosition !== null && frameBounds !== undefined && (
            // The bar's own presses and clicks are not board gestures.
            <div
              className={isFloatingBarBelow ? 'floating-bar floating-bar-below' : 'floating-bar'}
              role="presentation"
              style={{
                left: Math.min(
                  Math.max(floatingBarPosition.x, FLOATING_BAR_CLEARANCE.side),
                  Math.max(
                    FLOATING_BAR_CLEARANCE.side,
                    frameBounds.width - FLOATING_BAR_CLEARANCE.side,
                  ),
                ),
                top: floatingBarTop,
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onPointerMove={(event) => {
                event.stopPropagation();
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
              }}
            >
              {floatingBar.content}
            </div>
          )}
          {ghost?.isGhostValid === true && (
            <p className="placement-preview-status" role="status">
              Aperçu de placement valide
            </p>
          )}
        </div>
      </div>

      {showCameraControls && (
        <div className="camera-controls" aria-label="Cadrage du plateau">
          <button
            className="camera-button"
            type="button"
            aria-label="Zoom arrière"
            onClick={onZoomOut}
          >
            <ZoomOut size={20} aria-hidden="true" />
          </button>
          <button className="camera-button camera-reset" type="button" onClick={onFitToScene}>
            <Maximize2 size={20} aria-hidden="true" />
            Ajuster à la scène
          </button>
          <button
            className="camera-button"
            type="button"
            aria-label="Zoom avant"
            onClick={onZoomIn}
          >
            <ZoomIn size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
