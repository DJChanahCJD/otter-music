"use client";

import { useMusicCover } from "@/hooks/useMusicCover";
import { retry } from "@/lib/utils";
import { musicApi } from "@/services/music-api";
import { useMusicStore } from "@/store/music-store";
import { useRef, useEffect } from "react";
import toast from "react-hot-toast";

export function GlobalMusicPlayer() {
  const {
    queue,
    currentIndex,
    volume,
    isRepeat,
    isPlaying,
    setIsPlaying,
    setIsLoading,
    playNext,
    setAudioCurrentTime,
    currentAudioTime,
    seekTimestamp,
    quality,
    setDuration,
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

  const setMediaSessionPlaybackState = (state: "none" | "paused" | "playing") => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch (error) {
      console.log("Error setting media session playback state:", error);
    }
  };

  const setMediaSessionPositionState = () => {
    if (!("mediaSession" in navigator)) return;
    const audio = audioRef.current;
    if (!audio) return;

    const mediaSession = navigator.mediaSession;
    if (typeof (mediaSession)?.setPositionState !== "function") return;

    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const playbackRate = Number.isFinite(audio.playbackRate) ? audio.playbackRate : 1;

    mediaSession.setPositionState({ duration, position, playbackRate });

  };

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
       setMediaSessionPositionState();
    }
  }, [currentAudioTime, seekTimestamp]); 
  // Dependency on seekTimestamp ensures we only seek when explicit action happens
  // We don't depend on currentAudioTime alone because that changes during playback

  // Load Track Logic
  useEffect(() => {
    if (!currentTrack || !currentTrackId || !currentTrackSource || !audioRef.current) return;

    const requestId = ++requestIdRef.current;
    let cancelled = false;

    const load = async () => {
      const audio = audioRef.current!;
      setIsLoading(true);

      try {
        // Pause current
        audio.pause();
        
        // 1. Get URL
        const url = await retry(
          () => musicApi.getUrl(currentTrackId, currentTrackSource, parseInt(quality, 10)),
          2,
          600
        );

        if (cancelled || requestId !== requestIdRef.current) return;
        if (!url) throw new Error("EMPTY_URL");

        // 2. Set Source
        if (audio.src !== url) {
          audio.src = url;
          audio.load();

          const resumeTime = useMusicStore.getState().currentAudioTime;
          if (resumeTime > 0 && Math.abs(audio.currentTime - resumeTime) > 1) {
            audio.currentTime = resumeTime;
          }
        }

        // 3. Play if needed
        // If isPlaying was true, we continue playing.
        if (useMusicStore.getState().isPlaying) {
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
        
        // Auto skip to next
        playNext(currentTrack); 
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [currentTrack, currentTrackId, currentTrackSource, playNext, quality, setIsLoading, setIsPlaying]); 
  // Note: we don't depend on isPlaying here. 
  // If isPlaying toggles, the other effect handles it.
  // But if we load a new track, we check isPlaying to decide auto-play.

  useEffect(() => {
    setMediaSessionPlaybackState(isPlaying ? "playing" : "paused");
  }, [isPlaying]);

  // Event Handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const now = Date.now();
      // Throttle store updates to every 1s
      if (now - lastSaveTimeRef.current > 1000) {
        setAudioCurrentTime(audio.currentTime);
        setMediaSessionPositionState();
        lastSaveTimeRef.current = now;
      }
    };

    const onDurationChange = () => {
      setDuration(audio.duration || 0);
      setMediaSessionPositionState();
    };

    const onEnded = () => {
      if (isRepeat) {
        audio.currentTime = 0;
        audio.play();
      } else {
        // Next track
        if (queue.length > 0) {
            const nextIndex = (currentIndex + 1) % queue.length;
            useMusicStore.getState().setCurrentIndex(nextIndex);
        }
      }
    };
    
    const onError = (e: Event) => {
        console.error("Audio Error Event:", e);
        setIsLoading(false);
    };
    
    const onPause = () => {
        // Only update if we think we are playing (sync external pauses like headphones)
        // But be careful of loops.
        // If we trigger pause via store, this event fires. Store is already false.
        // If system pauses, store is true. We should set to false.
        // Check if it was intentional?
        if (isPlaying && !audio.ended && audio.error === null && audio.paused) {
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
  }, [isRepeat, currentTrack, isPlaying, setIsPlaying, setAudioCurrentTime, setDuration, queue.length, currentIndex, setIsLoading]);

  // Media Session
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;

    const mediaSession = navigator.mediaSession;

    mediaSession.metadata = new MediaMetadata({
      title: currentTrack.name,
      artist: currentTrack.artist?.join("/") ?? "Unknown",
      album: currentTrack.album ?? "",
      artwork: coverUrl ? [{ src: coverUrl, sizes: "300x300", type: "image/jpeg" }] : [],
    });

    const safeSetActionHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null
    ) => {
      mediaSession.setActionHandler(action, handler);
    };

    safeSetActionHandler("play", () => setIsPlaying(true));
    safeSetActionHandler("pause", () => setIsPlaying(false));
    safeSetActionHandler("nexttrack", () => {
         if (queue.length > 0) {
            const nextIndex = (currentIndex + 1) % queue.length;
            useMusicStore.getState().setCurrentIndex(nextIndex);
         }
    });
    safeSetActionHandler("previoustrack", () => {
        const prevIndex = currentIndex - 1;
        useMusicStore.getState().setCurrentIndex(prevIndex < 0 ? queue.length - 1 : prevIndex);
    });
    safeSetActionHandler("seekto", (e) => {
        if (e.seekTime != null && audioRef.current) {
            audioRef.current.currentTime = e.seekTime;
            setAudioCurrentTime(e.seekTime);
            setMediaSessionPositionState();
        }
    });

    return () => {
      safeSetActionHandler("play", null);
      safeSetActionHandler("pause", null);
      safeSetActionHandler("nexttrack", null);
      safeSetActionHandler("previoustrack", null);
      safeSetActionHandler("seekto", null);
    };
  }, [currentTrack, setIsPlaying, currentIndex, queue.length, setAudioCurrentTime, coverUrl]);

  return (
    <audio
      ref={audioRef}
      className="sr-only"
      preload="auto"
      playsInline // Important for mobile
    />
  );
}
