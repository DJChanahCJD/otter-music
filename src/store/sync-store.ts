import { create } from 'zustand';
import { persist, type StorageValue } from 'zustand/middleware';
import { storeKey } from './store-keys';
import { idbStorage } from '@/lib/storage-adapter';
import { encryptString, decryptString } from '@/lib/crypto-storage';

interface SyncState {
  syncKey: string | null;
  lastSyncTime: number;

  setSyncKey: (key: string) => void;
  clearSyncConfig: () => void;
  setLastSyncTime: (time: number) => void;
}

type PersistedState = { syncKey: string | null; lastSyncTime: number };

/**
 * 在 idbStorage 基础上透明加密 syncKey 字段。
 * 其余字段（lastSyncTime）明文存储，只有敏感密钥密文落盘。
 */
const encryptedSyncStorage = {
  getItem: async (name: string): Promise<StorageValue<PersistedState> | null> => {
    const raw = await idbStorage.getItem(name);
    if (!raw) return null;
    const parsed: StorageValue<PersistedState> = JSON.parse(raw);
    const encryptedKey = parsed.state?.syncKey;
    if (encryptedKey) {
      try {
        parsed.state.syncKey = await decryptString(encryptedKey);
      } catch {
        // 可能是旧版明文数据，直接使用原值
      }
    }
    return parsed;
  },
  setItem: async (name: string, value: StorageValue<PersistedState>): Promise<void> => {
    const toStore = structuredClone(value);
    if (toStore.state.syncKey) {
      toStore.state.syncKey = await encryptString(toStore.state.syncKey);
    }
    await idbStorage.setItem(name, JSON.stringify(toStore));
  },
  removeItem: async (name: string): Promise<void> => {
    await idbStorage.removeItem(name);
  },
};

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      syncKey: null,
      lastSyncTime: 0,

      setSyncKey: (key) => set({ syncKey: key }),
      clearSyncConfig: () => set({ syncKey: null, lastSyncTime: 0 }),
      setLastSyncTime: (time) => set({ lastSyncTime: time }),
    }),
    {
      name: storeKey.SyncStore,
      storage: encryptedSyncStorage,
      partialize: (state) => ({
        syncKey: state.syncKey,
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
);
