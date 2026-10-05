import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseReleaseArgs } from './release-core';

export const extractPublishedReleaseNotes = (
  packageJson: string,
  changelog: string,
  tag: string,
): string => {
  if (!tag.startsWith('v')) throw new Error('Le tag doit commencer par v.');
  const { version } = parseReleaseArgs([tag.slice(1)]);
  const parsed: unknown = JSON.parse(packageJson);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    parsed.version !== version
  ) {
    throw new Error('La version de package.json doit correspondre au tag publié.');
  }

  const lines = changelog.split(/\r?\n/);
  const headings = lines.flatMap((line, index) =>
    line.startsWith(`## [${version}] - `) ? [index] : [],
  );
  const start = headings[0];
  if (headings.length !== 1 || start === undefined) {
    throw new Error(`Une seule section publiée ${version} est requise dans CHANGELOG.md.`);
  }
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines
    .slice(start + 1, end < 0 ? lines.length : end)
    .join('\n')
    .trim();
};

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const tag = process.argv[2];
    if (tag === undefined || process.argv.length !== 3) {
      throw new Error('Indiquer un seul tag, par exemple v0.2.0.');
    }
    console.log(
      extractPublishedReleaseNotes(
        readFileSync('package.json', 'utf8'),
        readFileSync('CHANGELOG.md', 'utf8'),
        tag,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
