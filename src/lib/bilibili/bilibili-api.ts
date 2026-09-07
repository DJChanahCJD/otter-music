import * as config from "@/lib/api/config";
import {
  buildBilibiliArcSearchPath,
  buildBilibiliDurlPlayUrlPath,
  buildBilibiliHeaders,
  buildBilibiliNavPath,
  buildBilibiliPlayerPath,
  buildBilibiliPlayUrlPath,
  buildBilibiliSeasonSeriesListPath,
  buildBilibiliSeasonsArchivesListPath,
  buildBilibiliSearchPath,
  buildBilibiliSeriesArchivesPath,
  buildBilibiliSeriesDetailPath,
  buildBilibiliUserCardPath,
  buildBilibiliViewPath,
  buildBilibiliMultiPAlbumId,
  buildBilibiliSeriesAlbumId,
  convertBilibiliSubtitleToLrc,
  convertSeasonArchiveToMusicTrack,
  convertSeriesArchiveToMusicTrack,
  describePlayurlResponse,
  extractWbiKeys,
  normalizeBilibiliSubtitleUrl,
  parseBilibiliAlbumId,
  parseBilibiliArcSearchResponse,
  parseBilibiliMultiPAlbumId,
  parseBilibiliSeasonsArchivesList,
  parseBilibiliSearchResponse,
  parseBilibiliSeriesArchives,
  parseBilibiliSeriesDetail,
  parseBilibiliTrackId,
  parseBilibiliUpSeasonSeriesList,
  parseBilibiliUserInfo,
  selectBilibiliAudioUrl,
  selectBilibiliCid,
  selectBilibiliDurlUrl,
  selectBilibiliSubtitles,
  signWbiParams,
  type BilibiliArcSearchResponse,
  type BilibiliDurlResponse,
  type BilibiliNavResponse,
  type BilibiliPlayerResponse,
  type BilibiliPlayUrlResponse,
  type BilibiliSeasonSeriesListResponse,
  type BilibiliSeasonsArchivesListResponse,
  type BilibiliSearchResponse,
  type BilibiliSearchVideoRaw,
  type BilibiliSeriesArchivesResponse,
  type BilibiliSeriesMetaRaw,
  type BilibiliSeriesResponse,
  type BilibiliSubtitleBodyItem,
  type BilibiliSubtitleResponse,
  type BilibiliUpSeasonSummary,
  type BilibiliUserCardResponse,
  type BilibiliViewResponse,
  type MusicTrack,
  type SearchPageResult,
  type SongLyric,
} from "@otter-music/shared";

import { registerBlobUrl } from "@/lib/utils/blob-registry";
import { base64ToBlob } from "@/lib/utils/base64";
import { logger } from "../logger";
import { setUpNameCache, getUpNameCache } from "@/lib/bilibili/up-name-cache";
import { useBilibiliStore } from "@/store/bilibili-store";
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
  if (!config.IS_NATIVE) {
    return `${BILIBILI_DEV_AUDIO_PROXY}?${params.toString()}`;
  }
  return `${config.getApiUrl()}${BILIBILI_PROXY_PREFIX}/audio?${params.toString()}`;
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

  if (config.IS_NATIVE) {
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
  if (!config.IS_NATIVE)
    return `${BILIBILI_DEV_COVER_PROXY}?${params.toString()}`;
  return `${config.getApiUrl()}${BILIBILI_PROXY_PREFIX}/cover?${params.toString()}`;
}

async function fetchBilibiliJson<T>(
  path: string,
  referer?: string
): Promise<T | null> {
  if (config.IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const headers = buildBilibiliHeaders(referer);
    const cookie = useBilibiliStore.getState().cookie;
    if (cookie) headers.Cookie = cookie;
    const res = await CapacitorHttp.request({
      method: "GET",
      url: `${BILIBILI_API_BASE}${path}`,
      headers,
      connectTimeout: NATIVE_CONNECT_TIMEOUT,
      readTimeout: NATIVE_READ_TIMEOUT,
    });
    if (res.status >= 400) return null;
    return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  }

  const res = await config.fetchWithTimeout(
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
  // 单次搜索尝试。B 站会间歇性返回 412/HTML 风控页：
  // HTTP >= 400 时 fetchBilibiliJson 返回 null，200 + HTML 时 JSON 解析抛异常
  const attempt = async (): Promise<BilibiliSearchResponse | null> => {
    try {
      return await fetchBilibiliJson<BilibiliSearchResponse>(
        buildBilibiliSearchPath(keyword, page, rows)
      );
    } catch {
      return null;
    }
  };

  let data = await attempt();
  if (!data) {
    // 命中风控：延迟后重试一次，避免偶发的「未找到可用音源」
    logger.warn(
      "bilibili-api",
      "Bilibili search blocked by risk control, retrying",
      {
        keyword,
        page,
      }
    );
    await new Promise((resolve) => setTimeout(resolve, 1500));
    data = await attempt();
  }
  if (!data) return { items: [], hasMore: false };

  return parseBilibiliSearchResponse(data, page, rows);
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
  try {
    const referer = `https://www.bilibili.com/video/${bvid}`;
    let cid = cidOverride;

    if (!cid) {
      // 与歌词共用同一 view 缓存（24h），保证音频与字幕解析到同一 cid，避免串台
      const view = await cachedFetch<BilibiliViewResponse>(
        `bilibili_view_${bvid}`,
        () =>
          fetchBilibiliJson<BilibiliViewResponse>(
            buildBilibiliViewPath(bvid),
            referer
          ),
        24 * 60 * 60 * 1000
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
      // 与歌词共用同一 view 缓存（24h），保证音频与字幕解析到同一 cid，避免串台
      const view = await cachedFetch<BilibiliViewResponse>(
        `bilibili_view_${bvid}`,
        () =>
          fetchBilibiliJson<BilibiliViewResponse>(
            buildBilibiliViewPath(bvid),
            referer
          ),
        24 * 60 * 60 * 1000
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
  if (!config.IS_NATIVE) {
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
    // 如果有 mid，直接调用 seasons_archives_list（需要 WBI 签名）
    if (mid !== undefined && !isNaN(mid)) {
      const seasonsData =
        await fetchBilibiliWbiJson<BilibiliSeasonsArchivesListResponse>(
          buildBilibiliSeasonsArchivesListPath(mid, seriesId, page, pageSize),
          {
            mid,
            season_id: seriesId,
            page_num: page,
            page_size: pageSize,
          }
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
 * 计算字幕 body 中最大的时间戳（from/to 取最大值，单位秒）。
 */
function bilibiliSubtitleMaxTime(body: BilibiliSubtitleBodyItem[]): number {
  let max = 0;
  for (const item of body) {
    if (typeof item.from === "number" && item.from > max) max = item.from;
    if (typeof item.to === "number" && item.to > max) max = item.to;
  }
  return max;
}

// 字幕最大时间允许超出视频时长的容忍秒数（防串台校验用）
const SUBTITLE_DURATION_TOLERANCE = 15;

async function fetchBilibiliSubtitleLrc(
  subtitleUrl: string,
  bvid: string,
  referer: string,
  maxDuration?: number
): Promise<string | null> {
  const url = normalizeBilibiliSubtitleUrl(subtitleUrl);
  if (!url) return null;

  let body: BilibiliSubtitleBodyItem[] = [];

  try {
    if (config.IS_NATIVE) {
      const { CapacitorHttp } = await import("@capacitor/core");
      const headers = buildBilibiliHeaders(referer);
      const cookie = useBilibiliStore.getState().cookie;
      if (cookie) headers.Cookie = cookie;
      const res = await CapacitorHttp.request({
        method: "GET",
        url,
        headers,
        connectTimeout: NATIVE_CONNECT_TIMEOUT,
        readTimeout: NATIVE_READ_TIMEOUT,
      });
      if (res.status >= 400) return null;
      const data =
        typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      body = (data as BilibiliSubtitleResponse).body || [];
    } else {
      const params = new URLSearchParams({ url });
      const res = await config.fetchWithTimeout(
        `${config.getApiUrl()}${BILIBILI_PROXY_PREFIX}/subtitle?${params.toString()}`,
        { headers: buildBilibiliHeaders(referer) },
        NETWORK_TIMEOUT
      );
      if (!res.ok) return null;
      const data = (await res.json()) as BilibiliSubtitleResponse;
      body = data.body || [];
    }
  } catch {
    return null;
  }

  // 防串台校验：字幕最大时间超出当前分P时长，判定为无关字幕
  if (typeof maxDuration === "number" && maxDuration > 0) {
    if (
      bilibiliSubtitleMaxTime(body) >
      maxDuration + SUBTITLE_DURATION_TOLERANCE
    ) {
      return null;
    }
  }

  return convertBilibiliSubtitleToLrc(body);
}

/**
 * 获取 B站视频歌词。
 * 依据 track id 解析 bvid/cid（无 cid 时通过 view API 取默认分P），
 * 字幕轨道取自 player/wbi/v2（B 站播放器现行接口），
 * 正文仍从 aisubtitle 的 subtitle_url 获取。
 */
export async function getBilibiliLyric(
  trackId: string
): Promise<SongLyric | null> {
  const parsed = parseBilibiliTrackId(trackId);
  if (!parsed) return null;

  try {
    const referer = `https://www.bilibili.com/video/${parsed.bvid}`;
    let cid = parsed.cid;
    let view: BilibiliViewResponse | null = null;

    // view 结果按 bvid 缓存 24h，与 enrichBilibiliSearchResults 共用同一缓存键
    const loadView = () =>
      cachedFetch<BilibiliViewResponse>(
        `bilibili_view_${parsed.bvid}`,
        () =>
          fetchBilibiliJson<BilibiliViewResponse>(
            buildBilibiliViewPath(parsed.bvid),
            referer
          ),
        24 * 60 * 60 * 1000
      );

    // 始终加载 view 以便校验 cid 所在分 P（结果已按 bvid 缓存 24h）
    view = await loadView();
    if (!cid) {
      cid = view ? (selectBilibiliCid(view) ?? undefined) : undefined;
    }
    if (!cid) return null;

    // 校验 cid 是否真实存在于分 P 列表；匹配不到则回退首页并告警，
    // 避免 trackId 携带的 cid 指向错误分 P 导致字幕串台。
    const pages = view?.data?.pages;
    if (pages && pages.length) {
      const match = pages.find((p) => p.cid === cid);
      if (match) {
        logger.info(
          "[bilibili] matched page",
          `page_no=${match.page ?? "?"} has_next=${pages.length > 1}`
        );
      } else {
        logger.warn(
          "[bilibili] cid not in pages, fallback to page0",
          `bvid=${parsed.bvid} cid=${cid} pages=${pages
            .map((p) => p.cid)
            .join(",")}`
        );
        cid = pages[0]?.cid ?? cid;
      }
    }

    // aid 仅用于日志，校验 aid/cid 对应关系
    const aid = typeof view?.data?.aid === "number" ? view.data.aid : undefined;

    // 字幕轨道来自 player/wbi/v2（B 站播放器现行接口；
    // 旧 /x/player/v2 的字幕数据随机不稳定，可能返回无关字幕导致串台）
    let player: BilibiliPlayerResponse | null;
    if (config.IS_NATIVE) {
      player = await fetchBilibiliJson<BilibiliPlayerResponse>(
        buildBilibiliPlayerPath(parsed.bvid, cid),
        referer
      );
    } else {
      const res = await config.fetchWithTimeout(
        `${config.getApiUrl()}${BILIBILI_PROXY_PREFIX}/player`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bvid: parsed.bvid, cid }),
        },
        NETWORK_TIMEOUT
      );
      if (!res.ok) return null;
      player = (await res.json()) as BilibiliPlayerResponse;
    }
    const selection = selectBilibiliSubtitles(player);
    if (selection.primary) {
      logger.info(
        "[bilibili] lyric subtitle from player/wbi/v2:",
        `oid=${cid} pid=${aid ?? "unknown"}`,
        `lan=${selection.primary.lan} ai_status=${selection.primary.ai_status}`
      );
    }

    if (!selection.primary?.subtitle_url) return null;

    // 防串台：字幕时间轴不应超出当前分 P 时长，超长判定为错误字幕
    const pageDuration = view?.data?.pages?.find(
      (p) => p.cid === cid
    )?.duration;

    const lyric = await fetchBilibiliSubtitleLrc(
      selection.primary.subtitle_url,
      parsed.bvid,
      referer,
      pageDuration
    );
    if (!lyric) return null;

    return { lyric };
  } catch {
    return null;
  }
}

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
        lyric_id: `bilibili_BV${bvid.replace(/^BV/, "")}_${cid}`,
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

// ─────────────────────────────────────
// UP 主页 (用户空间)
// ─────────────────────────────────────

let bilibiliWbiKeysCache: {
  imgKey: string;
  subKey: string;
  expires: number;
} | null = null;

/**
 * 从 nav 接口获取 WBI 签名密钥并缓存（约 12 小时）。
 */
async function getBilibiliWbiKeys(): Promise<{
  imgKey: string;
  subKey: string;
} | null> {
  const now = Date.now();
  if (bilibiliWbiKeysCache && now < bilibiliWbiKeysCache.expires) {
    return bilibiliWbiKeysCache;
  }
  const nav = await fetchBilibiliJson<BilibiliNavResponse>(
    buildBilibiliNavPath()
  );
  const keys = nav ? extractWbiKeys(nav) : null;
  if (keys) {
    bilibiliWbiKeysCache = {
      ...keys,
      expires: now + 12 * 60 * 60 * 1000,
    };
  }
  return keys;
}

/**
 * 带 WBI 签名的 B 站请求（仅原生端）。
 * path 中若含 query 会被剥离，业务参数统一由 params 提供并参与签名，
 * 避免参数重复导致 w_rid 校验失败。
 */
async function fetchBilibiliWbiJson<T>(
  path: string,
  params: Record<string, string | number>,
  referer?: string
): Promise<T | null> {
  if (!config.IS_NATIVE) return null;
  const keys = await getBilibiliWbiKeys();
  if (!keys) return null;
  const endpoint = path.split("?")[0];
  const query = await signWbiParams(params, keys.imgKey, keys.subKey);
  return fetchBilibiliJson<T>(`${endpoint}?${query}`, referer);
}

/**
 * 获取 UP 主页信息（仅原生端）。
 */
export async function getBilibiliUpInfo(
  mid: number
): Promise<{ mid: number; name: string; face: string } | null> {
  const data = await fetchBilibiliWbiJson<BilibiliUserCardResponse>(
    buildBilibiliUserCardPath(mid),
    { mid }
  );
  return data ? parseBilibiliUserInfo(data) : null;
}

/**
 * 获取 UP 上传视频列表（分页，仅原生端）。
 */
export async function searchBilibiliUpVideos(
  mid: number,
  page: number,
  size = 30,
  upName = ""
): Promise<{ items: MusicTrack[]; hasMore: boolean; total: number }> {
  const data = await fetchBilibiliWbiJson<BilibiliArcSearchResponse>(
    buildBilibiliArcSearchPath(mid, page, size),
    { mid, pn: page, ps: size, order: "pubdate", platform: "web" }
  );
  if (!data) return { items: [], hasMore: false, total: 0 };
  const parsed = parseBilibiliArcSearchResponse(data, upName, page, size);
  return { ...parsed, total: data.data?.page?.count || parsed.items.length };
}

/**
 * 获取 UP 的合集列表（专辑入口，仅原生端）。
 * seasons_series_list 不需要 WBI 签名。
 */
export async function getBilibiliUpCollections(
  mid: number
): Promise<BilibiliUpSeasonSummary[]> {
  if (!config.IS_NATIVE) return [];
  const data = await fetchBilibiliJson<BilibiliSeasonSeriesListResponse>(
    buildBilibiliSeasonSeriesListPath(mid, 1, 20)
  );
  if (!data) return [];
  if (data.code !== 0) {
    logger.warn(
      `[bilibili] seasons_series_list failed: code=${data.code} message=${data.message}`
    );
    return [];
  }
  return parseBilibiliUpSeasonSeriesList(data, mid);
}
