import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LocalMusicFile } from '@/plugins/local-music';
import { storeKey } from './store-keys';

interface LocalMusicState {
  files: LocalMusicFile[];
  isScanning: boolean;
  scanType: "quick" | "full" | null;

  setFiles: (files: LocalMusicFile[]) => void;
  updateFiles: (updater: (files: LocalMusicFile[]) => LocalMusicFile[]) => void;
  clear: () => void;
  setScanning: (isScanning: boolean, scanType?: "quick" | "full") => void;
}

export const useLocalMusicStore = create<LocalMusicState>()(
  persist(
    (set) => ({
      files: [],
      isScanning: false,
      scanType: null,

      setFiles: (files) => set({ files }),
      updateFiles: (updater) => set((state) => ({ files: updater(state.files) })),
      clear: () => set({ files: [] }),
      setScanning: (isScanning, scanType) => set({ isScanning, scanType: scanType || null }),
    }),
    {
      name: storeKey.LocalMusicStore,
      partialize: (state) => ({
        files: state.files,
      }),
    }
  )
);
