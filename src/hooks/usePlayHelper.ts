import { useMusicStore } from "@/store/music-store";
import { MusicTrack } from "@/types/music";
import { useCallback } from "react";

export function usePlayHelper() {
  const {
    playContext,
    togglePlay,
    queue,
    currentIndex,
  } = useMusicStore();

  const currentTrack = queue[currentIndex] || null;

  const handlePlay = useCallback((track: MusicTrack, list: MusicTrack[], contextId?: string) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    const index = list.findIndex((t) => t.id === track.id);
    if (index === -1) return;

    playContext(list, index, contextId);
  }, [currentTrack, playContext, togglePlay]);

  return { handlePlay };
}
