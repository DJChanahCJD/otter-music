import {
  fetchWithTimeout,
  getApiUrl,
  IS_NATIVE,
  IS_WEB_PROD,
} from "@/lib/api/config";
import {
  buildBilibiliDurlPlayUrlPath,
  buildBilibiliHeaders,
  buildBilibiliPlayUrlPath,
  buildBilibiliSeasonsArchivesListPath,
  buildBilibiliSearchPath,
  buildBilibiliSeriesArchivesPath,
  buildBilibiliSeriesDetailPath,
  buildBilibiliViewPath,
  buildBilibiliMultiPAlbumId,
  buildBilibiliSeriesAlbumId,
  convertSeasonArchiveToMusicTrack,
  convertSeriesArchiveToMusicTrack,
  describePlayurlResponse,
  parseBilibiliAlbumId,
  parseBilibiliMultiPAlbumId,
  parseBilibiliSeasonsArchivesList,
  parseBilibiliSearchResponse,
  parseBilibiliSeriesArchives,
  parseBilibiliSeriesDetail,
  parseBilibiliTrackId,
  selectBilibiliAudioUrl,
  selectBilibiliCid,
  selectBilibiliDurlUrl,
  type BilibiliDurlResponse,
  type BilibiliPlayUrlResponse,
  type BilibiliSeasonsArchivesListResponse,
  type BilibiliSearchResponse,
  type BilibiliSearchVideoRaw,
  type BilibiliSeriesArchivesResponse,
  type BilibiliSeriesMetaRaw,
  type BilibiliSeriesResponse,
  type BilibiliViewResponse,
  type MusicTrack,
  type SearchPageResult,
} from "@otter-music/shared";

import { registerBlobUrl } from "@/lib/utils/blob-registry";
import { base64ToBlob } from "@/lib/utils/base64";
import { logger } from "../logger";
import { setUpNameCache, getUpNameCache } from "@/lib/bilibili/up-name-cache";
import { cachedFetch } from "@/lib/utils/cache";

const BILIBILI_API_BASE = "https://api.bilibili.com";
const BILIBILI_PROXY_PREFIX = "/music-api/bilibili";
const BILIBILI_DEV_AUDIO_PROXY = "/api/bilibili-audio";
const BILIBILI_DEV_COVER_PROXY = "/api/bilibili-cover";
const NETWORK_TIMEOUT = 12000;
const NATIVE_CONNECT_TIMEOUT = 10000;
const NATIVE_READ_TIMEOUT = 15000;

function ensureBlob(data: unknown, mimeType: string): Blob | null {
  if (data instanceof Blob) return data;
  if (typeof data === "string") {
    let base64 = data;
    if (data.startsWith("data:")) {
      const commaIdx = data.indexOf(",");
      base64 = commaIdx >= 0 ? data.substring(commaIdx + 1) : data;
    }
    try {
      return base64ToBlob(base64, mimeType);
    } catch {
      return null;
    }
  }
  return null;
}

function buildBilibiliAudioProxyUrl(bvid: string, audioUrl: string): string {
  const params = new URLSearchParams({ bvid, url: audioUrl });
  if (!IS_NATIVE && !IS_WEB_PROD) {
    return `${BILIBILI_DEV_AUDIO_PROXY}?${params.toString()}`;
  }
  return `${getApiUrl()}${BILIBILI_PROXY_PREFIX}/audio?${params.toString()}`;
}

/**
 * 从 B站 playurl 响应中提取音频URL，DASH 失败时尝试 durl 降级。
 */
async function resolveBilibiliAudioUrl(
  bvid: string,
  cid: number,
  referer: string
): Promise<{
  url: string;
  format: import("@otter-music/shared").AudioFormat;
  source: "dash" | "durl";
} | null> {
  // 尝试 DASH 格式 (fnval=16)
  const playUrl = await fetchBilibiliJson<BilibiliPlayUrlResponse>(
    buildBilibiliPlayUrlPath(bvid, cid),
    referer
  );
  const dashResult = playUrl ? selectBilibiliAudioUrl(playUrl) : null;

  if (dashResult) {
    return { url: dashResult.url, format: dashResult.format, source: "dash" };
  }

  // 诊断日志
  if (playUrl) {
    logger.warn(
      "[bilibili] DASH audio URL not found:",
      describePlayurlResponse(playUrl)
    );
  } else {
    logger.warn("[bilibili] DASH playurl request returned null");
  }

  // 降级：durl 格式 (fnval=0)
  const durlResponse = await fetchBilibiliJson<BilibiliDurlResponse>(
    buildBilibiliDurlPlayUrlPath(bvid, cid),
    referer
  );
  const durlResult = durlResponse ? selectBilibiliDurlUrl(durlResponse) : null;
  if (durlResult) {
    logger.warn("[bilibili] Using durl fallback for audio");
    return { url: durlResult.url, format: durlResult.format, source: "durl" };
  }

  return null;
}

export async function getBilibiliCoverUrl(
  coverUrl: string
): Promise<string | null> {
  if (!coverUrl) return null;

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url: coverUrl,
      headers: buildBilibiliHeaders(),
      responseType: "blob",
    });
    if (res.status >= 400) return null;
    const blob = ensureBlob(
      res.data,
      res.headers?.["Content-Type"] || "image/jpeg"
    );
    if (!blob) return null;
    const blobUrl = URL.createObjectURL(blob);
    registerBlobUrl(blobUrl);
    return blobUrl;
  }

  const params = new URLSearchParams({ url: coverUrl });
  if (!IS_WEB_PROD) return `${BILIBILI_DEV_COVER_PROXY}?${params.toString()}`;
  return `${getApiUrl()}${BILIBILI_PROXY_PREFIX}/cover?${params.toString()}`;
}

async function fetchBilibiliJson<T>(
  path: string,
  referer?: string
): Promise<T | null> {
  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url: `${BILIBILI_API_BASE}${path}`,
      headers: buildBilibiliHeaders(referer),
      connectTimeout: NATIVE_CONNECT_TIMEOUT,
      readTimeout: NATIVE_READ_TIMEOUT,
    });
    if (res.status >= 400) return null;
    return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  }

  const res = await fetchWithTimeout(
    `/api/bilibili${path}`,
    { headers: buildBilibiliHeaders(referer) },
    NETWORK_TIMEOUT
  );
  if (!res.ok) return null;
  return res.json();
}

export async function searchBilibiliVideos(
  keyword: string,
  page: number,
  rows = 20
): Promise<SearchPageResult<MusicTrack>> {
  if (IS_WEB_PROD) {
    const res = await fetchWithTimeout(
      `${getApiUrl()}${BILIBILI_PROXY_PREFIX}/search`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, page, rows }),
      },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return { items: [], hasMore: false };
    return res.json();
  }

  try {
    const data = await fetchBilibiliJson<BilibiliSearchResponse>(
      buildBilibiliSearchPath(keyword, page, rows)
    );
    if (!data) return { items: [], hasMore: false };

    const result = data
      ? parseBilibiliSearchResponse(data, page, rows)
      : { items: [], hasMore: false };

    return result;
  } catch {
    return { items: [], hasMore: false };
  }
}

/**
 * Web端获取B站音频URL
 * 返回代理URL，浏览器原生流式播放
 */
async function getBilibiliSongUrlWeb(
  bvid: string,
  cidOverride?: number
): Promise<{
  url: string;
  format: import("@otter-music/shared").AudioFormat;
} | null> {
  if (IS_WEB_PROD) {
    const res = await fetchWithTimeout(
      `${getApiUrl()}${BILIBILI_PROXY_PREFIX}/song-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bvid, cid: cidOverride }),
      },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      url?: string | null;
      format?: import("@otter-music/shared").AudioFormat;
    };
    if (!data.url) return null;
    return {
      url: buildBilibiliAudioProxyUrl(bvid, data.url),
      format: data.format ?? "m4s",
    };
  }

  try {
    const referer = `https://www.bilibili.com/video/${bvid}`;
    let cid = cidOverride;

    if (!cid) {
      const view = await fetchBilibiliJson<BilibiliViewResponse>(
        buildBilibiliViewPath(bvid),
        referer
      );
      if (!view) return null;
      cid = selectBilibiliCid(view) ?? undefined;
    }
    if (!cid) return null;

    const result = await resolveBilibiliAudioUrl(bvid, cid, referer);
    if (!result) return null;
    return {
      url: buildBilibiliAudioProxyUrl(bvid, result.url),
      format: result.format,
    };
  } catch {
    return null;
  }
}

/**
 * Android端获取B站音频URL
 * 使用本地代理实现真正的流式播放
 */
async function getBilibiliSongUrlNative(
  bvid: string,
  cidOverride?: number
): Promise<{
  url: string;
  format: import("@otter-music/shared").AudioFormat;
} | null> {
  try {
    const { getNativeBilibiliStreamUrl } =
      await import("./bilibili-native-player");
    const referer = `https://www.bilibili.com/video/${bvid}`;

    let cid = cidOverride;

    if (!cid) {
      const view = await fetchBilibiliJson<BilibiliViewResponse>(
        buildBilibiliViewPath(bvid),
        referer
      );
      if (!view) return null;
      cid = selectBilibiliCid(view) ?? undefined;
    }
    if (!cid) return null;

    const result = await resolveBilibiliAudioUrl(bvid, cid, referer);
    if (!result) return null;

    const streamUrl = await getNativeBilibiliStreamUrl(result.url, bvid);
    if (!streamUrl) return null;

    return {
      url: streamUrl,
      format: result.format,
    };
  } catch (e) {
    logger.error("[bilibili] Error getting native song URL:", e);
    return null;
  }
}

export async function getBilibiliSongUrl(trackId: string): Promise<{
  url: string;
  format: import("@otter-music/shared").AudioFormat;
} | null> {
  const parsed = parseBilibiliTrackId(trackId);
  if (!parsed) return null;

  // Web端：返回代理URL，浏览器原生流式播放
  if (!IS_NATIVE) {
    return getBilibiliSongUrlWeb(parsed.bvid, parsed.cid);
  }

  // Android端：使用本地代理
  return getBilibiliSongUrlNative(parsed.bvid, parsed.cid);
}

// ─────────────────────────────────────
// 合集 / 系列 搜索与详情
// ─────────────────────────────────────

/**
 * 从视频搜索结果中提取唯一的系列/合集，映射为专辑条目。
 * UGC 系列通过 enrichBilibiliSearchResults 异步回填。
 */
function extractCollectionsFromSearch(
  _results: BilibiliSearchVideoRaw[]
): MusicTrack[] {
  return [];
}

export async function searchBilibiliCollections(
  keyword: string,
  page: number,
  rows = 20
): Promise<SearchPageResult<MusicTrack>> {
  if (IS_WEB_PROD) {
    const res = await fetchWithTimeout(
      `${getApiUrl()}${BILIBILI_PROXY_PREFIX}/search-collections`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, page, rows }),
      },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return { items: [], hasMore: false };
    return res.json();
  }

  // 搜索视频，从结果中提取合集信息
  try {
    const data = await fetchBilibiliJson<BilibiliSearchResponse>(
      buildBilibiliSearchPath(keyword, page, rows)
    );
    if (!data || data.code !== 0) return { items: [], hasMore: false };

    const results = (data.data?.result || []).filter((v) => v.bvid);
    const albums = extractCollectionsFromSearch(results);

    return {
      items: albums,
      hasMore: false, // 合集聚合无分页
    };
  } catch {
    return { items: [], hasMore: false };
  }
}

export async function getBilibiliCollectionDetail(
  albumId: string,
  page = 1,
  pageSize = 100
): Promise<{
  meta: BilibiliSeriesMetaRaw | null;
  tracks: MusicTrack[];
  total: number;
} | null> {
  const parsed = parseBilibiliAlbumId(albumId);
  if (!parsed) return null;

  const seriesId = Number(parsed.seriesId);
  if (isNaN(seriesId)) return null;

  const mid = parsed.mid ? Number(parsed.mid) : undefined;

  try {
    // 如果有 mid，直接调用 seasons_archives_list
    if (mid !== undefined && !isNaN(mid)) {
      const seasonsData =
        await fetchBilibiliJson<BilibiliSeasonsArchivesListResponse>(
          buildBilibiliSeasonsArchivesListPath(mid, seriesId, page, pageSize)
        );
      if (seasonsData) {
        const seasonsResult = parseBilibiliSeasonsArchivesList(seasonsData);
        if (seasonsResult.meta) {
          const upName = getUpNameCache(mid) || "";

          // 更新 meta 中的 creator name
          const metaWithCreator: BilibiliSeriesMetaRaw = {
            ...seasonsResult.meta,
            creator: seasonsResult.meta.creator
              ? { ...seasonsResult.meta.creator, name: upName }
              : undefined,
          };

          return {
            meta: metaWithCreator,
            tracks: seasonsResult.archives.map((archive) =>
              convertSeasonArchiveToMusicTrack(archive, upName, albumId)
            ),
            total: seasonsResult.total,
          };
        }
      }
      // 如果 seasons_archives_list 失败，fallback 到 series API
    }

    // 没有 mid 或 seasons_archives_list 失败，尝试 series API
    const [detailData, archivesData] = await Promise.all([
      cachedFetch<BilibiliSeriesResponse>(
        `bilibili_series_detail_${seriesId}`,
        () =>
          fetchBilibiliJson<BilibiliSeriesResponse>(
            buildBilibiliSeriesDetailPath(seriesId)
          ),
        24 * 60 * 60 * 1000
      ),
      cachedFetch<BilibiliSeriesArchivesResponse>(
        `bilibili_series_archives_${seriesId}_${page}_${pageSize}`,
        () =>
          fetchBilibiliJson<BilibiliSeriesArchivesResponse>(
            buildBilibiliSeriesArchivesPath(seriesId, page, pageSize)
          ),
        24 * 60 * 60 * 1000
      ),
    ]);

    const meta = detailData ? parseBilibiliSeriesDetail(detailData) : null;

    if (meta) {
      const parsed = archivesData
        ? parseBilibiliSeriesArchives(archivesData)
        : { archives: [], total: 0 };

      return {
        meta,
        tracks: parsed.archives.map((archive) =>
          convertSeriesArchiveToMusicTrack(archive, albumId)
        ),
        total: parsed.total,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 异步对 B站搜索结果进行合集/多分P 信息补全。
 * 通过调用 view API 获取每个视频的 ugc_season（合集）和 pages（分P）信息，
 * 回填到 MusicTrack 的 album/album_id 字段中。
 * 已有 ogv 合集信息的条目不覆盖，未识别的条目通过 ugc_season / pages 回填。
 */
export async function enrichBilibiliSearchResults(
  tracks: MusicTrack[]
): Promise<MusicTrack[]> {
  const bvids = tracks
    .map((t) => {
      if (t.source !== "bilibili") return null;
      if (t.album_id?.startsWith("bilibili_O_")) return null;
      const parsed = parseBilibiliTrackId(t.id);
      return parsed?.bvid ?? null;
    })
    .filter((b): b is string => b !== null);

  if (bvids.length === 0) return tracks;

  const referer = "https://www.bilibili.com/";
  const viewResults = await Promise.all(
    bvids.map(async (bvid) => {
      try {
        const view = await cachedFetch<BilibiliViewResponse>(
          `bilibili_view_${bvid}`,
          () =>
            fetchBilibiliJson<BilibiliViewResponse>(
              buildBilibiliViewPath(bvid),
              referer
            ),
          24 * 60 * 60 * 1000
        );
        return { bvid, view };
      } catch {
        return { bvid, view: null };
      }
    })
  );

  const viewMap = new Map(viewResults.map((r) => [r.bvid, r.view]));

  return tracks.map((t) => {
    if (t.source !== "bilibili") return t;
    if (t.album_id?.startsWith("bilibili_O_")) return t;

    const parsed = parseBilibiliTrackId(t.id);
    if (!parsed) return t;

    const view = viewMap.get(parsed.bvid);
    if (!view?.data) return t;

    if (view.data.owner?.mid && view.data.owner?.name) {
      setUpNameCache(view.data.owner.mid, view.data.owner.name);
    }

    const ugcSeason = view.data.ugc_season;
    const pages = view.data.pages || [];

    if (ugcSeason?.id) {
      const ownerMid = view.data.owner?.mid;
      return {
        ...t,
        album: ugcSeason.title?.trim() || "合集",
        album_id: buildBilibiliSeriesAlbumId(ugcSeason.id, ownerMid),
      };
    }

    if (pages.length > 1) {
      return {
        ...t,
        album: view.data.title?.trim() || "合集",
        album_id: buildBilibiliMultiPAlbumId(parsed.bvid),
      };
    }

    return t;
  });
}
/**
 * 获取 B站视频详情。
 */
export async function getBilibiliVideoDetail(
  trackId: string
): Promise<Record<string, unknown> | null> {
  const parsed = parseBilibiliTrackId(trackId);
  if (!parsed) return null;

  try {
    const referer = `https://www.bilibili.com/video/${parsed.bvid}`;
    const view = await fetchBilibiliJson<BilibiliViewResponse>(
      buildBilibiliViewPath(parsed.bvid),
      referer
    );
    return view?.data ?? null;
  } catch {
    return null;
  }
}

// B站音频歌单 API (menu/hit)
/**
 * 获取 B站多分P 视频的详情，返回各分P作为独立曲目列表。
 */
export async function getBilibiliMultiPDetail(albumId: string): Promise<{
  meta: { name: string; cover: string };
  tracks: MusicTrack[];
  total: number;
} | null> {
  const bvid = parseBilibiliMultiPAlbumId(albumId);
  if (!bvid) return null;

  try {
    const referer = `https://www.bilibili.com/video/${bvid}`;
    const view = await fetchBilibiliJson<BilibiliViewResponse>(
      buildBilibiliViewPath(bvid),
      referer
    );
    if (!view?.data) return null;

    const data = view.data;
    const pages = data.pages || [];
    if (pages.length === 0) return null;

    const tracks: MusicTrack[] = pages.map((page) => {
      const cid = page.cid ?? 0;
      const partTitle = page.part || `P${page.page ?? 1}`;
      return {
        id: `bilibili_BV${bvid.replace(/^BV/, "")}_${cid}`,
        name: partTitle,
        artist: data.owner?.name ? [data.owner.name] : [],
        album: data.title?.trim() || "合集",
        source: "bilibili",
        pic_id: data.pic ?? "",
        url_id: `bilibili_BV${bvid.replace(/^BV/, "")}_${cid}`,
        lyric_id: "",
      };
    });

    return {
      meta: { name: data.title ?? "合集", cover: data.pic ?? "" },
      tracks,
      total: tracks.length,
    };
  } catch {
    return null;
  }
}
