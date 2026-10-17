import { useEffect, useRef } from "react";
import { throttle } from "@/lib/utils";
import { useMusicStore } from "@/store/music-store";
import { useAppStore } from "@/store/app-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useHistoryStore } from "@/store/history-store";
import { useOfflineStore } from "@/store/offline-store";
import { MediaSession } from "@jofr/capacitor-media-session";
import toast from "react-hot-toast";
import { handleAutoMatch, isNeteaseSampleClip } from "@/lib/audio-match";
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
      }).catch((e) =>
        logger.error("MediaSession", "setPositionState failed", e)
      );
    };

    const clearPauseTimer = () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
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

        // 检测网易云试听片段（音频时长可能是浮点型）
        if (
          state.enableAutoMatch &&
          track?.source === "_netease" &&
          isNeteaseSampleClip(duration, audio.src)
        ) {
          const am = autoMatchRef.current;
          if (am.index !== state.currentIndex) am.count = 0; // 重置计数

          if (am.count < MAX_AUTO_MATCH_PER_TRACK) {
            am.index = state.currentIndex;
            am.count++;
            // 搜索耗时期间原音源可能已恢复正常播放（临时时长被纠正为完整时长），
            // 此时中止换源，避免误覆盖可正常播放的源
            void handleAutoMatch(track, undefined, undefined, () => {
              const musicState = useMusicStore.getState();
              const current = musicState.queue[musicState.currentIndex];
              if (current?.id !== track.id) return false;
              return (
                !audio.paused &&
                !audio.error &&
                !isNeteaseSampleClip(audio.duration || 0, audio.src)
              );
            });
          }
        }
      },

      ended: () => {
        syncPositionState(0);
        const state = getMusicState();

        if (state.sleepTimerStopAfterCurrentTrack) {
          state.setIsPlaying(false);
          state.setSleepTimerIsActive(false);
          state.setSleepTimerStopAfterCurrentTrack(false);
          state.setSleepTimerRemaining(0);
          state.setSleepTimerEndTime(0);
        } else if (state.isRepeat) {
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
        const state = getMusicState();

        // pause 事件触发时 store 仍为播放中 ⇒ 非用户发起(如其他应用抢占音频焦点)
        if (
          useAppStore.getState().allowSimultaneousPlayback &&
          state.isPlaying
        ) {
          logger.info("useAudioEventHandlers", "External pause, resuming");
          audio.play().catch(() => state.setIsPlaying(false));
          return;
        }

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

        if (!state.isPlaying) state.setIsPlaying(true);
        state.resetFailures();

        if (!hasRecordedRef.current && track) {
          hasRecordedRef.current = true;
          useSourceQualityStore.getState().recordSuccess(track.source);
          useHistoryStore.getState().addToHistory(track);

          // 记录远程流媒体缓存
          if (
            track.source !== "local" &&
            audio.src &&
            !/^(blob|capacitor):/.test(audio.src)
          ) {
            useOfflineStore.getState()?.addRecord?.({
              ...track,
              trackId: track.id,
              source: "stream-cache",
              url: audio.src,
              cachedAt: Date.now(),
              trackSource: track.source,
            });
          }
        }
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
