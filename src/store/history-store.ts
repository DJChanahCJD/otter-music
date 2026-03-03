import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storeKey, storeVersion } from './config';
import { idbStorage } from '@/lib/storage-adapter';
import type { MusicTrack } from '@/types/music';
import { cleanTrack } from '@/lib/utils/music';

const MAX_HISTORY = 100;

interface HistoryState {
  history: MusicTrack[];
  addToHistory: (track: MusicTrack) => void;
  removeFromHistory: (trackId: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      history: [],

      addToHistory: (track) => set((state) => {
        const filtered = state.history.filter(t => t.id !== track.id);
        const newHistory = [track, ...filtered];
        return { history: newHistory.slice(0, MAX_HISTORY) };
      }),

      removeFromHistory: (trackId) => set((state) => ({
        history: state.history.filter(t => t.id !== trackId)
      })),

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: storeKey.HistoryStore,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        history: state.history.map(cleanTrack),
      }),
      version: storeVersion,
    }
  )
);
