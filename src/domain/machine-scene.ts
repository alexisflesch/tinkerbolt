import type { LevelDocument } from './level-document';

/** Ephemeral projection of a machine to simulate or draw: a level without what the player places. */
export type MachineScene = Pick<LevelDocument, 'objects' | 'wires' | 'scene' | 'goal'>;
