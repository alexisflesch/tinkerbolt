import { describe, expect, it } from 'vitest';

import { embeddedLevels } from '../content/embedded-levels';
import { levelDocumentSchema } from '../domain/level-document';
import { withSolutionPlaced } from './home-hero';

const tutorial5 = embeddedLevels.find(({ id }) => id === 'tuto-5');

describe('niveau résolu de l’accueil', () => {
  it('pose la solution de référence sur le plateau, sans marque « à placer »', () => {
    if (tutorial5 === undefined) throw new Error('Tutoriel 5 introuvable.');

    const solved = withSolutionPlaced(tutorial5);

    const added = solved.objects.slice(tutorial5.objects.length);
    expect(solved.scene.min.y).toBeCloseTo(tutorial5.scene.min.y + 0.75);
    expect(solved.scene.max.y).toBeCloseTo(tutorial5.scene.max.y + 0.75);
    expect(added.map(({ type }) => type)).toEqual(['ball', 'springboard']);
    expect(added.map(({ transform }) => transform)).toEqual(
      tutorial5.solution?.placements.map(({ transform }) => transform),
    );
    expect(solved.objects.slice(0, tutorial5.objects.length)).toEqual(tutorial5.objects);
    expect(new Set(solved.objects.map(({ id }) => id)).size).toBe(solved.objects.length);
    expect(solved.wires.map(({ sourceId, targetId }) => [sourceId, targetId])).toEqual([
      ['placement-9', 'placement-4'],
      ['placement-9', 'placement-11'],
    ]);
    expect(solved.objects.some((object) => 'toPlace' in object)).toBe(false);
    expect(solved.wires.some((wire) => 'toPlace' in wire)).toBe(false);
  });

  it('reste un document de niveau valide, sans solution à rejouer', () => {
    if (tutorial5 === undefined) throw new Error('Tutoriel 5 introuvable.');

    const solved = withSolutionPlaced(tutorial5);

    expect(solved.solution).toBeUndefined();
    expect(levelDocumentSchema.safeParse(solved).success).toBe(true);
  });

  it('ne modifie pas le niveau embarqué et rend tel quel un niveau sans solution', () => {
    if (tutorial5 === undefined) throw new Error('Tutoriel 5 introuvable.');
    const before = structuredClone(tutorial5);

    withSolutionPlaced(tutorial5);

    expect(tutorial5).toEqual(before);
    const { solution, ...unsolved } = tutorial5;
    void solution;
    expect(withSolutionPlaced(unsolved)).toBe(unsolved);
  });
});
