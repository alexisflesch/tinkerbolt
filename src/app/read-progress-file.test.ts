import { describe, expect, it, vi } from 'vitest';
import { readProgressFile } from './read-progress-file';
import { MAX_PROGRESS_FILE_SIZE_BYTES } from '../infrastructure/progress-file/progress-file-codec';

const valid = '{"kind":"progress","version":1,"data":{}}';
describe('lecture du fichier de progression', () => {
  it('valide le contenu et refuse une version inconnue', async () => {
    expect(await readProgressFile(new File([valid], 'progress.json'))).toEqual({
      status: 'ok',
      progress: {},
    });
    expect(
      await readProgressFile(
        new File([valid.replace('"version":1', '"version":2')], 'future.json'),
      ),
    ).toEqual({
      status: 'error',
      message: 'La version de cette progression n’est pas prise en charge.',
    });
  });
  it('borne le fichier avant lecture et traite un refus de lecture', async () => {
    const text = vi.fn(() => Promise.resolve(valid));
    expect(await readProgressFile({ size: MAX_PROGRESS_FILE_SIZE_BYTES + 1, text })).toEqual({
      status: 'error',
      message: 'Ce fichier dépasse la taille maximale de 256 Kio.',
    });
    expect(text).not.toHaveBeenCalled();
    expect(
      await readProgressFile({ size: 0, text: () => Promise.reject(new Error('refus')) }),
    ).toEqual({ status: 'error', message: 'Impossible de lire ce fichier.' });
  });
});
