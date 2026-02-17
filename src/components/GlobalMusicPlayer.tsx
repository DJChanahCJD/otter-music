"use client";

import { useMusicCover } from "@/hooks/useMusicCover";
import { retry } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { useMusicStore } from "@/store/music-store";
import { useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { MediaSession } from "@jofr/capacitor-media-session";
export function GlobalMusicPlayer() {
  const {
    queue,
    currentIndex,
    volume,
    isRepeat,
    isPlaying,
    setIsPlaying,
    setIsLoading,
    playTrackAsNext,
    setAudioCurrentTime,
    currentAudioTime,
    seekTimestamp,
    quality,
    setDuration,
    setCurrentAudioUrl,
    hasUserGesture,
  } = useMusicStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTrack = queue[currentIndex];
  const currentTrackId = currentTrack?.id;
  const currentTrackSource = currentTrack?.source;
  const coverUrl = useMusicCover(currentTrack);

  // Ref to track current request to avoid race conditions
  const requestIdRef = useRef(0);
  // Ref to throttle time updates
  const lastSaveTimeRef = useRef(0);
  // Ref to track if we are switching tracks (to avoid triggering pause event logic)
  const isSwitchingTrackRef = useRef(false);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Sync play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch((e) => {
        console.error("Play failed:", e);
        // Don't setIsPlaying(false) here immediately, as it might be loading
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Handle Seek
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekTimestamp === 0) return;

    // Check if valid time
    if (Number.isFinite(currentAudioTime)) {
      audio.currentTime = currentAudioTime;
    }
  }, [currentAudioTime, seekTimestamp]);
  // Dependency on seekTimestamp ensures we only seek when explicit action happens
  // We don't depend on currentAudioTime alone because that changes during playback

  // Load Track Logic
  useEffect(() => {
    if (!hasUserGesture) return;
    if (
      !currentTrack ||
      !currentTrackId ||
      !currentTrackSource ||
      !audioRef.current
    )
      return;

    const requestId = ++requestIdRef.current;
    let cancelled = false;

    const load = async () => {
      const audio = audioRef.current!;
      setIsLoading(true);
      
      // Mark as switching so pause events are ignored
      isSwitchingTrackRef.current = true;

      try {
        // Pause current
        audio.pause();

        // 1. Get URL with proper retry (null -> throw to trigger retry)
        const url = await retry(
          async () => {
            const result = await musicApi.getUrl(
              currentTrackId,
              currentTrackSource,
              parseInt(quality, 10),
            );
            if (!result) throw new Error("EMPTY_URL");
            return result;
          },
          2,
          800,
        );

        if (cancelled || requestId !== requestIdRef.current) return;

        // 保存当前音频 URL 到 store
        setCurrentAudioUrl(url);

        // 2. Set Source
        if (audio.src !== url) {
          audio.src = url;
          audio.load();
        }

        // Always reset currentTime for new track, then restore if needed
        const resumeTime = useMusicStore.getState().currentAudioTime;
        if (resumeTime > 0) {
          audio.currentTime = resumeTime;
        } else {
          audio.currentTime = 0;
        }

        if (isPlaying) {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.error("Auto-play failed:", error);
              setIsPlaying(false);
            });
          }
        }
      } catch (err: unknown) {
        if (cancelled || requestId !== requestIdRef.current) return;
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Audio load failed:", errorMessage);
        toast.error(`无法播放: ${currentTrack.name}`);

        // Clear audio source to prevent playing previous track
        audio.src = "";
        audio.load();
        setCurrentAudioUrl(null);

        // Auto skip to next
        playTrackAsNext(currentTrack);
      } finally {
        // Only reset if we are still the active request
        if (requestId === requestIdRef.current) {
          isSwitchingTrackRef.current = false;
          if (!cancelled) setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [hasUserGesture, currentTrack, currentTrackId, currentTrackSource, playTrackAsNext, quality, setCurrentAudioUrl, setIsLoading, setIsPlaying, isPlaying]);

  // Event Handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      // Prevent store pollution during track switching
      if (isSwitchingTrackRef.current) return;

      const now = Date.now();
      // Throttle store updates to every 1s
      if (now - lastSaveTimeRef.current > 1000) {
        setAudioCurrentTime(audio.currentTime);
        lastSaveTimeRef.current = now;
      }
    };

    const onDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      if (isRepeat) {
        audio.currentTime = 0;
        audio.play();
      } else {
        // Next track with auto-play
        if (queue.length > 0) {
          const nextIndex = (currentIndex + 1) % queue.length;
          useMusicStore.getState().setCurrentIndexAndPlay(nextIndex);
        }
      }
    };

    const onError = (e: Event) => {
      console.error("Audio Error Event:", e);
      setIsLoading(false);
    };

    const onPause = () => {
      // Ignore pause events if we are programmatically switching tracks
      if (isSwitchingTrackRef.current) return;

      if (!audio.ended && audio.error === null) {
        setIsPlaying(false);
      }
    };

    const onPlay = () => {
      if (!isPlaying) {
        setIsPlaying(true);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, [
    isRepeat,
    currentTrack,
    isPlaying,
    setIsPlaying,
    setAudioCurrentTime,
    setDuration,
    queue.length,
    currentIndex,
    setIsLoading,
  ]);

  // Media Session Integration
  useEffect(() => {
    const updateMetadata = async () => {
      if (!currentTrack) return;
      try {
        await MediaSession.setMetadata({
          title: currentTrack.name || "Unknown Track",
          artist: currentTrack.artist?.join("/") || "Unknown Artist",
          album: currentTrack.album || "",
          artwork: coverUrl ? [{ src: coverUrl }] : [],
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
    const actionHandlers: [string, (details?: any) => void][] = [
      ["play", () => {
        useMusicStore.getState().setUserGesture();
        setIsPlaying(true);
      }],
      ["pause", () => setIsPlaying(false)],
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
        if (details?.seekTime !== undefined && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
          setAudioCurrentTime(details.seekTime);
        }
      }],
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        MediaSession.setActionHandler({ action: action as any }, handler);
      } catch (e) {
        console.error(`Failed to set action handler for ${action}`, e);
      }
    }
  }, [setIsPlaying, setAudioCurrentTime]);

  // Sync Position State
  useEffect(() => {
    const updatePosition = async () => {
      if (!audioRef.current) return;
      try {
        await MediaSession.setPositionState({
          duration: audioRef.current.duration || 0,
          playbackRate: audioRef.current.playbackRate,
          position: audioRef.current.currentTime,
        });
      } catch {}
    };

    // Update on play/pause and seek
    updatePosition();
    
    // Also update periodically? 
    // Usually the OS extrapolates, but updating on events is good.
    // We can hook into the existing onTimeUpdate via a ref or similar, 
    // but the store update throttle (1s) in the main effect is not exposed here.
    // For now, updating on dependency change (isPlaying, seekTimestamp) is a good start.
  }, [isPlaying, currentAudioTime, seekTimestamp]);

  return (
    <audio
      ref={audioRef}
      className="sr-only"
      preload="auto"
      playsInline // Important for mobile
    />
  );
}
