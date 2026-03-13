import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storeKey } from './store-keys';
import { idbStorage } from '@/lib/storage-adapter';
import type { MusicSource } from '@/types/music';

interface SourceStats {
  recent: boolean[];
  fails: number;
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
        const current = state.stats[source] || { recent: [], fails: 0 };
        const recent = [...current.recent, true].slice(-20); // 滑动窗口
        return {
          stats: {
            ...state.stats,
            [source]: {
              recent,
              fails: 0 // 成功则重置连续失败计数
            }
          }
        };
      }),

      recordFail: (source) => set((state) => {
        const current = state.stats[source] || { recent: [], fails: 0 };
        const recent = [...current.recent, false].slice(-20); // 滑动窗口
        return {
          stats: {
            ...state.stats,
            [source]: {
              recent,
              fails: current.fails + 1 // 连续失败计数
            }
          }
        };
      }),

      getSourceDynamicScore: (source) => {
        const s = get().stats[source];
        if (!s || s.recent.length < 3) return 0;

        const rate = s.recent.filter(Boolean).length / s.recent.length;

        if (s.fails >= 3) return -50; // 熔断：连续死掉
        if (rate < 0.4) return -20;   // 降权：近期不稳
        return rate * 10;             // 奖励：表现良好
      },

      resetStats: () => set({ stats: {} })
    }),
    {
      name: storeKey.SourceQualityStore,
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
