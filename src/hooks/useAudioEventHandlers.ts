import { useEffect } from "react";
import { throttle } from "@/lib/utils";
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
import { retry } from "@/lib/utils";

async function retryWithRemote(
  audio: HTMLAudioElement,
  trackId: string,
  source: MusicSource,
  quality: number
): Promise<void> {
  const remoteUrl = await retry(
    async () => {
      const result = await musicApi.getUrl(trackId, source, quality);
      if (!result) throw new Error("EMPTY_URL");
      return result;
    },
    2,
    800,
  );

  if (audio.src !== remoteUrl) {
    audio.src = remoteUrl;
    audio.load();
    await audio.play();
  }
}

export function useAudioEventHandlers(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const isRepeat = useMusicStore(s => s.isRepeat);
  const currentTrack = useMusicStore(s => s.queue[s.currentIndex]);
  const currentTrackSource = currentTrack?.source;
  const currentTrackId = currentTrack?.id;
  const isPlaying = useMusicStore(s => s.isPlaying);
  const queue = useMusicStore(s => s.queue);
  const currentIndex = useMusicStore(s => s.currentIndex);
  const quality = useMusicStore(s => s.quality);
  const setIsPlaying = useMusicStore(s => s.setIsPlaying);
  const setAudioCurrentTime = useMusicStore(s => s.setAudioCurrentTime);
  const setDuration = useMusicStore(s => s.setDuration);
  const setIsLoading = useMusicStore(s => s.setIsLoading);
  const setCurrentAudioUrl = useMusicStore(s => s.setCurrentAudioUrl);
  const skipToNext = useMusicStore(s => s.skipToNext);

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
      if (isSwitchingTrackRef.current) return;

      if (!audio.ended && audio.error === null) {
        setIsPlaying(false);
      }
    };

    const onPlay = () => {
      if (audio.paused) return;
      
      if (hasRecordedRef.current) return;
      hasRecordedRef.current = true;

      if (!isPlaying) {
        setIsPlaying(true);
      }
      
      useMusicStore.getState().resetFailures();
      
      if (currentTrack?.source) {
        useSourceQualityStore.getState().recordSuccess(currentTrack.source);
      }
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
  }, [isRepeat, currentTrack?.source, currentTrack?.name, currentTrack, isPlaying, setIsPlaying, setAudioCurrentTime, setDuration, queue.length, currentIndex, setIsLoading, currentTrackSource, currentTrackId, quality, setCurrentAudioUrl, skipToNext]); // eslint-disable-line react-hooks/exhaustive-deps
}
