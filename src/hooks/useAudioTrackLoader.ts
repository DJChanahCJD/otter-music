import { useEffect, useRef } from "react";
import { retry } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { getProxyUrl, isProxyUrl } from "@/lib/api";
import { normalizeAudioUrlForPlayback } from "@/lib/utils/audio-url";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useDownloadStore } from "@/store/download-store";
import { useOfflineStore } from "@/store/offline-store";
import { useUrlCacheStore, buildUrlCacheKey } from "@/store/url-cache-store";
import { Capacitor } from "@capacitor/core";
import { buildDownloadKey } from "@/lib/utils/download";
import type { MusicSource } from "@/types/music";
import toast from "react-hot-toast";
import { handleAutoMatch } from "@/lib/audio-match";
import { logger } from "@/lib/logger";

const AUDIO_READY_TIMEOUT = 5000;

/**
 * 持久化 URL 缓存：跨会话保持已解析的音频 URL，离线时复用
 * 使用 useUrlCacheStore.getState() 在 React 渲染周期外访问
 */
const urlCache = {
  get: (key: string) => useUrlCacheStore.getState().get(key),
  set: (key: string, value: string) =>
    useUrlCacheStore.getState().set(key, value),
  delete: (key: string) => useUrlCacheStore.getState().delete(key),
};

type FallbackStage = "none" | "proxy" | "final";

function isTrackPlayable(
  track: { source: MusicSource; id: string } | null
): boolean {
  if (!track) return false;

  const isLocal = track.source === "local";

  if (isLocal) return true;

  if (!navigator.onLine) {
    if (Capacitor.isNativePlatform()) {
      const downloadKey = buildDownloadKey(track.source, track.id);
      return useDownloadStore.getState().hasRecord(downloadKey);
    }
    // Web 端：检查 offlineStore 是否有成功播放时记录的真实 URL
    const offlineRecord = useOfflineStore.getState().records?.[track.id];
    return Boolean(offlineRecord);
  }

  return true;
}

function findNextPlayableTrack(
  queue: { source: MusicSource; id: string }[],
  startIndex: number
): number | null {
  if (queue.length === 0) return null;

  for (let i = 0; i < queue.length; i++) {
    const index = (startIndex + i) % queue.length;
    if (isTrackPlayable(queue[index])) {
      return index;
    }
  }

  return null;
}

function waitForAudioReady(
  audio: HTMLAudioElement,
  timeout = AUDIO_READY_TIMEOUT
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("stalled", onStalled);
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
    const onStalled = () => finish(() => reject(new Error("AUDIO_STALLED")));
    const timer = setTimeout(
      () => finish(() => reject(new Error("AUDIO_READY_TIMEOUT"))),
      timeout
    );

    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("loadedmetadata", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.addEventListener("stalled", onStalled, { once: true });
  });
}

async function resolveLocalDownloadUrl({
  trackId,
  source,
}: {
  trackId: string;
  source: MusicSource;
}): Promise<{ url: string | null; downloadKey: string | null }> {
  const isNative = Capacitor.isNativePlatform();
  const isLocal = source === "local";
  if (isNative && !isLocal) {
    const downloadKey = buildDownloadKey(source, trackId);
    const uri = useDownloadStore.getState().getUri(downloadKey);
    if (uri) {
      return { url: Capacitor.convertFileSrc(uri), downloadKey };
    }
  }

  return { url: null, downloadKey: null };
}

async function resolveRemoteAudioUrl({
  trackId,
  source,
  quality,
}: {
  trackId: string;
  source: MusicSource;
  quality: number;
}): Promise<string> {
  // 离线时 cachedFetch 磁盘未命中则网络必然不可用，无需重试
  const maxRetries = navigator.onLine ? 2 : 0;
  return retry(
    async () => {
      const url = await musicApi.getUrl(trackId, source, quality);
      if (!url) {
        throw new Error("EMPTY_URL");
      }
      return url;
    },
    maxRetries,
    800
  );
}

export function useAudioTrackLoader(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const currentTrack = useMusicStore((s) => s.queue[s.currentIndex]) || null;
  const currentTrackId = currentTrack?.id;
  const currentTrackSource = currentTrack?.source;
  const currentTrackUrlId = currentTrack?.url_id;
  const quality = useMusicStore((s) => s.quality);
  const currentAudioTime = useMusicStore((s) => s.currentAudioTime);
  const hasUserGesture = useMusicStore((s) => s.hasUserGesture);
  const setIsPlaying = useMusicStore((s) => s.setIsPlaying);
  const setIsLoading = useMusicStore((s) => s.setIsLoading);
  const skipToNext = useMusicStore((s) => s.skipToNext);
  const setCurrentAudioUrl = useMusicStore((s) => s.setCurrentAudioUrl);
  const incrementFailures = useMusicStore((s) => s.incrementFailures);
  const maxConsecutiveFailures = useMusicStore((s) => s.maxConsecutiveFailures);
  const urlRecoveryKey = useMusicStore((s) => s.urlRecoveryKey);

  const requestIdRef = useRef(0);
  const prevUrlRecoveryKeyRef = useRef(urlRecoveryKey);

  const prevTrackRef = useRef<{
    id?: string;
    source?: string;
    quality?: string;
  } | null>(null);
  const remoteUrlRef = useRef<string | null>(null);
  const fallbackStageRef = useRef<{
    trackKey: string | null;
    stage: FallbackStage;
  }>({
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
      const trackKey = buildUrlCacheKey(
        currentTrackSource,
        currentTrackId,
        currentTrackUrlId,
        quality
      );
      if (fallbackStageRef.current.trackKey !== trackKey) {
        fallbackStageRef.current = { trackKey, stage: "none" };
        remoteUrlRef.current = null;
      }

      const getRemoteUrl = async () => {
        if (remoteUrlRef.current) return remoteUrlRef.current;
        // 离线时优先用缓存 URL，避免 API 调用失败
        if (!navigator.onLine) {
          const memCached = urlCache.get(trackKey);
          if (memCached) {
            // 用当前后端域名重新包装，避免死域名和 Mixed Content
            const finalUrl = normalizeAudioUrlForPlayback(memCached);
            urlCache.set(trackKey, finalUrl);
            remoteUrlRef.current = finalUrl;
            return finalUrl;
          }
          const offlineRecord = currentTrackId
            ? useOfflineStore.getState().records?.[currentTrackId]
            : null;
          if (offlineRecord?.url) {
            const finalUrl = normalizeAudioUrlForPlayback(offlineRecord.url);
            urlCache.set(trackKey, finalUrl);
            remoteUrlRef.current = finalUrl;
            return finalUrl;
          }
        }
        const urlId =
          (currentTrackSource as string) === "local" ||
          currentTrackSource === "podcast"
            ? currentTrackUrlId
            : currentTrackId;
        const remoteUrl = await resolveRemoteAudioUrl({
          trackId: urlId || "",
          source: currentTrackSource,
          quality: parseInt(quality, 10),
        });
        urlCache.set(trackKey, remoteUrl);
        remoteUrlRef.current = remoteUrl;
        return remoteUrl;
      };

      const setSourceAndPlay = async (audioUrl: string, startTime?: number) => {
        if (audio.src !== audioUrl) {
          setCurrentAudioUrl(audioUrl);
          audio.src = "";
          audio.src = audioUrl;
          audio.load();
        }
        await waitForAudioReady(audio);
        audio.currentTime = startTime ?? currentAudioTime;
        audio.playbackRate = useMusicStore.getState().playbackSpeed;
        await audio.play();
      };

      try {
        setIsLoading(true);

        const isRecovery = prevUrlRecoveryKeyRef.current !== urlRecoveryKey;
        const qualityChanged =
          prevTrackRef.current?.quality !== quality &&
          prevTrackRef.current?.id === currentTrackId &&
          prevTrackRef.current?.source === currentTrackSource;

        // 不支持音质调整的音源：quality 变化时无需重载
        const qualityAgnosticSources = ["local", "bilibili", "podcast"];
        const shouldSkipQualityReload =
          qualityChanged && qualityAgnosticSources.includes(currentTrackSource);

        if (
          prevTrackRef.current?.id === currentTrackId &&
          prevTrackRef.current?.source === currentTrackSource &&
          (prevTrackRef.current?.quality === quality ||
            shouldSkipQualityReload) &&
          !isSwitchingTrackRef.current &&
          !isRecovery
        ) {
          return;
        }

        if (isRecovery) {
          remoteUrlRef.current = null;
          fallbackStageRef.current = { trackKey: "", stage: "none" };
          prevUrlRecoveryKeyRef.current = urlRecoveryKey;
        }

        // 音质变更时清除 URL 缓存，确保用新音质重新请求
        if (qualityChanged && !shouldSkipQualityReload) {
          remoteUrlRef.current = null;
          fallbackStageRef.current = { trackKey: "", stage: "none" };
        }

        isSwitchingTrackRef.current = true;
        hasRecordedRef.current = false;

        // 音质变更时不暂停，尽量无缝切换
        if (!qualityChanged) {
          audio.pause();
        }

        // 音质变更时记录当前实际播放位置，用于恢复
        const resumeTime = qualityChanged
          ? audio.currentTime
          : currentAudioTime;

        const isLocal = (currentTrackSource as string) === "local";
        const isOnline = navigator.onLine;
        const { url: localDownloadUrl, downloadKey } =
          await resolveLocalDownloadUrl({
            trackId: currentTrackId || "",
            source: currentTrackSource,
          });
        const hasDownload = Boolean(localDownloadUrl);

        if (!isLocal && !hasDownload && !isOnline) {
          // 先尝试走缓存链路（urlCache → cachedFetch → SW），全部失败再判定不可播
          try {
            const remoteUrl = await getRemoteUrl();
            if (remoteUrl) {
              await setSourceAndPlay(remoteUrl, resumeTime);
              return;
            }
          } catch {
            // 缓存未命中，继续下面的跳过逻辑
          }

          const { queue, currentIndex } = useMusicStore.getState();
          const nextPlayableIndex = findNextPlayableTrack(queue, currentIndex);

          if (
            nextPlayableIndex !== null &&
            nextPlayableIndex !== currentIndex
          ) {
            useMusicStore.getState().setCurrentIndexAndPlay(nextPlayableIndex);
            return;
          }

          logger.error(
            "useAudioTrackLoader",
            "Network unavailable, no playable tracks",
            {
              trackId: currentTrackId,
              source: currentTrackSource,
            }
          );
          setIsPlaying(false);
          return;
        }

        try {
          const primaryUrl = localDownloadUrl || (await getRemoteUrl());

          await setSourceAndPlay(primaryUrl, resumeTime);
        } catch (primaryError) {
          console.error("Primary audio load failed:", primaryError);

          if (
            downloadKey &&
            localDownloadUrl &&
            currentTrackSource !== "local"
          ) {
            try {
              audio.src = "";
              await setSourceAndPlay(localDownloadUrl, resumeTime);
              return;
            } catch {
              useDownloadStore.getState().removeRecord(downloadKey);
              toast.error("播放失败，已切换在线播放");
              const remoteUrl = await getRemoteUrl();
              await setSourceAndPlay(remoteUrl, resumeTime);
              return;
            }
          }

          if (
            currentTrackSource !== "local" &&
            fallbackStageRef.current.stage === "none" &&
            remoteUrlRef.current &&
            isOnline
          ) {
            const remoteUrl = remoteUrlRef.current;
            // 源头已转代理时避免重复包装
            const proxyUrl = isProxyUrl(remoteUrl)
              ? remoteUrl
              : getProxyUrl(remoteUrl);
            fallbackStageRef.current.stage = "proxy";
            toast("已切换备用线路", { icon: "🌐", id: "proxy-notice" });
            await setSourceAndPlay(proxyUrl, resumeTime);
            return;
          }

          throw primaryError;
        }
      } catch (err: unknown) {
        if (requestId !== requestIdRef.current) return;
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(
          "useAudioTrackLoader",
          `Audio load failed: ${errorMessage}`,
          err,
          {
            trackId: currentTrackId,
            source: currentTrackSource,
            urlId: currentTrackUrlId,
          }
        );

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
            logger.warn(
              "useAudioTrackLoader",
              "Skip setIsPlaying(false) because audio is still playing"
            );
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
      quality,
    };

    return () => {
      if (currentRequestId === requestIdRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        requestIdRef.current++;
      }
    };
  }, [
    currentTrack?.id,
    currentTrack?.source,
    currentTrack?.url_id,
    quality,
    hasUserGesture,
    urlRecoveryKey,
  ]);
}
