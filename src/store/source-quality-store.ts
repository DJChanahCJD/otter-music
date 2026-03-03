import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storeKey, storeVersion } from './config';
import { idbStorage } from '@/lib/storage-adapter';
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

        const { success, fail } = stats;
        const n = success + fail;
        if (n < 5) return 0; // 样本太少不可信

        const z = 1.96; // 95% confidence
        const phat = success / n;

        const score =
          (phat + z * z / (2 * n) -
            z * Math.sqrt((phat * (1 - phat) + z * z / (4 * n)) / n)) /
          (1 + z * z / n); 

        return score * 40; // 映射到 0~40
      },

      resetStats: () => set({ stats: {} })
    }),
    {
      name: storeKey.SourceQualityStore,
      storage: createJSONStorage(() => idbStorage),
      version: storeVersion,
    }
  )
);
