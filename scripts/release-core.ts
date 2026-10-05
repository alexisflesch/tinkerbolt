import { isValidSemVer } from './check-release-metadata';

export interface ReleaseArguments {
  readonly version: string;
  readonly dryRun: boolean;
}

export interface ReleaseOriginalFiles {
  readonly packageJson: string;
  readonly changelog: string;
}

export interface ReleasePlan {
  readonly currentVersion: string;
  readonly version: string;
  readonly tag: string;
  readonly date: string;
  readonly packageJson: string;
  readonly changelog: string;
  readonly releaseNotes: string;
}

export interface ReleasePorts {
  readonly preflight: (plan: ReleasePlan) => void;
  readonly writeFiles: (plan: ReleasePlan) => void;
  readonly runChecks: () => void;
  readonly commit: (plan: ReleasePlan) => void;
  readonly createTag: (plan: ReleasePlan) => void;
  readonly push: (plan: ReleasePlan) => void;
  readonly createGithubRelease: (plan: ReleasePlan) => void;
  readonly githubReleaseRecoveryCommands: (plan: ReleasePlan) => string;
  readonly restoreFiles: (files: ReleaseOriginalFiles) => void;
  readonly print: (message: string) => void;
}

const stableReleasePattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const versionCorePattern = /^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+.+)?$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getPackageVersion = (packageJson: string): string => {
  const parsed: unknown = JSON.parse(packageJson);
  if (!isRecord(parsed) || typeof parsed.version !== 'string' || !isValidSemVer(parsed.version)) {
    throw new Error('package.json doit déclarer une version SemVer valide.');
  }
  return parsed.version;
};

const isGreaterVersion = (nextVersion: string, currentVersion: string): boolean => {
  const next = versionCorePattern.exec(nextVersion);
  const current = versionCorePattern.exec(currentVersion);
  if (next === null || current === null) return false;

  for (const index of [1, 2, 3]) {
    const nextPart = next[index];
    const currentPart = current[index];
    if (nextPart === undefined || currentPart === undefined) return false;
    const nextNumber = BigInt(nextPart);
    const currentNumber = BigInt(currentPart);
    if (nextNumber !== currentNumber) return nextNumber > currentNumber;
  }

  return current[4] !== undefined;
};

export const parseReleaseArgs = (args: readonly string[]): ReleaseArguments => {
  let version: string | undefined;
  let dryRun = false;

  for (const argument of args) {
    if (argument === '--dry-run') {
      if (dryRun) throw new Error('L’option --dry-run ne doit apparaître qu’une fois.');
      dryRun = true;
    } else if (argument.startsWith('-')) {
      throw new Error(`Option inconnue : ${argument}.`);
    } else if (version === undefined) {
      version = argument;
    } else {
      throw new Error('Indiquer un seul numéro de version.');
    }
  }

  if (version === undefined)
    throw new Error('Indiquer une version SemVer stable, par exemple 0.2.0.');
  if (!stableReleasePattern.test(version)) {
    throw new Error('La version de release doit être stable au format X.Y.Z, sans suffixe.');
  }

  return { version, dryRun };
};

const extractUnreleasedNotes = (
  changelog: string,
): { readonly lines: string[]; readonly rest: string[] } => {
  const lines = changelog.split(/\r?\n/);
  const headingIndexes = lines
    .map((line, index) => (line === '## [Non publié]' ? index : -1))
    .filter((index) => index >= 0);
  if (headingIndexes.length !== 1) {
    throw new Error('CHANGELOG.md doit contenir exactement une section « Non publié ».');
  }

  const start = headingIndexes[0];
  if (start === undefined) throw new Error('Section « Non publié » introuvable.');
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  const sectionEnd = end < 0 ? lines.length : end;
  const noteLines = lines
    .slice(start + 1, sectionEnd)
    .join('\n')
    .trim()
    .split('\n')
    .filter((line) => line.trim() !== 'Aucun changement notable pour le moment.');

  return {
    lines: noteLines.join('\n').trim().length === 0 ? [] : noteLines,
    rest: lines.slice(sectionEnd),
  };
};

const isValidDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
};

export const createReleasePlan = (
  packageJson: string,
  changelog: string,
  version: string,
  date: string,
): ReleasePlan => {
  if (!stableReleasePattern.test(version)) {
    throw new Error('La version de release doit être stable au format X.Y.Z, sans suffixe.');
  }
  if (!isValidDate(date)) throw new Error(`Date de release invalide : ${date}.`);

  const currentVersion = getPackageVersion(packageJson);
  if (!isGreaterVersion(version, currentVersion)) {
    throw new Error(`La nouvelle version ${version} doit être supérieure à ${currentVersion}.`);
  }

  const { lines: notes, rest } = extractUnreleasedNotes(changelog);
  const tag = `v${version}`;
  if (changelog.split(/\r?\n/).some((line) => line === `## [${version}] - ${date}`)) {
    throw new Error(`La section de release ${version} existe déjà.`);
  }
  if (changelog.split(/\r?\n/).some((line) => line.startsWith(`## [${version}] - `))) {
    throw new Error(`La version ${version} est déjà présente dans CHANGELOG.md.`);
  }

  const parsedPackage: unknown = JSON.parse(packageJson);
  if (!isRecord(parsedPackage)) throw new Error('package.json doit contenir un objet JSON.');
  const updatedPackageJson = `${JSON.stringify({ ...parsedPackage, version }, null, 2)}\n`;
  const newline = changelog.includes('\r\n') ? '\r\n' : '\n';
  const releaseLines = [
    '## [Non publié]',
    '',
    'Aucun changement notable pour le moment.',
    '',
    `## [${version}] - ${date}`,
    ...(notes.length === 0 ? [] : ['', ...notes]),
    ...(rest.length === 0 ? [] : ['']),
    ...rest,
  ];
  const sectionIndex = changelog.split(/\r?\n/).indexOf('## [Non publié]');
  const beforeSection = changelog.split(/\r?\n/).slice(0, sectionIndex);
  const updatedChangelog = [...beforeSection, ...releaseLines].join(newline);

  return {
    currentVersion,
    version,
    tag,
    date,
    packageJson: updatedPackageJson,
    changelog: updatedChangelog.endsWith(newline)
      ? updatedChangelog
      : `${updatedChangelog}${newline}`,
    releaseNotes: notes.join('\n'),
  };
};

const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

export const formatReleaseDryRun = (plan: ReleasePlan): string =>
  [
    `Aperçu de release ${plan.version} (aucune mutation, aucun accès réseau ou GitHub).`,
    `Version : ${plan.currentVersion} → ${plan.version}`,
    `Date prévue : ${plan.date}`,
    `Actions prévues : mise à jour package.json et CHANGELOG.md, pnpm check, commit ciblé, tag annoté, puis \`git push --atomic origin main refs/tags/v${plan.version}\` et GitHub Release.`,
    'Préconditions du mode réel : branche main propre, origin joignable, tag absent, gh installé et authentifié.',
    'Notes de release :',
    plan.releaseNotes.length === 0 ? '(aucune note notable)' : plan.releaseNotes,
  ].join('\n');

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const runReleaseWorkflow = (
  plan: ReleasePlan,
  originalFiles: ReleaseOriginalFiles,
  dryRun: boolean,
  ports: ReleasePorts,
): void => {
  if (dryRun) {
    ports.print(formatReleaseDryRun(plan));
    return;
  }

  ports.preflight(plan);
  let releaseCommitCreated = false;
  let releaseTagCreated = false;
  let pushAttempted = false;
  let refsPushed = false;

  try {
    ports.writeFiles(plan);
    ports.runChecks();
    ports.commit(plan);
    releaseCommitCreated = true;
    ports.createTag(plan);
    releaseTagCreated = true;
    pushAttempted = true;
    ports.push(plan);
    refsPushed = true;
    ports.createGithubRelease(plan);
  } catch (error) {
    if (!releaseCommitCreated) {
      try {
        ports.restoreFiles(originalFiles);
      } catch (restoreError) {
        throw new Error(
          `La release a échoué avant le commit (${errorText(error)}) et la restauration des fichiers a aussi échoué (${errorText(restoreError)}).`,
          { cause: restoreError },
        );
      }
      throw error;
    }

    const pushCommand = `git push --atomic origin main refs/tags/${plan.tag}`;
    if (refsPushed) {
      const githubCommands = ports.githubReleaseRecoveryCommands(plan);
      throw new Error(
        `Le commit, le tag et le push sont publiés, mais la GitHub Release n’a pas été confirmée (${errorText(error)}). Ne supprime pas les refs. Vérifie son état et reprends si nécessaire :\n${githubCommands}`,
        { cause: error },
      );
    }
    if (pushAttempted) {
      throw new Error(
        `Le commit ${plan.version} et son tag existent localement, mais le résultat du push atomique est incertain (${errorText(error)}). Vérifie « git ls-remote --heads --tags origin main ${plan.tag} » ; si les refs manquent, relance : ${pushCommand}`,
        { cause: error },
      );
    }
    if (releaseTagCreated) {
      throw new Error(
        `Le commit et le tag ${plan.tag} existent localement, mais le push atomique a échoué (${errorText(error)}). Vérifie « git ls-remote --heads --tags origin main ${plan.tag} » ; si les refs locales sont correctes, relance : ${pushCommand}`,
        { cause: error },
      );
    }
    throw new Error(
      `Le commit ${plan.version} existe localement, mais la création du tag a échoué (${errorText(error)}). Vérifie « git tag --list ${plan.tag} », puis crée le tag annoté avec « git tag -a ${plan.tag} -m ${shellQuote(`Tinkerbolt ${plan.version}`)} » avant de relancer : ${pushCommand}`,
      { cause: error },
    );
  }
};
