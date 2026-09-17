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

/** 小宇宙播客页 URL 前缀，用于复用 rssUrl 字段存储 */
const XYZ_PODCAST_PREFIX = "https://www.xiaoyuzhoufm.com/podcast/";

/** 小宇宙详情页直连超时（毫秒） */
const XYZ_FETCH_TIMEOUT = 10000;

/**
 * 小宇宙播客页 __NEXT_DATA__ 中的播客结构（仅声明用到的字段）
 */
type XyzPodcastData = {
  pid?: string;
  title?: string;
  author?: string;
  description?: string;
  brief?: string;
  image?: { picUrl?: string };
  episodes?: XyzEpisodeData[];
};

type XyzEpisodeData = {
  eid?: string;
  title?: string;
  pubDate?: string;
  enclosure?: { url?: string };
  media?: { source?: { url?: string } };
  image?: { picUrl?: string };
};

/**
 * 从链接中提取小宇宙播客 pid
 * 支持 https://www.xiaoyuzhoufm.com/podcast/{pid} 及带查询参数的变体
 * @param url 用户输入或存储的链接
 * @returns pid，非小宇宙播客链接时返回 null
 */
export const parseXyzPid = (url: string): string | null => {
  const matched = url
    .trim()
    .match(/xiaoyuzhoufm\.com\/podcast\/([0-9a-fA-F]{24})/);
  return matched ? matched[1] : null;
};

/**
 * 将小宇宙播客数据转为 RSS XML 字符串
 * 复用 parseRssXml 解析链路，避免为小宇宙单独维护一套解析逻辑
 * @param data 小宇宙 __NEXT_DATA__ 中的播客对象
 * @param pid 播客 pid，用于生成 guid
 */
const xyzToRssXml = (data: XyzPodcastData, pid: string): string => {
  // XML 转义，避免标题/描述中的 & < > 破坏结构
  const esc = (v: string | undefined | null): string =>
    (v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const cover = data.image?.picUrl;
  const episodes = (data.episodes ?? [])
    .map((ep) => {
      // 优先 enclosure.url，回退 media.source.url
      const audioUrl = ep.enclosure?.url || ep.media?.source?.url;
      if (!audioUrl || !ep.title) return null;
      return [
        "<item>",
        `<title>${esc(ep.title)}</title>`,
        `<enclosure url="${esc(audioUrl)}" type="audio/mp4"/>`,
        `<guid isPermaLink="false">${esc(ep.eid || audioUrl)}</guid>`,
        ep.pubDate
          ? `<pubDate>${esc(new Date(ep.pubDate).toUTCString())}</pubDate>`
          : "",
        ep.image?.picUrl
          ? `<itunes:image href="${esc(ep.image.picUrl)}"/>`
          : "",
        "</item>",
      ].join("");
    })
    .filter(Boolean)
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0">',
    "<channel>",
    `<title>${esc(data.title)}</title>`,
    `<description>${esc(data.brief || data.description)}</description>`,
    `<link>${XYZ_PODCAST_PREFIX}${pid}</link>`,
    cover ? `<itunes:image href="${esc(cover)}"/>` : "",
    episodes,
    "</channel>",
    "</rss>",
  ].join("");
};

/**
 * 拉取小宇宙播客详情页并解析为 PodcastFeed
 * 原生端 CapacitorHttp 直连（绕过 WebView CORS）；Web 端因无代理支持直接拒绝
 * @param pid 小宇宙播客 pid
 * @param signal 中断信号
 */
const fetchXyzPodcastFeed = async (
  pid: string,
  signal?: AbortSignal
): Promise<{ feed: PodcastFeed; author: string; brief: string }> => {
  const data = await fetchXyzPodcastData(pid, signal);
  const feed = parseRssXml(
    xyzToRssXml(data, pid),
    `${XYZ_PODCAST_PREFIX}${pid}`
  );
  if (!feed.name) feed.name = data.title ?? "";

  return {
    feed,
    author: data.author?.trim() ?? "",
    brief: data.brief || data.description || "",
  };
};

/**
 * 拉取并解析小宇宙播客页的 __NEXT_DATA__
 * @param pid 小宇宙播客 pid
 * @param signal 中断信号
 */
const fetchXyzPodcastData = async (
  pid: string,
  signal?: AbortSignal
): Promise<XyzPodcastData> => {
  if (!IS_NATIVE) {
    throw new Error("小宇宙订阅仅支持 Android 端");
  }

  const { CapacitorHttp } = await import("@capacitor/core");

  const res = await CapacitorHttp.request({
    method: "GET",
    url: `${XYZ_PODCAST_PREFIX}${pid}`,
    headers: {
      accept: "text/html,application/xhtml+xml",
      // 小宇宙对非浏览器 UA 可能返回不同内容，跟随浏览器标识
      "user-agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    },
    connectTimeout: XYZ_FETCH_TIMEOUT,
    readTimeout: XYZ_FETCH_TIMEOUT,
    signal,
  } as HttpOptions & { signal?: AbortSignal });

  if (res.status >= 400) {
    throw new Error(`小宇宙播客页请求失败: HTTP ${res.status}`);
  }

  const html = typeof res.data === "string" ? res.data : String(res.data);

  // 从 __NEXT_DATA__ 提取播客数据
  const matched = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!matched) {
    throw new Error("小宇宙页面结构已变化，无法解析");
  }

  let data: XyzPodcastData;
  try {
    const parsed = JSON.parse(matched[1]) as {
      props?: { pageProps?: { podcast?: XyzPodcastData } };
    };
    data = parsed.props?.pageProps?.podcast ?? {};
  } catch {
    throw new Error("小宇宙页面数据解析失败");
  }

  if (!data.pid || !data.title) {
    throw new Error("未找到播客信息");
  }

  return data;
};

/**
 * 将小宇宙播客页链接解析为可订阅项
 * 用于「粘贴链接订阅」入口，不依赖小宇宙搜索接口
 * @param pid 小宇宙播客 pid
 * @param signal 中断信号
 */
export const resolveXyzPodcast = async (
  pid: string,
  signal?: AbortSignal
): Promise<SearchPodcastItem> => {
  const { feed, author, brief } = await fetchXyzPodcastFeed(pid, signal);

  return {
    source: "xyz",
    id: pid,
    title: feed.name,
    author,
    description: brief || null,
    cover: feed.coverUrl,
    // 复用 rssUrl 字段存储小宇宙播客页链接，parsePodcastRss 据此分发
    rssUrl: `${XYZ_PODCAST_PREFIX}${pid}`,
    url: `${XYZ_PODCAST_PREFIX}${pid}`,
  };
};

/**
 * 将用户粘贴的播客链接解析为可订阅项
 * 支持小宇宙播客页链接；其他链接（含普通 RSS）返回 null 交由通用 RSS 流程处理
 * @param input 用户输入的链接
 * @param signal 中断信号
 */
export const resolvePodcastUrl = async (
  input: string,
  signal?: AbortSignal
): Promise<SearchPodcastItem | null> => {
  const url = input.trim();
  if (!url) return null;

  const xyzPid = parseXyzPid(url);
  if (xyzPid) {
    return resolveXyzPodcast(xyzPid, signal);
  }

  return null;
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
    // 小宇宙播客页链接：走详情页解析，不依赖 RSS
    const xyzPid = parseXyzPid(normalizedUrl);
    if (xyzPid) {
      const { feed } = await fetchXyzPodcastFeed(xyzPid, signal);
      return feed;
    }

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
