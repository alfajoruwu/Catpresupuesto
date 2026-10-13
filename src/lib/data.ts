import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

let version = 0;
const versionListeners = new Set<() => void>();

export function invalidate(): void {
  version += 1;
  versionListeners.forEach((l) => l());
}

export interface QueryResult<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload(): void;
}

export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]): QueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState(0);
  const globalVersion = useSyncExternalStore(
    (listener) => {
      versionListeners.add(listener);
      return () => {
        versionListeners.delete(listener);
      };
    },
    () => version,
    () => version,
  );
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((result) => {
        if (seq.current !== id) return;
        setData(result);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (seq.current !== id) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, reloadKey, globalVersion]);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  return { data, error, loading, reload };
}
