import { describe, expect, it } from 'vitest';
import {
  decodeProgressFile,
  encodeProgressFile,
  MAX_PROGRESS_FILE_SIZE_BYTES,
} from './progress-file-codec';

const progress = {
  'tuto-1': { resolved: true, bestObjectCount: 0 },
  'tuto-2': { resolved: false, bestObjectCount: null },
} as const;
const file = (data: unknown, version = 1) => JSON.stringify({ kind: 'progress', version, data });

describe('fichier de progression v1', () => {
  it('conserve les records, les entrées non résolues et les identifiants inconnus', () => {
    expect(decodeProgressFile(encodeProgressFile(progress))).toEqual({ status: 'ok', progress });
    expect(decodeProgressFile(encodeProgressFile({}))).toEqual({ status: 'ok', progress: {} });
  });
  it('refuse JSON cassé, autre document, version future et champs supplémentaires', () => {
    expect(decodeProgressFile('{')).toEqual({ status: 'error', code: 'invalid-json' });
    expect(decodeProgressFile(file(progress, 2))).toEqual({
      status: 'error',
      code: 'unsupported-version',
    });
    for (const text of [
      JSON.stringify({ kind: 'level', version: 1, data: {} }),
      JSON.stringify({ kind: 'progress', version: 1, data: {}, extra: true }),
      'null',
    ]) {
      expect(decodeProgressFile(text)).toEqual({ status: 'error', code: 'invalid-progress' });
    }
  });
  it('refuse les records incohérents, négatifs, non entiers ou les identifiants dangereux', () => {
    for (const data of [
      { a: { resolved: true, bestObjectCount: null } },
      { a: { resolved: false, bestObjectCount: 2 } },
      { a: { resolved: true, bestObjectCount: -1 } },
      { a: { resolved: true, bestObjectCount: 1.5 } },
      { '../a': { resolved: true, bestObjectCount: 1 } },
      { ['__proto__']: null },
    ]) {
      expect(decodeProgressFile(file(data)).status).toBe('error');
    }
  });
  it('borne la taille en octets UTF-8 avant parsing', () => {
    expect(decodeProgressFile('é'.repeat(MAX_PROGRESS_FILE_SIZE_BYTES / 2 + 1))).toEqual({
      status: 'error',
      code: 'too-large',
    });
  });
});
