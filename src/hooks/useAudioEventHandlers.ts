import { useEffect, useRef } from "react";
import { throttle } from "@/lib/utils";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useHistoryStore } from "@/store/history-store";
import { MediaSession } from "@jofr/capacitor-media-session";
import toast from "react-hot-toast";
import { handleAutoMatch } from "@/lib/audio-match";

export function useAudioEventHandlers(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const autoMatchedTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const loadingToastId = "audio-loading";

    /** 结束 loading 状态 */
    const settleLoading = () => {
      const state = useMusicStore.getState();
      if (state.isLoading) state.setIsLoading(false);
      toast.dismiss(loadingToastId);
    };

    /** 标记 loading */
    const markLoading = () => {
      const state = useMusicStore.getState();
      if (!state.isLoading) state.setIsLoading(true);
    };

    /** 播放进度更新（节流） */
    const onTimeUpdate = throttle(() => {
      if (isSwitchingTrackRef.current) return;

      const state = useMusicStore.getState();
      state.setAudioCurrentTime(audio.currentTime);

      MediaSession.setPositionState({
        duration: audio.duration || 0,
        playbackRate: audio.playbackRate,
        position: audio.currentTime,
      }).catch(console.error);
    }, 1000);

    /** 音频时长变化 */
    const onDurationChange = () => {
      const state = useMusicStore.getState();
      const track = state.queue[state.currentIndex];
      const duration = audio.duration || 0;

      state.setDuration(duration);

      // Netease 试听自动匹配
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

    /** 播放结束 */
    const onEnded = () => {
      const state = useMusicStore.getState();

      if (state.isRepeat) {
        audio.currentTime = 0;
        void audio.play();
      } else if (state.queue.length) {
        state.setCurrentIndexAndPlay((state.currentIndex + 1) % state.queue.length);
      }
    };

    /** 暂停 */
    const onPause = () => {
      if (isSwitchingTrackRef.current || audio.ended || audio.error) return;
      useMusicStore.getState().setIsPlaying(false);
    };

    /** 播放开始 */
    const onPlay = () => {
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

    /** 统一事件注册 */
    const events: Record<string, EventListener> = {
      timeupdate: onTimeUpdate,
      durationchange: onDurationChange,
      ended: onEnded,
      pause: onPause,
      play: onPlay,
      error: () => {
        console.error("Audio error");
        useMusicStore.getState().setIsPlaying(false);
      },

      // loading 相关事件
      loadstart: markLoading,
      waiting: markLoading,

      // ready 事件统一结束 loading
      canplay: settleLoading,
      playing: settleLoading,
      loadedmetadata: settleLoading,
    };

    Object.entries(events).forEach(([event, handler]) =>
      audio.addEventListener(event, handler)
    );

    return () => {
      Object.entries(events).forEach(([event, handler]) =>
        audio.removeEventListener(event, handler)
      );
    };
  }, [audioRef, isSwitchingTrackRef, hasRecordedRef]);

  return null;
}
