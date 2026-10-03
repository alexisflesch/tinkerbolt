import { AppFrame } from '../ui/AppFrame';
export function StorageLoading({ title }: { readonly title: string }) {
  return (
    <AppFrame title={title} variant="page">
      <p className="panel-note" role="status">
        Chargement…
      </p>
    </AppFrame>
  );
}
