import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Play } from 'lucide-react';

import { openCampaignDraft } from '../application/drafts/campaign-draft';
import { campaignChapters } from '../content/embedded-levels';
import type { LevelDocument } from '../domain/level-document';
import { AppFrame } from '../ui/AppFrame';
import { useDevelopmentMode } from './development-mode-context';
import { useDraftRepository } from './draft-repository-context';
import { StorageLoading } from './StorageLoading';
import { LevelCard } from './LevelCard';
import { LevelSection } from './LevelSection';
import { useCampaignProgress } from './use-campaign-progress';

/** Campaign chapters with their levels' global, 1-based campaign number. */
const numberedChapters = campaignChapters.reduce<
  readonly {
    readonly id: string;
    readonly title: string;
    readonly levels: readonly { readonly level: LevelDocument; readonly number: number }[];
  }[]
>((chapters, chapter) => {
  const firstNumber = chapters.reduce((count, { levels }) => count + levels.length, 0) + 1;
  return [
    ...chapters,
    {
      id: chapter.id,
      title: chapter.title,
      levels: chapter.levels.map((level, index) => ({ level, number: firstNumber + index })),
    },
  ];
}, []);

/**
 * `/levels` (ADR 0008): the campaign, chapter by chapter (U5). A locked level
 * stays visible but cannot be launched; a resolved one shows its tier
 * (ADR 0010). « Modifier » opens the level's creation (U17, ADR 0015),
 * disabled like « Jouer » while the level is locked. Each level is a
 * `LevelCard` (V6).
 */
export function LevelsPage() {
  const navigate = useNavigate();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const drafts = useDraftRepository();
  const {
    levels: levelProgress,
    unlockAllLevels,
    loading,
    known,
    storageError,
  } = useCampaignProgress();
  const developmentMode = useDevelopmentMode();
  const [opening, setOpening] = useState(false);
  const [draftErrorLevelId, setDraftErrorLevelId] = useState<string | null>(null);

  if (loading) return <StorageLoading title="Campagne" />;

  return (
    <AppFrame title="Campagne" variant="page">
      <div className="page-content page-content-levels">
        {opening && <p role="status">Chargement du brouillon…</p>}
        {storageError !== null && (
          <p role="alert">
            La progression ne peut pas être lue : le stockage est indisponible. Le niveau 1 reste
            jouable.
          </p>
        )}
        {unlockAllLevels && (
          <p className="panel-note dev-mode-note" role="status">
            Mode développement : niveaux débloqués
          </p>
        )}
        <section className="level-chapters" aria-label="Campagne">
          {numberedChapters.map((chapter, chapterIndex) => {
            const resolvedCount = chapter.levels.filter(
              ({ level }) => levelProgress[level.id]?.resolved === true,
            ).length;
            return (
              <LevelSection
                key={chapter.id}
                title={`Chapitre ${String(chapterIndex + 1)} · ${chapter.title}`}
                count={
                  known
                    ? `${String(resolvedCount)} / ${String(chapter.levels.length)} résolus`
                    : 'Progression inconnue'
                }
              >
                <div className="level-cards">
                  {chapter.levels.map(({ level, number }) => {
                    const progress = levelProgress[level.id];
                    const unlocked = progress?.unlocked === true;
                    return (
                      <LevelCard
                        key={level.id}
                        document={level}
                        label={`Niveau ${String(number)}`}
                        number={number}
                        tier={progress?.tier ?? null}
                        locked={!unlocked}
                        primary={{
                          label: 'Jouer',
                          name: `Jouer le niveau ${String(number)}`,
                          icon: Play,
                          onSelect: () => {
                            void navigate(`/levels/${level.id}/play`);
                          },
                        }}
                        actions={[
                          // U17, M11: the author edits a creation; the embedded level and progress stay untouched. A locked level is not editable (ADR 0015).
                          {
                            label: 'Modifier dans l’Atelier',
                            name: `Modifier le niveau ${String(number)}`,
                            icon: Pencil,
                            onSelect: () => {
                              setOpening(true);
                              void (async () => {
                                const result = await openCampaignDraft(drafts, level, {
                                  revealSolution: developmentMode,
                                });
                                if (!active.current) return;
                                if (result.status === 'error') {
                                  setOpening(false);
                                  setDraftErrorLevelId(level.id);
                                  return;
                                }
                                void navigate(
                                  `/editor?draft=${encodeURIComponent(result.draftId)}`,
                                );
                              })();
                            },
                          },
                        ]}
                      />
                    );
                  })}
                </div>
                {chapter.levels.some(({ level }) => draftErrorLevelId === level.id) && (
                  <p className="panel-note" role="alert">
                    Impossible de créer le brouillon : le stockage local est indisponible.
                  </p>
                )}
              </LevelSection>
            );
          })}
        </section>
      </div>
    </AppFrame>
  );
}
