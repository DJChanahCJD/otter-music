import { useEffect, useRef } from "react";
import { throttle } from "@/lib/utils";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useHistoryStore } from "@/store/history-store";
import { MediaSession } from "@jofr/capacitor-media-session";
import toast from "react-hot-toast";
import { handleAutoMatch } from "@/lib/audio-match";
import { logger } from "@/lib/logger";

const PAUSE_CONFIRM_DELAY_MS = 200;

export function useAudioEventHandlers(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const autoMatchedTrackIdRef = useRef<string | null>(null);
  const pauseConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseConfirmTokenRef = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const loadingToastId = "audio-loading";

    const settleLoading = () => {
      const state = useMusicStore.getState();
      if (state.isLoading) state.setIsLoading(false);
      toast.dismiss(loadingToastId);
    };

    const markLoading = () => {
      const state = useMusicStore.getState();
      if (!state.isLoading) state.setIsLoading(true);
    };

    const syncPositionState = (playbackRate: number) => {
      MediaSession.setPositionState({
        duration: audio.duration || 0,
        playbackRate,
        position: audio.currentTime,
      }).catch(console.error);
    };

    const cancelPendingPauseConfirm = () => {
      pauseConfirmTokenRef.current += 1;
      if (pauseConfirmTimerRef.current) {
        clearTimeout(pauseConfirmTimerRef.current);
        pauseConfirmTimerRef.current = null;
      }
    };

    const onTimeUpdate = throttle(() => {
      if (isSwitchingTrackRef.current) return;
      if (!audio.paused) cancelPendingPauseConfirm();

      const state = useMusicStore.getState();
      state.setAudioCurrentTime(audio.currentTime);
      if (!audio.paused && !state.isPlaying) {
        state.setIsPlaying(true);
      }

      syncPositionState(audio.paused ? 0 : audio.playbackRate);
    }, 1000);

    const onDurationChange = () => {
      const state = useMusicStore.getState();
      const track = state.queue[state.currentIndex];
      const duration = audio.duration || 0;

      state.setDuration(duration);

      if (
        track?.source === "_netease" &&
        duration >= 30 &&
        duration <= 45 &&
        state.enableAutoMatch &&
        autoMatchedTrackIdRef.current !== track.id
      ) {
        autoMatchedTrackIdRef.current = track.id;
        void handleAutoMatch(track);
      }
    };

    const onEnded = () => {
      const state = useMusicStore.getState();
      syncPositionState(0);

      if (state.isRepeat) {
        audio.currentTime = 0;
        void audio.play();
      } else if (state.queue.length) {
        state.setCurrentIndexAndPlay((state.currentIndex + 1) % state.queue.length);
      }
    };

    const onPause = () => {
      syncPositionState(0);
      if (isSwitchingTrackRef.current || audio.ended || audio.error) return;

      cancelPendingPauseConfirm();
      const token = pauseConfirmTokenRef.current;
      pauseConfirmTimerRef.current = setTimeout(() => {
        if (token !== pauseConfirmTokenRef.current) return;
        pauseConfirmTimerRef.current = null;

        if (isSwitchingTrackRef.current || audio.ended || audio.error || !audio.paused) return;

        const state = useMusicStore.getState();
        if (state.isPlaying) state.setIsPlaying(false);
      }, PAUSE_CONFIRM_DELAY_MS);
    };

    const onPlay = () => {
      cancelPendingPauseConfirm();
      settleLoading();
      if (audio.paused) return;

      const state = useMusicStore.getState();
      const track = state.queue[state.currentIndex];

      if (!state.isPlaying) state.setIsPlaying(true);
      state.resetFailures();

      if (hasRecordedRef.current) return;
      hasRecordedRef.current = true;

      if (track) {
        useSourceQualityStore.getState().recordSuccess(track.source);
        useHistoryStore.getState().addToHistory(track);
      }
    };

    const events: Record<string, EventListener> = {
      timeupdate: onTimeUpdate,
      durationchange: onDurationChange,
      ended: onEnded,
      pause: onPause,
      play: onPlay,
      error: () => {
        cancelPendingPauseConfirm();
        logger.error("useAudioEventHandlers", "Audio error");
        useMusicStore.getState().setIsPlaying(false);
        syncPositionState(0);
      },
      loadstart: markLoading,
      waiting: markLoading,
      canplay: settleLoading,
      playing: () => {
        cancelPendingPauseConfirm();
        settleLoading();
      },
      loadedmetadata: settleLoading,
    };

    Object.entries(events).forEach(([event, handler]) =>
      audio.addEventListener(event, handler)
    );

    return () => {
      cancelPendingPauseConfirm();
      Object.entries(events).forEach(([event, handler]) =>
        audio.removeEventListener(event, handler)
      );
    };
  }, [audioRef, isSwitchingTrackRef, hasRecordedRef]);

  return null;
}
