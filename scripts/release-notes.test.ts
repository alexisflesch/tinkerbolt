import { describe, expect, it } from 'vitest';

import { extractPublishedReleaseNotes } from './release-notes';

const packageJson = '{"version":"0.2.0"}';
const changelog =
  '# Journal\n\n## [Non publié]\n\n- Future.\n\n## [0.2.0] - 2026-10-05\n\n### Ajouts\n\n- Nouveauté.\n\n## Référence initiale — 0.1.0\n\n- Ancien.\n';

describe('published release notes', () => {
  it('extracts only the tagged version notes, including CRLF files', () => {
    expect(extractPublishedReleaseNotes(packageJson, changelog, 'v0.2.0')).toBe(
      '### Ajouts\n\n- Nouveauté.',
    );
    expect(
      extractPublishedReleaseNotes(packageJson, changelog.replaceAll('\n', '\r\n'), 'v0.2.0'),
    ).toBe('### Ajouts\n\n- Nouveauté.');
  });

  it('rejects invalid tags and disagreement with the package version', () => {
    for (const tag of ['0.2.0', 'v0.2.0-rc.1', 'v0.3.0', 'v01.2.0']) {
      expect(() => extractPublishedReleaseNotes(packageJson, changelog, tag)).toThrow();
    }
  });

  it('rejects missing or ambiguous published sections', () => {
    expect(() => extractPublishedReleaseNotes(packageJson, '', 'v0.2.0')).toThrow(/section/iu);
    expect(() =>
      extractPublishedReleaseNotes(
        packageJson,
        changelog + '\n## [0.2.0] - 2026-10-06\n',
        'v0.2.0',
      ),
    ).toThrow(/section/iu);
  });
});
