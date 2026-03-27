import { toast } from "react-hot-toast";
import { useMusicStore } from "@/store/music-store";
import { EXCLUDED_FOR_SEARCH, getAggregatedSourcesForMatch } from "@/hooks/use-aggregated-sources";
import { musicApi } from "@/lib/music-api";
import type { MusicTrack } from "@/types/music";
import { isNameMatch, isArtistMatch } from "./utils/music-key";
import { logger } from "@/lib/logger";

/**
 * 自动匹配免费源逻辑
 * @param track 需要匹配的歌曲
 * @returns 是否匹配并切换成功
 */
export async function handleAutoMatch(track: MusicTrack): Promise<boolean> {
  if (track.source && EXCLUDED_FOR_SEARCH.includes(track.source)) {
    return false;
  }
  const toastId = toast.loading("正在搜索免费音源...", { id: `auto-match-${track.id}` });
  
  try {
    const { updateTrackInQueue, isFavorite, favorites, setFavorites, updateTrackInPlaylists } = useMusicStore.getState();
    const aggregatedSources = getAggregatedSourcesForMatch();
    if (aggregatedSources.length === 0) {
      return false;
    }
    const match = await musicApi.searchBestMatch(
      `${track.name} ${track.artist[0]}`,
      aggregatedSources,
      (item: MusicTrack) => {
        // 1. 标准化名称匹配
        if (!isNameMatch(track.name, item.name)) return false;

        // 2. 歌手匹配 (集合交集)
        return isArtistMatch(track.artist, item.artist);
      },
      5
    );

    if (!match) {
      toast.error("未找到可用音源", { id: toastId });
      return false;
    }

    updateTrackInQueue(track.id, match);
    updateTrackInPlaylists(track.id, match);
    if (isFavorite(track.id)) {
      setFavorites(favorites.map(t => t.id === track.id ? match : t));
    }

    toast.success(`已自动切换至: ${match.source}`, { id: toastId });
    return true;
  } catch (error) {
    logger.error("audio-match", "Auto match failed", error);
    toast.error("自动匹配失败", { id: toastId });
    return false;
  }
}
