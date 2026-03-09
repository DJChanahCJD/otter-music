import { useEffect, useRef } from "react";
import { throttle, retry } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useHistoryStore } from "@/store/history-store";
import { useDownloadStore } from "@/store/download-store";
import { Capacitor } from "@capacitor/core";
import { MediaSession } from "@jofr/capacitor-media-session";
import { buildDownloadKey } from "@/lib/utils/download";
import type { MusicSource } from "@/types/music";
import toast from "react-hot-toast";
import { handleAutoMatch } from "@/lib/audio-match";
import { getProxyUrl, isProxyUrl } from "@/lib/api";

type FallbackStage = "none" | "remote" | "proxy" | "final";

const AUDIO_READY_TIMEOUT = 8000;
const LOAD_WATCHDOG_TIMEOUT = 4000;
const LOCAL_FILE_RE = /_capacitor_file_|capacitor:\/\/|file:\/\//;

function getTrackKey(track?: { source: MusicSource; id: string } | null) {
  return track ? `${track.source}:${track.id}` : null;
}

function isLocalFileUrl(url: string) {
  return LOCAL_FILE_RE.test(url);
}

async function fetchRemoteUrl(trackId: string, source: MusicSource, quality: number) {
  return retry(async () => {
    const url = await musicApi.getUrl(trackId, source, quality);
    if (!url) throw new Error("EMPTY_URL");
    return url;
  }, 2, 800);
}

function waitForAudioReady(audio: HTMLAudioElement, timeout = AUDIO_READY_TIMEOUT): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("error", onError);
      clearTimeout(timer);
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const onReady = () => finish(resolve);
    const onError = () => finish(() => reject(new Error("AUDIO_NOT_READY")));

    const timer = setTimeout(() => {
      finish(() => reject(new Error("AUDIO_READY_TIMEOUT")));
    }, timeout);

    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("loadedmetadata", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
  });
}

async function warmupProxy(proxyUrl: string, timeout = AUDIO_READY_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(proxyUrl, {
      method: "GET",
      headers: { Range: "bytes=0-1" },
      signal: controller.signal,
    });

    if (!resp.ok && resp.status !== 206) {
      throw new Error(`PROXY_WARMUP_FAILED_${resp.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function setAudioSourceAndPlay(audio: HTMLAudioElement, url: string) {
  const { setCurrentAudioUrl, setIsPlaying } = useMusicStore.getState();

  if (audio.src !== url) {
    setCurrentAudioUrl(url);
    audio.src = url;
    audio.load();
    await waitForAudioReady(audio);
  }

  await audio.play();
  setIsPlaying(true);
}

async function retryWithRemote(audio: HTMLAudioElement, trackId: string, source: MusicSource, quality: number) {
  const remoteUrl = await fetchRemoteUrl(trackId, source, quality);
  await setAudioSourceAndPlay(audio, remoteUrl);
}

async function retryWithProxy(audio: HTMLAudioElement, originalUrl: string) {
  const proxyUrl = getProxyUrl(originalUrl);
  await warmupProxy(proxyUrl);
  await setAudioSourceAndPlay(audio, proxyUrl);
}

// --- Hook 核心逻辑优化 ---
export function useAudioEventHandlers(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoMatchedTrackIdRef = useRef<string | null>(null);
  const fallbackingRef = useRef(false);
  const lastToastKeyRef = useRef<string | null>(null);

  const fallbackStageRef = useRef<{ trackKey: string | null; stage: FallbackStage }>({
    trackKey: null,
    stage: "none",
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const loadingToastId = "audio-loading";

    const clearLoadTimeout = () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };

    const settleLoading = () => {
      const state = useMusicStore.getState();
      if (state.isLoading) {
        state.setIsLoading(false);
      }
      toast.dismiss(loadingToastId);
    };

    const startLoadTimeout = () => {
      clearLoadTimeout();
      const isProxy = isProxyUrl(audio.src || "");
      const timeoutMs = isProxy ? 10000 : LOAD_WATCHDOG_TIMEOUT;
      loadTimeoutRef.current = setTimeout(() => void triggerFallback("TIMEOUT"), timeoutMs);
    };

    const notifyOnce = (key: string, message: string) => {
      if (lastToastKeyRef.current === key) return;
      lastToastKeyRef.current = key;
      toast.error(message);
    };

    const resetTrackScopedState = (track?: { source: MusicSource; id: string } | null) => {
      const trackKey = getTrackKey(track);
      if (fallbackStageRef.current.trackKey !== trackKey) {
        fallbackStageRef.current = { trackKey, stage: "none" };
        lastToastKeyRef.current = null;
      }
    };

    const triggerFallback = async (reason: "TIMEOUT" | "NATIVE_ERROR") => {
      if (fallbackingRef.current) return;
      fallbackingRef.current = true;
      clearLoadTimeout();

      try {
        const state = useMusicStore.getState();
        const track = state.queue[state.currentIndex];
        if (!track) return;

        resetTrackScopedState(track);
        if (track.source) useSourceQualityStore.getState().recordFail(track.source);

        const currentSrc = audio.src || "";
        const isLocal = isLocalFileUrl(currentSrc);
        const { stage } = fallbackStageRef.current;

        // 1. Native 下载文件失效 -> 回退到远程
        if (Capacitor.isNativePlatform() && track.source !== "local" && stage === "none") {
          const downloadKey = buildDownloadKey(track.source, track.id);
          if (useDownloadStore.getState().getUri(downloadKey) && isLocal) {
            fallbackStageRef.current.stage = "remote";
            useDownloadStore.getState().removeRecord(downloadKey);
            notifyOnce(`remote:${track.id}`, "本地文件失效，已切换在线播放");
            await retryWithRemote(audio, track.id, track.source, parseInt(state.quality, 10));
            return;
          }
        }

        // 2. 远程失败 -> 尝试代理
        if ((stage === "none" || stage === "remote") && currentSrc && !isLocal && !isProxyUrl(currentSrc)) {
          fallbackStageRef.current.stage = "proxy";
          await retryWithProxy(audio, currentSrc);
          toast("已切换备用线路", { icon: "🌐", id: "proxy-notice" });
          return;
        }

        // 3. 最终失败 -> 跳过
        fallbackStageRef.current.stage = "final";
        audio.src = "";
        state.setCurrentAudioUrl(null);
        notifyOnce(`final:${track.id}`, `播放失败: ${track.name}`);
        settleLoading();
        state.skipToNext();

      } catch (err) {
        settleLoading();
        console.error(`[audio:fallback:${reason}]`, err);
      } finally {
        fallbackingRef.current = false;
      }
    };

    const onTimeUpdate = throttle(() => {
      if (isSwitchingTrackRef.current) return;
      useMusicStore.getState().setAudioCurrentTime(audio.currentTime);
      MediaSession.setPositionState({
        duration: audio.duration || 0,
        playbackRate: audio.playbackRate,
        position: audio.currentTime,
      }).catch(e => console.error("MediaSession position error:", e));
    }, 1000);

    const onDurationChange = () => {
      const state = useMusicStore.getState();
      const currentTrack = state.queue[state.currentIndex];
      const duration = audio.duration || 0;

      state.setDuration(duration);

      if (
        currentTrack?.source === "_netease" &&
        duration >= 30 && duration <= 45 &&
        state.enableAutoMatch &&
        autoMatchedTrackIdRef.current !== currentTrack.id
      ) {
        autoMatchedTrackIdRef.current = currentTrack.id;
        void handleAutoMatch(currentTrack);
      }
    };

    const onEnded = () => {
      clearLoadTimeout();
      const state = useMusicStore.getState();
      if (state.isRepeat) {
        audio.currentTime = 0;
        void audio.play();
      } else if (state.queue.length > 0) {
        state.setCurrentIndexAndPlay((state.currentIndex + 1) % state.queue.length);
      }
    };

    const onPause = () => {
      if (isSwitchingTrackRef.current || audio.ended || audio.error) return;
      useMusicStore.getState().setIsPlaying(false);
    };

    const onPlay = () => {
      clearLoadTimeout();
      settleLoading();
      if (audio.paused || hasRecordedRef.current) return;
      
      hasRecordedRef.current = true;
      const state = useMusicStore.getState();
      const track = state.queue[state.currentIndex];

      if (!state.isPlaying) state.setIsPlaying(true);
      state.resetFailures();

      if (track) {
        resetTrackScopedState(track);
        useSourceQualityStore.getState().recordSuccess(track.source);
        useHistoryStore.getState().addToHistory(track);
      }
    };

    // 批量注册与清理事件监听，大幅减少样板代码
    const eventHandlers: Record<string, EventListenerOrEventListenerObject> = {
      timeupdate: onTimeUpdate,
      durationchange: onDurationChange,
      ended: onEnded,
      error: () => void triggerFallback("NATIVE_ERROR"),
      pause: onPause,
      play: onPlay,
      loadstart: startLoadTimeout,
      waiting: startLoadTimeout,
      canplay: () => {
        clearLoadTimeout();
        settleLoading();
      },
      playing: () => {
        clearLoadTimeout();
        settleLoading();
      },
      loadedmetadata: () => {
        clearLoadTimeout();
        settleLoading();
      },
    };

    Object.entries(eventHandlers).forEach(([event, handler]) => {
      audio.addEventListener(event, handler);
    });

    return () => {
      clearLoadTimeout();
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        audio.removeEventListener(event, handler);
      });
    };
  }, [audioRef, isSwitchingTrackRef, hasRecordedRef]);

  return null;
}
