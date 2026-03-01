import { MusicTrack, MergedMusicTrack } from "@/types/music";
import { getExactKey } from "./music-key";

// 格式化音视频时间为分秒格式
export const formatMediaTime = (time: number) => {
  if (isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};
/**
 * 清理 MusicTrack，移除 variants 字段
 */
export function cleanTrack(track: MusicTrack | MergedMusicTrack): MusicTrack {
  const { variants, ...rest } = track as MergedMusicTrack;
  return rest;
}

/**
 * 歌单去重结果
 */
export interface DeduplicationResult {
  tracks: MusicTrack[];
  removedCount: number;
  tracksToLike: MusicTrack[];
}

/**
 * 歌单去重逻辑
 * @param tracks 原始歌曲列表
 * @param isFavorite 检查歌曲是否已喜欢的回调
 * @param isDownloaded 检查歌曲是否已下载的回调
 * @returns DeduplicationResult
 */
export function deduplicateTracks(
  tracks: MusicTrack[],
  isFavorite: (id: string) => boolean,
  isDownloaded: (track: MusicTrack) => boolean
): DeduplicationResult {
  const groups = new Map<string, { track: MusicTrack; index: number }[]>();

  // 1. Grouping
  tracks.forEach((track, index) => {
    const key = getExactKey(track);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push({ track, index });
  });

  const indicesToRemove = new Set<number>();
  let removedCount = 0;
  const tracksToLike: MusicTrack[] = [];

  // 2. Selection
  groups.forEach((group) => {
    if (group.length <= 1) return;

    // Check if any track in the group is liked
    const hasLiked = group.some(item => isFavorite(item.track.id));

    // Sort to find the winner
    group.sort((a, b) => {
      const aDown = isDownloaded(a.track);
      const bDown = isDownloaded(b.track);
      // Priority 1: Downloaded (True > False)
      if (aDown !== bDown) return aDown ? -1 : 1;

      const aLiked = isFavorite(a.track.id);
      const bLiked = isFavorite(b.track.id);
      // Priority 2: Liked (True > False)
      if (aLiked !== bLiked) return aLiked ? -1 : 1;

      // Priority 3: Larger index first (descending) - Keep the newer/later one
      return b.index - a.index;
    });

    const winner = group[0];

    // If the group had a liked track but the winner is not liked, mark it for liking
    if (hasLiked && !isFavorite(winner.track.id)) {
      tracksToLike.push(winner.track);
    }

    // Mark losers for removal
    for (let i = 1; i < group.length; i++) {
      indicesToRemove.add(group[i].index);
      removedCount++;
    }
  });

  // 3. Update list
  const newTracks = tracks.filter((_, index) => !indicesToRemove.has(index));

  return {
    tracks: newTracks,
    removedCount,
    tracksToLike,
  };
}
