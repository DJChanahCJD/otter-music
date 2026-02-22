"use client";

import { useRef } from "react";
import { useMusicStore } from "@/store/music-store";
import { useMusicCover } from "@/hooks/useMusicCover";
import { useAudioElement } from "@/hooks/useAudioElement";
import { useSeekHandler } from "@/hooks/useSeekHandler";
import { useAudioPlaybackControl } from "@/hooks/useAudioPlaybackControl";
import { useMediaSessionIntegration } from "@/hooks/useMediaSessionIntegration";
import { useAudioEventHandlers } from "@/hooks/useAudioEventHandlers";
import { useAudioTrackLoader } from "@/hooks/useAudioTrackLoader";

export function GlobalMusicPlayer() {
  const audioRef = useAudioElement();
  const currentTrack = useMusicStore(s => s.queue[s.currentIndex]);
  const coverUrl = useMusicCover(currentTrack);

  const isSwitchingTrackRef = useRef(false);
  const hasRecordedRef = useRef(false);

  useSeekHandler(audioRef);
  useAudioTrackLoader(audioRef, isSwitchingTrackRef, hasRecordedRef);
  useAudioPlaybackControl(audioRef, isSwitchingTrackRef);
  useAudioEventHandlers(audioRef, isSwitchingTrackRef, hasRecordedRef);
  useMediaSessionIntegration(coverUrl);

  return (
    <audio
      ref={audioRef}
      className="sr-only"
      preload="auto"
      playsInline
    />
  );
}