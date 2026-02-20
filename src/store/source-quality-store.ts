import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storeKey } from '.';
import type { MusicSource } from '@/types/music';

interface SourceStats {
  success: number;
  fail: number;
}

interface SourceQualityState {
  stats: Partial<Record<MusicSource, SourceStats>>;
  recordSuccess: (source: MusicSource) => void;
  recordFail: (source: MusicSource) => void;
  getSourceDynamicScore: (source: MusicSource) => number;
  resetStats: () => void;
}

export const useSourceQualityStore = create<SourceQualityState>()(
  persist(
    (set, get) => ({
      stats: {},

      recordSuccess: (source) => set((state) => {
        const current = state.stats[source] || { success: 0, fail: 0 };
        return {
          stats: {
            ...state.stats,
            [source]: { ...current, success: current.success + 1 }
          }
        };
      }),

      recordFail: (source) => set((state) => {
        const current = state.stats[source] || { success: 0, fail: 0 };
        return {
          stats: {
            ...state.stats,
            [source]: { ...current, fail: current.fail + 1 }
          }
        };
      }),

      getSourceDynamicScore: (source) => {
        const stats = get().stats[source];
        if (!stats) return 0;

        const total = stats.success + stats.fail;
        if (total === 0) return 0;

        const successRate = stats.success / total;

        const score = successRate * Math.log(total + 1) * 20;

        return Math.min(score, 50);
      },

      resetStats: () => set({ stats: {} })
    }),
    {
      name: storeKey.SourceQualityStore
    }
  )
);
