import { fetchWithTimeout } from "@/lib/api/config";
import { logger } from "@/lib/logger";
import type { MusicTrack, SearchPageResult } from "@/types/music";

/**
 * Jamendo 适配层，走站点自己的网页接口（`www.jamendo.com/api/*`），
 * 不是需要注册 app 的 developers API —— **无需 client_id、无需登录、无需 cookie**。
 *
 * 唯一门槛是 `x-jam-call` 请求头，格式 `$sha1(path + randStr)*randStr~`，
 * 纯本地可算（不含任何密钥）。实测结论：
 * - 响应头 `access-control-allow-origin: *`，预检放行 `x-jam-call` → Web/原生直连，无需走代理；
 * - `/api/search` 直接返回曲目数组，含 name / artist / album / cover / stream，
 *   一次请求即可填满 MusicTrack（无需再查详情）；
 * - 音频直链是确定性的 `?trackid={id}&format=mp32`（实测 40/40 可用且支持 Range），
 *   故取流按模板拼串即可，零额外请求；只有 mp32 一档 → 单一音质音源。
 */

const JAMENDO_WEB_BASE = "https://www.jamendo.com";
/** 音频直链模板：mp31 约 96kbps 偏低，mp33 多数曲目不存在，取 mp32 */
const JAMENDO_STREAM_BASE = "https://prod-1.storage.jamendo.com/";
const LOG_TAG = "jamendo-api";
const NETWORK_TIMEOUT = 15000;
/** 接口 limit 上限保守取值 */
const MAX_LIMIT = 100;

/** 曲目 ID 前缀，避免与其他音源的裸数字 ID 冲突 */
export const JAMENDO_TRACK_ID_PREFIX = "jamendo_";

/** `/api/search` 返回的单条曲目（只声明用到的字段） */
interface JamendoSearchItem {
  id: number;
  name: string;
  artist?: { name?: string };
  album?: { name?: string };
  cover?: { big?: { size300?: string } };
}

/**
 * 生成 `x-jam-call` 签名：站点前端算法为 `$sha1(path + randStr)*randStr~`，无密钥。
 * 用 Web Crypto 计算（页面为 https://localhost 安全上下文，`crypto.subtle` 可用）。
 */
async function makeXJamCall(path: string): Promise<string> {
  const randStr = String(Math.random());
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(path + randStr)
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `$${hex}*${randStr}~`;
}

/** 请求 Jamendo 网页接口（path 必须与签名中使用的 path 一致） */
async function jamendoGet<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<T | null> {
  if (signal?.aborted) return null;
  const url = `${JAMENDO_WEB_BASE}${path}?${new URLSearchParams(params)}`;

  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { "x-jam-call": await makeXJamCall(path) }, signal },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return null;
    logger.warn(LOG_TAG, `请求失败：${url}`, e);
    return null;
  }
}

/** 空页（搜索词为空或请求失败时复用） */
const EMPTY_PAGE: SearchPageResult<MusicTrack> = { items: [], hasMore: false };

/** 曲目 ID → 音频直链（确定性模板，不发请求） */
export function buildJamendoStreamUrl(id: string): string {
  return `${JAMENDO_STREAM_BASE}?trackid=${encodeURIComponent(id)}&format=mp32`;
}

/** 从 `jamendo_123` / `123` 形式的 ID 中取出纯数字 track id，非法输入返回 null */
export function parseJamendoTrackId(
  id: string | undefined | null
): string | null {
  if (!id) return null;
  const raw = id.startsWith(JAMENDO_TRACK_ID_PREFIX)
    ? id.slice(JAMENDO_TRACK_ID_PREFIX.length)
    : id;
  return /^\d+$/.test(raw) ? raw : null;
}

/** 接口曲目 → MusicTrack；ID 非法则丢弃该条 */
function convertToMusicTrack(item: JamendoSearchItem): MusicTrack | null {
  const trackId = parseJamendoTrackId(String(item.id ?? ""));
  if (!trackId) return null;

  return {
    id: `${JAMENDO_TRACK_ID_PREFIX}${trackId}`,
    name: item.name?.trim() || "未知曲目",
    artist: item.artist?.name ? [item.artist.name] : [],
    album: item.album?.name ?? "",
    // 搜索结果已带封面直链，上层 musicApi 对 http 形式免解析
    pic_id: item.cover?.big?.size300 ?? "",
    // url_id 存纯数字 ID，直链由 buildJamendoStreamUrl 拼出
    url_id: trackId,
    lyric_id: `${JAMENDO_TRACK_ID_PREFIX}${trackId}`,
    source: "jamendo",
    audioFormat: "mp3",
  };
}

/**
 * 搜索 Jamendo 曲目。接口用 `offset` 分页（`page` 参数实测无效），
 * 返回条数不足一页即视为末页。
 */
export async function searchJamendoSongs(
  keyword: string,
  page = 1,
  count = 20,
  signal?: AbortSignal
): Promise<SearchPageResult<MusicTrack>> {
  const query = keyword.trim();
  if (!query) return EMPTY_PAGE;

  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const limit = Math.min(Math.max(Math.floor(count) || 20, 1), MAX_LIMIT);

  const items = await jamendoGet<JamendoSearchItem[]>(
    "/api/search",
    {
      query,
      type: "track",
      identities: "www",
      limit: String(limit),
      offset: String((safePage - 1) * limit),
    },
    signal
  );
  if (!Array.isArray(items)) return EMPTY_PAGE;

  return {
    items: items
      .map(convertToMusicTrack)
      .filter((track): track is MusicTrack => track !== null),
    hasMore: items.length >= limit,
  };
}
