import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

import { homeLevel } from '../content/home-level';
import { createBoardRenderer, projectLevel } from '../presentation/board-renderer';
import { previewViewport } from '../presentation/level-preview';
import { createSpriteLoader } from '../presentation/sprite-loader';
import { createSimulationSession } from '../simulation/simulation-session';
import { createCanvasContextAdapter, createCanvasSpriteDecoder } from '../ui/board-canvas';
import { createHomeScene } from './home-hero';
import { simulationView } from './simulation-view';
import { capElapsedSecondsForCatchUp, fixedStepSeconds } from './use-simulation-runner';

const scene = createHomeScene(homeLevel);
const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The real board and physics in the welcome frame, with no editor or progression session. */
export function HomeMachine() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(reducedMotion);
  const pausedRef = useRef(paused);

  useEffect(() => {
    const canvas = canvasRef.current;
    const decode = createCanvasSpriteDecoder();
    if (canvas === null || decode === null) return undefined;
    const context = canvas.getContext('2d');
    if (context === null) return undefined;

    const loader = createSpriteLoader({ scale: 2, decode });
    const session = createSimulationSession(scene, { fixedStepSeconds });
    let disposed = false;
    let frameId: number | null = null;
    let timestamp: number | null = null;

    const draw = async (): Promise<void> => {
      const { width, height } = canvas.getBoundingClientRect();
      if (disposed || width <= 0 || height <= 0) return;
      const viewport = previewViewport(
        scene.scene,
        { width, height },
        window.devicePixelRatio || 1,
      );
      await createBoardRenderer({
        canvas,
        context: createCanvasContextAdapter(context),
        viewport,
        spriteLoader: loader,
      }).render(projectLevel(scene, simulationView(session.readState())));
    };

    const schedule = (): void => {
      if (disposed || document.hidden || frameId !== null) return;
      frameId = requestAnimationFrame((time) => {
        frameId = null;
        const previous = timestamp;
        timestamp = time;
        if (!pausedRef.current && previous !== null) {
          session.advanceElapsedSeconds(
            capElapsedSecondsForCatchUp(Math.max(0, time - previous) / 1000, fixedStepSeconds),
          );
        }
        void draw().then(schedule, () => undefined);
      });
    };

    const visibilityChanged = (): void => {
      timestamp = null;
      if (document.hidden && frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      schedule();
    };
    const motion =
      typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const motionChanged = (): void => {
      pausedRef.current = motion?.matches ?? false;
      setPaused(pausedRef.current);
      timestamp = null;
    };

    document.addEventListener('visibilitychange', visibilityChanged);
    motion?.addEventListener('change', motionChanged);
    // Decode once before drawing, so a late asset load cannot paint a disposed canvas.
    void loader
      .loadForFamilies(scene.objects.map(({ type }) => type))
      .then(draw)
      .then(schedule, () => undefined);

    return () => {
      disposed = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', visibilityChanged);
      motion?.removeEventListener('change', motionChanged);
      session.destroy();
    };
  }, []);

  return (
    <>
      <div
        className="home-board"
        role="img"
        aria-label="Démonstration animée d’une machine TinkerBolt"
      >
        <canvas className="home-machine" ref={canvasRef} aria-hidden="true" />
      </div>
      <button
        className="home-machine-toggle"
        type="button"
        aria-label={paused ? 'Animer la démonstration' : 'Mettre la démonstration en pause'}
        onClick={() => {
          pausedRef.current = !pausedRef.current;
          setPaused(pausedRef.current);
        }}
      >
        {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
      </button>
    </>
  );
}
