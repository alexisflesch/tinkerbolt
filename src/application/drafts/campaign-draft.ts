import type { LevelDocument } from '../../domain/level-document';
import { revealAuthorSolution } from '../construction/authoring-commands';
import { createConstructionAttempt } from '../construction/construction-attempt';
import { creationFromLevel } from './creation-from-level';
import type {
  DraftCreationContent,
  DraftRepository,
  DraftRepositoryErrorCode,
} from './draft-repository';

type OpenCampaignDraftResult =
  | { readonly status: 'ok'; readonly draftId: string }
  | { readonly status: 'error'; readonly code: DraftRepositoryErrorCode };

interface OpenCampaignDraftOptions {
  /**
   * ADR 0015 § Révéler: under `pnpm dev`, a new creation of a campaign level
   * opens with the author's solution revealed, for calibration. An existing
   * creation is always reopened as is.
   */
  readonly revealSolution?: boolean;
}

/** U17: the draft of a campaign level never shares the embedded level's id. */
export const campaignDraftId = (level: LevelDocument): string => `${level.id}-brouillon`;

/** The M7 command, applied once: the same result as « Révéler » in the workshop. */
const withAuthorSolution = (creation: DraftCreationContent): DraftCreationContent => {
  const { source } = creation;
  if (source?.solution === undefined) return creation;
  const outcome = revealAuthorSolution({ context: 'author', source }).execute(
    createConstructionAttempt(creation.document),
  );
  return outcome.status === 'accepted'
    ? { ...creation, document: outcome.state.document }
    : creation;
};

/**
 * Opens the author's creation of a campaign level: an existing one is reopened
 * as is, so earlier adjustments survive; otherwise a creation is built from
 * the level (ADR 0015, no solution posed unless revealed) and saved with the
 * level as source.
 */
export const openCampaignDraft = async (
  repository: DraftRepository,
  level: LevelDocument,
  { revealSolution = false }: OpenCampaignDraftOptions = {},
): Promise<OpenCampaignDraftResult> => {
  const draftId = campaignDraftId(level);
  const existing = await repository.load(draftId);
  if (existing.status === 'error') return existing;
  if (existing.creation !== null) return { status: 'ok', draftId };

  const creation = creationFromLevel(level, { createId: () => draftId });
  const saved = await repository.save(revealSolution ? withAuthorSolution(creation) : creation);
  return saved.status === 'ok' ? { status: 'ok', draftId } : saved;
};
