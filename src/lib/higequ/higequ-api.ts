import { fetchWithTimeout, getProxyUrl, IS_NATIVE } from "@/lib/api/config";
import { logger } from "@/lib/logger";
import type { MusicTrack } from "@/types/music";

/**
 * Hi歌曲音乐网（https://higequ.com）适配层。
 *
 * 该站点不提供任何 JSON 接口，页面全部由 PHP 服务端渲染，因此只能抓 HTML 后解析：
 * - 搜索：`/s/{关键词}/{页码}/`，每页固定 10 条，结果在 `.result-item[data-rid]`
 * - 播放：`/player/{rid}/`，音频直链以内联 base64 给出，且**标记名改过**
 *   （旧 `let code` → 现 `const encodedUrl`），故解析按内容嗅探、不认变量名；
 *   歌词以 `.lyric-line[data-time]`（秒）渲染
 */

const HIGEQU_BASE = "https://higequ.com";
const LOG_TAG = "higequ-api";
const NETWORK_TIMEOUT = 15000;

/** 曲目 ID 前缀，避免与其他音源的裸数字 ID 冲突 */
export const HIGEQU_TRACK_ID_PREFIX = "higequ_";

/**
 * 站点会直接断开非浏览器 User-Agent 的请求（curl 默认 UA 实测连接被重置），
 * 原生端 CapacitorHttp 默认走 okhttp UA，这里显式伪装为移动端浏览器。
 */
const HIGEQU_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

// ============================================================
// 网络层（环境路由：原生直连 / Web 走 /proxy）
// ============================================================

async function fetchHigequHtml(
  path: string,
  signal?: AbortSignal
): Promise<string | null> {
  const url = `${HIGEQU_BASE}${path}`;

  try {
    if (IS_NATIVE) {
      const { CapacitorHttp } = await import("@capacitor/core");
      const res = await CapacitorHttp.request({
        method: "GET",
        url,
        headers: { "User-Agent": HIGEQU_UA },
        connectTimeout: NETWORK_TIMEOUT,
        readTimeout: NETWORK_TIMEOUT,
      });
      if (res.status >= 400) return null;
      return typeof res.data === "string" ? res.data : String(res.data ?? "");
    }

    // 传入 signal 参数支持取消请求
    const res = await fetchWithTimeout(
      getProxyUrl(url),
      { signal },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return null;
    logger.warn(LOG_TAG, `请求失败：${url}`, e);
    return null;
  }
}

// ============================================================
// 工具函数 & 搜索解析
// ============================================================

export interface HigequSearchItem {
  /** 站点内部歌曲 ID，播放页路径为 /player/{rid}/ */
  rid: string;
  name: string;
  /** 多歌手以 `&` 连接后的原始字符串 */
  artist: string;
  album: string;
}

const cleanText = (el: Element | null): string =>
  el?.textContent?.trim().replace(/\s+/g, " ") ?? "";

/**
 * 站点用 `&` 连接多歌手（如 `五月天&周杰伦`）。
 * 但西文歌手名中的 `&` 两侧通常带空格（如 `Simon & Garfunkel`），
 * 因此仅当整串不存在 ` & ` 时才按 `&` 拆分，避免误伤。
 */
export function splitHigequArtists(raw: string): string[] {
  const value = raw.trim();
  if (!value) return [];
  if (!value.includes("&") || value.includes(" & ")) return [value];
  return value
    .split("&")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 解析搜索结果页 HTML。
 *
 * `hasMore` 以 `#next-page` 的 disabled 属性为准：实测站点会在最后一页给该按钮加上
 * disabled。若分页容器整体缺失（站点改版），保守返回 false，避免聚合搜索无限翻页。
 */
export function parseHigequSearchHtml(html: string): {
  items: HigequSearchItem[];
  hasMore: boolean;
} {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const items: HigequSearchItem[] = [];

  const elements = doc.querySelectorAll(".result-item[data-rid]");
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const rid = el.getAttribute("data-rid")?.trim();
    const name = cleanText(el.querySelector(".result-title"));
    if (!rid || !name) continue;

    items.push({
      rid,
      name,
      artist: cleanText(el.querySelector(".result-artist")),
      album: cleanText(el.querySelector(".result-album")).replace(
        /^专辑[:：]\s*/,
        ""
      ),
    });
  }

  const nextButton = doc.querySelector("#next-page");

  return {
    items,
    hasMore: nextButton ? !nextButton.hasAttribute("disabled") : false,
  };
}

export function convertHigequSearchItemToMusicTrack(
  item: HigequSearchItem
): MusicTrack {
  const trackId = `${HIGEQU_TRACK_ID_PREFIX}${item.rid}`;

  return {
    id: trackId,
    name: item.name,
    artist: splitHigequArtists(item.artist),
    album: item.album,
    // 搜索页不含封面，pic_id 只存标记位，播放时再去播放页取真实封面
    pic_id: trackId,
    url_id: item.rid,
    lyric_id: trackId,
    source: "higequ",
  };
}

/**
 * 搜索 Hi歌曲音乐网。结果带 2 分钟短 TTL + LRU 缓存，
 * 相同关键词/页码的重复查询直接返回缓存。
 */
export async function searchHigequSongs(
  keyword: string,
  page = 1,
  signal?: AbortSignal
): Promise<{ items: MusicTrack[]; hasMore: boolean }> {
  const trimmed = keyword.trim();
  if (!trimmed || signal?.aborted) return { items: [], hasMore: false };

  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const cacheKey = `${trimmed}::${safePage}`;

  // 命中有效缓存直接返回（刷新 LRU 顺序）
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL) {
    searchCache.delete(cacheKey);
    searchCache.set(cacheKey, cached);
    return { items: cached.items, hasMore: cached.hasMore };
  } else if (cached) {
    searchCache.delete(cacheKey); // 过期剔除
  }

  const html = await fetchHigequHtml(
    `/s/${encodeURIComponent(trimmed)}/${safePage}/`,
    signal
  );
  if (!html) return { items: [], hasMore: false };

  const { items, hasMore } = parseHigequSearchHtml(html);
  const result = {
    items: items.map(convertHigequSearchItemToMusicTrack),
    hasMore,
  };

  // LRU 容量上限：超限时淘汰最久未写入条目
  if (!searchCache.has(cacheKey) && searchCache.size >= SEARCH_CACHE_MAX) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(cacheKey, { at: Date.now(), ...result });

  return result;
}

// ============================================================
// 播放页解析 & 带防重刷缓存机制
// ============================================================

export interface HigequSongDetail {
  rid: string;
  audioUrl: string;
  coverUrl: string;
  lyric: string;
}

// 缓存管理：TTL + LRU 容量上限，及在请求中（In-Flight）合并
const DETAIL_CACHE_TTL = 10 * 60 * 1000;
const DETAIL_CACHE_MAX = 50;
const detailCache = new Map<string, { at: number; value: HigequSongDetail }>();
const pendingRequests = new Map<string, Promise<HigequSongDetail | null>>();

const SEARCH_CACHE_TTL = 2 * 60 * 1000;
const SEARCH_CACHE_MAX = 30;
const searchCache = new Map<
  string,
  {
    at: number;
    items: MusicTrack[];
    hasMore: boolean;
  }
>();

function formatLrcTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = (safe % 60).toFixed(2);
  return `${String(minutes).padStart(2, "0")}:${secs.padStart(5, "0")}`;
}

/** 明文音频直链（直接写在 HTML 里的形态） */
const PLAIN_AUDIO_URL_RE =
  /https?:\/\/[^\s"'<>]+\.(?:mp3|m4a|aac|flac|ogg|opus)(?:[?#][^\s"'<>]*)?/i;

/** 解码后的音频直链判定：站点 token 在路径里，故只校验域名协议与音频扩展名 */
const DECODED_AUDIO_URL_RE =
  /^https?:\/\/[^\s]+\.(?:mp3|m4a|aac|flac|ogg|opus)(?:[?#]\S*)?$/i;

/**
 * 把 base64 解成字符串。
 *
 * 站点是 base64(UTF-8)，浏览器侧用 `TextDecoder` 还原（与站点自身脚本一致），
 * 不能用 `atob` 的 latin1 结果直接拼 URL。
 */
function decodeBase64Utf8(base64: string): string {
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes).trim();
  } catch {
    return "";
  }
}

/**
 * 从播放页 HTML 中取出音频直链。
 *
 * 站点把直链以 base64 内联在 `<script>` 里，且**标记名改过**
 * （旧 `let code = "..."` → 现 `const encodedUrl = "..."`）。
 * 因此这里按内容嗅探而非依赖变量名：
 * 1. 明文音频 URL（有的页面直接给）；
 * 2. 已知标记名（老/新两代，回归最低成本）；
 * 3. 兜底：扫所有 ≥40 字符的 base64 串，解码后必须是音频 URL —— 站点再怎么改变量名都命中。
 *
 * 实测 `/player/228908/` 全页只有 1 个这样的 base64 串，误判风险极低。
 */
function parseInlineAudioUrl(html: string): string {
  const plain = html.match(PLAIN_AUDIO_URL_RE);
  if (plain) return plain[0];

  const named =
    html.match(/encodedUrl\s*=\s*["']([A-Za-z0-9+/=]+)["']/)?.[1] ??
    html.match(/let\s+code\s*=\s*["']([A-Za-z0-9+/=]+)["']/)?.[1];
  if (named) {
    const url = decodeBase64Utf8(named);
    if (/^https?:\/\//i.test(url)) return url;
  }

  for (const match of html.matchAll(/["']([A-Za-z0-9+/=]{40,})["']/g)) {
    const url = decodeBase64Utf8(match[1]);
    if (DECODED_AUDIO_URL_RE.test(url)) return url;
  }

  return "";
}

export function parseHigequPlayerHtml(
  html: string
): Omit<HigequSongDetail, "rid"> {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const coverUrl =
    doc.querySelector("#album-cover")?.getAttribute("src")?.trim() ?? "";

  const lyricLines: string[] = [];
  const lineEls = doc.querySelectorAll(".lyric-line[data-time]");

  for (let i = 0; i < lineEls.length; i++) {
    const el = lineEls[i];
    const seconds = Number(el.getAttribute("data-time"));
    const text = cleanText(el);
    if (!Number.isFinite(seconds) || !text) continue;
    lyricLines.push(`[${formatLrcTime(seconds)}]${text}`);
  }

  return {
    audioUrl: parseInlineAudioUrl(html),
    coverUrl,
    lyric: lyricLines.join("\n"),
  };
}

/**
 * 获取播放页详情（音频直链 / 封面 / 歌词）。
 * 命中缓存则不发请求；失败不写缓存，交给上层 musicApi 的缓存策略兜底。
 */
export async function getHigequSongDetail(
  rid: string
): Promise<HigequSongDetail | null> {
  const key = rid.trim();
  if (!key) return null;

  // 1. 命中内存有效缓存直接返回（命中时刷新 LRU 顺序）
  const cached = detailCache.get(key);
  if (cached) {
    if (Date.now() - cached.at < DETAIL_CACHE_TTL) {
      detailCache.delete(key);
      detailCache.set(key, cached);
      return cached.value;
    }
    detailCache.delete(key); // 过期剔除
  }

  // 2. 请求去重：同一 rid 若在请求中，复用 Promise
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  const reqPromise = (async () => {
    try {
      const html = await fetchHigequHtml(`/player/${encodeURIComponent(key)}/`);
      if (!html) return null;

      const value: HigequSongDetail = {
        rid: key,
        ...parseHigequPlayerHtml(html),
      };

      // 3. LRU 容量上限：超限时淘汰最久未写入条目
      if (!detailCache.has(key) && detailCache.size >= DETAIL_CACHE_MAX) {
        const oldestKey = detailCache.keys().next().value;
        if (oldestKey !== undefined) detailCache.delete(oldestKey);
      }
      detailCache.set(key, { at: Date.now(), value });

      if (!value.audioUrl) {
        logger.warn(LOG_TAG, `播放页未取到音频直链：${key}`);
      }

      return value;
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, reqPromise);
  return reqPromise;
}

/** 从 `higequ_123` / `123` 形式的 ID 中取出纯数字 rid，非法输入返回 null */
export function parseHigequRid(id: string | undefined | null): string | null {
  if (!id) return null;
  const rid = id.startsWith(HIGEQU_TRACK_ID_PREFIX)
    ? id.slice(HIGEQU_TRACK_ID_PREFIX.length)
    : id;
  return /^\d+$/.test(rid) ? rid : null;
}
