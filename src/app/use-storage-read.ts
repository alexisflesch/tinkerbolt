import { useEffect, useState } from 'react';

/** A route owns its read; an unmounted reader cannot replace the next route's state. */
export function useStorageRead<T>(read: (signal?: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<
    T | { readonly status: 'error'; readonly code: 'storage-unavailable' } | null
  >(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setResult(null);
    void Promise.resolve()
      .then(() => read(controller.signal))
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active) setResult({ status: 'error', code: 'storage-unavailable' });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [read]);
  return result;
}
