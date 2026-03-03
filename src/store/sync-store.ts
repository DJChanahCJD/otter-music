import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storeKey } from './store-keys';
import { idbStorage } from '@/lib/storage-adapter';

interface SyncState {
  syncKey: string | null;
  lastSyncTime: number;

  setSyncKey: (key: string) => void;
  clearSyncKey: () => void;
  setLastSyncTime: (time: number) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      syncKey: null,
      lastSyncTime: 0,

      setSyncKey: (key) => set({ syncKey: key }),
      clearSyncKey: () => set({ syncKey: null }),
      setLastSyncTime: (time) => set({ lastSyncTime: time }),
    }),
    {
      name: storeKey.SyncStore,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        syncKey: state.syncKey,
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
);
