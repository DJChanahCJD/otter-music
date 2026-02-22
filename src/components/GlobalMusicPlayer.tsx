"use client";

import { useMusicCover } from "@/hooks/useMusicCover";
import { retry, throttle } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useHistoryStore } from "@/store/history-store";
import { useDownloadStore } from "@/store/download-store";
import { useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { MediaSession } from "@jofr/capacitor-media-session";
import { Capacitor } from "@capacitor/core";
import { buildDownloadKey } from "@/lib/utils/download";
import type { MusicSource } from "@/types/music";

async function resolveAudioUrl({
  trackId,
  source,
  quality,
}: {
  trackId: string
  source: MusicSource
  quality: number
}): Promise<string> {
  const isNative = Capacitor.isNativePlatform()
  const isLocal = source === 'local'

  if (isLocal) {
    return retry(async () => {
      const url = await musicApi.getUrl(trackId, source, quality)
      if (!url) throw new Error('LOCAL_FILE_NOT_ACCESSIBLE')
      return url
    }, 2, 800)
  }

  if (isNative) {
    const key = buildDownloadKey(source, trackId)
    const uri = useDownloadStore.getState().getUri(key)
    if (uri) {
      return Capacitor.convertFileSrc(uri)
    }
  }

  return retry(async () => {
    const url = await musicApi.getUrl(trackId, source, quality)
    if (!url) throw new Error('EMPTY_URL')
    return url
  }, 2, 800)
}

async function retryWithRemote(
  audio: HTMLAudioElement,
  trackId: string,
  source: MusicSource,
  quality: number
): Promise<void> {
  const remoteUrl = await retry(
    async () => {
      const result = await musicApi.getUrl(trackId, source, quality)
      if (!result) throw new Error("EMPTY_URL")
      return result
    },
    2,
    800,
  )

  if (audio.src !== remoteUrl) {
    audio.src = remoteUrl
    audio.load()
    await audio.play()
  }
}

export function GlobalMusicPlayer() {
  const currentTrack = useMusicStore(s => s.queue[s.currentIndex])
  const isPlaying = useMusicStore(s => s.isPlaying)
  const quality = useMusicStore(s => s.quality)
  const volume = useMusicStore(s => s.volume)
  const isRepeat = useMusicStore(s => s.isRepeat)
  const currentAudioTime = useMusicStore(s => s.currentAudioTime)
  const setIsPlaying = useMusicStore(s => s.setIsPlaying)
  const setIsLoading = useMusicStore(s => s.setIsLoading)
  const skipToNext = useMusicStore(s => s.skipToNext)
  const setAudioCurrentTime = useMusicStore(s => s.setAudioCurrentTime)
  const seekTargetTime = useMusicStore(s => s.seekTargetTime)
  const seekTimestamp = useMusicStore(s => s.seekTimestamp)
  const clearSeekTargetTime = useMusicStore(s => s.clearSeekTargetTime)
  const setDuration = useMusicStore(s => s.setDuration)
  const setCurrentAudioUrl = useMusicStore(s => s.setCurrentAudioUrl)
  const hasUserGesture = useMusicStore(s => s.hasUserGesture)
  const queue = useMusicStore(s => s.queue)
  const currentIndex = useMusicStore(s => s.currentIndex)
  const incrementFailures = useMusicStore(s => s.incrementFailures)
  const maxConsecutiveFailures = useMusicStore(s => s.maxConsecutiveFailures)

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTrackId = currentTrack?.id;
  const currentTrackSource = currentTrack?.source;
  const currentTrackUrlId = currentTrack?.url_id;
  const coverUrl = useMusicCover(currentTrack);

  const requestIdRef = useRef(0);
  const isSwitchingTrackRef = useRef(false);
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
    const currentRequestId = requestId;

    const load = async () => {
      const audio = audioRef.current!;
      setIsLoading(true);

      isSwitchingTrackRef.current = true;
      hasRecordedRef.current = false;

      try {
        audio.pause();

        // 网络状态检测：检查是否可以播放
        const isLocal = (currentTrackSource as string) === 'local';
        const hasDownload = Capacitor.isNativePlatform()
          ? useDownloadStore.getState().hasRecord(buildDownloadKey(currentTrackSource, currentTrackId || ''))
          : false;

        if (!isLocal && !hasDownload && !navigator.onLine) {
          toast.error("网络不可用，请检查网络连接");
          setIsPlaying(false);
          return;
        }

        const urlId = (currentTrackSource as string) === 'local' ? currentTrackUrlId : currentTrackId;
        const br = parseInt(quality, 10);

        const toastId = toast.loading("加载中...", { id: `download-${requestId}` });

        try {
          const audioUrl = await resolveAudioUrl({
            trackId: urlId || '',
            source: currentTrackSource,
            quality: br,
          });

          if (requestId !== requestIdRef.current) {
            toast.dismiss(toastId);
            return;
          }

          setCurrentAudioUrl(audioUrl);

          if (audio.src !== audioUrl) {
            audio.src = audioUrl;
            audio.load();
          }

          audio.currentTime = currentAudioTime;

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.error("Auto-play failed:", error);
              setIsPlaying(false);
            });
          }

          toast.success("加载完成", { id: toastId });
        } catch (err: unknown) {
          toast.dismiss(toastId);
          throw err;
        }
      } catch (err: unknown) {
        if (requestId !== requestIdRef.current) return;
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Audio load failed:", errorMessage);

        if (errorMessage === "LOCAL_FILE_NOT_ACCESSIBLE") {
          toast.error(`无法访问本地文件: ${currentTrack.name}`);
        } else {
          toast.error(`无法播放: ${currentTrack.name}`);
        }

        if (currentTrackSource) {
          useSourceQualityStore.getState().recordFail(currentTrackSource);
        }

        audio.src = "";
        setCurrentAudioUrl(null);

        // 连续失败计数：超过阈值时停止跳下一首
        const failures = incrementFailures();
        if (failures >= maxConsecutiveFailures) {
          toast.error("多次加载失败，已停止播放");
          setIsPlaying(false);
        } else {
          skipToNext();
        }
      } finally {
        if (requestId === requestIdRef.current) {
          isSwitchingTrackRef.current = false;
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      if (currentRequestId === requestIdRef.current) {
        requestIdRef.current++;
      }
    };
  }, [currentTrack.id, currentTrack.source, quality, hasUserGesture, currentTrack, currentTrackId, currentTrackSource, currentTrackUrlId, setCurrentAudioUrl, setIsLoading, setIsPlaying, skipToNext, incrementFailures, maxConsecutiveFailures]);

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

    const onTimeUpdate = throttle(() => {
      if (isSwitchingTrackRef.current) return;
      setAudioCurrentTime(audio.currentTime);

      MediaSession.setPositionState({
        duration: audio.duration || 0,
        playbackRate: audio.playbackRate,
        position: audio.currentTime,
      }).catch(e => console.error('MediaSession position error:', e));
    }, 1000);

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

    const onError = async (e: Event) => {
      console.error("Audio Error Event:", e);
      setIsLoading(false);

      if (currentTrack?.source) {
        useSourceQualityStore.getState().recordFail(currentTrack.source);
      }

      if (Capacitor.isNativePlatform() && (currentTrackSource as string) !== 'local') {
        const downloadKey = buildDownloadKey(currentTrackSource, currentTrackId || '');
        const downloadUri = useDownloadStore.getState().getUri(downloadKey);

        if (downloadUri && audio.src.startsWith('file://')) {
          useDownloadStore.getState().removeRecord(downloadKey);

          try {
            const br = parseInt(quality, 10);
            await retryWithRemote(audio, currentTrackId || '', currentTrackSource, br);
          } catch (retryError) {
            console.error("Retry load failed:", retryError);
            toast.error(`无法播放: ${currentTrack.name}`);
            audio.src = "";
            setCurrentAudioUrl(null);
            skipToNext();
          }
        }
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
      
      // 播放成功，重置失败计数
      useMusicStore.getState().resetFailures();
      
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
  }, [isRepeat, currentTrack?.source, currentTrack?.name, currentTrack, isPlaying, setIsPlaying, setAudioCurrentTime, setDuration, queue.length, currentIndex, setIsLoading, currentTrackSource, currentTrackUrlId, currentTrackId, quality, setCurrentAudioUrl, skipToNext]);

  // Media Session Integration
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
        const musicStore = useMusicStore.getState();
        const prevIndex = musicStore.currentIndex - 1;
        musicStore.setCurrentIndexAndPlay(prevIndex < 0 ? musicStore.queue.length - 1 : prevIndex);
      }],
      ["nexttrack", () => {
        const musicStore = useMusicStore.getState();
        if (musicStore.queue.length > 0) {
          const nextIndex = (musicStore.currentIndex + 1) % musicStore.queue.length;
          musicStore.setCurrentIndexAndPlay(nextIndex);
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
  }, [setIsPlaying]);

  return (
    <audio
      ref={audioRef}
      className="sr-only"
      preload="auto"
      playsInline // Important for mobile
    />
  );
}
