import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LocalMusicFile } from '@/plugins/local-music';
import { storeKey } from '.';

interface LocalMusicState {
  files: LocalMusicFile[];
  timestamp: number;
  scanType: 'quick' | 'full';
  setFiles: (files: LocalMusicFile[], scanType: 'quick' | 'full') => void;
  updateFiles: (updater: (files: LocalMusicFile[]) => LocalMusicFile[]) => void;
  clear: () => void;
}

const CACHE_TTL = 24 * 60 * 60 * 1000;  // 1天

function isExpired(timestamp: number): boolean {
  return Date.now() - timestamp > CACHE_TTL;
}

export const useLocalMusicStore = create<LocalMusicState>()(
  persist(
    (set, get) => ({
      files: [],
      timestamp: 0,
      scanType: 'quick',
      setFiles: (files, scanType) => set({ files, timestamp: Date.now(), scanType }),
      updateFiles: (updater) => set((state) => ({ files: updater(state.files) })),
      clear: () => set({ files: [], timestamp: 0, scanType: 'quick' }),
    }),
    {
      name: storeKey.LocalMusicStore,
      partialize: (state) => ({
        files: isExpired(state.timestamp) ? [] : state.files,
        timestamp: isExpired(state.timestamp) ? 0 : state.timestamp,
        scanType: state.scanType,
      }),
    }
  )
);
