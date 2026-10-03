import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ConstructionAttempt } from '../application/construction';
import { saveCreationFromLevel } from '../application/drafts/save-creation-from-level';
import { solutionFromAttempt } from '../application/puzzle/player-solution';
import type { LevelDocument } from '../domain/level-document';
import { useDraftRepository } from './draft-repository-context';
import { randomIdPart } from './random-id-part';

interface Remix {
  /** Saves the winning attempt (snapshot taken at launch) as a new creation and opens it. */
  readonly remix: (attempt: ConstructionAttempt) => void;
  /** Why the last remix could not be saved; `undefined` otherwise. */
  readonly error: string | undefined;
  readonly clearError: () => void;
}

/**
 * « Remixer » after a victory (ADR 0015 § Points d'entrée), for the campaign
 * and received levels: a new `creation-<aléa>` from the level, the winning
 * attempt posed to place, opened in the workshop.
 */
export function useRemix(level: LevelDocument): Remix {
  const drafts = useDraftRepository();
  const navigate = useNavigate();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [error, setError] = useState<string | undefined>(undefined);

  return {
    remix: (attempt) => {
      void (async () => {
        const result = await saveCreationFromLevel(drafts, level, {
          playerSolution: solutionFromAttempt(attempt),
          createId: randomIdPart,
        });
        if (!active.current) return;
        if (result.status === 'error') {
          setError(
            result.code === 'quota-exceeded'
              ? 'Le remix n’a pas pu être créé : l’espace de stockage de cet appareil est plein.'
              : 'Le remix n’a pas pu être créé : le stockage local de cet appareil est indisponible.',
          );
          return;
        }
        void navigate(`/editor?draft=${encodeURIComponent(result.draftId)}`);
      })();
    },
    error,
    clearError: () => {
      setError(undefined);
    },
  };
}
