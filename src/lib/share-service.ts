import { Share } from "@capacitor/share";
import toast from "react-hot-toast";
import { IS_NATIVE, getApiUrl } from "@/lib/api/config";
import { getCanonicalShareUrl } from "@/lib/share-url";
import { writeClipboardText } from "@/lib/clipboard";
import { useMusicStore } from "@/store/music-store";
import { logger } from "@/lib/logger";
import type { MusicTrack } from "@/types/music";

/** 分享深链自定义 scheme */
export const DEEP_LINK_SCHEME = "ottermusic://";

export interface ShareTrackOptions {
  track: MusicTrack;
  /** 当前播放中的音频 CDN URL，可能为 null 或本地代理地址 */
  audioUrl: string | null;
  /** 当前封面 URL，用于分享页展示 */
  coverUrl?: string | null;
}

/**
 * 判断音频 URL 是否可直接对外分享
 * 排除本地代理地址（如 B 站原生播放的 127.0.0.1 代理流），此类地址对外无效
 */
function isShareableAudioUrl(url: string | null): url is string {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol.startsWith("http") &&
      !["localhost", "127.0.0.1"].includes(hostname)
    );
  } catch {
    return false;
  }
}

/**
 * 构建 /share 页面链接，通过 Query 携带歌曲信息（无持久化、无短链）
 * id 取 url_id（音源 API 取流时使用的标识），供分享页过期时重新解析
 */
function buildSharePageUrl({
  track,
  audioUrl,
  coverUrl,
}: ShareTrackOptions): string {
  const origin = IS_NATIVE ? getApiUrl() : window.location.origin;
  const params = new URLSearchParams({
    source: track.source,
    id: track.url_id || track.id,
    title: track.name,
    artist: track.artist.join(", "),
  });
  if (isShareableAudioUrl(audioUrl)) params.set("url", audioUrl);
  if (coverUrl) params.set("cover", coverUrl);
  return `${origin}/share?${params.toString()}`;
}

/**
 * 平台感知分享：
 * - Android：通过 Capacitor Sharesheet 分享 /share 页面链接
 * - Web：保持原有行为，复制规范链接或 CDN URL 到剪贴板
 */
export async function shareTrack(options: ShareTrackOptions): Promise<void> {
  const { track, audioUrl } = options;
  const text = `【OtterMusic】${track.name} - ${track.artist.join(", ")}`;

  if (IS_NATIVE) {
    await Share.share({
      title: text,
      text,
      url: buildSharePageUrl(options),
      dialogTitle: "分享歌曲",
    });
    return;
  }

  const shareUrl =
    getCanonicalShareUrl(track) ||
    (isShareableAudioUrl(audioUrl) ? audioUrl : null);
  if (!shareUrl) {
    toast.error("该音源暂不支持分享");
    return;
  }
  const ok = await writeClipboardText(`${text}\n${shareUrl}`);
  if (ok) {
    toast.success("已复制到剪贴板");
  } else {
    toast.error("复制失败，请重试");
  }
}

/**
 * 解析分享深链（ottermusic://share?...）中的歌曲参数
 * 兼容不同 WebView 对自定义 scheme 的规范化差异，仅按首个 ? 截取 Query
 */
function parseShareDeepLink(url: string): URLSearchParams | null {
  if (!url.startsWith(DEEP_LINK_SCHEME)) return null;
  const raw = url.slice(DEEP_LINK_SCHEME.length);
  const queryIndex = raw.indexOf("?");
  if (queryIndex === -1) return null;
  return new URLSearchParams(raw.slice(queryIndex));
}

/**
 * 等待 music-store 持久化恢复完成
 * 避免冷启动深链时插入的曲目被随后恢复的队列覆盖
 */
function waitForStoreHydration(): Promise<void> {
  if (useMusicStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useMusicStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

/**
 * 分享深链播放入口：将分享歌曲插入当前播放列表的下一首并立即播放
 * 不替换、不打断原有队列（应用未在播放时则直接开始播放）
 */
export async function handleShareDeepLink(url: string): Promise<void> {
  const params = parseShareDeepLink(url);
  if (!params) return;

  const source = params.get("source");
  const id = params.get("id");
  if (!source || !id) return;

  await waitForStoreHydration();

  const artist = params.get("artist");
  const track: MusicTrack = {
    id: `${source}_${id}`,
    name: params.get("title") ?? "未知歌曲",
    artist: artist ? [artist] : [],
    album: "",
    pic_id: "",
    url_id: id,
    lyric_id: "",
    source: source as MusicTrack["source"],
  };

  useMusicStore.getState().playTrackAsNext(track);
  const { queue, setCurrentIndexAndPlay } = useMusicStore.getState();
  const index = queue.findIndex((t) => t.id === track.id);
  if (index !== -1) setCurrentIndexAndPlay(index);
  logger.info(
    "share-service",
    "深链播放分享歌曲:",
    track.name,
    track.source,
    track.url_id
  );
}
