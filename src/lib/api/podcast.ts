import type { PodcastFeed, SearchPodcastItem } from "@/types/podcast";
import type { HttpOptions } from "@capacitor/core";
import { getApiUrl, IS_NATIVE } from ".";
import { retry } from "@/lib/utils";
import { parseRssXml } from "@/lib/utils/rss-parser";
import { cachedFetch } from "@/lib/utils/cache";
import { logger } from "@/lib/logger";
import { isAbort } from "@/lib/music-provider/utils";

/** RSS Feed 缓存 TTL：30 分钟 */
const PODCAST_FEED_CACHE_TTL = 30 * 60 * 1000;

/** 直连 RSS 源 HEAD 预检超时（毫秒） */
const RSS_DIRECT_CHECK_TIMEOUT = 3000;

const parseJson = async (res: Response) => {
  if (!res.ok) {
    throw new Error((await res.text()) || "请求失败");
  }
  try {
    return await res.json();
  } catch {
    throw new Error("接口返回不是有效 JSON");
  }
};

/**
 * Apple Podcasts iTunes 搜索响应类型
 */
type ApplePodcastResult = {
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  feedUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  collectionViewUrl?: string;
};

/**
 * 将 Apple Podcasts 响应标准化为 SearchPodcastItem
 */
const normalizeAppleResult = (item: ApplePodcastResult): SearchPodcastItem => ({
  source: "apple",
  id: String(item.collectionId ?? ""),
  title: item.collectionName?.trim() ?? "",
  author: item.artistName?.trim() ?? "",
  cover: item.artworkUrl600?.trim() || item.artworkUrl100?.trim() || null,
  rssUrl: item.feedUrl?.trim() || null,
  url: item.collectionViewUrl?.trim() || null,
});

/**
 * 前端直连 Apple Podcasts iTunes Search API
 */
const appleSearchPodcast = async (
  keyword: string,
  limit: number = 20
): Promise<SearchPodcastItem[]> => {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", keyword);
  url.searchParams.set("media", "podcast");
  url.searchParams.set("entity", "podcast");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("country", "CN");
  url.searchParams.set("lang", "zh_cn");

  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Apple Podcasts 搜索失败: HTTP ${response.status}`);
  }

  const json = (await response.json()) as { results?: ApplePodcastResult[] };
  return (json.results ?? [])
    .map(normalizeAppleResult)
    .filter((item) => item.id && item.title);
};

/**
 * 搜索播客（直连 Apple Podcasts）
 */
export const searchPodcast = async (
  keyword: string
): Promise<SearchPodcastItem[]> => {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return [];
  }
  return appleSearchPodcast(normalizedKeyword);
};

/**
 * 通过后端代理获取 RSS 并解析
 */
const fetchPodcastRssViaProxy = async (
  rssUrl: string,
  signal?: AbortSignal
): Promise<PodcastFeed | null> => {
  const res = await retry(
    async () => {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return await fetch(
        `${getApiUrl()}/podcast-api/rss?url=${encodeURIComponent(rssUrl)}`,
        { signal }
      );
    },
    2,
    1000
  );

  const json = await parseJson(res);
  return (json.data as PodcastFeed | undefined) ?? null;
};

/**
 * 快速检测 RSS 源是否网络可达
 * 使用 CapacitorHttp HEAD 请求 + 短超时，不可达时让调用方立即回退代理
 */
const checkRssReachable = async (
  rssUrl: string,
  signal?: AbortSignal
): Promise<boolean> => {
  try {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { CapacitorHttp } = await import("@capacitor/core");
    await CapacitorHttp.request({
      method: "HEAD",
      url: rssUrl,
      headers: {
        accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      connectTimeout: RSS_DIRECT_CHECK_TIMEOUT,
      readTimeout: RSS_DIRECT_CHECK_TIMEOUT,
    } as HttpOptions);
    return true;
  } catch (e) {
    if (isAbort(e)) throw e;
    return false;
  }
};

/**
 * 通过 CapacitorHttp 直连 RSS 源并解析
 * - 先 HEAD 预检快速探测可达性，不可达立即回退代理
 * - 预检通过后发起 GET + retry，减少用户等待时间
 */
const fetchPodcastRssDirect = async (
  rssUrl: string,
  signal?: AbortSignal
): Promise<PodcastFeed> => {
  const { CapacitorHttp } = await import("@capacitor/core");

  // HEAD 预检：3 秒超时探测可达性，不可达立即回退代理，避免用户长时间等待
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const reachable = await checkRssReachable(rssUrl, signal);
  if (!reachable) {
    throw new Error("RSS source unreachable");
  }

  return retry(
    async () => {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const res = await CapacitorHttp.request({
        method: "GET",
        url: rssUrl,
        headers: {
          accept: "application/rss+xml, application/xml, text/xml, */*",
        },
        signal,
      } as HttpOptions & { signal?: AbortSignal });
      if (res.status >= 400) {
        throw new Error(`RSS fetch failed: HTTP ${res.status}`);
      }
      const xmlText =
        typeof res.data === "string" ? res.data : String(res.data);
      return parseRssXml(xmlText, rssUrl);
    },
    2,
    1000
  );
};

/**
 * 解析播客 RSS
 * - 原生端：优先 CapacitorHttp 直连；直连不可达时回退后端代理
 * - Web 端：后端代理（RSS 源通常不支持 CORS）
 * - 解析结果按 rssUrl 缓存 30 分钟，减少重复请求并支持弱网回退
 */
export const parsePodcastRss = async (
  rssUrl: string,
  signal?: AbortSignal
): Promise<PodcastFeed> => {
  const normalizedUrl = rssUrl.trim();
  if (!normalizedUrl) {
    throw new Error("RSS 地址不能为空");
  }

  const fetcher = async (): Promise<PodcastFeed | null> => {
    if (IS_NATIVE) {
      try {
        // 原生端：直连 RSS 源
        return await fetchPodcastRssDirect(normalizedUrl, signal);
      } catch (e) {
        if (isAbort(e)) throw e;
        logger.warn(
          "podcast",
          `RSS 直连失败，回退代理: ${normalizedUrl}`,
          e instanceof Error ? e.message : String(e)
        );
        return fetchPodcastRssViaProxy(normalizedUrl, signal);
      }
    }

    // Web 端：后端代理
    return fetchPodcastRssViaProxy(normalizedUrl, signal);
  };

  const cached = await cachedFetch<PodcastFeed>(
    `podcast:feed:${normalizedUrl}`,
    fetcher,
    PODCAST_FEED_CACHE_TTL
  );

  if (!cached) {
    throw new Error("RSS 解析失败");
  }

  return cached;
};
