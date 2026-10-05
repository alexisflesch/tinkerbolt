import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import {
  fitCameraToScene,
  zoomCameraAt,
  type Camera,
  type SceneRect,
} from '../presentation/board-camera';

/** UI increment for the ± buttons. Not an ADR 0007 bound: those live in board-camera.ts. */
const CAMERA_BUTTON_ZOOM_FACTOR = 1.25;
/** A wheel notch (100 px of `deltaY`) zooms by about the ± buttons' factor. */
const WHEEL_ZOOM_PER_PIXEL = Math.log(CAMERA_BUTTON_ZOOM_FACTOR) / 100;
/** `WheelEvent.DOM_DELTA_LINE` and `DOM_DELTA_PAGE`, in CSS pixels. */
const WHEEL_LINE_IN_CSS_PIXELS = 16;
const WHEEL_PAGE_IN_CSS_PIXELS = 800;

/** Zoom factor for a wheel turn: up zooms in, down zooms out, whatever the delta unit. */
const wheelZoomFactor = (deltaY: number, deltaMode: number): number => {
  const pixels =
    deltaMode === 1
      ? deltaY * WHEEL_LINE_IN_CSS_PIXELS
      : deltaMode === 2
        ? deltaY * WHEEL_PAGE_IN_CSS_PIXELS
        : deltaY;
  return Number.isFinite(pixels) ? Math.exp(-pixels * WHEEL_ZOOM_PER_PIXEL) : 1;
};

export interface CanvasSizeInCss {
  readonly width: number;
  readonly height: number;
}

interface BoardCameraController {
  readonly camera: Camera;
  /** Always in sync with `camera`, updated synchronously: for gesture handlers that need the latest value within a single event. */
  readonly cameraRef: RefObject<Camera>;
  readonly boardCanvasRef: RefObject<HTMLCanvasElement | null>;
  readonly updateCamera: (next: Camera) => void;
  /** The canvas's own rect, not `.scene-frame`'s: the frame carries a 2px border, so its rect is offset from the canvas it visually contains. */
  readonly readCanvasRect: () => DOMRect | null;
  readonly readCanvasSizeInCss: () => CanvasSizeInCss | null;
  readonly fitCameraToCurrentScene: () => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  /** Mouse wheel: zooms keeping the world point under the pointer in place. */
  readonly zoomWithWheel: (event: WheelEvent) => void;
}

/**
 * Owns the board camera (ADR 0007 § Caméra): its state, the canvas ref used
 * to measure the viewport, "Ajuster à la scène" and the ± zoom buttons, and
 * the effect that fits the camera on mount and on every resize/orientation
 * change. Pan and pinch stay in `use-board-pointers.ts` — they are pointer
 * gestures that happen to move the camera, not camera concerns of their own
 * (plan-remise-en-jeu.md § A5 leaves this boundary to judgment).
 *
 * `getScene` bounds the zoom and the pan; `getFraming` is the rectangle the
 * camera fits — the scene by default, the level's useful part when playing
 * (ADR 0007, amendment of 5 October 2026). Both must be referentially stable
 * (e.g. `useEditorSession().currentScene`) so the mount/resize effect below
 * only subscribes once.
 */
export function useBoardCamera(
  getScene: () => SceneRect,
  getFraming: () => SceneRect = getScene,
): BoardCameraController {
  const boardCanvasRef = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState<Camera>(() =>
    fitCameraToScene(getFraming(), { width: 0, height: 0 }),
  );
  const cameraRef = useRef(camera);

  const updateCamera = useCallback((nextCamera: Camera): void => {
    cameraRef.current = nextCamera;
    setCamera(nextCamera);
  }, []);

  const readCanvasRect = useCallback(
    (): DOMRect | null => boardCanvasRef.current?.getBoundingClientRect() ?? null,
    [],
  );

  const readCanvasSizeInCss = useCallback((): CanvasSizeInCss | null => {
    const bounds = readCanvasRect();
    if (bounds === null) return null;
    return { width: bounds.width, height: bounds.height };
  }, [readCanvasRect]);

  const fitCameraToCurrentScene = useCallback((): void => {
    const canvasSize = readCanvasSizeInCss();
    if (canvasSize === null) return;

    updateCamera(fitCameraToScene(getFraming(), canvasSize));
  }, [readCanvasSizeInCss, updateCamera, getFraming]);

  const zoomByButtonFactor = useCallback(
    (factor: number): void => {
      const canvasSize = readCanvasSizeInCss();
      if (canvasSize === null) return;

      const anchor = { x: canvasSize.width / 2, y: canvasSize.height / 2 };
      updateCamera(zoomCameraAt(cameraRef.current, factor, anchor, getScene(), canvasSize));
    },
    [readCanvasSizeInCss, updateCamera, getScene],
  );

  const zoomWithWheel = useCallback(
    (event: WheelEvent): void => {
      const canvasRect = readCanvasRect();
      if (canvasRect === null) return;

      const anchor = { x: event.clientX - canvasRect.left, y: event.clientY - canvasRect.top };
      const factor = wheelZoomFactor(event.deltaY, event.deltaMode);
      const size = { width: canvasRect.width, height: canvasRect.height };
      updateCamera(zoomCameraAt(cameraRef.current, factor, anchor, getScene(), size));
    },
    [readCanvasRect, updateCamera, getScene],
  );

  const zoomIn = useCallback((): void => {
    zoomByButtonFactor(CAMERA_BUTTON_ZOOM_FACTOR);
  }, [zoomByButtonFactor]);

  const zoomOut = useCallback((): void => {
    zoomByButtonFactor(1 / CAMERA_BUTTON_ZOOM_FACTOR);
  }, [zoomByButtonFactor]);

  useEffect(() => {
    fitCameraToCurrentScene();
    window.addEventListener('resize', fitCameraToCurrentScene);
    window.addEventListener('orientationchange', fitCameraToCurrentScene);
    return () => {
      window.removeEventListener('resize', fitCameraToCurrentScene);
      window.removeEventListener('orientationchange', fitCameraToCurrentScene);
    };
  }, [fitCameraToCurrentScene]);

  useEffect(() => {
    // The canvas's own CSS size can change for reasons a `window` resize
    // event never fires for: a flex sibling appearing or disappearing next
    // to it (e.g. the B1 result banner, or a selection's context panel)
    // reflows `.scene-frame` without the viewport itself changing size.
    // Without this, the camera keeps the origin/zoom it fit for the
    // *previous* canvas size, and objects render outside the new, smaller
    // buffer — the board goes visibly blank instead of merely resizing.
    // `ResizeObserver` is unavailable in the jsdom test environment, so this
    // degrades to window-resize-only there (already covered above).
    const canvas = boardCanvasRef.current;
    if (canvas === null || typeof ResizeObserver !== 'function') return;

    const observer = new ResizeObserver(() => {
      fitCameraToCurrentScene();
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [fitCameraToCurrentScene]);

  return {
    camera,
    cameraRef,
    boardCanvasRef,
    updateCamera,
    readCanvasRect,
    readCanvasSizeInCss,
    fitCameraToCurrentScene,
    zoomIn,
    zoomOut,
    zoomWithWheel,
  };
}
