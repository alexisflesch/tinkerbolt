import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface BuildMetadata {
  readonly version: string;
  readonly commit: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const getBuildMetadata = (repositoryRoot: string = process.cwd()): BuildMetadata => {
  const packageContents: unknown = JSON.parse(
    readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
  );
  if (!isRecord(packageContents) || typeof packageContents.version !== 'string') {
    throw new Error('package.json doit déclarer une version texte.');
  }

  try {
    const commit = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const workingTree = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return {
      version: packageContents.version,
      commit: workingTree.length > 0 ? `${commit}-dirty` : commit,
    };
  } catch {
    return { version: packageContents.version, commit: 'local' };
  }
};
