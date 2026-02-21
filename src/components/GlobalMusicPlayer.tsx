"use client";

import { useMusicCover } from "@/hooks/useMusicCover";
import { retry } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useHistoryStore } from "@/store/history-store";
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
    skipToNext,
    setAudioCurrentTime,
    seekTargetTime,
    seekTimestamp,
    clearSeekTargetTime,
    quality,
    setDuration,
    setCurrentAudioUrl,
    hasUserGesture,
  } = useMusicStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTrack = queue[currentIndex];
  const currentTrackId = currentTrack?.id;
  const currentTrackSource = currentTrack?.source;
  const currentTrackUrlId = currentTrack?.url_id;
  const coverUrl = useMusicCover(currentTrack);

  // Ref to track current request to avoid race conditions
  const requestIdRef = useRef(0);
  // Ref to throttle time updates
  const lastSaveTimeRef = useRef(0);
  // Ref to track if we are switching tracks (to avoid triggering pause event logic)
  const isSwitchingTrackRef = useRef(false);
  // Ref to track if we have already recorded success/history for current track
  const hasRecordedRef = useRef(false);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle Seek
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || seekTimestamp === 0 || seekTargetTime < 0) return;

    if (Number.isFinite(seekTargetTime)) {
      audio.currentTime = seekTargetTime;
      setAudioCurrentTime(seekTargetTime);
      clearSeekTargetTime();
    }
  }, [seekTargetTime, seekTimestamp, setAudioCurrentTime, clearSeekTargetTime]);

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
      // 重置记录状态，以便新曲目可以正确记录
      hasRecordedRef.current = false;

      try {
        // Pause current
        audio.pause();

        // 1. Get URL with proper retry (null -> throw to trigger retry)
        const url = await retry(
          async () => {
            // 本地音乐使用 url_id（本地文件路径），在线音乐使用 id
            const urlId = currentTrackSource === 'local' ? currentTrackUrlId : currentTrackId;
            const result = await musicApi.getUrl(
              urlId || '',
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

        // 新歌曲从 0 开始播放，不再使用旧的 currentAudioTime
        audio.currentTime = 0;

        // 只有在用户意图是播放时才自动播放
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

        // 记录播放失败
        if (currentTrackSource) {
          useSourceQualityStore.getState().recordFail(currentTrackSource);
        }

        // Clear audio source to prevent playing previous track
        audio.src = "";
        audio.load();
        setCurrentAudioUrl(null);

        // Auto skip to next
        skipToNext();
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
  }, [hasUserGesture, currentTrack, currentTrackId, currentTrackSource, currentTrackUrlId, quality, setCurrentAudioUrl, setIsLoading]);

  // 恢复播放控制（isPlaying 变化时触发，但不重新加载曲目）
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    // 如果正在切换曲目，忽略
    if (isSwitchingTrackRef.current) return;

    if (isPlaying && audio.paused) {
      audio.play().catch((e) => {
        console.error("Resume play failed:", e);
        setIsPlaying(false);
      });
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, setIsPlaying]);

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
      // 记录播放失败
      if (currentTrack?.source) {
        useSourceQualityStore.getState().recordFail(currentTrack.source);
      }
    };

    const onPause = () => {
      // Ignore pause events if we are programmatically switching tracks
      if (isSwitchingTrackRef.current) return;

      if (!audio.ended && audio.error === null) {
        setIsPlaying(false);
      }
    };

    const onPlay = () => {
      // 使用 audio 的实际 paused 状态判断是否真正开始播放
      if (audio.paused) return;
      
      // 避免重复记录
      if (hasRecordedRef.current) return;
      hasRecordedRef.current = true;

      // 同步 UI 状态
      if (!isPlaying) {
        setIsPlaying(true);
      }
      
      // 记录播放成功
      if (currentTrack?.source) {
        useSourceQualityStore.getState().recordSuccess(currentTrack.source);
      }
      // 记录播放历史
      if (currentTrack) {
        useHistoryStore.getState().addToHistory(currentTrack);
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
        if (details?.seekTime !== undefined) {
          useMusicStore.getState().seek(details.seekTime);
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
  }, [setIsPlaying]);

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

    updatePosition();
  }, [isPlaying, seekTargetTime, seekTimestamp]);

  return (
    <audio
      ref={audioRef}
      className="sr-only"
      preload="auto"
      playsInline // Important for mobile
    />
  );
}
