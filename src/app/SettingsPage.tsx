import { useCallback, useId, useRef, useState } from 'react';
import { RotateCcw, Save, X } from 'lucide-react';

import { rememberAuthor } from '../application/preferences/remember-author';
import { AppFrame } from '../ui/AppFrame';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Panel } from '../ui/Panel';
import { useStorageRead } from './use-storage-read';
import { pseudoRefusal } from './level-export';
import { usePreferencesRepository } from './preferences-repository-context';
import { useCampaignProgress } from './use-campaign-progress';

/** Mirrors the pseudonym's length limit (`level-document.ts`), like the export dialog (M14). */
const MAX_PSEUDO_LENGTH = 40;

const storageMessage = (code: string): string =>
  code === 'quota-exceeded'
    ? 'L’espace de stockage de cet appareil est plein.'
    : 'Le stockage local de cet appareil est indisponible.';

type Notice = { readonly tone: 'status' | 'alert'; readonly message: string } | null;

/** U11: the remembered pseudonym (M14), shown, changed or forgotten. */
function PseudoSettings() {
  const preferences = usePreferencesRepository();
  const initial = useStorageRead(useCallback(() => preferences.load(), [preferences]));
  if (initial === null)
    return (
      <Panel title="Pseudo">
        <p role="status">Chargement des préférences…</p>
      </Panel>
    );
  return (
    <PseudoForm
      initialAuthor={initial.status === 'ok' ? (initial.preferences.author ?? '') : ''}
      initialError={initial.status === 'error' ? initial.code : null}
    />
  );
}

function PseudoForm({
  initialAuthor,
  initialError,
}: {
  readonly initialAuthor: string;
  readonly initialError: string | null;
}) {
  const preferences = usePreferencesRepository();
  const [remembered, setRemembered] = useState(initialAuthor);
  const [pseudo, setPseudo] = useState(initialAuthor);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(() =>
    initialError === null
      ? null
      : {
          tone: 'alert',
          message: `${storageMessage(initialError)} Ton pseudo ne peut pas être lu.`,
        },
  );
  const pseudoError = pseudoRefusal(pseudo);
  const helpId = useId();
  const errorId = useId();

  /** M14's rule: edge spaces removed, an empty field forgets the pseudonym. */
  const remember = async (typed: string): Promise<void> => {
    setSaving(true);
    const author = typed.trim();
    const result = await rememberAuthor(preferences, author === '' ? undefined : author);
    setSaving(false);
    if (result.status === 'error') {
      setNotice({
        tone: 'alert',
        message: `${storageMessage(result.code)} Ton pseudo n’a pas été enregistré.`,
      });
      return;
    }
    setRemembered(author);
    setPseudo(author);
    setNotice({ tone: 'status', message: author === '' ? 'Pseudo effacé.' : 'Pseudo enregistré.' });
  };

  return (
    <Panel title="Pseudo">
      <label className="export-link">
        <span className="export-link-label">Pseudo retenu</span>
        <input
          className="export-link-field export-name-field"
          type="text"
          autoComplete="nickname"
          maxLength={MAX_PSEUDO_LENGTH}
          value={pseudo}
          aria-invalid={pseudoError !== null}
          aria-describedby={pseudoError === null ? helpId : `${helpId} ${errorId}`}
          onChange={(event) => {
            setPseudo(event.currentTarget.value);
            setNotice(null);
          }}
        />
      </label>
      <p className="panel-note" id={helpId}>
        Un pseudo, pas ton vrai nom. Il préremplit le partage de tes niveaux.
      </p>
      {pseudoError !== null && (
        <p className="export-field-error" id={errorId} role="alert">
          {pseudoError}
        </p>
      )}
      <div className="level-result-actions">
        <Button
          tone="go"
          disabled={pseudoError !== null || saving}
          onClick={() => {
            void remember(pseudo);
          }}
        >
          <Save size={18} aria-hidden="true" />
          Enregistrer le pseudo
        </Button>
        <Button
          disabled={saving || (remembered === '' && pseudo === '')}
          onClick={() => {
            void remember('');
          }}
        >
          <X size={18} aria-hidden="true" />
          Effacer le pseudo
        </Button>
      </div>
      {notice !== null && (
        <p
          className={notice.tone === 'alert' ? 'export-field-error' : 'panel-note'}
          role={notice.tone}
        >
          {notice.message}
        </p>
      )}
    </Panel>
  );
}

/** U11 (ADR 0010, ADR 0011): forgets the campaign progress only, after confirmation. */
function ProgressSettings() {
  const { levels, loading, known, storageError, resetCampaignProgress } = useCampaignProgress();
  const [isConfirming, setIsConfirming] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [resetting, setResetting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const campaign = Object.values(levels);
  const resolvedCount = campaign.filter(({ resolved }) => resolved).length;

  const confirmReset = async (): Promise<void> => {
    setResetting(true);
    const result = await resetCampaignProgress();
    setResetting(false);
    setIsConfirming(false);
    setNotice(
      result.status === 'ok'
        ? { tone: 'status', message: 'Progression remise à zéro : seul le niveau 1 est ouvert.' }
        : {
            tone: 'alert',
            message: `${storageMessage(result.code)} La progression n’a pas été effacée.`,
          },
    );
  };

  return (
    <>
      <Panel title="Progression de la campagne">
        {known && (
          <p className="panel-note">{`Niveaux résolus : ${String(resolvedCount)} sur ${String(campaign.length)}.`}</p>
        )}
        {!loading && !known && (
          <p className="panel-note" role="alert">
            La progression ne peut pas être lue sur cet appareil.
          </p>
        )}
        {known && storageError !== null && notice === null && (
          <p role="alert">La progression ne peut pas être enregistrée sur cet appareil.</p>
        )}
        <Button
          tone="reset"
          disabled={loading || resetting}
          onClick={() => {
            setNotice(null);
            setIsConfirming(true);
          }}
        >
          <RotateCcw size={18} aria-hidden="true" />
          Remettre la progression à zéro
        </Button>
        {notice !== null && (
          <p
            className={notice.tone === 'alert' ? 'export-field-error' : 'panel-note'}
            role={notice.tone}
          >
            {notice.message}
          </p>
        )}
      </Panel>
      {isConfirming && (
        <Dialog
          title="Remettre la progression à zéro ?"
          closeLabel="Fermer sans remettre à zéro"
          initialFocusRef={cancelRef}
          onClose={() => {
            setIsConfirming(false);
          }}
        >
          <p className="dialog-text">
            Sur cet appareil, les niveaux résolus de la campagne et leurs records, leurs solutions
            et toutes les constructions de campagne seront effacés. Seul le niveau 1 restera ouvert.
            Tes créations, tes niveaux reçus et ton pseudo sont conservés. Une création faite avec «
            Modifier le niveau » d’un niveau qui redevient verrouillé ne s’ouvrira qu’une fois ce
            niveau débloqué à nouveau.
          </p>
          <div className="level-result-actions">
            <Button
              ref={cancelRef}
              onClick={() => {
                setIsConfirming(false);
              }}
            >
              Annuler
            </Button>
            <Button
              tone="reset"
              disabled={resetting}
              onClick={() => {
                void confirmReset();
              }}
            >
              <RotateCcw size={18} aria-hidden="true" />
              Remettre à zéro
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

/**
 * `/settings` (ADR 0008), U11: the remembered pseudonym and the campaign
 * progress reset — nothing else, until a real need asks for another setting.
 */
export function SettingsPage() {
  return (
    <AppFrame title="Paramètres" variant="page">
      <div className="page-content settings-page">
        <PseudoSettings />
        <ProgressSettings />
      </div>
    </AppFrame>
  );
}
