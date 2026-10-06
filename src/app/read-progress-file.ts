import {
  decodeProgressFile,
  MAX_PROGRESS_FILE_SIZE_BYTES,
} from '../infrastructure/progress-file/progress-file-codec';
import type { CampaignProgress } from '../application/progression';

type ReadProgressFileResult =
  | { readonly status: 'ok'; readonly progress: CampaignProgress }
  | { readonly status: 'error'; readonly message: string };
const messages = {
  'too-large': 'Ce fichier dépasse la taille maximale de 256 Kio.',
  'invalid-json': 'Le fichier ne contient pas un JSON valide.',
  'unsupported-version': 'La version de cette progression n’est pas prise en charge.',
  'invalid-progress': 'Ce fichier ne contient pas une progression TinkerBolt valide.',
};

export const readProgressFile = async (
  file: Pick<File, 'size' | 'text'>,
): Promise<ReadProgressFileResult> => {
  if (file.size > MAX_PROGRESS_FILE_SIZE_BYTES)
    return { status: 'error', message: messages['too-large'] };
  try {
    const result = decodeProgressFile(await file.text());
    return result.status === 'ok' ? result : { status: 'error', message: messages[result.code] };
  } catch {
    return { status: 'error', message: 'Impossible de lire ce fichier.' };
  }
};
