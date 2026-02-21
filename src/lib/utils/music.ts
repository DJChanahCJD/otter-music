import { MusicTrack, MergedMusicTrack } from "@/types/music";

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