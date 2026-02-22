import { useEffect } from "react";
import { useMusicStore } from "@/store/music-store";
import { MediaSession } from "@jofr/capacitor-media-session";

export function useMediaSessionIntegration(coverUrl: string | null | undefined) {
  const currentTrack = useMusicStore(s => s.queue[s.currentIndex]);
  const isPlaying = useMusicStore(s => s.isPlaying);
  const setIsPlaying = useMusicStore(s => s.setIsPlaying);
  const queue = useMusicStore(s => s.queue);
  const currentIndex = useMusicStore(s => s.currentIndex);

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
        await MediaSession.setPlaybackState({
          playbackState: isPlaying ? "playing" : "paused",
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
        setIsPlaying(true);
      }],
      ["pause", () => setIsPlaying(false)],
      ["previoustrack", () => {
        const prevIndex = currentIndex - 1;
        useMusicStore.getState().setCurrentIndexAndPlay(prevIndex < 0 ? queue.length - 1 : prevIndex);
      }],
      ["nexttrack", () => {
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
  }, [currentIndex, queue.length, setIsPlaying]);
}
