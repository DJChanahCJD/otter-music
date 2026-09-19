import { useEffect, useRef } from "react";
import { getProxyUrl, isProxyUrl } from "@/lib/api";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useDownloadStore } from "@/store/download-store";
import { useOfflineStore } from "@/store/offline-store";
import { useUrlCacheStore, buildUrlCacheKey } from "@/store/url-cache-store";
import { buildDownloadKey } from "@/lib/utils/download";
import type { MusicSource } from "@/types/music";
import toast from "react-hot-toast";
import { handleAutoMatch } from "@/lib/audio-match";
import { logger } from "@/lib/logger";
import { resolveTrackUrl } from "@/lib/audio-resolver";
import { IS_NATIVE } from "@/lib/api/config";

const AUDIO_READY_TIMEOUT = 8000;
type FallbackStage = "none" | "proxy" | "final";

/** 校验歌曲在当前网络/缓存状态下是否可播 */
function isTrackPlayable(
  track: { source: MusicSource; id: string } | null
): boolean {
  if (!track) return false;
  if (track.source === "local" || navigator.onLine) return true;

  if (IS_NATIVE) {
    const downloadKey = buildDownloadKey(track.source, track.id);
    return useDownloadStore.getState().hasRecord(downloadKey);
  }

  return Boolean(useOfflineStore.getState().records?.[track.id]);
}

/**
 * 判断是否为网络层加载失败（MEDIA_ERR_NETWORK == 2）。
 * 鉴权/格式类失败（DECODE、SRC_NOT_SUPPORTED）不代表直连不可达，
 * 不应触发代理回退（否则会掩盖真实原因且回退也无效）。
 */
function isNetworkMediaError(err: unknown): boolean {
  return (err as { mediaErrorCode?: number | null })?.mediaErrorCode === 2;
}

/** 查找队列中下一首可播歌曲 */
function findNextPlayableTrack(
  queue: { source: MusicSource; id: string }[],
  startIndex: number
): number | null {
  if (!queue.length) return null;
  for (let i = 0; i < queue.length; i++) {
    const index = (startIndex + i) % queue.length;
    if (isTrackPlayable(queue[index])) return index;
  }
  return null;
}

/** 将音频加载事件封装为 Promise */
function waitForAudioReady(
  audio: HTMLAudioElement,
  timeout = AUDIO_READY_TIMEOUT
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("error", onError);
      clearTimeout(timer);
    };

    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(
        Object.assign(new Error("AUDIO_NOT_READY"), {
          mediaErrorCode: audio.error?.code ?? null,
        })
      );
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("AUDIO_READY_TIMEOUT"));
    }, timeout);

    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("loadedmetadata", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
  });
}

export function useAudioTrackLoader(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const currentTrack = useMusicStore((s) => s.queue[s.currentIndex]) || null;
  const quality = useMusicStore((s) => s.quality);
  const hasUserGesture = useMusicStore((s) => s.hasUserGesture);
  const urlRecoveryKey = useMusicStore((s) => s.urlRecoveryKey);

  const requestIdRef = useRef(0);
  const remoteUrlRef = useRef<string | null>(null);
  const fallbackStageRef = useRef<{
    trackKey: string | null;
    stage: FallbackStage;
  }>({ trackKey: null, stage: "none" });
  const prevTrackRef = useRef<{
    id?: string;
    source?: string;
    quality?: string;
    recoveryKey?: number;
  }>({});

  useEffect(() => {
    if (
      !hasUserGesture ||
      !currentTrack?.id ||
      !currentTrack?.source ||
      !audioRef.current
    )
      return;

    const { id: trackId, source, url_id: urlId } = currentTrack;
    const getState = useMusicStore.getState;
    const requestId = ++requestIdRef.current;
    const trackKey = buildUrlCacheKey(source, trackId, urlId, quality);

    const loadAudio = async () => {
      const audio = audioRef.current!;
      const prev = prevTrackRef.current;

      // prev.recoveryKey 为 undefined说明是本 effect 首次运行，非错误恢复
      const isRecovery =
        prev.recoveryKey !== undefined && prev.recoveryKey !== urlRecoveryKey;
      const isSameTrack = prev.id === trackId && prev.source === source;
      const qualityChanged = isSameTrack && prev.quality !== quality;
      // 单一品质音源没有多档码率流可换（本地文件、B站、播客、Hi歌曲、Jamendo），
      // 音质切换静默跳过：重载只会带来多余请求与 loading 闪烁，音频流其实不变
      const skipQualityReload =
        qualityChanged &&
        ["local", "bilibili", "podcast", "higequ", "jamendo"].includes(source);

      // 无需重新加载的场景
      if (
        isSameTrack &&
        (!qualityChanged || skipQualityReload) &&
        !isSwitchingTrackRef.current &&
        !isRecovery
      )
        return;

      // 状态初始化与缓存清理
      if (
        isRecovery ||
        (qualityChanged && !skipQualityReload) ||
        fallbackStageRef.current.trackKey !== trackKey
      ) {
        remoteUrlRef.current = null;
        fallbackStageRef.current = { trackKey, stage: "none" };
      }

      isSwitchingTrackRef.current = true;
      hasRecordedRef.current = false;
      getState().setIsLoading(true);

      const resumeTime = qualityChanged
        ? audio.currentTime
        : getState().currentAudioTime;
      if (!qualityChanged) audio.pause();

      /** 核心播放器加载逻辑 */
      const play = async (audioUrl: string) => {
        if (audio.src !== audioUrl) {
          getState().setCurrentAudioUrl(audioUrl);
          // 先清空再赋值，强制 WebView 释放旧缓冲、重置 media element 状态
          audio.src = "";
          audio.src = audioUrl;
          audio.load();
        }
        await waitForAudioReady(audio);
        audio.currentTime = resumeTime;
        audio.playbackRate = getState().playbackSpeed;
        await audio.play();
      };

      /** 解析获取最佳 URL (本地 -> 内存缓存 -> 离线库 -> 网络) */
      const resolveOptimalUrl = async () => {
        // 代理备用线路容灾时，直接使用已缓存的远程 URL
        if (remoteUrlRef.current) return { url: remoteUrlRef.current };

        // 播放错误恢复时强制绕过 URL 缓存重新请求，
        // 否则会命中缓存里的过期签名直链，导致恢复后二次失败
        const result = await resolveTrackUrl(
          currentTrack,
          parseInt(quality, 10),
          { forceRefresh: isRecovery }
        );
        // 同步到 remoteUrlRef 以支持代理备用线路容灾
        if (result.url && !result.dlKey) {
          remoteUrlRef.current = result.url;
        }
        return result;
      };

      try {
        const { url: primaryUrl, dlKey } = await resolveOptimalUrl();

        // 离线无资源容灾跳过
        if (!primaryUrl && !navigator.onLine && source !== "local") {
          const state = getState();
          const nextIdx = findNextPlayableTrack(
            state.queue,
            state.currentIndex
          );
          if (nextIdx !== null && nextIdx !== state.currentIndex) {
            state.setCurrentIndexAndPlay(nextIdx);
          } else {
            logger.error(
              "useAudioTrackLoader",
              "Network unavailable, no playable tracks",
              { trackId, source }
            );
            state.setIsPlaying(false);
          }
          return;
        }

        try {
          await play(primaryUrl);
        } catch (err) {
          if (err instanceof DOMException && err.name === "NotAllowedError")
            throw err;

          // 本地文件失效退化为网络
          if (
            dlKey &&
            primaryUrl !== remoteUrlRef.current &&
            remoteUrlRef.current
          ) {
            useDownloadStore.getState().removeRecord(dlKey);
            toast.error("播放失败，已切换在线播放");
            await play(remoteUrlRef.current);
            return;
          }

          // 代理备用线路容灾（仅网络层失败才回退，鉴权/格式类失败不走）
          if (
            getState().enableProxyFallback &&
            isNetworkMediaError(err) &&
            source !== "local" &&
            fallbackStageRef.current.stage === "none" &&
            remoteUrlRef.current &&
            navigator.onLine
          ) {
            fallbackStageRef.current.stage = "proxy";
            toast("已切换备用线路", { icon: "🌐", id: "proxy-notice" });
            const proxyUrl = isProxyUrl(remoteUrlRef.current)
              ? remoteUrlRef.current
              : getProxyUrl(remoteUrlRef.current);
            await play(proxyUrl);
            return;
          }

          throw err;
        }
      } catch (err: unknown) {
        // 清理失效缓存（置于 requestId 守卫前：audio error 触发的恢复流程
        // 会使本请求失效，但失效缓存仍需删除，避免恢复/重试再次命中死链）
        useOfflineStore.getState().removeRecord(trackId);
        useUrlCacheStore.getState().delete(trackKey);

        if (requestId !== requestIdRef.current) return;

        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(
          "useAudioTrackLoader",
          `Audio load failed: ${errorMsg}`,
          err,
          { trackId, source, urlId }
        );

        // 自动匹配容灾
        if (getState().enableAutoMatch) {
          try {
            if (await handleAutoMatch(currentTrack)) return;
          } catch {
            logger.warn("useAudioTrackLoader", "Auto match failed", {
              trackId,
              source,
            });
          }
        }

        useSourceQualityStore.getState().recordFail(source);

        fallbackStageRef.current.stage = "final";
        audio.src = "";
        getState().setCurrentAudioUrl(null);
        toast.error("播放失败，已自动切到下一首");

        const state = getState();
        if (state.incrementFailures() >= state.maxConsecutiveFailures) {
          if (audio.paused) getState().setIsPlaying(false);
          else
            logger.warn(
              "useAudioTrackLoader",
              "Skip setIsPlaying(false) because audio is still playing"
            );
        } else {
          getState().skipToNext();
        }
      } finally {
        if (requestId === requestIdRef.current) {
          isSwitchingTrackRef.current = false;
          getState().setIsLoading(false);
        }
      }
    };

    loadAudio();
    prevTrackRef.current = {
      id: trackId,
      source,
      quality,
      recoveryKey: urlRecoveryKey,
    };

    return () => {
      if (requestId === requestIdRef.current) requestIdRef.current++;
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
