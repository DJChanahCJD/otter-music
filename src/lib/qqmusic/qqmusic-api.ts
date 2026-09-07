import type { MusicTrack, SearchPageResult, SongLyric } from "@/types/music";
import {
  type QqPlaylistDetail,
  type QqSosoSearchResponse,
  type QqVkeyResponse,
  QQ_API_URL,
  QQ_LYRIC_URL,
  QQ_REFERER,
  QQ_SEARCH_BASE_URL,
  buildQqPlaylistApiPath,
  buildQqSearchApiPath,
  buildVkeyRequestBody,
  convertQqSongToMusicTrack,
  decodeQqHtmlEntities,
  extractVkeyUrl,
  orderQqQualityKeys,
  parseQqPlaylistResponse,
  parseQqSosoSearchResponse,
  qqBrToQualityKey,
} from "@otter-music/shared";
import { IS_NATIVE } from "@/lib/api/config";
import { useQqStore } from "@/store/qq-store";
import { logger } from "@/lib/logger";

const NETWORK_TIMEOUT = 12000;

/**
 * 从 QQ 音乐分享链接中提取歌单数字 ID。
 * 支持格式:
 *   https://y.qq.com/n/yqq/playlist/{id}.html
 *   https://i.y.qq.com/n2/m/share/details/taoge.html?id={id}
 */
export function parseQqMusicUrl(urlStr: string): string | null {
  try {
    const url = new URL(
      urlStr.startsWith("http") ? urlStr : `https://${urlStr}`
    );

    // 尝试从路径中提取: /n/yqq/playlist/7177076625.html
    const playlistMatch = url.pathname.match(/playlist\/(\d+)/);
    if (playlistMatch) return playlistMatch[1];

    // 尝试从 query 参数中提取: ?id=7177076625
    const idParam = url.searchParams.get("id");
    if (idParam && /^\d+$/.test(idParam)) return idParam;

    return null;
  } catch {
    return null;
  }
}

// Re-export for convenience
export {
  convertQqSongToMusicTrack,
  buildQqPlaylistApiPath,
  parseQqPlaylistResponse,
};

/**
 * 带超时的 fetch。超时信号与外部传入的 AbortSignal 叠加,
 * 任一触发都会中止请求 (不覆盖外部 signal)。
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = NETWORK_TIMEOUT
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  const external = options.signal;
  const onAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onAbort);
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    external?.removeEventListener("abort", onAbort);
  }
}

/**
 * 获取 QQ 音乐歌单详情。
 * - 开发环境 (Web): 通过 Vite 代理 /api/qqmusic → i.y.qq.com
 * - 原生环境 (Capacitor): 直接调用 i.y.qq.com (原生无 CORS 限制)
 */
export async function getQqPlaylistDetail(
  playlistId: string
): Promise<QqPlaylistDetail> {
  if (IS_NATIVE) {
    // 原生环境直接请求
    const url = `https://i.y.qq.com${buildQqPlaylistApiPath(playlistId)}`;
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url,
      headers: { Referer: QQ_REFERER },
    });
    if (res.status >= 400) throw new Error(`QQ Music API error: ${res.status}`);
    const rawText =
      typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    const data = parseQqPlaylistResponse(rawText);
    if (data.subcode && data.subcode !== 0)
      throw new Error(
        data.msg || `QQ Music API returned subcode ${data.subcode}`
      );
    if (!data.cdlist?.length) throw new Error("歌单不存在或已被删除");
    return {
      name: data.cdlist[0].dissname,
      coverUrl: data.cdlist[0].logo,
      trackCount: data.cdlist[0].songnum,
      songs: data.cdlist[0].songlist || [],
    };
  }

  // 开发环境 (Web): 通过 Vite 代理
  // 注意: 不能在 headers 中设置 Referer，浏览器会静默丢弃（forbidden header）。
  // Referer 由 Vite 代理的 configure 钩子在服务端注入。
  const url = `/api/qqmusic${buildQqPlaylistApiPath(playlistId)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`QQ Music API error: ${res.status}`);

  const rawText = await res.text();
  const data = parseQqPlaylistResponse(rawText);

  if (data.subcode && data.subcode !== 0)
    throw new Error(
      data.msg || `QQ Music API returned subcode ${data.subcode}`
    );
  if (!data.cdlist?.length) throw new Error("歌单不存在或已被删除");

  return {
    name: data.cdlist[0].dissname,
    coverUrl: data.cdlist[0].logo,
    trackCount: data.cdlist[0].songnum,
    songs: data.cdlist[0].songlist || [],
  };
}

// --- QQ 音乐搜索 ---

const PAGE_SIZE = 20;

const QQ_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36";

export async function searchQqMusic(
  query: string,
  page: number,
  signal?: AbortSignal
): Promise<SearchPageResult<MusicTrack>> {
  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url: `${QQ_SEARCH_BASE_URL}${buildQqSearchApiPath(query, page, PAGE_SIZE)}`,
      headers: { Referer: QQ_REFERER, "User-Agent": QQ_USER_AGENT },
    });
    if (res.status >= 400) {
      logger.error("qqmusic", `QQ 搜索失败: HTTP ${res.status}`, {
        query,
        page,
      });
      return { items: [], hasMore: false };
    }
    const data =
      typeof res.data === "string"
        ? (JSON.parse(res.data) as QqSosoSearchResponse)
        : (res.data as QqSosoSearchResponse);
    if (data.code !== 0) {
      logger.error("qqmusic", `QQ 搜索失败: code=${data.code}`, {
        query,
        page,
        message: data.message,
      });
    }
    return parseQqSosoSearchResponse(data, page, PAGE_SIZE);
  }

  // dev: 通过 Vite 代理 /api/qqmusic-soso → c.y.qq.com
  const res = await fetchWithTimeout(
    `/api/qqmusic-soso${buildQqSearchApiPath(query, page, PAGE_SIZE)}`,
    { signal }
  );
  if (!res.ok) {
    logger.error("qqmusic", `QQ 搜索失败: HTTP ${res.status}`, {
      query,
      page,
    });
    return { items: [], hasMore: false };
  }
  const data = (await res.json()) as QqSosoSearchResponse;
  if (data.code !== 0) {
    logger.error("qqmusic", `QQ 搜索失败: code=${data.code}`, {
      query,
      page,
      message: data.message,
    });
  }
  return parseQqSosoSearchResponse(data, page, PAGE_SIZE);
}

// --- QQ 音乐音频 URL (vkey 直连) ---

/**
 * 通过 QQ 音乐 vkey API 获取音频直链。
 * 根据目标码率 br 选择首选质量（QQ 无 192 档，就近降级；320k 封顶），
 * 请求内按优先级降级，不可播放时返回 null。
 * - 原生: 直连 u.y.qq.com
 * - 开发: 走 Vite 代理
 */
export async function getQqMusicUrl(
  songmid: string,
  br = 320
): Promise<string | null> {
  const qualityKeys = orderQqQualityKeys(qqBrToQualityKey(br));

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const { cookie, user } = useQqStore.getState();
    const authenticatedUin = cookie && user?.uin ? user.uin : "0";
    const authenticatedBody = buildVkeyRequestBody(
      songmid,
      qualityKeys,
      authenticatedUin
    );
    const res = await CapacitorHttp.request({
      method: "POST",
      url: QQ_API_URL,
      headers: {
        "Content-Type": "application/json",
        Referer: QQ_REFERER,
        "User-Agent": QQ_USER_AGENT,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      data: JSON.stringify(authenticatedBody),
    });
    if (res.status >= 400) return null;
    const data =
      typeof res.data === "string"
        ? (JSON.parse(res.data) as QqVkeyResponse)
        : (res.data as QqVkeyResponse);
    const directUrl = extractVkeyUrl(data);
    if (!directUrl) return null;
    return directUrl;
  }

  // dev
  const { cookie, user } = useQqStore.getState();
  const uin = cookie && user?.uin ? user.uin : "0";
  const authenticatedBody = buildVkeyRequestBody(songmid, qualityKeys, uin);
  try {
    const res = await fetchWithTimeout(`/api/qqmusic-url/cgi-bin/musicu.fcg`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { "X-Real-Cookie": cookie } : {}),
      },
      body: JSON.stringify(authenticatedBody),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as QqVkeyResponse;
    return extractVkeyUrl(data);
  } catch {
    return null;
  }
}

// --- QQ 音乐歌词 ---

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function parseJsonpLyric(
  raw: string
): { lyric: string; trans?: string } | null {
  const jsonStr = raw.replace(/^[\w$.]+\s*\(/, "").replace(/\)\s*;?\s*$/, "");
  const data = JSON.parse(jsonStr);
  const lyric = decodeBase64Utf8(data.lyric || "");
  let trans: string | undefined;
  if (data.trans) {
    trans = decodeBase64Utf8(data.trans);
  }
  return { lyric, trans };
}

export async function getQqMusicLyric(
  songmid: string
): Promise<SongLyric | null> {
  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url: `${QQ_LYRIC_URL}?songmid=${encodeURIComponent(songmid)}&pcachetime=${Date.now()}&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`,
      headers: { Referer: QQ_REFERER },
    });
    if (res.status >= 400) return null;
    const rawText =
      typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    const parsed = parseJsonpLyric(rawText);
    if (!parsed) return null;
    return {
      lyric: decodeQqHtmlEntities(parsed.lyric),
      tlyric: parsed.trans ? decodeQqHtmlEntities(parsed.trans) : undefined,
    };
  }

  // dev
  const res = await fetchWithTimeout(
    `/api/qqmusic-lyric/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(songmid)}&pcachetime=${Date.now()}&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`
  );
  if (!res.ok) return null;
  const rawText = await res.text();
  const parsed = parseJsonpLyric(rawText);
  if (!parsed) return null;
  return {
    lyric: decodeQqHtmlEntities(parsed.lyric),
    tlyric: parsed.trans ? decodeQqHtmlEntities(parsed.trans) : undefined,
  };
}
