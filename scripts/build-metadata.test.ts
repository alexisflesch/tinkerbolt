import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getBuildMetadata } from './build-metadata';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'tinkerbolt-build-metadata-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('getBuildMetadata', () => {
  it('uses package.json as the application version source', () => {
    const packageContents: unknown = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    );
    if (
      typeof packageContents !== 'object' ||
      packageContents === null ||
      !('version' in packageContents) ||
      typeof packageContents.version !== 'string'
    ) {
      throw new Error('package.json doit déclarer une version texte.');
    }

    expect(getBuildMetadata().version).toBe(packageContents.version);
  });

  it('uses the package version and falls back to local without Git metadata', () => {
    const directory = createTemporaryDirectory();
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '0.2.0' }));

    expect(getBuildMetadata(directory)).toEqual({ version: '0.2.0', commit: 'local' });
  });

  it('reports the short commit and marks a modified checkout dirty', () => {
    const directory = createTemporaryDirectory();
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '1.0.0' }));
    execFileSync('git', ['init', '--quiet'], { cwd: directory });
    execFileSync('git', ['config', 'user.name', 'TinkerBolt test'], { cwd: directory });
    execFileSync('git', ['config', 'user.email', 'tinkerbolt-test@example.invalid'], {
      cwd: directory,
    });
    execFileSync('git', ['add', 'package.json'], { cwd: directory });
    execFileSync('git', ['commit', '--quiet', '-m', 'Initial'], { cwd: directory });

    const commit = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: directory,
      encoding: 'utf8',
    }).trim();
    expect(getBuildMetadata(directory)).toEqual({ version: '1.0.0', commit });

    writeFileSync(join(directory, 'untracked.ts'), 'export {};');
    expect(getBuildMetadata(directory)).toEqual({ version: '1.0.0', commit: `${commit}-dirty` });
  });
});
