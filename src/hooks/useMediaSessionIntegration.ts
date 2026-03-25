import { useEffect } from "react";
import { useMusicStore } from "@/store/music-store";
import { MediaSession } from "@jofr/capacitor-media-session";
import { forceHttps } from "@/lib/music-provider/utils";

export function sanitizeMediaSessionArtworkUrl(
  rawUrl: string | null | undefined
): string | null {
  if (!rawUrl) return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const normalized = forceHttps(trimmed);

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:") return null;
    if (!parsed.hostname || parsed.hostname === "localhost") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

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
        const safeArtworkUrl = sanitizeMediaSessionArtworkUrl(coverUrl);

        // The Android plugin fetches artwork synchronously in native code, which
        // can destabilize startup when restored playback state replays metadata updates.
        const safeArtwork =
          isOnline && safeArtworkUrl
            ? [{ src: safeArtworkUrl }]
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
    const audio = audioRef.current;

    const updatePlaybackState = async () => {
      try {
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

    const syncPlaybackState = () => {
      void updatePlaybackState();
    };

    syncPlaybackState();

    if (!audio) return;

    const playbackEvents: Array<keyof HTMLMediaElementEventMap> = [
      "play",
      "pause",
      "ended",
      "waiting",
      "stalled",
      "error",
    ];

    playbackEvents.forEach(event => {
      audio.addEventListener(event, syncPlaybackState);
    });

    return () => {
      playbackEvents.forEach(event => {
        audio.removeEventListener(event, syncPlaybackState);
      });
    };
  }, [audioRef, isPlaying, currentTrack?.id]);

  useEffect(() => {
    const actionHandlers: [string, (details?: { seekTime?: number | null }) => void][] = [
      ["play", () => {
        useMusicStore.getState().setUserGesture();
        const audio = audioRef.current;
        if (!audio) return;
        audio.play().catch(e => console.error("MediaSession play error:", e));
      }],
      ["pause", () => {
        const audio = audioRef.current;
        audio?.pause();
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
