import { useEffect, useRef } from "react";
import { retry } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { getProxyUrl, isProxyUrl } from "@/lib/api";
import { normalizeAudioUrlForPlayback } from "@/lib/utils/audio-url";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useDownloadStore } from "@/store/download-store";
import { useOfflineStore } from "@/store/offline-store";
import {
  AUDIO_STREAM_CACHE_NAME,
  hasCacheEntry,
  deleteCacheEntry,
} from "@/lib/sw-cache";
import { Capacitor } from "@capacitor/core";
import { buildDownloadKey } from "@/lib/utils/download";
import type { MusicSource } from "@/types/music";
import toast from "react-hot-toast";
import { handleAutoMatch } from "@/lib/audio-match";
import { revokeBlobUrl } from "@/lib/utils/blob-registry";
import { logger } from "@/lib/logger";

const AUDIO_READY_TIMEOUT = 8000;

/**
 * 快速检测音频 URL 是否可达
 * @param url 音频链接
 * @param timeout 超时时间 (毫秒)
 */
async function checkUrlReachable(
  url: string,
  timeout = 1500
): Promise<boolean> {
  return new Promise((resolve) => {
    const controller = new AbortController();
    let isTimeout = false;

    const timer = setTimeout(() => {
      isTimeout = true;
      controller.abort();
      resolve(false); // 超时判定为不可达
    }, timeout);

    fetch(url, { method: "HEAD", mode: "no-cors", signal: controller.signal })
      .then(() => {
        clearTimeout(timer);
        resolve(true); // 只要有响应（即使是 403 等 HTTP 错误，由 audio 标签后续兜底）就认为网络连通
      })
      .catch((err) => {
        clearTimeout(timer);
        // 如果不是因为超时导致的 abort，说明是真实的网络不通/DNS污染
        resolve(!isTimeout && err.name === "AbortError");
      });
  });
}

// 模块级 URL 缓存：跨渲染保持已解析的音频 URL，离线时复用
const _urlMemoryCache = new Map<string, string>();
const urlMemoryCache = {
  get: (key: string) => _urlMemoryCache.get(key),
  set: (key: string, value: string) => {
    const old = _urlMemoryCache.get(key);
    if (old && old !== value && old.startsWith("blob:")) {
      revokeBlobUrl(old);
    }
    _urlMemoryCache.set(key, value);
  },
  delete: (key: string) => {
    const old = _urlMemoryCache.get(key);
    if (old?.startsWith("blob:")) {
      revokeBlobUrl(old);
    }
    _urlMemoryCache.delete(key);
  },
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
    return useOfflineStore.getState().isRecordValid(track.id);
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
    const timer = setTimeout(
      () => finish(() => reject(new Error("AUDIO_READY_TIMEOUT"))),
      timeout
    );

    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("loadedmetadata", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
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
      const trackKey = `${currentTrackSource}:${currentTrackId}:${currentTrackUrlId ?? ""}`;
      if (fallbackStageRef.current.trackKey !== trackKey) {
        fallbackStageRef.current = { trackKey, stage: "none" };
        remoteUrlRef.current = null;
      }

      const getRemoteUrl = async () => {
        if (remoteUrlRef.current) return remoteUrlRef.current;
        // 离线时优先用缓存 URL，避免 API 调用失败
        if (!navigator.onLine) {
          const memCached = urlMemoryCache.get(trackKey);
          if (memCached) {
            // 用当前后端域名重新包装，避免死域名和 Mixed Content
            const finalUrl = normalizeAudioUrlForPlayback(memCached);
            urlMemoryCache.set(trackKey, finalUrl);
            remoteUrlRef.current = finalUrl;
            return finalUrl;
          }
          const offlineRecord = currentTrackId
            ? useOfflineStore.getState().getRecord(currentTrackId)
            : null;
          if (offlineRecord) {
            const cacheKey =
              offlineRecord.cacheKey ||
              normalizeAudioUrlForPlayback(offlineRecord.url);
            const isCached = await hasCacheEntry(
              AUDIO_STREAM_CACHE_NAME,
              cacheKey
            );
            if (isCached) {
              urlMemoryCache.set(trackKey, cacheKey);
              remoteUrlRef.current = cacheKey;
              return cacheKey;
            }
            // 缓存条目已失效/被淘汰，清理离线记录与 SW 缓存条目
            useOfflineStore.getState().removeRecord(currentTrackId);
            await deleteCacheEntry(AUDIO_STREAM_CACHE_NAME, cacheKey);
            logger.warn(
              "useAudioTrackLoader",
              "Offline cache entry missing, removed stale record",
              {
                trackId: currentTrackId,
                cacheKey,
              }
            );
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

        // 新 URL 与旧缓存 key 不一致时，清理旧 SW 缓存条目与旧离线记录
        if (currentTrackId) {
          const offlineRecord = useOfflineStore
            .getState()
            .getRecord(currentTrackId);
          if (offlineRecord) {
            const oldCacheKey =
              offlineRecord.cacheKey ||
              normalizeAudioUrlForPlayback(offlineRecord.url);
            if (oldCacheKey !== remoteUrl) {
              await deleteCacheEntry(AUDIO_STREAM_CACHE_NAME, oldCacheKey);
              useOfflineStore.getState().removeRecord(currentTrackId);
              logger.info(
                "useAudioTrackLoader",
                "URL changed, cleaned old offline record",
                {
                  trackId: currentTrackId,
                  oldCacheKey,
                  newUrl: remoteUrl,
                }
              );
            }
          }
        }

        urlMemoryCache.set(trackKey, remoteUrl);
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
          // 先尝试走缓存链路（urlMemoryCache → cachedFetch → SW），全部失败再判定不可播
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

          // 新增：如果是在线 HTTP 链接，执行 1.5 秒快速探测
          if (!localDownloadUrl && primaryUrl.startsWith("http")) {
            const isReachable = await checkUrlReachable(primaryUrl, 1500);
            if (!isReachable) {
              // 抛出特定错误，直接跳过 8 秒等待，进入 catch 触发代理
              throw new Error("PRECHECK_UNREACHABLE");
            }
          }

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

        // 播放失败时清理当前曲目的离线记录与 SW 缓存条目，避免反复使用失效缓存
        if (currentTrackId) {
          const offlineRecord = useOfflineStore
            .getState()
            .getRecord(currentTrackId);
          if (offlineRecord) {
            const cacheKey =
              offlineRecord.cacheKey ||
              normalizeAudioUrlForPlayback(offlineRecord.url);
            useOfflineStore.getState().removeRecord(currentTrackId);
            await deleteCacheEntry(AUDIO_STREAM_CACHE_NAME, cacheKey);
            logger.warn(
              "useAudioTrackLoader",
              "Cleaned stale offline record on playback failure",
              {
                trackId: currentTrackId,
                cacheKey,
              }
            );
          }
          urlMemoryCache.delete(trackKey);
        }

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
