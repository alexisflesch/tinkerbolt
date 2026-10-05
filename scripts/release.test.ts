import { describe, expect, it, vi } from 'vitest';

import { createReleasePlan } from './release-core';
import { makePorts } from './release';

const { execFileSync } = vi.hoisted(() => ({ execFileSync: vi.fn() }));
vi.mock('node:child_process', () => ({ execFileSync }));

describe('release preflight authentication', () => {
  it.each(['git@github.com:owner/repo.git', 'https://github.com/owner/repo.git'])(
    'uses Git credentials only with origin %s',
    (origin) => {
      execFileSync.mockReset();
      execFileSync.mockImplementation((command: string, args: readonly string[]) => {
        if (command !== 'git') throw new Error('Unexpected non-Git command');
        if (args[0] === 'branch') return 'main\n';
        if (args[0] === 'remote') return origin;
        return '';
      });
      const plan = createReleasePlan(
        '{"version":"0.1.0"}',
        '## [Non publié]\n\n- Ajout.\n',
        '0.2.0',
        '2026-10-05',
      );

      expect(() => {
        makePorts().preflight(plan);
      }).not.toThrow();
      expect(execFileSync.mock.calls.every(([command]) => command === 'git')).toBe(true);
      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['push', '--dry-run', '--atomic', 'origin', 'main'],
        expect.objectContaining({ encoding: 'utf8' }),
      );
    },
  );
});
