import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import type { MusicSource } from "@/types/music";

export const EXCLUDED_FOR_SEARCH = ["local", "podcast"];
export const EXCLUDED_FOR_AUTO_MATCH = ["local", "podcast"];

const getEnabledSourcesInOrder = (): MusicSource[] => {
  const { sourceConfigs } = useMusicStore.getState();
  return sourceConfigs.filter((c) => c.enabled).map((c) => c.source);
};

export function useAggregatedSourcesForSearch() {
  return useMusicStore(
    useShallow((state) =>
      state.sourceConfigs
        .filter((c) => c.enabled && !EXCLUDED_FOR_SEARCH.includes(c.source))
        .map((c) => c.source)
    )
  );
}

export function useAggregatedSourcesForMatch() {
  return useMusicStore(
    useShallow((state) =>
      state.sourceConfigs
        .filter((c) => c.enabled && !EXCLUDED_FOR_AUTO_MATCH.includes(c.source))
        .map((c) => c.source)
    )
  );
}

export function getAggregatedSourcesForSearch() {
  return getEnabledSourcesInOrder().filter(
    (s) => !EXCLUDED_FOR_SEARCH.includes(s)
  );
}

export function getAggregatedSourcesForMatch() {
  return getEnabledSourcesInOrder().filter(
    (s) => !EXCLUDED_FOR_AUTO_MATCH.includes(s)
  );
}
