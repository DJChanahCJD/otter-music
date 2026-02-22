import { useEffect, useRef } from "react";
import { retry } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useDownloadStore } from "@/store/download-store";
import { Capacitor } from "@capacitor/core";
import { buildDownloadKey } from "@/lib/utils/download";
import type { MusicSource } from "@/types/music";
import toast from "react-hot-toast";

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

export function useAudioTrackLoader(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const currentTrack = useMusicStore(s => s.queue[s.currentIndex]);
  const currentTrackId = currentTrack?.id;
  const currentTrackSource = currentTrack?.source;
  const currentTrackUrlId = currentTrack?.url_id;
  const quality = useMusicStore(s => s.quality);
  const currentAudioTime = useMusicStore(s => s.currentAudioTime);
  const hasUserGesture = useMusicStore(s => s.hasUserGesture);
  const setIsPlaying = useMusicStore(s => s.setIsPlaying);
  const setIsLoading = useMusicStore(s => s.setIsLoading);
  const skipToNext = useMusicStore(s => s.skipToNext);
  const setCurrentAudioUrl = useMusicStore(s => s.setCurrentAudioUrl);
  const incrementFailures = useMusicStore(s => s.incrementFailures);
  const maxConsecutiveFailures = useMusicStore(s => s.maxConsecutiveFailures);

  const requestIdRef = useRef(0);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        requestIdRef.current++;
      }
    };
  }, [currentTrack.id, currentTrack.source, quality, hasUserGesture, currentTrack, currentTrackId, currentTrackSource, currentTrackUrlId, setCurrentAudioUrl, setIsLoading, setIsPlaying, skipToNext, incrementFailures, maxConsecutiveFailures]); // eslint-disable-line react-hooks/exhaustive-deps
}
