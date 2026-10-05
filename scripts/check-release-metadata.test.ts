import { describe, expect, it } from 'vitest';

import { validateReleaseMetadata } from './check-release-metadata';

describe('validateReleaseMetadata', () => {
  it('accepts the current 0.1.0 reference and the Non publié section', () => {
    const changelog = [
      '# Journal des changements',
      '',
      '## [Non publié]',
      '',
      'Aucun changement notable pour le moment.',
      '',
      '## Référence initiale — 0.1.0',
    ].join('\n');

    expect(validateReleaseMetadata('0.1.0', changelog)).toEqual([]);
  });

  it('accepts a published section with a date', () => {
    expect(
      validateReleaseMetadata(
        '0.2.0',
        '# Journal des changements\n\n## [Non publié]\n\n## [0.2.0] - 2026-10-06',
      ),
    ).toEqual([]);
  });

  it('accepts a SemVer prerelease section', () => {
    expect(
      validateReleaseMetadata(
        '1.0.0-rc.1+build.5',
        '# Journal des changements\n\n## [Non publié]\n\n## [1.0.0-rc.1+build.5] - 2026-10-06',
      ),
    ).toEqual([]);
  });

  it('reports when the package version has no changelog section', () => {
    const changelog =
      '# Journal des changements\n\n## [Non publié]\n\n## Référence initiale — 0.1.0';

    expect(validateReleaseMetadata('0.1.1', changelog)).toContain(
      'Le changelog ne contient pas de section pour la version 0.1.1.',
    );
  });

  it('requires a Non publié section', () => {
    expect(validateReleaseMetadata('0.1.0', '## Référence initiale — 0.1.0')).toContain(
      'Le changelog doit contenir une section « Non publié ».',
    );
  });

  it('rejects a package version that is not SemVer', () => {
    expect(validateReleaseMetadata('0.1', '## [Non publié]')).toContain(
      'La version 0.1 de package.json n’est pas une version SemVer valide.',
    );
  });

  it('rejects a numeric component with a leading zero', () => {
    expect(validateReleaseMetadata('01.2.3', '## [Non publié]')).toContain(
      'La version 01.2.3 de package.json n’est pas une version SemVer valide.',
    );
  });
});
