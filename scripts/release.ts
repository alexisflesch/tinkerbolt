import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createReleasePlan,
  parseReleaseArgs,
  runReleaseWorkflow,
  type ReleaseOriginalFiles,
  type ReleasePlan,
  type ReleasePorts,
} from './release-core';

const root = process.cwd();
const packagePath = resolve(root, 'package.json');
const changelogPath = resolve(root, 'CHANGELOG.md');

const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

const output = (command: string, args: readonly string[]): string => {
  try {
    return execFileSync(command, [...args], { cwd: root, encoding: 'utf8' }).trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${command} ${args[0] ?? ''} a échoué : ${detail}`, { cause: error });
  }
};

const githubRepositoryFromOrigin = (): string => {
  const urls = output('git', ['remote', 'get-url', '--push', '--all', 'origin']).split(/\r?\n/);
  if (urls.length !== 1 || urls[0] === undefined) {
    throw new Error('origin doit avoir une seule URL de push GitHub.');
  }
  const match =
    /^(?:https?:\/\/|ssh:\/\/git@|git@)github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(
      urls[0],
    );
  const owner = match?.[1];
  const repository = match?.[2];
  if (owner === undefined || repository === undefined) {
    throw new Error('origin doit pointer vers un dépôt GitHub sur github.com.');
  }
  return `${owner}/${repository}`;
};

const makePorts = (): ReleasePorts => {
  let githubRepository = '';

  const ports: ReleasePorts = {
    preflight: (plan) => {
      const branch = output('git', ['branch', '--show-current']);
      if (branch !== 'main')
        throw new Error(`La release doit partir de main (branche active : ${branch}).`);

      const status = output('git', ['status', '--porcelain', '--untracked-files=all']);
      if (status !== '') throw new Error('L’arbre Git doit être propre avant une release.');

      if (output('git', ['tag', '--list', plan.tag]) !== '') {
        throw new Error(`Le tag ${plan.tag} existe déjà localement.`);
      }

      githubRepository = githubRepositoryFromOrigin();
      if (output('git', ['ls-remote', '--tags', 'origin', `refs/tags/${plan.tag}`]) !== '') {
        throw new Error(`Le tag ${plan.tag} existe déjà sur origin.`);
      }

      try {
        output('gh', ['auth', 'status', '--hostname', 'github.com']);
      } catch (error) {
        throw new Error(
          'GitHub CLI (`gh`) et une session `gh auth login` sont requis avant une release.',
          {
            cause: error,
          },
        );
      }
      const ghRepository = output('gh', [
        'repo',
        'view',
        githubRepository,
        '--json',
        'nameWithOwner',
        '--jq',
        '.nameWithOwner',
      ]);
      if (ghRepository.toLocaleLowerCase('en-US') !== githubRepository.toLocaleLowerCase('en-US')) {
        throw new Error(
          `gh a résolu ${ghRepository}, alors que origin désigne ${githubRepository}.`,
        );
      }

      try {
        output('git', ['push', '--dry-run', '--atomic', 'origin', 'main']);
      } catch (error) {
        throw new Error(
          'Le push atomique de main a échoué en préflight ; aucune modification locale n’a été faite.',
          {
            cause: error,
          },
        );
      }
    },
    writeFiles: (plan) => {
      writeFileSync(packagePath, plan.packageJson, 'utf8');
      writeFileSync(changelogPath, plan.changelog, 'utf8');
    },
    runChecks: () => {
      execFileSync('pnpm', ['check'], { cwd: root, stdio: 'inherit' });
    },
    commit: (plan) => {
      execFileSync('git', ['add', '--', 'package.json', 'CHANGELOG.md'], {
        cwd: root,
        stdio: 'inherit',
      });
      execFileSync('git', ['commit', '-m', `Publier la version ${plan.version}`], {
        cwd: root,
        stdio: 'inherit',
      });
    },
    createTag: (plan) => {
      execFileSync('git', ['tag', '-a', plan.tag, '-m', `Tinkerbolt ${plan.version}`], {
        cwd: root,
        stdio: 'inherit',
      });
    },
    push: (plan) => {
      execFileSync('git', ['push', '--atomic', 'origin', 'main', `refs/tags/${plan.tag}`], {
        cwd: root,
        stdio: 'inherit',
      });
    },
    createGithubRelease: (plan) => {
      execFileSync(
        'gh',
        [
          'release',
          'create',
          plan.tag,
          '--verify-tag',
          '--repo',
          githubRepository,
          '--notes',
          plan.releaseNotes,
        ],
        { cwd: root, stdio: 'inherit' },
      );
    },
    githubReleaseRecoveryCommands: (plan) =>
      [
        `gh release view ${shellQuote(plan.tag)} --repo ${shellQuote(githubRepository)}`,
        `gh release create ${shellQuote(plan.tag)} --verify-tag --repo ${shellQuote(githubRepository)} --notes ${shellQuote(plan.releaseNotes)}`,
      ].join('\n'),
    restoreFiles: (files: ReleaseOriginalFiles) => {
      try {
        execFileSync('git', ['restore', '--staged', '--', 'package.json', 'CHANGELOG.md'], {
          cwd: root,
          stdio: 'inherit',
        });
      } finally {
        writeFileSync(packagePath, files.packageJson, 'utf8');
        writeFileSync(changelogPath, files.changelog, 'utf8');
      }
    },
    print: (message) => {
      console.log(message);
    },
  };

  return ports;
};

const run = (): void => {
  const { version, dryRun } = parseReleaseArgs(process.argv.slice(2));
  const originals: ReleaseOriginalFiles = {
    packageJson: readFileSync(packagePath, 'utf8'),
    changelog: readFileSync(changelogPath, 'utf8'),
  };
  const plan: ReleasePlan = createReleasePlan(
    originals.packageJson,
    originals.changelog,
    version,
    new Date().toISOString().slice(0, 10),
  );

  runReleaseWorkflow(plan, originals, dryRun, makePorts());
};

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
