import { useEffect, useRef } from "react";
import { retry } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { getProxyStreamUrl } from "@/lib/api";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useDownloadStore } from "@/store/download-store";
import { Capacitor } from "@capacitor/core";
import { buildDownloadKey } from "@/lib/utils/download";
import type { MusicSource } from "@/types/music";
import toast from "react-hot-toast";
import { handleAutoMatch } from "@/lib/audio-match";
import { logger } from "@/lib/logger";

const AUDIO_READY_TIMEOUT = 8000;

type FallbackStage = "none" | "proxy" | "final";

function isTrackPlayable(
  track: { source: MusicSource; id: string } | null,
  isOnline: boolean
): boolean {
  if (!track) return false;

  const isLocal = track.source === 'local';

  if (isLocal) return true;

  if (!isOnline) {
    if (Capacitor.isNativePlatform()) {
      const downloadKey = buildDownloadKey(track.source, track.id);
      return useDownloadStore.getState().hasRecord(downloadKey);
    }
    return false;
  }

  return true;
}

function findNextPlayableTrack(
  queue: { source: MusicSource; id: string }[],
  startIndex: number,
  isOnline: boolean
): number | null {
  if (queue.length === 0) return null;

  for (let i = 0; i < queue.length; i++) {
    const index = (startIndex + i) % queue.length;
    if (isTrackPlayable(queue[index], isOnline)) {
      return index;
    }
  }

  return null;
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
    const timer = setTimeout(() => finish(() => reject(new Error("AUDIO_READY_TIMEOUT"))), timeout);

    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("loadedmetadata", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
  });
}

async function resolveLocalDownloadUrl({
  trackId,
  source,
}: {
  trackId: string
  source: MusicSource
}): Promise<{ url: string | null; downloadKey: string | null }> {
  const isNative = Capacitor.isNativePlatform()
  const isLocal = source === 'local'
  if (isNative && !isLocal) {
    const downloadKey = buildDownloadKey(source, trackId)
    const uri = useDownloadStore.getState().getUri(downloadKey)
    if (uri) {
      return { url: Capacitor.convertFileSrc(uri), downloadKey }
    }
  }

  return { url: null, downloadKey: null }
}

async function resolveRemoteAudioUrl({
  trackId,
  source,
  quality,
}: {
  trackId: string
  source: MusicSource
  quality: number
}): Promise<string> {
  return retry(async () => {
    const url = await musicApi.getUrl(trackId, source, quality)
    if (!url) {
      throw new Error("EMPTY_URL")
    }
    return url
  }, 2, 800)
}

export function useAudioTrackLoader(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const currentTrack = useMusicStore(s => s.queue[s.currentIndex]) || null;
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

  const prevTrackRef = useRef<{ id?: string; source?: string } | null>(null);
  const remoteUrlRef = useRef<string | null>(null);
  const fallbackStageRef = useRef<{ trackKey: string | null; stage: FallbackStage }>({
    trackKey: null,
    stage: "none",
  });

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
      const trackKey = `${currentTrackSource}:${currentTrackId}:${currentTrackUrlId ?? ""}`;
      if (fallbackStageRef.current.trackKey !== trackKey) {
        fallbackStageRef.current = { trackKey, stage: "none" };
        remoteUrlRef.current = null;
      }

      const getRemoteUrl = async () => {
        if (remoteUrlRef.current) return remoteUrlRef.current;
        const urlId = ((currentTrackSource as string) === 'local' || currentTrackSource === 'podcast')
          ? currentTrackUrlId
          : currentTrackId;
        const remoteUrl = await resolveRemoteAudioUrl({
          trackId: urlId || '',
          source: currentTrackSource,
          quality: parseInt(quality, 10),
        });
        remoteUrlRef.current = remoteUrl;
        return remoteUrl;
      };

      const setSourceAndPlay = async (audioUrl: string) => {
        if (audio.src !== audioUrl) {
          setCurrentAudioUrl(audioUrl);
          audio.src = audioUrl;
          audio.load();
        }
        await waitForAudioReady(audio);
        audio.currentTime = currentAudioTime;
        await audio.play();
      };

      try {
        setIsLoading(true);

        if (prevTrackRef.current?.id === currentTrackId && prevTrackRef.current?.source === currentTrackSource && !isSwitchingTrackRef.current) {
          return;
        }

        isSwitchingTrackRef.current = true;
        hasRecordedRef.current = false;

        audio.pause();

        const isLocal = (currentTrackSource as string) === 'local';
        const isOnline = navigator.onLine;
        const { url: localDownloadUrl, downloadKey } = await resolveLocalDownloadUrl({
          trackId: currentTrackId || "",
          source: currentTrackSource,
        });
        const hasDownload = Boolean(localDownloadUrl);

        if (!isLocal && !hasDownload && !isOnline) {
          const { queue, currentIndex } = useMusicStore.getState();
          const nextPlayableIndex = findNextPlayableTrack(queue, currentIndex, isOnline);

          if (nextPlayableIndex !== null && nextPlayableIndex !== currentIndex) {
            useMusicStore.getState().setCurrentIndexAndPlay(nextPlayableIndex);
            return;
          } else {
            logger.error("useAudioTrackLoader", "Network unavailable, no playable tracks", {
              trackId: currentTrackId,
              source: currentTrackSource,
            });
            setIsPlaying(false);
            return;
          }
        }

        try {
          const primaryUrl = localDownloadUrl || await getRemoteUrl();
          await setSourceAndPlay(primaryUrl);
        } catch (primaryError) {
          console.error("Primary audio load failed:", primaryError);

          if (downloadKey && localDownloadUrl && currentTrackSource !== "local") {
            useDownloadStore.getState().removeRecord(downloadKey);
            toast.error("本地文件失效，已切换在线播放");
            const remoteUrl = await getRemoteUrl();
            await setSourceAndPlay(remoteUrl);
            return;
          }

          if (currentTrackSource !== "local" && fallbackStageRef.current.stage === "none" && remoteUrlRef.current) {
            const remoteUrl = remoteUrlRef.current;
            const proxyUrl = getProxyStreamUrl(remoteUrl);
            fallbackStageRef.current.stage = "proxy";
            toast("已切换备用线路", { icon: "🌐", id: "proxy-notice" });
            await setSourceAndPlay(proxyUrl);
            return;
          }

          throw primaryError;
        }
      } catch (err: unknown) {
        if (requestId !== requestIdRef.current) return;
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error("useAudioTrackLoader", `Audio load failed: ${errorMessage}`, err, {
          trackId: currentTrackId,
          source: currentTrackSource,
          urlId: currentTrackUrlId,
        });

        if (useMusicStore.getState().enableAutoMatch) {
          try {
            const success = await handleAutoMatch(currentTrack);
            if (success) return;
          } catch {
            logger.warn("useAudioTrackLoader", "Auto match failed", {
              trackId: currentTrackId,
              source: currentTrackSource,
            });
          }
        }

        if (currentTrackSource) {
          useSourceQualityStore.getState().recordFail(currentTrackSource);
        }

        fallbackStageRef.current.stage = "final";
        audio.src = "";
        setCurrentAudioUrl(null);
        toast.error("播放失败，已自动切到下一首");

        const failures = incrementFailures();
        if (failures >= maxConsecutiveFailures) {
          if (audio.paused) {
            setIsPlaying(false);
          } else {
            logger.warn("useAudioTrackLoader", "Skip setIsPlaying(false) because audio is still playing");
          }
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

    prevTrackRef.current = {
      id: currentTrackId,
      source: currentTrackSource,
    };

    return () => {
      if (currentRequestId === requestIdRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        requestIdRef.current++;
      }
    };
  }, [currentTrack?.id, currentTrack?.source, currentTrack?.url_id, quality, hasUserGesture]); // eslint-disable-line react-hooks/exhaustive-deps
}
