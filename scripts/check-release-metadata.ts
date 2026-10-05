import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const semVerPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export const isValidSemVer = (value: string): boolean => semVerPattern.test(value);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const validateReleaseMetadata = (
  packageVersion: string,
  changelog: string,
): readonly string[] => {
  const errors: string[] = [];

  if (!isValidSemVer(packageVersion)) {
    errors.push(
      `La version ${packageVersion} de package.json n’est pas une version SemVer valide.`,
    );
    return errors;
  }

  const headings = changelog.split(/\r?\n/).filter((line) => line.startsWith('## '));
  if (!headings.includes('## [Non publié]')) {
    errors.push('Le changelog doit contenir une section « Non publié ».');
  }

  const escapedVersion = escapeRegExp(packageVersion);
  const isCurrentVersionHeading = (heading: string): boolean =>
    new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`).test(heading) ||
    new RegExp(`^## Référence initiale — ${escapedVersion}$`).test(heading);

  if (!headings.some(isCurrentVersionHeading)) {
    errors.push(`Le changelog ne contient pas de section pour la version ${packageVersion}.`);
  }

  return errors;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const runReleaseMetadataCheck = (): void => {
  const packagePath = new URL('../package.json', import.meta.url);
  const packageContents: unknown = JSON.parse(readFileSync(packagePath, 'utf8'));
  if (!isRecord(packageContents) || typeof packageContents.version !== 'string') {
    throw new Error('package.json doit déclarer une version texte.');
  }

  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const errors = validateReleaseMetadata(packageContents.version, changelog);
  if (errors.length > 0) {
    console.error('Contrôle version/changelog échoué :');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Version ${packageContents.version} cohérente avec CHANGELOG.md.`);
};

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) runReleaseMetadataCheck();
