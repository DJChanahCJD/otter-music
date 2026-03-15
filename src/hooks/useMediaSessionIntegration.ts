import { useEffect } from "react";
import { useMusicStore } from "@/store/music-store";
import { MediaSession } from "@jofr/capacitor-media-session";

export function useMediaSessionIntegration(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  coverUrl: string | null | undefined
) {
  const currentTrack = useMusicStore(s => s.queue[s.currentIndex]);
  const isPlaying = useMusicStore(s => s.isPlaying);

  useEffect(() => {
    const updateMetadata = async () => {
      if (!currentTrack) return;

      try {
        const isOnline = navigator.onLine;

        const safeArtwork =
          isOnline && coverUrl
            ? [{ src: coverUrl }]
            : [];

        await MediaSession.setMetadata({
          title: currentTrack.name || "Unknown Track",
          artist: currentTrack.artist?.join("/") || "Unknown Artist",
          album: currentTrack.album || "",
          artwork: safeArtwork,
        });
      } catch (e) {
        console.error("MediaSession metadata error:", e);
      }
    };
    updateMetadata();
  }, [currentTrack, coverUrl]);

  useEffect(() => {
    const updatePlaybackState = async () => {
      try {
        // 以 audio 实际状态作为播放态真源
        const audio = audioRef.current;
        const playbackState = audio
          ? (audio.paused ? "paused" : "playing")
          : (isPlaying ? "playing" : "paused");

        await MediaSession.setPlaybackState({
          playbackState,
        });
      } catch (e) {
        console.error("MediaSession state error:", e);
      }
    };
    updatePlaybackState();
  }, [isPlaying]);

  useEffect(() => {
    const actionHandlers: [string, (details?: { seekTime?: number | null }) => void][] = [
      ["play", () => {
        useMusicStore.getState().setUserGesture();
        const audio = audioRef.current;
        if (!audio) return;
        // 仅驱动 audio，store 交由 onPlay/onPause 事件同步
        audio.play().catch(e => console.error("MediaSession play error:", e));
      }],
      ["pause", () => {
        audioRef.current?.pause();
      }],
      ["previoustrack", () => {
        const { queue, currentIndex } = useMusicStore.getState();
        const prevIndex = currentIndex - 1;
        useMusicStore.getState().setCurrentIndexAndPlay(prevIndex < 0 ? queue.length - 1 : prevIndex);
      }],
      ["nexttrack", () => {
        const { queue, currentIndex } = useMusicStore.getState();
        if (queue.length > 0) {
          const nextIndex = (currentIndex + 1) % queue.length;
          useMusicStore.getState().setCurrentIndexAndPlay(nextIndex);
        }
      }],
      ["seekto", (details) => {
        if (details?.seekTime !== undefined && details?.seekTime !== null) {
          useMusicStore.getState().seek(details.seekTime);
        }
      }],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        MediaSession.setActionHandler({ action: action as 'play' | 'pause' | 'previoustrack' | 'nexttrack' | 'seekto' }, handler);
      } catch (e) {
        console.error(`Failed to set action handler for ${action}`, e);
      }
    }
  }, [audioRef]);
}
