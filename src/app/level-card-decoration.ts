import type { CSSProperties } from 'react';

type DecorationStyle = CSSProperties & {
  '--card-tilt': string;
  '--attachment-left': string;
  '--attachment-angle': string;
  '--attachment-width': string;
  '--attachment-height': string;
};

/** A level's id seeds its decoration, independent of list order, progress and renders. */
export function levelCardDecoration(id: string): {
  readonly kind: 'pin1' | 'pin2' | 'tape';
  readonly style: DecorationStyle;
} {
  let seed = 2166136261;
  for (const character of id) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  }
  const random = (): number => {
    // Mix each draw so neighboring ids also yield visibly different fixations.
    seed = (seed + 0x9e3779b9) | 0;
    let value = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
  };
  // Only the paper tilts (`styles.css`): its straight content stays inside the margin.
  const tilt = (random() * 2 - 1) * 0.8;
  const choice = random();
  const kind = choice < 0.5 ? 'tape' : choice < 0.75 ? 'pin1' : 'pin2';
  const left = kind === 'tape' ? 23 + random() * 47 : 8 + random() * 80;
  const angle = (random() * 2 - 1) * (kind === 'tape' ? 15 : 12);
  const width = kind === 'tape' ? 94 + random() * 32 : 38 + random() * 6;
  const height = kind === 'tape' ? 46 + random() * 14 : width;

  return {
    kind,
    style: {
      '--card-tilt': `${tilt.toFixed(2)}deg`,
      '--attachment-left': `${left.toFixed(2)}%`,
      '--attachment-angle': `${angle.toFixed(2)}deg`,
      '--attachment-width': `${width.toFixed(2)}px`,
      '--attachment-height': `${height.toFixed(2)}px`,
    },
  };
}
