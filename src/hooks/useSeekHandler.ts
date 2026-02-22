import { useEffect } from "react";
import { useMusicStore } from "@/store/music-store";

export function useSeekHandler(audioRef: React.RefObject<HTMLAudioElement | null>) {
  const seekTargetTime = useMusicStore(s => s.seekTargetTime);
  const seekTimestamp = useMusicStore(s => s.seekTimestamp);
  const setAudioCurrentTime = useMusicStore(s => s.setAudioCurrentTime);
  const clearSeekTargetTime = useMusicStore(s => s.clearSeekTargetTime);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekTimestamp === 0 || seekTargetTime < 0) return;

    if (Number.isFinite(seekTargetTime)) {
      audio.currentTime = seekTargetTime;
      setAudioCurrentTime(seekTargetTime);
      clearSeekTargetTime();
    }
  }, [seekTargetTime, seekTimestamp, setAudioCurrentTime, clearSeekTargetTime]); // eslint-disable-line react-hooks/exhaustive-deps
}
