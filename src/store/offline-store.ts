import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storeKey } from "./store-keys";
import { idbStorage } from "@/lib/storage-adapter";
import { MusicSource } from "@/types/music";

export interface OfflineTrackRecord {
  trackId: string;
  source: "stream-cache";
  url: string;
  cacheKey?: string;
  cachedAt: number;
  verifiedAt?: number;
  name: string;
  artist: string[];
  album: string;
  trackSource: MusicSource;
  url_id: string;
  pic_id: string;
  lyric_id: string;
}

interface OfflineStoreState {
  records: Record<string, OfflineTrackRecord>;

  addRecord: (record: OfflineTrackRecord) => void;
  removeRecord: (trackId: string) => void;
  getRecord: (trackId: string) => OfflineTrackRecord | undefined;
  isRecordValid: (trackId: string) => boolean;
  clear: () => void;
}

export const useOfflineStore = create<OfflineStoreState>()(
  persist(
    (set, get) => ({
      records: {},

      addRecord: (record) =>
        set((s) => ({ records: { ...s.records, [record.trackId]: record } })),

      removeRecord: (trackId) =>
        set((s) => {
          const { [trackId]: _, ...rest } = s.records;
          return { records: rest };
        }),

      getRecord: (trackId) => get().records[trackId],

      isRecordValid: (trackId) => {
        const record = get().records[trackId];
        if (!record) return false;
        // 新记录必须有 cacheKey；旧记录兼容 url 字段，但需外部进一步校验 SW 缓存
        return Boolean(record.cacheKey || record.url);
      },

      clear: () => set({ records: {} }),
    }),
    {
      name: storeKey.OfflineStore,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ records: state.records }),
    }
  )
);
