import { fetchWithTimeout, getProxyUrl, IS_NATIVE } from "@/lib/api/config";
import { logger } from "@/lib/logger";
import type { MusicTrack } from "@/types/music";

/**
 * Hi歌曲音乐网（https://higequ.com）适配层。
 *
 * 该站点不提供任何 JSON 接口，页面全部由 PHP 服务端渲染，因此只能抓 HTML 后解析：
 * - 搜索：`/s/{关键词}/{页码}/`，每页固定 10 条，结果在 `.result-item[data-rid]`
 * - 播放：`/player/{rid}/`，音频直链以内联 base64（`let code = "..."`）给出，
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

async function fetchHigequHtml(path: string): Promise<string | null> {
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
      return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    }

    const res = await fetchWithTimeout(getProxyUrl(url), {}, NETWORK_TIMEOUT);
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    logger.warn(LOG_TAG, `请求失败：${url}`, e);
    return null;
  }
}

// ============================================================
// 搜索结果解析
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
  el?.textContent?.replace(/\s+/g, " ").trim() ?? "";

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

  doc.querySelectorAll(".result-item[data-rid]").forEach((el) => {
    const rid = el.getAttribute("data-rid")?.trim();
    const name = cleanText(el.querySelector(".result-title"));
    if (!rid || !name) return;

    items.push({
      rid,
      name,
      artist: cleanText(el.querySelector(".result-artist")),
      album: cleanText(el.querySelector(".result-album")).replace(
        /^专辑[:：]\s*/,
        ""
      ),
    });
  });

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

export async function searchHigequSongs(
  keyword: string,
  page = 1,
  signal?: AbortSignal
): Promise<{ items: MusicTrack[]; hasMore: boolean }> {
  const trimmed = keyword.trim();
  if (!trimmed || signal?.aborted) return { items: [], hasMore: false };

  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const html = await fetchHigequHtml(
    `/s/${encodeURIComponent(trimmed)}/${safePage}/`
  );
  if (!html) return { items: [], hasMore: false };

  const { items, hasMore } = parseHigequSearchHtml(html);
  return { items: items.map(convertHigequSearchItemToMusicTrack), hasMore };
}

// ============================================================
// 播放页解析（音频直链 / 封面 / 歌词）
// ============================================================

export interface HigequSongDetail {
  rid: string;
  /** 音频直链，来自页面内联 base64 解码 */
  audioUrl: string;
  coverUrl: string;
  /** 由页面内联歌词行重建的 LRC 文本 */
  lyric: string;
}

/** 播放页解析结果缓存：一次播放最多只触发一次播放页请求 */
const detailCache = new Map<string, { at: number; value: HigequSongDetail }>();
const DETAIL_CACHE_TTL = 10 * 60 * 1000;

/** 把秒数格式化为 LRC 时间戳 `[mm:ss.xx]`（与 src/lib/lyrics.ts 的解析口径一致） */
function formatLrcTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = Math.round((safe - minutes * 60) * 100) / 100;
  return `${String(minutes).padStart(2, "0")}:${secs.toFixed(2).padStart(5, "0")}`;
}

/** 从页面原始 HTML 的内联脚本中取出 base64 音频地址 */
function parseInlineAudioUrl(html: string): string {
  const match = html.match(/let\s+code\s*=\s*"([^"]*)"/);
  const code = match?.[1];
  if (!code) return "";

  try {
    const decoded = atob(code);
    return /^https?:\/\//.test(decoded) ? decoded : "";
  } catch {
    // base64 不合法视为无直链
    return "";
  }
}

export function parseHigequPlayerHtml(
  html: string
): Omit<HigequSongDetail, "rid"> {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const coverUrl =
    doc.querySelector("#album-cover")?.getAttribute("src")?.trim() ?? "";

  const lyricLines: string[] = [];
  doc.querySelectorAll(".lyric-line[data-time]").forEach((el) => {
    const seconds = Number(el.getAttribute("data-time"));
    const text = cleanText(el);
    if (!Number.isFinite(seconds) || !text) return;
    lyricLines.push(`[${formatLrcTime(seconds)}]${text}`);
  });

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

  const cached = detailCache.get(key);
  if (cached && Date.now() - cached.at < DETAIL_CACHE_TTL) return cached.value;

  const html = await fetchHigequHtml(`/player/${encodeURIComponent(key)}/`);
  if (!html) return null;

  const value: HigequSongDetail = { rid: key, ...parseHigequPlayerHtml(html) };
  detailCache.set(key, { at: Date.now(), value });

  if (!value.audioUrl) {
    logger.warn(LOG_TAG, `播放页未取到音频直链：${key}`);
  }

  return value;
}

/** 从 `higequ_123` / `123` 形式的 ID 中取出纯数字 rid，非法输入返回 null */
export function parseHigequRid(id: string | undefined | null): string | null {
  if (!id) return null;
  const rid = id.startsWith(HIGEQU_TRACK_ID_PREFIX)
    ? id.slice(HIGEQU_TRACK_ID_PREFIX.length)
    : id;
  return /^\d+$/.test(rid) ? rid : null;
}
