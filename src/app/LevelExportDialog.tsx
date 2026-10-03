import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Download, Link2 } from 'lucide-react';

import {
  updateLevelAuthor,
  updateLevelDescription,
  updateLevelTitle,
  type ConstructionAttempt,
} from '../application/construction';
import type { Command } from '../application/history';
import { rememberAuthor } from '../application/preferences/remember-author';
import { useStorageRead } from './use-storage-read';
import type { LevelDocument } from '../domain/level-document';
import type { PuzzleRunner } from '../application/puzzle/puzzle-workshop';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import {
  browserClipboard,
  downloadWithTemporaryLink,
  type DownloadFile,
  type WriteClipboard,
} from './browser-share';
import {
  createShareLink,
  nameExportedLevel,
  prepareLevelExport,
  pseudoRefusal,
} from './level-export';
import { usePreferencesRepository } from './preferences-repository-context';

/** Mirrors the level title's length limit (`level-document.ts`). */
const MAX_LEVEL_NAME_LENGTH = 160;

/** Mirrors the level description's length limit (`level-document.ts`). */
const MAX_LEVEL_DESCRIPTION_LENGTH = 2000;

/** ADR 0016 § Licence: the exact notice shown when sharing. */
const LICENCE_NOTICE =
  'En partageant ce niveau, tu le places sous licence CC BY 4.0 : d’autres pourront le modifier et le republier en te citant.';

interface LevelExportDialogProps {
  /** The author's committed document: never a simulation snapshot or a gesture preview. */
  readonly document: LevelDocument;
  readonly onClose: () => void;
  readonly origin?: string;
  readonly basePath?: string;
  /** Injected for tests; defaults to a Blob download through a temporary link. */
  readonly downloadFile?: DownloadFile;
  /** Injected for tests; defaults to `navigator.clipboard.writeText` when it exists. */
  readonly writeClipboard?: WriteClipboard | undefined;
  readonly run?: PuzzleRunner;
  /**
   * M14, M14b: called once per export with the author commands that record
   * the exported title, pseudonym and description in the creation (undoable
   * in the workshop).
   */
  readonly onApplyAttribution?: (commands: readonly Command<ConstructionAttempt>[]) => void;
}

type ShareState =
  | { readonly status: 'idle' }
  | { readonly status: 'working' }
  | { readonly status: 'copied'; readonly link: string }
  | { readonly status: 'manual'; readonly link: string }
  | { readonly status: 'failed' };

/**
 * U16: « Exporter » from the author mode. Downloads the L22 file or copies
 * the L23 `/shared` link, and explains instead when the document is invalid.
 * Every action is a plain button, so it works by touch alone.
 */
export function LevelExportDialog({
  document: levelDocument,
  onClose,
  origin = window.location.origin,
  basePath = import.meta.env.BASE_URL,
  downloadFile = downloadWithTemporaryLink,
  writeClipboard = browserClipboard(),
  run,
  onApplyAttribution,
}: LevelExportDialogProps) {
  const preferences = usePreferencesRepository();
  const [preparation] = useState(() => prepareLevelExport(levelDocument, run));
  const [name, setName] = useState(levelDocument.metadata.title);
  // A level that already names its author keeps it; otherwise the last pseudonym is offered.
  const [pseudo, setPseudo] = useState(levelDocument.metadata.author ?? '');
  const pseudoTouched = useRef(false);
  const remembered = useStorageRead(useCallback(() => preferences.load(), [preferences]));
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  useEffect(() => {
    if (remembered === null) return;
    if (
      remembered.status === 'ok' &&
      !pseudoTouched.current &&
      levelDocument.metadata.author === undefined
    )
      setPseudo(remembered.preferences.author ?? '');
    if (remembered.status === 'error')
      setStorageNotice('Le pseudo ne peut pas être lu sur cet appareil.');
  }, [remembered, levelDocument.metadata.author]);
  const [description, setDescription] = useState(levelDocument.metadata.description ?? '');
  const pseudoError = pseudoRefusal(pseudo);
  const named =
    preparation.status === 'ready'
      ? nameExportedLevel(preparation.puzzle, name, pseudo, description)
      : null;
  const pseudoHelpId = useId();
  const pseudoErrorId = useId();
  const [downloadedFileName, setDownloadedFileName] = useState<string | null>(null);
  const [share, setShare] = useState<ShareState>({ status: 'idle' });

  /**
   * M14, M14b: the exported title, pseudonym and description become the
   * creation's, and the pseudonym is kept. A blank description is removed.
   */
  const recordAttribution = async ({ metadata }: LevelDocument): Promise<void> => {
    onApplyAttribution?.([
      updateLevelTitle({ context: 'author', title: metadata.title }),
      updateLevelAuthor({ context: 'author', author: metadata.author }),
      updateLevelDescription({ context: 'author', description: metadata.description }),
    ]);
    const result = await rememberAuthor(preferences, metadata.author);
    setStorageNotice(
      result.status === 'ok' ? null : 'Ton pseudo n’a pas été enregistré sur cet appareil.',
    );
  };

  const copyShareLink = async (puzzle: LevelDocument): Promise<void> => {
    setShare({ status: 'working' });
    let link: string;
    try {
      link = await createShareLink(puzzle, origin, basePath);
    } catch {
      setShare({ status: 'failed' });
      return;
    }

    if (writeClipboard === undefined) {
      setShare({ status: 'manual', link });
      return;
    }
    try {
      await writeClipboard(link);
      setShare({ status: 'copied', link });
    } catch {
      setShare({ status: 'manual', link });
    }
  };

  return (
    <Dialog
      label="Exporter le niveau"
      title="Exporter"
      closeLabel="Fermer l’export"
      onClose={onClose}
    >
      {preparation.status === 'invalid' ? (
        <div className="export-invalid" role="alert">
          <p className="dialog-text">Ce niveau ne peut pas encore être exporté :</p>
          <ul className="export-reasons">
            {preparation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p className="panel-note">
            Puzzle vérifié. Envoie le fichier ou le lien : il ouvre le niveau avec les objets à
            placer dans le tiroir du joueur.
          </p>
          <label className="export-link">
            <span className="export-link-label">Nom du niveau</span>
            <input
              className="export-link-field export-name-field"
              type="text"
              maxLength={MAX_LEVEL_NAME_LENGTH}
              value={name}
              onChange={(event) => {
                setName(event.currentTarget.value);
              }}
            />
          </label>
          <label className="export-link">
            <span className="export-link-label">Description (facultatif)</span>
            <textarea
              className="export-link-field export-name-field"
              rows={3}
              maxLength={MAX_LEVEL_DESCRIPTION_LENGTH}
              value={description}
              onChange={(event) => {
                setDescription(event.currentTarget.value);
              }}
            />
          </label>
          {remembered === null && <p role="status">Chargement des préférences…</p>}
          {storageNotice !== null && <p role="alert">{storageNotice}</p>}
          <label className="export-link">
            <span className="export-link-label">Pseudo (facultatif)</span>
            <input
              className="export-link-field export-name-field"
              type="text"
              autoComplete="nickname"
              maxLength={40}
              value={pseudo}
              aria-invalid={pseudoError !== null}
              aria-describedby={
                pseudoError === null ? pseudoHelpId : `${pseudoHelpId} ${pseudoErrorId}`
              }
              onChange={(event) => {
                pseudoTouched.current = true;
                setPseudo(event.currentTarget.value);
              }}
            />
          </label>
          <p className="panel-note" id={pseudoHelpId}>
            Un pseudo, pas ton vrai nom
          </p>
          {pseudoError !== null && (
            <p className="export-field-error" id={pseudoErrorId} role="alert">
              {pseudoError}
            </p>
          )}
          <p className="panel-note">{LICENCE_NOTICE}</p>
          <Button
            disabled={named === null || remembered === null}
            onClick={() => {
              if (named === null) return;
              downloadFile(named.fileName, preparation.mimeType, named.fileText);
              void recordAttribution(named.puzzle).then(() => {
                setDownloadedFileName(named.fileName);
              });
            }}
          >
            <Download size={18} aria-hidden="true" />
            Télécharger le fichier
          </Button>
          <Button
            tone="go"
            disabled={named === null || remembered === null || share.status === 'working'}
            onClick={() => {
              if (named === null) return;
              void recordAttribution(named.puzzle).then(() => copyShareLink(named.puzzle));
            }}
          >
            <Link2 size={18} aria-hidden="true" />
            Copier le lien de partage
          </Button>
          <p className="export-status" role="status">
            {share.status === 'copied'
              ? 'Lien copié'
              : share.status === 'manual'
                ? 'Copie impossible : sélectionne le lien ci-dessous pour le copier.'
                : share.status === 'failed'
                  ? 'Ce niveau est trop grand pour un lien : télécharge le fichier.'
                  : downloadedFileName !== null
                    ? `Fichier ${downloadedFileName} téléchargé.`
                    : ''}
          </p>
          {share.status === 'manual' && (
            <label className="export-link">
              <span className="export-link-label">Lien de partage</span>
              <textarea
                className="export-link-field"
                readOnly
                rows={4}
                value={share.link}
                onFocus={(event) => {
                  event.currentTarget.select();
                }}
              />
            </label>
          )}
        </>
      )}
    </Dialog>
  );
}
