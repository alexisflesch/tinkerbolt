import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';

import { addAuthoredPlacement } from '../application/construction/authoring-commands';
import {
  movePlacement,
  placeFromInventory,
  rotatePlacement,
  type ConstructionAttempt,
  type ConstructionContext,
} from '../application/construction/construction-attempt';
import {
  beginEditorManipulation,
  cancelEditorManipulation,
  commitEditorManipulation,
  currentEditorAttempt,
  previewEditorManipulation,
  previewInvalidEditorManipulation,
  selectEditorPlacement,
  type EditorSession,
} from '../application/editor-session/editor-session';
import type { Command } from '../application/history';
import { isWirable, rotationMode, type LevelDocument } from '../domain/level-document';
import { hitTestBoard, hitTestRotationHandle } from '../presentation/board-hit-test';
import {
  projectLevel,
  withAuthorRotation,
  worldToPixels,
  type BoardViewport,
} from '../presentation/board-renderer';
import type { AuthorCatalogueEntry, ObjectKind } from './object-catalog';
import { panCamera, zoomCameraAt, type Camera } from '../presentation/board-camera';
import type { CanvasSizeInCss } from './use-board-camera';
import { screenPointToWorld, type BoardOffset, type ScreenPoint } from './screen-point-to-world';

/**
 * Where a placed object comes from: the player's inventory, or the author's
 * catalogue, which places any family without inventory (U20).
 */
export type PlacementSource =
  | { readonly from: 'inventory'; readonly inventoryEntryId: string }
  | { readonly from: 'catalogue'; readonly entry: AuthorCatalogueEntry };

interface PlacementTool {
  readonly kind: ObjectKind;
  readonly source: PlacementSource;
  readonly placementId: string;
}

/** The drawer card a placement tool came from: its inventory entry or its catalogue entry. */
export const placementSourceKey = (source: PlacementSource): string =>
  source.from === 'inventory' ? source.inventoryEntryId : source.entry.key;

const placementCommand = (
  source: PlacementSource,
  placementId: string,
  transform: LevelDocument['objects'][number]['transform'],
) =>
  source.from === 'inventory'
    ? (context: ConstructionContext): Command<ConstructionAttempt> =>
        placeFromInventory({
          context,
          inventoryEntryId: source.inventoryEntryId,
          placementId,
          transform,
        })
    : (context: ConstructionContext): Command<ConstructionAttempt> =>
        addAuthoredPlacement({
          context,
          placementId,
          type: source.entry.type,
          props: source.entry.props,
          transform,
        });

/**
 * Ids already taken in the document: a reopened draft may hold `placement-1`
 * already. A reference solution names its poses by id (`placementId`, for its
 * wires): a placement taking one would stand in for that pose and invalidate
 * the document.
 */
const isIdentifierUsed = (document: LevelDocument, id: string): boolean =>
  document.objects.some((placement) => placement.id === id) ||
  document.inventory.some((entry) => entry.id === id) ||
  (document.solution?.placements ?? []).some((pose) => pose.placementId === id);

const unavailablePositionMessage = 'Placement refusé : la position tactile est indisponible.';
const unavailableViewportMessage = 'Placement refusé : le cadrage du plateau est indisponible.';

/** Guards pinch-zoom against a division by (near) zero when two fingers nearly touch. */
const MIN_PINCH_DISTANCE_IN_CSS_PIXELS = 1;
const DIRECT_DRAG_THRESHOLD_CSS_PIXELS = 8;
/** The handle snaps every family to fifteen degrees, like the panel's rotation buttons. */
const ROTATION_SNAP = Math.PI / 12;

const isRotatableFamily = (type: LevelDocument['objects'][number]['type']): boolean =>
  rotationMode(type) !== 'fixed';

const hasFiniteCoordinates = (point: ScreenPoint): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y);

const hasUsableZoom = (zoom: number): boolean => Number.isFinite(zoom) && zoom > 0;

interface PointerPreview {
  readonly session: EditorSession;
  /** Refusal to report when the gesture ends; `null` when the projection can be committed. */
  readonly refusal: string | null;
}

/**
 * Previews a gesture so the object keeps following the pointer: outside every
 * build zone the projection is still shown, flagged invalid, instead of
 * freezing at its last valid position. Other refusals keep that position.
 */
const previewFollowingPointer = (
  session: EditorSession,
  command: (context: ConstructionContext) => Command<ConstructionAttempt>,
): PointerPreview => {
  const context = session.mode === 'resolution' ? 'player' : 'author';
  const result = previewEditorManipulation(session, command(context));
  if (result.status === 'accepted') return { session: result.session, refusal: null };
  if (result.reason === 'outside-build-zone') {
    // The author context applies every rule except the build zones.
    const invalid = previewInvalidEditorManipulation(session, command('author'), result.reason);
    if (invalid.status === 'accepted') return { session: invalid.session, refusal: result.reason };
  }
  return { session: result.session, refusal: result.reason };
};

const pointerIdFromEvent = (pointerId: unknown): number | null =>
  typeof pointerId === 'number' && Number.isFinite(pointerId) ? pointerId : null;

const isActivePointer = (
  activePointer: { readonly id: number | null } | null,
  pointerId: number | null,
): boolean =>
  activePointer !== null && (activePointer.id === null || activePointer.id === pointerId);

type DivPointerHandler = (event: PointerEvent<HTMLDivElement>) => void;
type DivClickHandler = (event: MouseEvent<HTMLDivElement>) => void;

export interface BoardPointerHandlers {
  readonly onClick: DivClickHandler;
  readonly onPointerDown: DivPointerHandler;
  readonly onPointerUp: DivPointerHandler;
  readonly onPointerMove: DivPointerHandler;
  readonly onPointerCancel: DivPointerHandler;
  readonly onLostPointerCapture: DivPointerHandler;
}

interface UseBoardPointersOptions {
  readonly sessionRef: RefObject<EditorSession>;
  readonly updateSession: (next: EditorSession) => void;
  readonly setFeedback: (message: string | null) => void;
  readonly reportRefusal: (reason: string) => void;
  readonly currentScene: () => LevelDocument['scene'];
  readonly cameraRef: RefObject<Camera>;
  readonly updateCamera: (next: Camera) => void;
  readonly readCanvasRect: () => DOMRect | null;
  readonly readCanvasSizeInCss: () => CanvasSizeInCss | null;
  /**
   * While the "Fil" card is active (U15), touching a placement names a wire's
   * source or target instead of selecting it; the empty board still pans.
   */
  readonly isWiringRef: RefObject<boolean>;
  readonly onWiringTap: (placementId: string) => void;
  readonly onRequestOpenProperties: () => void;
}

interface BoardPointersController {
  readonly placementTool: PlacementTool | null;
  readonly activatePlacement: (kind: ObjectKind, source: PlacementSource) => void;
  /** The toolbar's "Annuler le placement" button: cancels the projection and clears the active tool. */
  readonly cancelPlacement: () => void;
  readonly boardPointerHandlers: BoardPointerHandlers;
  /** Clears the active placement tool. Exposed for `use-simulation-runner.ts`, which resets it when a simulation launches. */
  readonly clearPlacementTool: () => void;
  /** Clears every pointer/gesture tracking ref. Exposed for `use-simulation-runner.ts`'s launch/reset transitions. */
  readonly resetGestureState: () => void;
}

/**
 * Owns every board pointer gesture: placement (drag-to-preview, tap to
 * commit), selecting and moving/rotating a placement from the context panel,
 * and panning/pinch-zooming the camera from an empty area of the board
 * (mobile-editor-interactions.md § Navigation, § Zoom). Pan/pinch necessarily
 * also touch camera state (`cameraRef`/`updateCamera`, from
 * `use-board-camera.ts`): plan-remise-en-jeu.md § A5 leaves this exact
 * boundary to judgment rather than prescribing it.
 */
export function useBoardPointers({
  sessionRef,
  updateSession,
  setFeedback,
  reportRefusal,
  currentScene,
  cameraRef,
  updateCamera,
  readCanvasRect,
  readCanvasSizeInCss,
  isWiringRef,
  onWiringTap,
  onRequestOpenProperties,
}: UseBoardPointersOptions): BoardPointersController {
  const [placementTool, setPlacementTool] = useState<PlacementTool | null>(null);
  const nextPlacementNumber = useRef(1);
  const placementToolRef = useRef<PlacementTool | null>(placementTool);
  const hasValidPlacementPreview = useRef(false);
  const activePointer = useRef<{ readonly id: number | null } | null>(null);
  const suppressNextBoardClick = useRef(false);
  const capturedPointerId = useRef<number | null>(null);
  const activeMovePointer = useRef<{
    readonly id: number | null;
    readonly placementId: string;
    readonly startPoint: ScreenPoint;
    readonly kind: 'move' | 'rotation';
    readonly startRotation: number;
    /** Rotation step the handle snaps to, in radians. */
    readonly snap: number;
    readonly center: ScreenPoint;
    hasDragged: boolean;
    /** Refusal of the last preview, reported once when the finger lifts. */
    refusal: string | null;
  } | null>(null);
  const placementRefusal = useRef<string | null>(null);
  /** Pointers currently down on the empty board, tracked for pan/pinch (mobile-editor-interactions.md § Navigation). */
  const boardGesturePointers = useRef<Map<number, ScreenPoint>>(new Map());
  const panPointerId = useRef<number | null>(null);
  const panLastPoint = useRef<ScreenPoint | null>(null);
  const pinchStart = useRef<{
    readonly camera: Camera;
    readonly midpoint: ScreenPoint;
    readonly distance: number;
  } | null>(null);

  const updatePlacementTool = (nextTool: PlacementTool | null): void => {
    placementToolRef.current = nextTool;
    setPlacementTool(nextTool);
  };

  const clearPlacementTool = (): void => {
    updatePlacementTool(null);
  };

  const distanceBetweenPoints = (a: ScreenPoint, b: ScreenPoint): number =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const midpointBetweenPoints = (a: ScreenPoint, b: ScreenPoint): ScreenPoint => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const resetBoardGesture = (): void => {
    boardGesturePointers.current.clear();
    panPointerId.current = null;
    panLastPoint.current = null;
    pinchStart.current = null;
  };

  const resetGestureState = (): void => {
    hasValidPlacementPreview.current = false;
    activePointer.current = null;
    capturedPointerId.current = null;
    resetBoardGesture();
  };

  /**
   * mobile-editor-interactions.md § Zoom: a second finger touching the board
   * cancels any in-progress object manipulation without creating a history
   * command, and the two fingers then drive the camera.
   */
  const cancelActiveObjectManipulationForGesture = (): void => {
    if (activeMovePointer.current === null) return;
    activeMovePointer.current = null;
    const cancelled = cancelEditorManipulation(sessionRef.current);
    if (cancelled.status === 'accepted') updateSession(cancelled.session);
  };

  const beginPinch = (): void => {
    const points = [...boardGesturePointers.current.values()];
    const [first, second] = points;
    if (first === undefined || second === undefined) return;

    panPointerId.current = null;
    panLastPoint.current = null;
    pinchStart.current = {
      camera: cameraRef.current,
      midpoint: midpointBetweenPoints(first, second),
      distance: Math.max(distanceBetweenPoints(first, second), MIN_PINCH_DISTANCE_IN_CSS_PIXELS),
    };
  };

  const handleBoardGesturePointerDown = (
    pointerId: number | null,
    point: ScreenPoint,
    target: HTMLDivElement,
  ): void => {
    if (pointerId === null || !hasFiniteCoordinates(point)) return;

    // A pointer arriving anywhere on the board while an object move is in
    // progress (started from the context panel's move handle) counts as the
    // "second finger" the manipulation-cancel rule describes.
    cancelActiveObjectManipulationForGesture();

    boardGesturePointers.current.set(pointerId, point);

    if (boardGesturePointers.current.size === 1) {
      panPointerId.current = pointerId;
      panLastPoint.current = point;
      if (typeof target.setPointerCapture === 'function') {
        try {
          target.setPointerCapture(pointerId);
        } catch {
          // Capture is a progressive enhancement; the gesture still works without it.
        }
      }
      return;
    }

    if (boardGesturePointers.current.size === 2) {
      beginPinch();
    }
  };

  const handleBoardGesturePointerMove = (pointerId: number | null, point: ScreenPoint): void => {
    if (pointerId === null || !boardGesturePointers.current.has(pointerId)) return;
    if (!hasFiniteCoordinates(point)) return;

    boardGesturePointers.current.set(pointerId, point);
    const canvasSize = readCanvasSizeInCss();
    if (canvasSize === null) return;

    if (boardGesturePointers.current.size === 1 && panPointerId.current === pointerId) {
      const last = panLastPoint.current;
      if (last === null) return;
      const delta = { x: point.x - last.x, y: point.y - last.y };
      panLastPoint.current = point;
      updateCamera(panCamera(cameraRef.current, delta, currentScene(), canvasSize));
      return;
    }

    if (boardGesturePointers.current.size === 2 && pinchStart.current !== null) {
      const points = [...boardGesturePointers.current.values()];
      const [first, second] = points;
      if (first === undefined || second === undefined) return;
      const canvasRect = readCanvasRect();
      if (canvasRect === null) return;

      const currentMidpoint = midpointBetweenPoints(first, second);
      const currentDistance = Math.max(
        distanceBetweenPoints(first, second),
        MIN_PINCH_DISTANCE_IN_CSS_PIXELS,
      );
      const factor = currentDistance / pinchStart.current.distance;
      const anchor = {
        x: pinchStart.current.midpoint.x - canvasRect.left,
        y: pinchStart.current.midpoint.y - canvasRect.top,
      };
      const scene = currentScene();
      const zoomed = zoomCameraAt(pinchStart.current.camera, factor, anchor, scene, canvasSize);
      const panDelta = {
        x: currentMidpoint.x - pinchStart.current.midpoint.x,
        y: currentMidpoint.y - pinchStart.current.midpoint.y,
      };
      updateCamera(panCamera(zoomed, panDelta, scene, canvasSize));
    }
  };

  const handleBoardGesturePointerEnd = (pointerId: number | null): void => {
    if (pointerId === null) return;

    boardGesturePointers.current.delete(pointerId);
    if (panPointerId.current === pointerId) {
      panPointerId.current = null;
      panLastPoint.current = null;
    }
    if (boardGesturePointers.current.size < 2) {
      pinchStart.current = null;
    }
    if (
      boardGesturePointers.current.size === 1 &&
      panPointerId.current === null &&
      pinchStart.current === null
    ) {
      const [remaining] = [...boardGesturePointers.current.entries()];
      if (remaining === undefined) return;
      const [remainingId, remainingPoint] = remaining;
      panPointerId.current = remainingId;
      panLastPoint.current = remainingPoint;
    }
  };

  const releaseGesturePointerCapture = (element: HTMLDivElement, pointerId: number): void => {
    if (typeof element.releasePointerCapture !== 'function') return;
    try {
      element.releasePointerCapture(pointerId);
    } catch {
      // A browser can release capture before dispatching pointercancel.
    }
  };

  const cancelPlacementProjection = (): void => {
    const result = cancelEditorManipulation(sessionRef.current);
    if (result.status === 'accepted') {
      updateSession(result.session);
    }
    hasValidPlacementPreview.current = false;
    activePointer.current = null;
  };

  const cancelPlacement = (): void => {
    cancelPlacementProjection();
    clearPlacementTool();
    setFeedback(null);
  };

  const releasePointerCapture = (element: HTMLDivElement, pointerId: number): void => {
    if (capturedPointerId.current !== pointerId) return;

    capturedPointerId.current = null;
    if (typeof element.releasePointerCapture !== 'function') return;
    try {
      element.releasePointerCapture(pointerId);
    } catch {
      // A browser can release capture before dispatching pointercancel.
    }
  };

  const activatePlacement = (kind: ObjectKind, source: PlacementSource): void => {
    const { document } = currentEditorAttempt(sessionRef.current);
    let placementId = `placement-${String(nextPlacementNumber.current)}`;
    nextPlacementNumber.current += 1;
    while (isIdentifierUsed(document, placementId)) {
      placementId = `placement-${String(nextPlacementNumber.current)}`;
      nextPlacementNumber.current += 1;
    }
    const result = beginEditorManipulation(sessionRef.current, { kind: 'placement', placementId });
    if (result.status === 'rejected') {
      reportRefusal(result.reason);
      return;
    }

    updateSession(result.session);
    updatePlacementTool({ kind, placementId, source });
    hasValidPlacementPreview.current = false;
    activePointer.current = null;
    capturedPointerId.current = null;
    resetBoardGesture();
    setFeedback(null);
  };

  const placeAt = (point: ScreenPoint, boardRect: BoardOffset): void => {
    const activeTool = placementToolRef.current;
    if (activeTool === null) return;

    if (!hasFiniteCoordinates(point)) {
      hasValidPlacementPreview.current = false;
      setFeedback(unavailablePositionMessage);
      return;
    }
    if (!hasUsableZoom(cameraRef.current.pixelsPerWorldUnit)) {
      hasValidPlacementPreview.current = false;
      setFeedback(unavailableViewportMessage);
      return;
    }

    let currentSession = sessionRef.current;
    if (currentSession.manipulation === null) {
      const resumed = beginEditorManipulation(currentSession, {
        kind: 'placement',
        placementId: activeTool.placementId,
      });
      if (resumed.status === 'rejected') {
        hasValidPlacementPreview.current = false;
        reportRefusal(resumed.reason);
        return;
      }
      currentSession = resumed.session;
      updateSession(currentSession);
    }

    const worldPosition = screenPointToWorld(
      point,
      boardRect,
      cameraRef.current.pixelsPerWorldUnit,
      cameraRef.current.origin,
    );

    const result = previewFollowingPointer(
      currentSession,
      placementCommand(activeTool.source, activeTool.placementId, {
        position: worldPosition,
        rotation: 0,
      }),
    );
    updateSession(result.session);
    hasValidPlacementPreview.current = result.refusal === null;
    placementRefusal.current = result.refusal;
  };

  const updatePlacementIndicator = (point: ScreenPoint, boardRect: BoardOffset): void => {
    const activeTool = placementToolRef.current;
    if (activeTool === null) return;

    placeAt(point, boardRect);
  };

  const commitPlacement = (): void => {
    if (placementToolRef.current === null) return;
    if (!hasValidPlacementPreview.current) {
      // Lifting the finger on a refused position drops the projection; the
      // tool stays active for another try.
      const refusal = placementRefusal.current;
      placementRefusal.current = null;
      const cancelled = cancelEditorManipulation(sessionRef.current);
      if (cancelled.status === 'accepted') updateSession(cancelled.session);
      if (refusal !== null) reportRefusal(refusal);
      return;
    }

    const result = commitEditorManipulation(sessionRef.current);
    updateSession(result.session);
    if (result.status === 'accepted') {
      updatePlacementTool(null);
      hasValidPlacementPreview.current = false;
      setFeedback(null);
    } else {
      reportRefusal(result.reason);
    }
  };

  const previewDirectMove = (point: ScreenPoint): void => {
    const activeMove = activeMovePointer.current;
    const boardRect = readCanvasRect();
    if (activeMove === null || boardRect === null || !hasFiniteCoordinates(point)) return;
    if (!activeMove.hasDragged) {
      if (distanceBetweenPoints(activeMove.startPoint, point) < DIRECT_DRAG_THRESHOLD_CSS_PIXELS)
        return;
      suppressNextBoardClick.current = true;
      const started = beginEditorManipulation(sessionRef.current, {
        kind: 'move',
        placementId: activeMove.placementId,
      });
      if (started.status === 'rejected') {
        activeMovePointer.current = null;
        reportRefusal(started.reason);
        return;
      }
      updateSession(started.session);
      activeMove.hasDragged = true;
    }
    const result = previewFollowingPointer(sessionRef.current, (context) =>
      activeMove.kind === 'move'
        ? movePlacement({
            context,
            placementId: activeMove.placementId,
            position: screenPointToWorld(
              point,
              boardRect,
              cameraRef.current.pixelsPerWorldUnit,
              cameraRef.current.origin,
            ),
          })
        : rotatePlacement({
            context,
            placementId: activeMove.placementId,
            rotation:
              activeMove.startRotation +
              Math.round(
                (Math.atan2(point.y - activeMove.center.y, point.x - activeMove.center.x) -
                  Math.atan2(
                    activeMove.startPoint.y - activeMove.center.y,
                    activeMove.startPoint.x - activeMove.center.x,
                  )) /
                  activeMove.snap,
              ) *
                activeMove.snap,
          }),
    );
    updateSession(result.session);
    activeMove.refusal = result.refusal;
  };

  const commitDirectMove = (pointerId: number | null): void => {
    const activeMove = activeMovePointer.current;
    if (activeMove === null || (activeMove.id !== null && activeMove.id !== pointerId)) return;
    activeMovePointer.current = null;
    if (!activeMove.hasDragged) return;
    if (activeMove.refusal !== null) {
      const cancelled = cancelEditorManipulation(sessionRef.current);
      if (cancelled.status === 'accepted') updateSession(cancelled.session);
      reportRefusal(activeMove.refusal);
      return;
    }
    const result = commitEditorManipulation(sessionRef.current);
    updateSession(result.session);
    // One refusal per gesture (U13): an accepted gesture clears an earlier one.
    if (result.status === 'rejected') reportRefusal(result.reason);
    else setFeedback(null);
  };

  const cancelDirectMove = (): void => {
    const activeMove = activeMovePointer.current;
    activeMovePointer.current = null;
    if (activeMove === null || !activeMove.hasDragged) return;
    const cancelled = cancelEditorManipulation(sessionRef.current);
    if (cancelled.status === 'accepted') updateSession(cancelled.session);
  };

  useEffect(() => {
    // mobile-editor-interactions.md § Portrait, paysage et changements de
    // viewport : une manipulation tactile en cours est annulée avant le
    // recalcul du layout, quel que soit son type (placement, déplacement ou
    // panoramique/pincement de caméra).
    const cancelForLayoutChange = (): void => {
      resetBoardGesture();

      const hadActiveMove = activeMovePointer.current !== null;
      activeMovePointer.current = null;

      if (placementToolRef.current === null) {
        if (hadActiveMove) {
          const result = cancelEditorManipulation(sessionRef.current);
          if (result.status === 'accepted') updateSession(result.session);
        }
        return;
      }

      const result = cancelEditorManipulation(sessionRef.current);
      if (result.status === 'accepted') {
        updateSession(result.session);
      }
      hasValidPlacementPreview.current = false;
      activePointer.current = null;
      capturedPointerId.current = null;
      setFeedback('Placement annulé : le cadrage du plateau a changé.');
    };

    window.addEventListener('resize', cancelForLayoutChange);
    window.addEventListener('orientationchange', cancelForLayoutChange);
    return () => {
      window.removeEventListener('resize', cancelForLayoutChange);
      window.removeEventListener('orientationchange', cancelForLayoutChange);
    };
    // `sessionRef`/`setFeedback`/`updateSession` are stable across renders
    // (see `use-editor-session.ts`'s `useCallback` wrapping), so listing them
    // here does not make this effect resubscribe on every render.
  }, [sessionRef, setFeedback, updateSession]);

  const boardPointerHandlers: BoardPointerHandlers = {
    onClick: (event) => {
      if (event.detail === 0) return;
      if (suppressNextBoardClick.current) {
        suppressNextBoardClick.current = false;
        return;
      }

      const session = sessionRef.current;
      if (
        placementToolRef.current !== null ||
        isWiringRef.current ||
        session.phase !== 'construction'
      ) {
        return;
      }

      const boardRect = readCanvasRect();
      if (boardRect === null) return;
      const viewport: BoardViewport = {
        cssWidth: boardRect.width,
        cssHeight: boardRect.height,
        origin: cameraRef.current.origin,
        pixelsPerWorldUnit: cameraRef.current.pixelsPerWorldUnit,
        devicePixelRatio: 1,
      };
      const projection = projectLevel(currentEditorAttempt(session).document);
      const objects =
        session.mode === 'creation' ? withAuthorRotation(projection.objects) : projection.objects;
      const target = hitTestBoard(
        { x: event.clientX - boardRect.left, y: event.clientY - boardRect.top },
        objects,
        viewport,
      );
      if (target !== null) onRequestOpenProperties();
    },
    onPointerDown: (event) => {
      suppressNextBoardClick.current = false;
      const pointerId = pointerIdFromEvent(event.pointerId);
      const point = { x: event.clientX, y: event.clientY };

      if (placementToolRef.current !== null) {
        if (activePointer.current !== null) {
          if (activePointer.current.id !== pointerId) {
            suppressNextBoardClick.current = true;
            cancelPlacementProjection();
            setFeedback('Placement annulé : un second doigt a interrompu le geste.');
          }
          return;
        }

        if (!hasFiniteCoordinates(point)) {
          hasValidPlacementPreview.current = false;
          setFeedback(unavailablePositionMessage);
          return;
        }
        if (!hasUsableZoom(cameraRef.current.pixelsPerWorldUnit)) {
          hasValidPlacementPreview.current = false;
          setFeedback(unavailableViewportMessage);
          return;
        }

        activePointer.current = { id: pointerId };
        if (pointerId !== null && typeof event.currentTarget.setPointerCapture === 'function') {
          try {
            event.currentTarget.setPointerCapture(pointerId);
            capturedPointerId.current = pointerId;
          } catch {
            // Capture is a progressive enhancement; the gesture still works without it.
          }
        }
        const boardRect = readCanvasRect();
        if (boardRect === null) {
          hasValidPlacementPreview.current = false;
          setFeedback(unavailableViewportMessage);
          return;
        }
        placeAt(point, boardRect);
        return;
      }

      if (activeMovePointer.current !== null && activeMovePointer.current.id !== pointerId) {
        const interrupted = activeMovePointer.current;
        suppressNextBoardClick.current = true;
        cancelDirectMove();
        if (interrupted.id !== null) {
          boardGesturePointers.current.set(interrupted.id, interrupted.startPoint);
        }
        handleBoardGesturePointerDown(pointerId, point, event.currentTarget);
        return;
      }

      const boardRect = readCanvasRect();
      if (sessionRef.current.phase === 'construction' && boardRect !== null) {
        const viewport: BoardViewport = {
          cssWidth: boardRect.width,
          cssHeight: boardRect.height,
          origin: cameraRef.current.origin,
          pixelsPerWorldUnit: cameraRef.current.pixelsPerWorldUnit,
          devicePixelRatio: 1,
        };
        const projection = projectLevel(currentEditorAttempt(sessionRef.current).document);
        const objects =
          sessionRef.current.mode === 'creation'
            ? withAuthorRotation(projection.objects)
            : projection.objects;
        const localPoint = { x: point.x - boardRect.left, y: point.y - boardRect.top };
        // A finger added to a pan or pinch stays a camera gesture.
        if (isWiringRef.current && boardGesturePointers.current.size === 0) {
          // A wire only ends on an object it can link: a beam or a mass lying
          // over a button's touch target does not take the tap. An object
          // that cannot be linked still answers alone, to explain the refusal.
          const wiringTarget =
            hitTestBoard(
              localPoint,
              objects.filter(({ family }) => isWirable(family)),
              viewport,
            ) ?? hitTestBoard(localPoint, objects, viewport);
          if (wiringTarget !== null) {
            // The tap names a wire's end; its click must not also open the
            // properties once the laid wire has ended the gesture.
            suppressNextBoardClick.current = true;
            onWiringTap(wiringTarget);
            return;
          }
        }
        // Only the selected object shows its handle, so only it answers there:
        // anything else under that spot stays reachable.
        const rotationTarget = objects.find(
          (object) =>
            object.id === sessionRef.current.selectedPlacementId &&
            isRotatableFamily(object.family) &&
            object.rotatable &&
            hitTestRotationHandle(localPoint, object, viewport),
        );
        if (rotationTarget !== undefined) {
          const selected = selectEditorPlacement(sessionRef.current, rotationTarget.id);
          updateSession(selected);
          suppressNextBoardClick.current = true;
          const placement = currentEditorAttempt(selected).document.objects.find(
            (object) => object.id === rotationTarget.id,
          );
          if (placement !== undefined) {
            const centerInBoard = worldToPixels(rotationTarget.position, viewport);
            activeMovePointer.current = {
              id: pointerId,
              placementId: rotationTarget.id,
              startPoint: point,
              kind: 'rotation',
              startRotation: placement.transform.rotation,
              snap: ROTATION_SNAP,
              center: { x: boardRect.left + centerInBoard.x, y: boardRect.top + centerInBoard.y },
              hasDragged: false,
              refusal: null,
            };
            if (pointerId !== null && typeof event.currentTarget.setPointerCapture === 'function') {
              try {
                event.currentTarget.setPointerCapture(pointerId);
                capturedPointerId.current = pointerId;
              } catch {
                // Capture is a progressive enhancement.
              }
            }
          }
          return;
        }
        const placementId = hitTestBoard(localPoint, objects, viewport);
        if (placementId !== null) {
          const selected = selectEditorPlacement(sessionRef.current, placementId);
          updateSession(selected);
          const placement = currentEditorAttempt(selected).document.objects.find(
            (object) => object.id === placementId,
          );
          if (
            placement !== undefined &&
            (selected.mode === 'creation' || placement.permissions.move)
          ) {
            const centerInBoard = worldToPixels(
              { x: placement.transform.position.x, y: placement.transform.position.y },
              viewport,
            );
            activeMovePointer.current = {
              id: pointerId,
              placementId,
              startPoint: point,
              kind: 'move',
              startRotation: placement.transform.rotation,
              snap: ROTATION_SNAP,
              center: { x: boardRect.left + centerInBoard.x, y: boardRect.top + centerInBoard.y },
              hasDragged: false,
              refusal: null,
            };
            if (pointerId !== null && typeof event.currentTarget.setPointerCapture === 'function') {
              try {
                event.currentTarget.setPointerCapture(pointerId);
                capturedPointerId.current = pointerId;
              } catch {
                // Capture is a progressive enhancement.
              }
            }
          } else {
            setFeedback('Objet verrouillé : déplacement indisponible.');
          }
          return;
        }
        updateSession(selectEditorPlacement(sessionRef.current, null));
      }

      // mobile-editor-interactions.md § Navigation: one finger from an
      // empty area pans the camera, two fingers pinch-zoom it.
      handleBoardGesturePointerDown(pointerId, point, event.currentTarget);
    },
    onPointerUp: (event) => {
      const pointerId = pointerIdFromEvent(event.pointerId);

      if (placementToolRef.current !== null) {
        if (!isActivePointer(activePointer.current, pointerId)) return;
        activePointer.current = null;
        suppressNextBoardClick.current = true;
        if (pointerId !== null) releasePointerCapture(event.currentTarget, pointerId);
        commitPlacement();
        return;
      }

      if (activeMovePointer.current !== null) {
        suppressNextBoardClick.current =
          activeMovePointer.current.kind === 'rotation' || activeMovePointer.current.hasDragged;
        if (pointerId !== null) releasePointerCapture(event.currentTarget, pointerId);
        commitDirectMove(pointerId);
        return;
      }

      if (pointerId !== null) releaseGesturePointerCapture(event.currentTarget, pointerId);
      handleBoardGesturePointerEnd(pointerId);
    },
    onPointerMove: (event) => {
      const pointerId = pointerIdFromEvent(event.pointerId);
      const point = { x: event.clientX, y: event.clientY };

      if (placementToolRef.current !== null) {
        const boardRect = readCanvasRect();
        if (boardRect === null) return;
        if (isActivePointer(activePointer.current, pointerId)) {
          placeAt(point, boardRect);
          return;
        }

        updatePlacementIndicator(point, boardRect);
        return;
      }

      if (activeMovePointer.current !== null) {
        previewDirectMove(point);
        return;
      }

      handleBoardGesturePointerMove(pointerId, point);
    },
    onPointerCancel: (event) => {
      const pointerId = pointerIdFromEvent(event.pointerId);

      if (placementToolRef.current !== null) {
        if (!isActivePointer(activePointer.current, pointerId)) return;
        activePointer.current = null;
        suppressNextBoardClick.current = true;
        if (pointerId !== null) releasePointerCapture(event.currentTarget, pointerId);
        cancelPlacementProjection();
        setFeedback('Placement annulé : le geste tactile a été interrompu.');
        return;
      }

      if (activeMovePointer.current !== null) {
        suppressNextBoardClick.current = true;
        if (pointerId !== null) releasePointerCapture(event.currentTarget, pointerId);
        cancelDirectMove();
        return;
      }

      if (pointerId !== null) releaseGesturePointerCapture(event.currentTarget, pointerId);
      handleBoardGesturePointerEnd(pointerId);
    },
    onLostPointerCapture: (event) => {
      const pointerId = pointerIdFromEvent(event.pointerId);

      if (placementToolRef.current !== null) {
        capturedPointerId.current = null;
        if (!isActivePointer(activePointer.current, pointerId)) return;
        suppressNextBoardClick.current = true;
        cancelPlacementProjection();
        setFeedback('Placement annulé : le geste tactile a été interrompu.');
        return;
      }

      if (activeMovePointer.current !== null) {
        capturedPointerId.current = null;
        suppressNextBoardClick.current = true;
        cancelDirectMove();
        return;
      }

      handleBoardGesturePointerEnd(pointerId);
    },
  };

  return {
    placementTool,
    activatePlacement,
    cancelPlacement,
    boardPointerHandlers,
    clearPlacementTool,
    resetGestureState,
  };
}
