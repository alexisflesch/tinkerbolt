import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import {
  updateLevelDescription,
  updateLevelTitle,
  type ConstructionAttempt,
} from '../application/construction';
import type { Command } from '../application/history';
import { MAX_TITLE_LENGTH, type LevelDocument } from '../domain/level-document';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

/** Mirrors the level description's length limit (`level-document.ts`). */
const MAX_LEVEL_DESCRIPTION_LENGTH = 2000;

type LevelInfoCommands = readonly Command<ConstructionAttempt>[];

interface LevelInfoDraft {
  readonly name: string;
  readonly description: string;
}

/** What the fields open on: the default title is shown as a placeholder, not as a name. */
const draftOf = ({ title, description }: LevelDocument['metadata'], defaultTitle: string) => ({
  name: title === defaultTitle ? '' : title,
  description: description ?? '',
});

/**
 * The author commands (undoable, like the export's M14) that record what was
 * typed. A blank name gives the default title back and a blank description is
 * removed.
 */
const levelInfoCommands = (
  { name, description }: LevelInfoDraft,
  defaultTitle: string,
): LevelInfoCommands => [
  updateLevelTitle({ context: 'author', title: name.trim() === '' ? defaultTitle : name.trim() }),
  updateLevelDescription({
    context: 'author',
    description: description.trim() === '' ? undefined : description.trim(),
  }),
];

function LevelInfoFields({
  draft,
  defaultTitle,
  onChange,
}: {
  readonly draft: LevelInfoDraft;
  readonly defaultTitle: string;
  readonly onChange: (draft: LevelInfoDraft) => void;
}) {
  return (
    <>
      <label className="export-link">
        <span className="export-link-label">Nom du niveau</span>
        <input
          className="export-link-field export-name-field"
          type="text"
          maxLength={MAX_TITLE_LENGTH}
          placeholder={defaultTitle}
          value={draft.name}
          onChange={(event) => {
            onChange({ ...draft, name: event.currentTarget.value });
          }}
        />
      </label>
      <label className="export-link">
        <span className="export-link-label">Description (facultatif)</span>
        <textarea
          className="export-link-field export-name-field"
          rows={3}
          maxLength={MAX_LEVEL_DESCRIPTION_LENGTH}
          placeholder="Ce que le joueur doit réussir, un indice…"
          value={draft.description}
          onChange={(event) => {
            onChange({ ...draft, description: event.currentTarget.value });
          }}
        />
      </label>
    </>
  );
}

/** The link leaves the workshop: its owner first waits for the pending saves. */
function MyLevelsLink({ onOpen }: { readonly onOpen: () => void }) {
  return (
    <Link
      to="/my-levels"
      onClick={(event) => {
        event.preventDefault();
        onOpen();
      }}
    >
      Mes niveaux
    </Link>
  );
}

function DialogActions({ children }: { readonly children: ReactNode }) {
  return <div className="level-result-actions">{children}</div>;
}

interface LevelInfoDialogProps {
  readonly metadata: LevelDocument['metadata'];
  /** The free workshop's title, which stands for « not named yet ». */
  readonly defaultTitle: string;
  readonly onClose: () => void;
  readonly onApply: (commands: LevelInfoCommands) => void;
  readonly onOpenMyLevels: () => void;
}

/**
 * ADR 0015 (amendment of 6 Oct. 2026): the workshop's pencil. Names and
 * describes the creation, and says where the autosaved level is found.
 */
export function LevelInfoDialog({
  metadata,
  defaultTitle,
  onClose,
  onApply,
  onOpenMyLevels,
}: LevelInfoDialogProps) {
  const [draft, setDraft] = useState(() => draftOf(metadata, defaultTitle));
  return (
    <Dialog title="Infos du niveau" closeLabel="Fermer les infos du niveau" onClose={onClose}>
      <LevelInfoFields draft={draft} defaultTitle={defaultTitle} onChange={setDraft} />
      <p className="panel-note">
        Ton niveau est enregistré automatiquement sur cet appareil. Tu le retrouves à tout moment
        dans <MyLevelsLink onOpen={onOpenMyLevels} />.
      </p>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          tone="go"
          onClick={() => {
            onApply(levelInfoCommands(draft, defaultTitle));
          }}
        >
          Valider
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface NewLevelDialogProps extends Omit<LevelInfoDialogProps, 'onApply'> {
  /** Called with the commands naming the level being left, none when it has a name. */
  readonly onConfirm: (commands: LevelInfoCommands) => void;
}

/**
 * ADR 0015 (amendment of 6 Oct. 2026): « Nouveau niveau » from the workshop.
 * Says that nothing is lost and, for a level still without a name, offers to
 * name it before leaving.
 */
export function NewLevelDialog({
  metadata,
  defaultTitle,
  onClose,
  onConfirm,
  onOpenMyLevels,
}: NewLevelDialogProps) {
  const isUntitled = metadata.title === defaultTitle;
  const [draft, setDraft] = useState(() => draftOf(metadata, defaultTitle));
  return (
    <Dialog title="Nouveau niveau ?" closeLabel="Fermer" onClose={onClose}>
      <p className="panel-note">
        Tu ne perds rien&nbsp;:{' '}
        {isUntitled ? 'ton niveau actuel' : <>«&nbsp;{metadata.title}&nbsp;»</>} est enregistré et
        t’attend dans <MyLevelsLink onOpen={onOpenMyLevels} />.
      </p>
      {isUntitled && (
        <>
          <p className="dialog-text">Donne-lui un nom pour le reconnaître plus tard&nbsp;:</p>
          <LevelInfoFields draft={draft} defaultTitle={defaultTitle} onChange={setDraft} />
        </>
      )}
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          tone="go"
          onClick={() => {
            onConfirm(isUntitled ? levelInfoCommands(draft, defaultTitle) : []);
          }}
        >
          Nouveau niveau
        </Button>
      </DialogActions>
    </Dialog>
  );
}
