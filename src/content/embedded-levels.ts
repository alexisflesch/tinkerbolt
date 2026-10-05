import tutorial1 from './levels/tuto-1.json';
import tutorial2 from './levels/tuto-2.json';
import tutorial3 from './levels/tuto-3.json';
import tutorial4 from './levels/tuto-4.json';
import tutorial5 from './levels/tuto-5.json';
import tutorial6 from './levels/tuto-6.json';
import tutorial7 from './levels/tuto-7.json';
import workshop from './levels/workshop.json';

import { levelDocumentSchema, type LevelDocument } from '../domain/level-document';

const parseEmbeddedLevel = (value: unknown): LevelDocument => levelDocumentSchema.parse(value);

export interface CampaignChapter {
  readonly id: string;
  readonly title: string;
  readonly levels: readonly LevelDocument[];
}

/** Validates chapter and level identifiers across one ordered campaign. */
export const createCampaign = (
  chapters: readonly CampaignChapter[],
): readonly CampaignChapter[] => {
  const identifiers = new Map<string, 'chapter' | 'level'>();

  for (const chapter of chapters) {
    const previousChapterId = identifiers.get(chapter.id);
    if (previousChapterId !== undefined) {
      throw new Error(
        `L’identifiant de chapitre « ${chapter.id} » est déjà utilisé dans la campagne.`,
      );
    }
    identifiers.set(chapter.id, 'chapter');

    for (const level of chapter.levels) {
      const previousIdentifier = identifiers.get(level.id);
      if (previousIdentifier !== undefined) {
        throw new Error(
          `L’identifiant de niveau « ${level.id} » est déjà utilisé dans la campagne.`,
        );
      }
      identifiers.set(level.id, 'level');
    }
  }

  return chapters;
};

export const campaignChapters = createCampaign([
  {
    id: 'tutoriels',
    title: 'Premiers pas',
    levels: [
      parseEmbeddedLevel(tutorial1),
      parseEmbeddedLevel(tutorial2),
      parseEmbeddedLevel(tutorial3),
      parseEmbeddedLevel(tutorial4),
      parseEmbeddedLevel(tutorial5),
      parseEmbeddedLevel(tutorial6),
      parseEmbeddedLevel(tutorial7),
    ],
  },
]);

export const flattenCampaignLevels = (
  chapters: readonly CampaignChapter[],
): readonly LevelDocument[] => chapters.flatMap(({ levels }) => levels);

/**
 * Compatibility list derived from the ordered chapters. The workshop is a
 * validated embedded document, but it does not belong to the campaign.
 */
export const embeddedLevels: readonly LevelDocument[] = flattenCampaignLevels(campaignChapters);

export const nextCampaignLevel = (
  levelId: string,
  chapters: readonly CampaignChapter[] = campaignChapters,
): LevelDocument | undefined => {
  const levels = flattenCampaignLevels(chapters);
  const currentIndex = levels.findIndex((level) => level.id === levelId);
  return currentIndex < 0 ? undefined : levels[currentIndex + 1];
};

/**
 * The free-form creation starting point (ADR 0007 - `App.tsx:80-132` in
 * pixel units is retired). It is a validated embedded document exactly like a
 * campaign level, but it is explicitly not campaign content: `App.tsx`
 * must not list it in the level list, and no code should infer "is the
 * workshop" from `id` string matching elsewhere.
 */
export const embeddedWorkshopDocument: LevelDocument = parseEmbeddedLevel(workshop);
