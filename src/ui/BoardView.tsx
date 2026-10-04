import { useEffect, useRef, type RefObject } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

import {
  currentEditorAttempt,
  type EditorSession,
} from '../application/editor-session/editor-session';
import { highlightedBuildZones } from '../app/build-zone-highlight';
import { placementGhost } from '../app/placement-ghost';
import type { BoardPointerHandlers } from '../app/use-board-pointers';
import {
  createBoardRenderer,
  projectLevel,
  withAuthorRotation,
  type BoardDeviceView,
  type BoardSimulationView,
} from '../presentation/board-renderer';
import type { Camera } from '../presentation/board-camera';
import { createSpriteLoader, type SpriteLoader } from '../presentation/sprite-loader';
import { type SimulationSnapshot } from '../simulation/simulation-session';
import { createCanvasContextAdapter, createCanvasSpriteDecoder } from './board-canvas';

/**
 * Collects what a running simulation moves — the ball, the seesaw's board,
 * a lever's handle, a conveyor's belt, a button's cap, a fan's blades, a
 * barrier's bar, a springboard's spring. The simulated document itself is
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
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onFitToScene: () => void;
  readonly onWheelZoom: (event: WheelEvent) => void;
}

/**
 * The board itself: the canvas and its sprite-pipeline rendering (ADR 0006,
 * ADR 0007), including the placement ghost (C1, U1), and the camera zoom
 * controls.
 * B1 (plan-remise-en-jeu.md § 4) removed the debug "scene objects" pip list
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
  onZoomIn,
  onZoomOut,
  onFitToScene,
  onWheelZoom,
}: BoardViewProps) {
  const boardRef = useRef<HTMLDivElement>(null);
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
  const shownProjection = projectLevel(
    (session.simulationSnapshot ?? currentEditorAttempt(session)).document,
  );
  const projectedLayers = shownProjection.objects;
  const ballColourIds = (assetKey: 'ball-base' | 'second-ball-base'): string =>
    projectedLayers
      .filter((object) => object.assetKey === assetKey)
      .map(({ id }) => id)
      .join(',');

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
          const displayedDocument = (simulationAttempt ?? currentEditorAttempt(currentSession))
            .document;
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
          await renderer.render({ ...projectionWithEffectiveCapabilities, ...constructionView });
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
  }, [session, simulationState, camera]);

  return (
    <>
      {/*
        D4 (plan-remise-en-jeu.md § 6, arbitrated by the product owner): the
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
          {ghost?.isGhostValid === true && (
            <p className="placement-preview-status" role="status">
              Aperçu de placement valide
            </p>
          )}
        </div>
      </div>

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
        <button className="camera-button" type="button" aria-label="Zoom avant" onClick={onZoomIn}>
          <ZoomIn size={20} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
