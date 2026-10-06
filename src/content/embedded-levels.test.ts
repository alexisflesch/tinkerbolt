import { describe, expect, it } from 'vitest';

import {
  campaignChapters,
  createCampaign,
  embeddedLevels,
  embeddedWorkshopDocument,
  flattenCampaignLevels,
  nextCampaignLevel,
} from './embedded-levels';
import { levelDocumentSchema } from '../domain/level-document';
import { playSolution } from '../application/puzzle/puzzle-workshop';
import { runLevel } from './level-regression';
import { createSimulationSession } from '../simulation/simulation-session';

const expectedIds = ['tuto-1', 'tuto-2', 'tuto-3', 'tuto-4', 'tuto-5', 'tuto-6', 'tuto-7'] as const;

describe('campagne embarquée', () => {
  it('publie les sept tutoriels de Bolt dans leur ordre, à la place des esquisses (N2)', () => {
    expect(campaignChapters.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'tutoriels', title: 'Premiers pas' },
    ]);
    expect(embeddedLevels.map(({ id }) => id)).toEqual(expectedIds);
    expect(campaignChapters.map(({ levels }) => levels.length)).toEqual([7]);
    expect(flattenCampaignLevels(campaignChapters)).toEqual(embeddedLevels);
  });

  it('porte une description courte, l’auteur Bolt et une scène libre de restrictions (N2)', () => {
    expect(embeddedLevels).toHaveLength(expectedIds.length);
    for (const level of embeddedLevels) {
      expect(level.metadata.author).toBe('Bolt');
      expect(level.metadata.description?.length).toBeGreaterThan(10);
      expect(level.metadata.description).not.toMatch(/Esquisse|création libre|à écrire/);
      expect(level.challenge).toBeUndefined();
      expect(level.solution).toBeDefined();
      expect(
        level.objects.every(
          ({ permissions }) => !permissions.move && !permissions.rotate && !permissions.remove,
        ),
      ).toBe(true);
      expect(level.scene).toEqual({ min: { x: 0, y: 0 }, max: { x: 16, y: 9 } });
      expect(level.buildZones).toEqual([level.scene]);
    }
  });

  it.each(expectedIds)(
    'la solution du joueur gagne dans %s, et le décor seul ne gagne pas (N2)',
    (id) => {
      const level = embeddedLevels.find((candidate) => candidate.id === id);
      if (level === undefined || level.solution === undefined)
        throw new Error(`Solution absente : ${id}`);
      const attempt = playSolution(level, level.solution);
      expect(attempt).not.toBeNull();
      if (attempt === null) return;
      expect(runLevel(attempt.document).outcome).toBe('succeeded');
      expect(runLevel(level).outcome).not.toBe('succeeded');
    },
  );

  it('garde le bouton sous la masse et le ventilateur en marche jusqu’à la victoire du tutoriel 3', () => {
    const level = embeddedLevels.find(({ id }) => id === 'tuto-3');
    if (level?.solution === undefined) throw new Error('Tutoriel 3 sans solution.');
    const attempt = playSolution(level, level.solution);
    if (attempt === null) throw new Error('Solution du tutoriel 3 refusée.');
    const session = createSimulationSession(attempt.document, { fixedStepSeconds: 1 / 60 });
    let heldSteps = 0;
    try {
      for (let step = 0; step < 1_200; step += 1) {
        session.advanceFixedSteps(1);
        const devices = session.readState().devices;
        const button = devices.find((device) => device.kind === 'button');
        if (button?.kind !== 'button') throw new Error('Bouton du tutoriel 3 absent.');
        if (button.pressed) heldSteps += 1;
        if (heldSteps > 0) {
          expect(button.pressed).toBe(true);
          expect(devices.find((device) => device.kind === 'fan')).toMatchObject({ running: true });
        }
        if (session.readGoalEvaluation().status === 'succeeded') break;
      }
      expect(heldSteps).toBeGreaterThan(60);
      expect(session.readGoalEvaluation().status).toBe('succeeded');
    } finally {
      session.destroy();
    }
  });

  it('ne publie pas le niveau 15 reporté dans la campagne', () => {
    expect(embeddedLevels.some(({ metadata }) => metadata.title === 'Prenez votre temps')).toBe(
      false,
    );
  });

  it('donne le niveau suivant dans l’ordre, puis aucun après le dernier', () => {
    const first = embeddedLevels[0];
    const second = embeddedLevels[1];
    const last = embeddedLevels.at(-1);
    if (first === undefined || second === undefined || last === undefined) {
      throw new Error('La campagne doit contenir ses tutoriels.');
    }

    expect(nextCampaignLevel(first.id)).toBe(second);
    expect(nextCampaignLevel(last.id)).toBeUndefined();
    expect(nextCampaignLevel('unknown-level')).toBeUndefined();
  });

  it('refuse les identifiants de chapitre ou de niveau dupliqués sur toute la campagne', () => {
    const level = embeddedLevels[0];
    if (level === undefined) throw new Error('Le premier niveau est absent.');

    expect(() =>
      createCampaign([
        { id: 'chapter-one', title: 'Premier', levels: [level] },
        { id: 'chapter-two', title: 'Second', levels: [level] },
      ]),
    ).toThrow(/identifiant de niveau/);
    expect(() =>
      createCampaign([
        { id: 'same-chapter', title: 'Premier', levels: [] },
        { id: 'same-chapter', title: 'Second', levels: [] },
      ]),
    ).toThrow(/identifiant de chapitre/);
  });
});

describe('atelier libre embarqué (M14b)', () => {
  it('n’a pas de description : une création partie de zéro n’en hérite pas', () => {
    expect(embeddedWorkshopDocument.metadata).toEqual({ title: 'Sans titre' });
    expect('description' in embeddedWorkshopDocument.metadata).toBe(false);
  });
});

describe('niveaux embarqués', () => {
  it('expose des documents v2 valides et conserve les documents hors campagne hors liste', () => {
    for (const level of embeddedLevels) {
      expect(levelDocumentSchema.safeParse(level).success).toBe(true);
    }
    expect(embeddedLevels.some((level) => level.id === embeddedWorkshopDocument.id)).toBe(false);
    expect(embeddedLevels.map((level) => level.id)).not.toContain('free-workshop');
  });
});
