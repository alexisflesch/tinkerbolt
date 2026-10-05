import type { WorldPoint } from '../domain/family-geometry';
import type { ProjectedWire, ProjectedWireSegment } from './control-wires';

type ScreenPoint = WorldPoint;

/** The operations the wires need, all present on a real `CanvasRenderingContext2D`. */
export type WireCanvas = {
  globalAlpha: number;
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  lineCap: CanvasLineCap;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  readonly save: () => void;
  readonly restore: () => void;
  readonly beginPath: () => void;
  readonly moveTo: (x: number, y: number) => void;
  readonly lineTo: (x: number, y: number) => void;
  readonly arc: (
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ) => void;
  readonly stroke: () => void;
  readonly fill: () => void;
  readonly fillText: (text: string, x: number, y: number) => void;
};

/**
 * Circuit colours, in circuit order. Colour is only a second cue: the
 * circuit letter is always drawn at both ends (ADR 0009). Red is reserved for
 * the goal's ball, so no circuit is red or near it; every colour stays
 * readable on the cream board.
 */
const CIRCUIT_COLOURS = ['#1e88e5', '#2e7d32', '#b36b00', '#8e24aa', '#00897b'];
const CASING_COLOUR = '#1d1f24';
/** Wire sizes are CSS pixels, like the selection outline: readable at every zoom. */
const CASING_WIDTH = 4;
const CORE_WIDTH = 2;
const LABEL_RADIUS = 8;
/** Badges sit on the wire, this far from its end: "(A)───" rather than on the object. */
const LABEL_INSET = 14;
/** Same stack as the interface (`--font-ui`), so the letter matches the rest of the UI. */
const LABEL_FONT =
  "bold 10px ui-rounded, 'Nunito', 'Varela Round', system-ui, 'Segoe UI', Roboto, Arial, sans-serif";
/**
 * Wires are a hint, behind the machine: translucent while building, fainter
 * still for objects other than the selected one, almost gone while the
 * machine runs. Their letters stay readable while building.
 */
const WIRE_ALPHA = { construction: 0.45, unrelated: 0.25, simulation: 0.08 } as const;
const LABEL_ALPHA = { construction: 0.8, unrelated: 0.45, simulation: 0.1 } as const;

const circuitColour = (circuitIndex: number): string =>
  CIRCUIT_COLOURS[circuitIndex % CIRCUIT_COLOURS.length] ?? CASING_COLOUR;

type WireEmphasis = 'construction' | 'unrelated' | 'simulation';

const emphasisOf = (
  wire: ProjectedWire,
  dimmed: boolean,
  focusId: string | undefined,
): WireEmphasis => {
  if (dimmed) return 'simulation';
  if (
    focusId === undefined ||
    wire.sourceId === focusId ||
    wire.timerId === focusId ||
    wire.targetId === focusId
  ) {
    return 'construction';
  }
  return 'unrelated';
};

const tracePath = (
  context: WireCanvas,
  segment: ProjectedWireSegment,
  toScreen: (point: WorldPoint) => ScreenPoint,
): void => {
  const from = toScreen(segment.from);
  const to = toScreen(segment.to);
  const bend = segment.bend === undefined ? undefined : toScreen(segment.bend);
  context.moveTo(from.x, from.y);
  if (bend !== undefined) context.lineTo(bend.x, bend.y);
  context.lineTo(to.x, to.y);
};

/**
 * Draws every wire as a horizontal/vertical dark casing under a coloured
 * core, with at most one corner (U14b): through `bend` when it exists,
 * straight from `from` to `to` otherwise. When a wired object is selected,
 * the other wires fade further.
 */
export const drawWires = (
  context: WireCanvas,
  wires: readonly ProjectedWire[],
  toScreen: (point: WorldPoint) => ScreenPoint,
  options: { readonly dimmed: boolean; readonly focusId: string | undefined },
): void => {
  for (const wire of wires) {
    const segments = wire.segments ?? [wire];
    context.save();
    context.globalAlpha = WIRE_ALPHA[emphasisOf(wire, options.dimmed, options.focusId)];
    context.lineCap = 'round';
    for (const [colour, width] of [
      [CASING_COLOUR, CASING_WIDTH],
      [circuitColour(wire.circuitIndex), CORE_WIDTH],
    ] as const) {
      context.beginPath();
      for (const segment of segments) tracePath(context, segment, toScreen);
      context.strokeStyle = colour;
      context.lineWidth = width;
      context.stroke();
    }
    context.restore();
  }
};

/** The wire being laid has no circuit yet: it takes the selection's blue, well visible. */
const PENDING_WIRE_COLOUR = '#1e88e5';
const PENDING_WIRE_ALPHA = 0.85;

/** Draws the wire being laid, from the first object to the cursor, like a laid wire. */
export const drawPendingWire = (
  context: WireCanvas,
  segments: readonly ProjectedWireSegment[],
  toScreen: (point: WorldPoint) => ScreenPoint,
): void => {
  if (segments.length === 0) return;
  context.save();
  context.globalAlpha = PENDING_WIRE_ALPHA;
  context.lineCap = 'round';
  for (const [colour, width] of [
    [CASING_COLOUR, CASING_WIDTH],
    [PENDING_WIRE_COLOUR, CORE_WIDTH],
  ] as const) {
    context.beginPath();
    for (const segment of segments) tracePath(context, segment, toScreen);
    context.strokeStyle = colour;
    context.lineWidth = width;
    context.stroke();
  }
  context.restore();
};

/** A point `LABEL_INSET` from `end` towards `towards`, never past half the segment. */
const insetAlong = (end: ScreenPoint, towards: ScreenPoint): ScreenPoint => {
  const length = Math.hypot(towards.x - end.x, towards.y - end.y);
  if (length === 0) return end;
  const distance = Math.min(LABEL_INSET, length / 2);
  return {
    x: end.x + ((towards.x - end.x) / length) * distance,
    y: end.y + ((towards.y - end.y) / length) * distance,
  };
};

/**
 * The circuit letter on both ends of each wire, over the objects, fading
 * with the wire. Each badge sits `LABEL_INSET` along its own leg of the
 * equerre — towards `bend` when there is one — never on the diagonal.
 */
export const drawWireLabels = (
  context: WireCanvas,
  wires: readonly ProjectedWire[],
  toScreen: (point: WorldPoint) => ScreenPoint,
  options: { readonly dimmed: boolean; readonly focusId: string | undefined },
): void => {
  for (const wire of wires) {
    const segments = wire.segments ?? [wire];
    const first = segments[0];
    const last = segments.at(-1);
    if (first === undefined || last === undefined) continue;
    const from = toScreen(first.from);
    const fromTowards = toScreen(first.bend ?? first.to);
    const to = toScreen(last.to);
    const toTowards = toScreen(last.bend ?? last.from);
    context.save();
    context.globalAlpha = LABEL_ALPHA[emphasisOf(wire, options.dimmed, options.focusId)];
    context.font = LABEL_FONT;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const centre of [insetAlong(from, fromTowards), insetAlong(to, toTowards)]) {
      context.beginPath();
      context.arc(centre.x, centre.y, LABEL_RADIUS, 0, 2 * Math.PI);
      context.fillStyle = circuitColour(wire.circuitIndex);
      context.fill();
      context.fillStyle = '#ffffff';
      context.fillText(wire.label, centre.x, centre.y);
    }
    context.restore();
  }
};
