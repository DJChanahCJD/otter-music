import { musicApi } from "@/services/music-api";
import type { MusicTrack } from "@/types/music";
import { useState, useEffect } from "react";

export function useMusicCover(
  track: MusicTrack | null | undefined,
  enabled: boolean = true
) {
  const [state, setState] = useState<{
    url: string | null;
    picId: string | undefined;
    source: string | undefined;
  }>({
    url: null,
    picId: undefined,
    source: undefined,
  });

  useEffect(() => {
    if (!track?.pic_id || !enabled) {
      return;
    }

    let active = true;
    const { pic_id, source } = track;

    const fetchCover = async () => {
      try {
        const url = await musicApi.getPic(pic_id, source);
        if (active) {
          setState({ url, picId: pic_id, source });
        }
      } catch (e) {
        console.error("Failed to fetch cover:", e);
        if (active) {
          setState({ url: null, picId: pic_id, source });
        }
      }
    };

    fetchCover();

    return () => {
      active = false;
    };
  }, [track?.pic_id, track?.source, enabled, track]);

  // Derived state: if disabled or no track, return null.
  // If the current track doesn't match what we've loaded, return null (it's loading).
  if (
    !enabled ||
    !track?.pic_id ||
    track.pic_id !== state.picId ||
    track.source !== state.source
  ) {
    return null;
  }

  return state.url;
}
