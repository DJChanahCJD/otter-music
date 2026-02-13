import { useSyncExternalStore } from 'react';

export function useMounted() {
  const isMounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  return isMounted;
}