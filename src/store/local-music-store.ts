import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LocalMusicFile } from '@/plugins/local-music';
import { storeKey } from '.';

interface LocalMusicState {
  files: LocalMusicFile[];
  setFiles: (files: LocalMusicFile[]) => void;
  updateFiles: (updater: (files: LocalMusicFile[]) => LocalMusicFile[]) => void;
  clear: () => void;
}

export const useLocalMusicStore = create<LocalMusicState>()(
  persist(
    (set, get) => ({
      files: [],
      setFiles: (files) => set({ files }),
      updateFiles: (updater) => set((state) => ({ files: updater(state.files) })),
      clear: () => set({ files: [] }),
    }),
    {
      name: storeKey.LocalMusicStore,
      partialize: (state) => ({
        files: state.files,
      }),
    }
  )
);
