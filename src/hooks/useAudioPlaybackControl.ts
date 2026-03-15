import { useEffect } from "react";
import { useMusicStore } from "@/store/music-store";

export function useAudioPlaybackControl(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>
) {
  const isPlaying = useMusicStore(s => s.isPlaying);
  const setIsPlaying = useMusicStore(s => s.setIsPlaying);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!isPlaying) {
      if (!audio.paused) audio.pause();
      return;
    }

    if (isSwitchingTrackRef.current) return;
    if (!audio.src) return;
    if (audio.paused) {
      audio.play().catch((e) => {
        console.error("Resume play failed:", e);
        if (audio.paused) {
          setIsPlaying(false);
        }
      });
    }
  }, [isPlaying, setIsPlaying]); // eslint-disable-line react-hooks/exhaustive-deps
}
