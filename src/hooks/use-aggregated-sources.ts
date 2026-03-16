import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";

export const EXCLUDED_FOR_SEARCH = ["local", "podcast"];
export const EXCLUDED_FOR_AUTO_MATCH = ["local", "podcast", "_netease"];

/**
 * 用于【搜索】的聚合数据源
 */
export function useAggregatedSourcesForSearch() {
  return useMusicStore(
    useShallow((state) =>
      state.aggregatedSources.filter((p) => !EXCLUDED_FOR_SEARCH.includes(p))
    )
  );
}

/**
 * 用于【自动匹配】的聚合数据源
 */
export function useAggregatedSourcesForMatch() {
  return useMusicStore(
    useShallow((state) =>
      state.aggregatedSources.filter((p) => !EXCLUDED_FOR_AUTO_MATCH.includes(p))
    )
  );
}

/**
 * 获取【搜索】的聚合数据源（非 Hook 环境）
 */
export function getAggregatedSourcesForSearch() {
  const { aggregatedSources } = useMusicStore.getState();
  return aggregatedSources.filter((p) => !EXCLUDED_FOR_SEARCH.includes(p));
}

/**
 * 获取【自动匹配】的聚合数据源（非 Hook 环境）
 */
export function getAggregatedSourcesForMatch() {
  const { aggregatedSources } = useMusicStore.getState();
  return aggregatedSources.filter((p) => !EXCLUDED_FOR_AUTO_MATCH.includes(p));
}
