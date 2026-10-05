import { useEffect } from 'react';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';

type ImportToastProps = Readonly<{
  notice: Readonly<{ tone: 'status' | 'alert'; message: string }>;
  onDismiss: () => void;
}>;

/** Import feedback stays outside the page flow and never takes keyboard focus. */
export function ImportToast({ notice, onDismiss }: ImportToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 6000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notice, onDismiss]);

  const Icon = notice.tone === 'alert' ? TriangleAlert : CircleCheck;
  return (
    <div className={`import-toast import-toast-${notice.tone}`}>
      <Icon size={24} aria-hidden="true" />
      <p role={notice.tone} aria-atomic="true">
        {notice.message}
      </p>
      <button
        type="button"
        className="import-toast-close"
        aria-label="Fermer la notification"
        onClick={onDismiss}
      >
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
