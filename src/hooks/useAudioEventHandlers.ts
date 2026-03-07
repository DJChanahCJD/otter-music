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

/** 远程重试工具函数 */
async function retryWithRemote(audio: HTMLAudioElement, trackId: string, source: MusicSource, quality: number) {
  const { setIsPlaying, setIsLoading, setCurrentAudioUrl } = useMusicStore.getState();
  try {
    setIsLoading(true);
    const remoteUrl = await retry(async () => {
      const result = await musicApi.getUrl(trackId, source, quality);
      if (!result) throw new Error("EMPTY_URL");
      return result;
    }, 2, 800);

    if (audio.src !== remoteUrl) {
      setCurrentAudioUrl(remoteUrl);
      audio.src = remoteUrl;
      audio.load();
      await audio.play();
      setIsPlaying(true);
    }
  } finally {
    setIsLoading(false);
  }
}

export function useAudioEventHandlers(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const toastedTrackIdRef = useRef<string | null>(null);
  const autoMatchedTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = throttle(() => {
      if (isSwitchingTrackRef.current) return;
      useMusicStore.getState().setAudioCurrentTime(audio.currentTime);

      MediaSession.setPositionState({
        duration: audio.duration || 0,
        playbackRate: audio.playbackRate,
        position: audio.currentTime,
      }).catch(e => console.error('MediaSession position error:', e));
    }, 1000);

    const onDurationChange = () => {
      const state = useMusicStore.getState();
      const currentTrack = state.queue[state.currentIndex];
      const duration = audio.duration || 0;
      
      state.setDuration(duration);

      // 网易云试听/自动匹配逻辑
      if (currentTrack?.source === '_netease' && duration > 0 && duration <= 45) {
        if (toastedTrackIdRef.current !== currentTrack.id) {
          toast("试听中...", { icon: "🎵" });
          toastedTrackIdRef.current = currentTrack.id;
        }
        if (state.enableAutoMatch && autoMatchedTrackIdRef.current !== currentTrack.id) {
          autoMatchedTrackIdRef.current = currentTrack.id;
          void handleAutoMatch(currentTrack);
        }
      }
    };

    const onEnded = () => {
      const state = useMusicStore.getState();
      if (state.isRepeat) {
        audio.currentTime = 0;
        const replayPromise = audio.play();
        if (replayPromise !== undefined) {
          replayPromise.catch((error) => {
            console.error("Repeat play failed:", error);
            useMusicStore.getState().setIsPlaying(false);
          });
        }
      } else if (state.queue.length > 0) {
        state.setCurrentIndexAndPlay((state.currentIndex + 1) % state.queue.length);
      }
    };

    const onError = async (e: Event) => {
      console.error("Audio Error Event:", e);
      const state = useMusicStore.getState();
      const track = state.queue[state.currentIndex];
      
      state.setIsLoading(false);
      if (track?.source) useSourceQualityStore.getState().recordFail(track.source);

      // Native 下载记录失效回退逻辑
      if (Capacitor.isNativePlatform() && track && track.source !== 'local') {
        const downloadKey = buildDownloadKey(track.source, track.id);
        const downloadUri = useDownloadStore.getState().getUri(downloadKey);
        const isLocalFileUrl = /_capacitor_file_|capacitor:\/\/|file:\/\//.test(audio.src);

        if (downloadUri && isLocalFileUrl) {
          useDownloadStore.getState().removeRecord(downloadKey);
          toast.error(`本地文件失效，尝试网络播放`, { duration: 3000 });

          try {
            await retryWithRemote(audio, track.id, track.source, parseInt(state.quality, 10));
          } catch {
            toast.error(`播放失败: ${track.name}`);
            audio.src = "";
            state.setCurrentAudioUrl(null);
            state.skipToNext();
          }
        }
      }
    };

    const onPause = () => {
      if (isSwitchingTrackRef.current || audio.ended || audio.error !== null) return;
      useMusicStore.getState().setIsPlaying(false);
    };

    const onPlay = () => {
      if (audio.paused || hasRecordedRef.current) return;
      hasRecordedRef.current = true;

      const state = useMusicStore.getState();
      const track = state.queue[state.currentIndex];

      if (!state.isPlaying) state.setIsPlaying(true);
      state.resetFailures();

      if (track) {
        useSourceQualityStore.getState().recordSuccess(track.source);
        useHistoryStore.getState().addToHistory(track);
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
  }, [audioRef, isSwitchingTrackRef, hasRecordedRef]);

  return null;
}