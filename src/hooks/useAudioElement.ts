import { useRef, useEffect } from "react";
import { useMusicStore } from "@/store/music-store";

export function useAudioElement() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const volume = useMusicStore(s => s.volume);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return audioRef;
}
