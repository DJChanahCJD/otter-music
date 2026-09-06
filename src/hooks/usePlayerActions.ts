import { useRef, useCallback } from "react";
import { useMusicStore } from "@/store/music-store";
import { shareTrack } from "@/lib/share-service";
import { writeClipboardText } from "@/lib/clipboard";
import { toastUtils } from "@/lib/utils/toast";
import type { MusicTrack } from "@/types/music";
import toast from "react-hot-toast";

export function usePlayerActions(
  currentTrack: MusicTrack | null,
  currentAudioUrl: string | null
) {
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const favorites = useMusicStore((s) => s.favorites);
  const isFavorite = useMusicStore((s) => s.isFavorite);
  const addToFavorites = useMusicStore((s) => s.addToFavorites);
  const removeFromFavorites = useMusicStore((s) => s.removeFromFavorites);

  const isCurrentTrackFavorite = currentTrack
    ? favorites.some((t) => t.id === currentTrack.id && !t.is_deleted)
    : false;

  const coverUrl = useMusicStore((s) => s.coverUrl);

  const handleShare = useCallback(async () => {
    if (!currentTrack) return toast.error("暂无歌曲信息");
    await shareTrack({
      track: currentTrack,
      audioUrl: currentAudioUrl,
      coverUrl,
    });
  }, [currentTrack, currentAudioUrl, coverUrl]);

  const handleToggleLike = useCallback(() => {
    if (!currentTrack) return;
    if (isFavorite(currentTrack.id)) {
      removeFromFavorites(currentTrack.id);
      toast.success("已取消喜欢");
    } else {
      const error = addToFavorites(currentTrack);
      if (error) {
        toastUtils.info(error);
      } else {
        toast.success("已喜欢");
      }
    }
  }, [currentTrack, isFavorite, addToFavorites, removeFromFavorites]);

  const handleTrackInfoPressStart = useCallback(() => {
    if (!currentTrack) return;

    pressTimerRef.current = setTimeout(async () => {
      const text = `${currentTrack.name} - ${currentTrack.artist.join(", ")}`;
      const ok = await writeClipboardText(text);
      if (ok) {
        toast.success("已复制歌曲信息");
      } else {
        toast.error("复制失败，请重试");
      }
    }, 500);
  }, [currentTrack]);

  const handleTrackInfoPressEnd = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  return {
    handleShare,
    handleToggleLike,
    isCurrentTrackFavorite,
    trackInfoPressHandlers: {
      onMouseDown: handleTrackInfoPressStart,
      onMouseUp: handleTrackInfoPressEnd,
      onMouseLeave: handleTrackInfoPressEnd,
      onTouchStart: handleTrackInfoPressStart,
      onTouchEnd: handleTrackInfoPressEnd,
    },
  };
}
