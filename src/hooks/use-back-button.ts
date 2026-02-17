import { useEffect } from 'react';
import { App } from '@capacitor/app';

export function useBackButton(callback: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    let handler: { remove: () => void } | null = null;

    App.addListener('backButton', callback).then((listenerHandle) => {
      handler = listenerHandle;
    });

    return () => {
      if (handler) {
        handler.remove();
      }
    };
  }, [callback, enabled]);
}
