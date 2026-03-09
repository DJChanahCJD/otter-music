import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { idbStorage } from "@/lib/storage-adapter";
import { storeKey } from "./store-keys";
import type { PodcastRssSource } from "@/types/podcast";

const DEFAULT_RSS_SOURCES: PodcastRssSource[] = [
  { id: "podcast-1", name: "资讯早七点", rssUrl: "https://feed.xyzfm.space/wb39te6k9gqw", update_time: Date.now(), is_deleted: false },
];

interface PodcastState {
  rssSources: PodcastRssSource[];
  addRssSource: (name: string, rssUrl: string, coverUrl?: string, description?: string) => string;
  updateRssSource: (id: string, data: Pick<PodcastRssSource, "name" | "rssUrl" | "coverUrl" | "description">) => void;
  removeRssSource: (id: string) => void;
  resetDefaultRssSources: () => void;
  setRssSources: (sources: PodcastRssSource[]) => void;
}

const markUpdate = (item: PodcastRssSource): PodcastRssSource => ({
  ...item,
  update_time: Date.now(),
});

const upsertDefaults = (current: PodcastRssSource[]) => {
  const map = new Map(current.map((item) => [item.id, item]));
  DEFAULT_RSS_SOURCES.forEach((item) => {
    map.set(item.id, { ...item, update_time: Date.now(), is_deleted: false });
  });
  return Array.from(map.values());
};

export const usePodcastStore = create<PodcastState>()(
  persist(
    (set) => ({
      rssSources: DEFAULT_RSS_SOURCES,
      addRssSource: (name, rssUrl, coverUrl, description) => {
        const id = uuidv4();
        set((state) => ({
          rssSources: [
            markUpdate({ id, name, rssUrl, coverUrl, description, is_deleted: false }),
            ...state.rssSources,
          ],
        }));
        return id;
      },
      updateRssSource: (id, data) =>
        set((state) => ({
          rssSources: state.rssSources.map((item) =>
            item.id === id ? markUpdate({ ...item, ...data, is_deleted: false }) : item
          ),
        })),
      removeRssSource: (id) =>
        set((state) => ({
          rssSources: state.rssSources.map((item) =>
            item.id === id ? markUpdate({ ...item, is_deleted: true }) : item
          ),
        })),
      resetDefaultRssSources: () =>
        set((state) => ({
          rssSources: upsertDefaults(state.rssSources),
        })),
      setRssSources: (sources) =>
        set({
          rssSources: sources,
        }),
    }),
    {
      name: storeKey.PodcastStore,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ rssSources: state.rssSources }),
    }
  )
);
