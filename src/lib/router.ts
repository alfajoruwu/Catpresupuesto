import { useSyncExternalStore } from 'react';

export interface Route {
  segments: string[];
}

function readRoute(): Route {
  const hash = window.location.hash.replace(/^#/, '');
  const segments = hash.split('/').filter((s) => s.length > 0);
  return { segments: segments.length === 0 ? ['home'] : segments };
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  listeners.forEach((l) => l());
}

window.addEventListener('hashchange', notify);

export function navigate(path: string, opts?: { replace?: boolean }): void {
  const hash = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
  if (opts?.replace) {
    window.location.replace(hash);
    notify();
  } else {
    window.location.hash = hash;
  }
}

export function useRoute(): Route {
  return useSyncExternalStore(
    subscribe,
    readRoute,
    () => ({ segments: ['home'] }),
  );
}
