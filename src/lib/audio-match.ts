import { toast } from "react-hot-toast";
import { useMusicStore } from "@/store/music-store";
import { musicApi } from "@/lib/music-api";
import type { MusicTrack } from "@/types/music";
import { normalizeText } from "./utils/music-key";

/**
 * 自动匹配免费源逻辑
 * @param track 需要匹配的歌曲
 * @returns 是否匹配并切换成功
 */
export async function handleAutoMatch(track: MusicTrack): Promise<boolean> {
  const toastId = toast.loading("正在搜索免费音源...", { id: `auto-match-${track.id}` });
  
  try {
    const { aggregatedSources, updateTrackInQueue } = useMusicStore.getState();
    const targetName = normalizeText(track.name);
    const targetArtist = normalizeText(track.artist[0] || "");

    const match = await musicApi.searchBestMatch(
      `${track.name} ${track.artist[0]}`,
      aggregatedSources,
      (item) =>
        normalizeText(item.name) === targetName &&
        item.artist.some((a) => normalizeText(a).includes(targetArtist)),
      5
    );

    if (!match) {
      toast.error("未找到可用音源", { id: toastId });
      return false;
    }

    updateTrackInQueue(track.id, match);
    toast.success(`已自动切换至: ${match.name}（${match.source}）`, { id: toastId });
    return true;
  } catch (error) {
    console.error("Auto match failed:", error);
    toast.error("自动匹配失败", { id: toastId });
    return false;
  }
}
