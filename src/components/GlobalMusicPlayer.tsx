"use client";

import { useRef, useEffect } from "react";
import { useMusicStore } from "@/store/music-store";
import { useMusicCover } from "@/hooks/useMusicCover";
import { useAudioElement } from "@/hooks/useAudioElement";
import { useSeekHandler } from "@/hooks/useSeekHandler";
import { useAudioPlaybackControl } from "@/hooks/useAudioPlaybackControl";
import { useMediaSessionIntegration } from "@/hooks/useMediaSessionIntegration";
import { useAudioEventHandlers } from "@/hooks/useAudioEventHandlers";
import { useAudioTrackLoader } from "@/hooks/useAudioTrackLoader";
import { useSleepTimer } from "@/hooks/useSleepTimer";
import { useAudioPreloader } from "@/hooks/useAudioPreloader";
import { useAudioRouteSafety } from "@/hooks/useAudioRouteSafety";
import { useCarLyric } from "@/hooks/useCarLyric";

export function GlobalMusicPlayer() {
  const audioRef = useAudioElement();
  const currentTrack = useMusicStore((s) => s.queue[s.currentIndex]);
  const setCoverUrl = useMusicStore((s) => s.setCoverUrl);
  const coverUrl = useMusicCover(currentTrack);

  useEffect(() => {
    setCoverUrl(coverUrl);
  }, [coverUrl, setCoverUrl]);

  const isSwitchingTrackRef = useRef(false);
  const hasRecordedRef = useRef(false);

  useSleepTimer(audioRef);
  useSeekHandler(audioRef);
  useAudioTrackLoader(audioRef, isSwitchingTrackRef, hasRecordedRef);
  useAudioPlaybackControl(audioRef, isSwitchingTrackRef);
  useAudioEventHandlers(audioRef, isSwitchingTrackRef, hasRecordedRef);
  useAudioRouteSafety(audioRef);
  useMediaSessionIntegration(audioRef, coverUrl);
  useCarLyric();
  useAudioPreloader(audioRef);

  return (
    <audio ref={audioRef} className="sr-only" preload="auto" playsInline />
  );
}
