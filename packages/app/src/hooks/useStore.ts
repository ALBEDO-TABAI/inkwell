import { useSyncExternalStore, useCallback } from 'react';
import { store } from '../store/store';
import type { Block } from '../store/model';

/** Subscribe to a single record; re-renders when that record changes. */
export function useBlock(id: string | undefined): Block | undefined {
  const sub = useCallback((f: () => void) => (id ? store.subscribeId(id, f) : () => {}), [id]);
  return useSyncExternalStore(sub, () => (id ? store.get(id) : undefined));
}
/** Subscribe to the store version (any change). */
export function useStoreVersion(): number {
  return useSyncExternalStore((f) => store.subscribe(f), () => store.version);
}
