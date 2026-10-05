import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import {
  Code2,
  ExternalLink,
  FileText,
  Gauge,
  Info,
  Package,
  RotateCcw,
  Save,
  UserRound,
  X,
} from 'lucide-react';

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

function SettingsPanelTitle({
  icon,
  children,
}: {
  readonly icon: ReactNode;
  readonly children: string;
}) {
  return (
    <>
      <span className="settings-panel-symbol" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </>
  );
}

/** U11: the remembered pseudonym (M14), shown, changed or forgotten. */
function PseudoSettings() {
  const preferences = usePreferencesRepository();
  const initial = useStorageRead(useCallback(() => preferences.load(), [preferences]));
  if (initial === null)
    return (
      <Panel
        label="Pseudo"
        title={<SettingsPanelTitle icon={<UserRound size={30} />}>Profil</SettingsPanelTitle>}
        className="settings-panel settings-panel-profile"
      >
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
    <Panel
      label="Pseudo"
      title={<SettingsPanelTitle icon={<UserRound size={30} />}>Profil</SettingsPanelTitle>}
      className="settings-panel settings-panel-profile"
    >
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

  const progressPercent =
    campaign.length === 0 ? 0 : Math.round((resolvedCount / campaign.length) * 100);

  return (
    <>
      <Panel
        label="Progression de la campagne"
        title={<SettingsPanelTitle icon={<Gauge size={30} />}>Progression</SettingsPanelTitle>}
        className="settings-panel settings-panel-progress"
      >
        {known && (
          <>
            <p className="settings-progress-caption">Progression de la campagne</p>
            <p className="settings-progress-count">{`Niveaux résolus : ${String(resolvedCount)} sur ${String(campaign.length)}.`}</p>
            <div className="settings-progress-meter">
              <progress
                max={campaign.length}
                value={resolvedCount}
                aria-label="Progression de la campagne"
              />
              <span>{`${String(progressPercent)} %`}</span>
            </div>
          </>
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

function AboutSettings() {
  return (
    <Panel
      label="À propos de TinkerBolt"
      title={<SettingsPanelTitle icon={<Info size={30} />}>À propos</SettingsPanelTitle>}
      className="settings-panel settings-panel-about"
    >
      <p className="settings-about-heading">À propos de TinkerBolt</p>
      <div className="settings-about-list">
        <dl className="settings-about-details">
          <div>
            <dt>
              <Package size={20} aria-hidden="true" />
              Version :
            </dt>
            <dd>1.0</dd>
          </div>
          <div>
            <dt>
              <FileText size={20} aria-hidden="true" />
              Licence :
            </dt>
            <dd>AGPL-3.0-or-later</dd>
          </div>
          <div>
            <dt>
              <Code2 size={20} aria-hidden="true" />
              Code source :
            </dt>
            <dd>dépôt sur la Forge</dd>
          </div>
        </dl>
        <a
          className="settings-repository-link"
          href="https://github.com/alexisflesch/tinkerbolt"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={20} aria-hidden="true" />
          Voir le dépôt
        </a>
      </div>
    </Panel>
  );
}

/**
 * `/settings` (ADR 0008), U11: profile and campaign controls, followed by
 * concise project information.
 */
export function SettingsPage() {
  return (
    <AppFrame title="Paramètres" variant="page">
      <div className="page-content settings-page">
        <PseudoSettings />
        <ProgressSettings />
        <AboutSettings />
      </div>
    </AppFrame>
  );
}
