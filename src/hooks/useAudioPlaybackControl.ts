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
    if (!audio || !audio.src) return;

    if (isSwitchingTrackRef.current) return;

    if (isPlaying && audio.paused) {
      audio.play().catch((e) => {
        console.error("Resume play failed:", e);
        setIsPlaying(false);
      });
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, setIsPlaying]); // eslint-disable-line react-hooks/exhaustive-deps
}
