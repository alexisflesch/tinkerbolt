import { describe, expect, it } from 'vitest';

import {
  createReleasePlan,
  parseReleaseArgs,
  runReleaseWorkflow,
  type ReleaseOriginalFiles,
  type ReleasePorts,
} from './release-core';

const originalFiles: ReleaseOriginalFiles = {
  packageJson: '{\n  "name": "tinkerbolt",\n  "version": "0.1.0",\n  "private": true\n}\n',
  changelog: [
    '# Journal des changements',
    '',
    '## [Non publié]',
    '',
    '- Ajout visible pour les joueurs.',
    '',
    '## Référence initiale — 0.1.0',
    '',
    '- État initial conservé.',
    '',
  ].join('\n'),
};

const makePlan = () =>
  createReleasePlan(originalFiles.packageJson, originalFiles.changelog, '0.2.0', '2026-10-06');

const makePorts = (events: string[], overrides: Partial<ReleasePorts> = {}): ReleasePorts => ({
  preflight: () => {
    events.push('preflight');
  },
  writeFiles: () => {
    events.push('write');
  },
  runChecks: () => {
    events.push('check');
  },
  commit: () => {
    events.push('commit');
  },
  createTag: () => {
    events.push('tag');
  },
  push: () => {
    events.push('push');
  },
  restoreFiles: () => {
    events.push('restore');
  },
  print: (message) => {
    events.push(`print:${message}`);
  },
  ...overrides,
});

describe('release arguments and plan', () => {
  it('parses a version and the optional dry-run flag in either order', () => {
    expect(parseReleaseArgs(['0.2.0'])).toEqual({ version: '0.2.0', dryRun: false });
    expect(parseReleaseArgs(['--dry-run', '0.2.0'])).toEqual({
      version: '0.2.0',
      dryRun: true,
    });
    expect(parseReleaseArgs(['0.2.0', '--dry-run'])).toEqual({
      version: '0.2.0',
      dryRun: true,
    });
  });

  it('rejects missing, duplicate and unknown arguments', () => {
    expect(() => parseReleaseArgs([])).toThrow(/version/iu);
    expect(() => parseReleaseArgs(['0.2.0', '0.3.0'])).toThrow(/un seul/iu);
    expect(() => parseReleaseArgs(['0.2.0', '--force'])).toThrow(/option/iu);
  });

  it('prepares the package version, notes and dated section while keeping the reference', () => {
    const plan = makePlan();

    expect(JSON.parse(plan.packageJson)).toMatchObject({ version: '0.2.0' });
    expect(plan.tag).toBe('v0.2.0');
    expect(plan.releaseNotes).toBe('- Ajout visible pour les joueurs.');
    expect(plan.changelog).toContain('## [Non publié]\n\nAucun changement notable pour le moment.');
    expect(plan.changelog).toContain(
      '## [0.2.0] - 2026-10-06\n\n- Ajout visible pour les joueurs.\n\n## Référence initiale',
    );
    expect(plan.changelog).toContain('## Référence initiale — 0.1.0\n\n- État initial conservé.');
  });

  it('rejects invalid, non-increasing and already recorded versions', () => {
    expect(() =>
      createReleasePlan(originalFiles.packageJson, originalFiles.changelog, '0.1.0', '2026-10-06'),
    ).toThrow(/supérieure/iu);
    expect(() =>
      createReleasePlan(
        originalFiles.packageJson,
        originalFiles.changelog,
        '0.2.0-rc.1',
        '2026-10-06',
      ),
    ).toThrow(/version/iu);
    const duplicateChangelog = `${originalFiles.changelog}\n## [0.2.0] - 2026-10-01\n`;
    expect(() =>
      createReleasePlan(originalFiles.packageJson, duplicateChangelog, '0.2.0', '2026-10-06'),
    ).toThrow(/déjà/iu);
  });

  it('allows a stable version to follow the same prerelease core', () => {
    const prereleasePackage = '{\n  "name": "tinkerbolt",\n  "version": "1.0.0-rc.1"\n}\n';
    expect(
      createReleasePlan(prereleasePackage, originalFiles.changelog, '1.0.0', '2026-10-06')
        .currentVersion,
    ).toBe('1.0.0-rc.1');
  });
});

describe('runReleaseWorkflow', () => {
  it('prints a dry-run plan without preflight or mutations', () => {
    const events: string[] = [];
    const ports = makePorts(events);

    runReleaseWorkflow(makePlan(), originalFiles, true, ports);

    expect(events).toHaveLength(1);
    expect(events[0]).toContain('- Ajout visible pour les joueurs.');
    expect(events[0]).toContain('git push --atomic');
  });

  it('runs checks before committing, tagging and pushing without local GitHub CLI', () => {
    const events: string[] = [];

    runReleaseWorkflow(makePlan(), originalFiles, false, makePorts(events));

    expect(events.slice(0, 6)).toEqual(['preflight', 'write', 'check', 'commit', 'tag', 'push']);
    expect(events).toHaveLength(7);
    expect(events[6]).toContain('GitHub Actions');
  });

  it('does not mutate files when preflight fails', () => {
    const events: string[] = [];
    const ports = makePorts(events, {
      preflight: () => {
        events.push('preflight');
        throw new Error('no Git push auth');
      },
    });

    expect(() => {
      runReleaseWorkflow(makePlan(), originalFiles, false, ports);
    }).toThrow('no Git push auth');
    expect(events).toEqual(['preflight']);
  });

  it('restores package and changelog when the gate fails before commit', () => {
    const events: string[] = [];
    const ports = makePorts(events, {
      runChecks: () => {
        events.push('check');
        throw new Error('gate failed');
      },
    });

    expect(() => {
      runReleaseWorkflow(makePlan(), originalFiles, false, ports);
    }).toThrow('gate failed');
    expect(events).toEqual(['preflight', 'write', 'check', 'restore']);
  });

  it('keeps local refs and gives recovery instructions when the push fails', () => {
    const events: string[] = [];
    const ports = makePorts(events, {
      push: () => {
        events.push('push');
        throw new Error('Git unavailable');
      },
    });

    expect(() => {
      runReleaseWorkflow(makePlan(), originalFiles, false, ports);
    }).toThrow(/git ls-remote --heads --tags origin main v0\.2\.0/iu);
    expect(events).toEqual(['preflight', 'write', 'check', 'commit', 'tag', 'push']);
  });
});
