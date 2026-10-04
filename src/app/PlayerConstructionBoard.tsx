import { useCallback, useState, type ComponentProps } from 'react';
import type {
  PlayerConstructionSource,
  PlayerConstructionWriteResult,
} from '../application/construction/player-construction-repository';
import type { PlayerConstructionWriter } from '../application/construction/player-construction-writes';
import { createConstructionAttempt } from '../application/construction';
import { preparePlayerConstructionSource } from '../infrastructure/player-construction/player-construction-codec';
import { AppFrame } from '../ui/AppFrame';
import { Panel } from '../ui/Panel';
import { BoardShell } from './BoardShell';
import { StorageLoading } from './StorageLoading';
import { useStorageRead } from './use-storage-read';
import { usePlayerConstructionWrites } from './player-construction-context';

type Props = ComponentProps<typeof BoardShell> & {
  readonly scope: PlayerConstructionSource['scope'];
  readonly levelId: string | null;
};
const saveFailure = (code: string) =>
  code === 'quota-exceeded'
    ? 'Dernières modifications de ta construction non enregistrées : l’espace de stockage de cet appareil est plein.'
    : 'Dernières modifications de ta construction non enregistrées : le stockage de cet appareil est indisponible.';
const warningMessage = (warning: string | undefined) =>
  warning === 'source-changed'
    ? 'Le niveau a changé. Ta construction précédente a été effacée ; tu repars du niveau actuel.'
    : warning === 'invalid-data-backed-up'
      ? 'Ta construction était illisible. Une copie de secours a été conservée ; tu repars du niveau initial.'
      : undefined;

/** The route remains in loading until compatibility and construction reads finish. */
export function PlayerConstructionBoard(props: Props) {
  const [generation, setGeneration] = useState(0);
  if (props.levelId === null) return <BoardShell {...props} />;
  return (
    <StoredPlayerBoard
      key={generation}
      {...props}
      levelId={props.levelId}
      reload={() => {
        setGeneration((current) => current + 1);
      }}
    />
  );
}

function StoredPlayerBoard({
  scope,
  levelId,
  initialDocument,
  reload,
  notice,
  ...props
}: Props & { readonly levelId: string; readonly reload: () => void }) {
  const writes = usePlayerConstructionWrites();
  const [replacementWriter, setReplacementWriter] = useState<PlayerConstructionWriter | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | undefined>();
  const loaded = useStorageRead(
    useCallback(
      async (signal?: AbortSignal) => {
        const prepared = await preparePlayerConstructionSource(scope, levelId, initialDocument);
        if (prepared.status === 'error') return prepared;
        if (signal?.aborted === true)
          return { status: 'error', code: 'storage-unavailable' } as const;
        const writer = writes.open(prepared.source);
        const result = await writer.ready;
        return { ...result, writer, source: prepared.source };
      },
      [scope, levelId, initialDocument, writes],
    ),
  );
  if (loaded === null) return <StorageLoading title={props.title} />;
  if (loaded.status === 'error' && 'operation' in loaded) {
    return (
      <AppFrame title={props.title} subtitle={props.subtitle} variant="page">
        <div className="page-content">
          <Panel label="Construction" title="Construction à reprendre">
            <p role="alert">
              La construction du niveau précédent n’a pas pu être effacée. Libère de l’espace ou
              réactive le stockage, puis réessaie.
            </p>
            <button className="btn btn-neutral" type="button" onClick={reload}>
              Réessayer
            </button>
          </Panel>
        </div>
      </AppFrame>
    );
  }
  const writer = replacementWriter ?? ('writer' in loaded ? loaded.writer : null);
  const initialAttempt =
    loaded.status === 'ok'
      ? (loaded.attempt ?? createConstructionAttempt(initialDocument))
      : createConstructionAttempt(initialDocument);
  const memoryNotice =
    loaded.status === 'error'
      ? loaded.code === 'fingerprint-unavailable'
        ? 'Ta construction ne peut pas être reprise ni enregistrée sur cet appareil : l’empreinte du niveau est indisponible.'
        : 'Ta construction ne peut pas être reprise ni enregistrée : le stockage est indisponible ou incompatible. Tu peux jouer en mémoire.'
      : undefined;
  const report = (result: PlayerConstructionWriteResult | { readonly status: 'ignored' }) => {
    if (result.status !== 'ignored')
      setSaveNotice(result.status === 'error' ? saveFailure(result.code) : undefined);
  };
  return (
    <BoardShell
      {...props}
      initialDocument={initialDocument}
      initialAttempt={initialAttempt}
      notice={loaded.status === 'ok' ? (warningMessage(loaded.warning) ?? notice) : notice}
      saveNotice={memoryNotice ?? saveNotice}
      onAttemptCommitted={(attempt) => {
        if (writer !== null) void writer.save(attempt).then(report);
      }}
      beforeLeave={() => writes.flush()}
      beforeSimulation={async (attempt) => {
        if (writer !== null) report(await writer.save(attempt));
        await writes.flush();
      }}
      beforeRestart={
        writer === null
          ? undefined
          : async () => {
              const result = await writer.restart();
              report(result);
              if (result.status !== 'ok') return false;
              if ('source' in loaded) {
                const next = writes.open(loaded.source);
                const ready = await next.ready;
                setReplacementWriter(next);
                if (ready.status === 'error') setSaveNotice(saveFailure(ready.code));
              }
              return true;
            }
      }
    />
  );
}
