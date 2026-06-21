import { useEffect, useRef } from "react";
import { throttle } from "@/lib/utils";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useHistoryStore } from "@/store/history-store";
import { useOfflineStore } from "@/store/offline-store";
import {
  AUDIO_STREAM_CACHE_NAME,
  hasCacheEntry,
  hasCacheEntryAfterDelay,
} from "@/lib/sw-cache";
import { MediaSession } from "@jofr/capacitor-media-session";
import toast from "react-hot-toast";
import { handleAutoMatch } from "@/lib/audio-match";
import { logger } from "@/lib/logger";

const PAUSE_CONFIRM_DELAY_MS = 200;
const MAX_AUTO_MATCH_PER_TRACK = 3;

export function useAudioEventHandlers(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const autoMatchRef = useRef({ index: -1, count: 0 });
  const recoveryAttemptedRef = useRef(false);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSessionRecordedRef = useRef(false);
  const prevTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 缓存 getState 方法以减少代码冗余
    const getMusicState = useMusicStore.getState;

    const toggleLoading = (isLoading: boolean) => {
      const state = getMusicState();
      if (state.isLoading !== isLoading) state.setIsLoading(isLoading);
      if (!isLoading) toast.dismiss("audio-loading");
    };

    const syncPositionState = (rate = audio.playbackRate || 1) => {
      const duration = Math.max(audio.duration || 0, 0);
      MediaSession.setPositionState({
        duration,
        playbackRate: rate,
        position: audio.currentTime,
      }).catch(console.error);
    };

    const clearPauseTimer = () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };

    /**
     * 在音频可以持续播放且 SW 已缓存对应响应后，写入离线记录。
     * 使用 hasRecordedRef 防止同一次播放会话重复写入。
     */
    const writeOfflineRecord = async () => {
      if (hasRecordedRef.current) return;

      const state = getMusicState();
      const track = state.queue[state.currentIndex];
      if (!track || track.source === "local") return;
      if (!audio.src || /^(blob|capacitor):/.test(audio.src)) return;

      let hasCache = await hasCacheEntry(AUDIO_STREAM_CACHE_NAME, audio.src);
      if (!hasCache) {
        hasCache = await hasCacheEntryAfterDelay(
          AUDIO_STREAM_CACHE_NAME,
          audio.src
        );
      }

      if (!hasCache) {
        logger.warn(
          "useAudioEventHandlers",
          "SW cache entry not found, skip offline record",
          {
            trackId: track.id,
            src: audio.src,
          }
        );
        return;
      }

      hasRecordedRef.current = true;
      useOfflineStore.getState().addRecord({
        ...track,
        trackId: track.id,
        source: "stream-cache",
        url: audio.src,
        cacheKey: audio.src,
        cachedAt: Date.now(),
        verifiedAt: Date.now(),
        trackSource: track.source,
      });
      logger.info("useAudioEventHandlers", "Offline record created", {
        trackId: track.id,
        cacheKey: audio.src,
      });
    };

    const handlers: Record<string, EventListener> = {
      timeupdate: throttle(() => {
        if (isSwitchingTrackRef.current) return;
        if (!audio.paused) clearPauseTimer();

        const state = getMusicState();
        state.setAudioCurrentTime(audio.currentTime);
        if (!audio.paused && !state.isPlaying) state.setIsPlaying(true);

        syncPositionState(audio.paused ? 0 : audio.playbackRate);
      }, 1000),

      durationchange: () => {
        const state = getMusicState();
        const track = state.queue[state.currentIndex];
        const duration = audio.duration || 0;
        state.setDuration(duration);

        // 检测网易云试听片段
        const isNeteaseSample =
          [30, 45, 60].includes(duration) || audio.src.includes("jdusicrep-ts");
        if (
          state.enableAutoMatch &&
          track?.source === "_netease" &&
          isNeteaseSample
        ) {
          const am = autoMatchRef.current;
          if (am.index !== state.currentIndex) am.count = 0; // 重置计数

          if (am.count < MAX_AUTO_MATCH_PER_TRACK) {
            am.index = state.currentIndex;
            am.count++;
            void handleAutoMatch(track);
          }
        }
      },

      ended: () => {
        syncPositionState(0);
        const state = getMusicState();

        if (state.isRepeat) {
          audio.currentTime = 0;
          audio.play().catch(() => state.setIsPlaying(false));
        } else if (state.queue.length) {
          state.setCurrentIndexAndPlay(
            (state.currentIndex + 1) % state.queue.length
          );
        }
      },

      pause: () => {
        syncPositionState(0);
        if (isSwitchingTrackRef.current || audio.ended || audio.error) return;

        clearPauseTimer();
        pauseTimerRef.current = setTimeout(() => {
          if (
            isSwitchingTrackRef.current ||
            audio.ended ||
            audio.error ||
            !audio.paused
          )
            return;
          getMusicState().setIsPlaying(false);
        }, PAUSE_CONFIRM_DELAY_MS);
      },

      play: () => {
        clearPauseTimer();
        toggleLoading(false);
        if (audio.paused) return;

        recoveryAttemptedRef.current = false;
        const state = getMusicState();
        const track = state.queue[state.currentIndex];

        if (track && track.id !== prevTrackIdRef.current) {
          prevTrackIdRef.current = track.id;
          hasSessionRecordedRef.current = false;
        }

        if (!state.isPlaying) state.setIsPlaying(true);
        state.resetFailures();

        if (!hasSessionRecordedRef.current && track) {
          hasSessionRecordedRef.current = true;
          useSourceQualityStore.getState().recordSuccess(track.source);
          useHistoryStore.getState().addToHistory(track);
        }
      },

      canplaythrough: () => {
        toggleLoading(false);
        void writeOfflineRecord();
      },

      error: () => {
        clearPauseTimer();
        const state = getMusicState();

        if (!recoveryAttemptedRef.current && state.queue.length > 0) {
          recoveryAttemptedRef.current = true;
          logger.warn(
            "useAudioEventHandlers",
            "Audio error, attempting URL recovery"
          );
          state.incrementUrlRecoveryKey();
        } else {
          logger.error("useAudioEventHandlers", "Audio error");
          state.setIsPlaying(false);
          syncPositionState(0);
        }
      },

      loadstart: () => toggleLoading(true),
      waiting: () => toggleLoading(true),
      canplay: () => toggleLoading(false),
      playing: () => {
        clearPauseTimer();
        toggleLoading(false);
      },
      loadedmetadata: () => toggleLoading(false),
    };

    Object.entries(handlers).forEach(([event, handler]) =>
      audio.addEventListener(event, handler)
    );

    return () => {
      clearPauseTimer();
      Object.entries(handlers).forEach(([event, handler]) =>
        audio.removeEventListener(event, handler)
      );
    };
  }, [audioRef, isSwitchingTrackRef, hasRecordedRef]);

  return null;
}
