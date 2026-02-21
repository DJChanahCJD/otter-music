import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storeKey } from '.';
import type { MusicTrack } from '@/types/music';

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
    }
  )
);
