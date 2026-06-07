import {
  BILIBILI_COVER_HOST_RE,
  buildBilibiliHeaders,
  buildBilibiliPlayUrlPath,
  buildBilibiliSeasonsArchivesListPath,
  buildBilibiliSearchPath,
  buildBilibiliSeriesArchivesPath,
  buildBilibiliSeriesDetailPath,
  buildBilibiliViewPath,
  convertSeasonArchiveToMusicTrack,
  convertSeriesArchiveToMusicTrack,
  parseBilibiliAlbumId,
  parseBilibiliSeasonsArchivesList,
  parseBilibiliSearchResponse,
  parseBilibiliSeriesArchives,
  parseBilibiliSeriesDetail,
  selectBilibiliAudioUrl,
  selectBilibiliCid,
  type BilibiliSeasonsArchivesListResponse,
  type BilibiliSearchResponse,
  type BilibiliSearchVideoRaw,
  type BilibiliSeriesArchivesResponse,
  type BilibiliSeriesResponse,
  type BilibiliPlayUrlResponse,
  type BilibiliViewResponse,
  type MusicTrack,
  type SearchPageResult,
} from "@otter-music/shared";

const BILIBILI_BASE_URL = "https://api.bilibili.com";

async function fetchBilibiliJson<T>(
  path: string,
  referer?: string
): Promise<T> {
  const res = await fetch(`${BILIBILI_BASE_URL}${path}`, {
    headers: buildBilibiliHeaders(referer),
  });
  if (!res.ok) throw new Error(`Bilibili API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchBilibiliSearch(
  keyword: string,
  page: number,
  rows = 20
): Promise<SearchPageResult<MusicTrack>> {
  const data = await fetchBilibiliJson<BilibiliSearchResponse>(
    buildBilibiliSearchPath(keyword, page, rows)
  );

  const result = parseBilibiliSearchResponse(data, page, rows);
  const albums = extractCollectionsFromSearch(data.data?.result || []);

  return {
    items: [...albums, ...result.items],
    hasMore: result.hasMore,
  };
}

export async function fetchBilibiliSongUrl(
  bvid: string,
  cidOverride?: number
): Promise<string | null> {
  const referer = `https://www.bilibili.com/video/${bvid}`;

  let cid = cidOverride;

  if (!cid) {
    const view = await fetchBilibiliJson<BilibiliViewResponse>(
      buildBilibiliViewPath(bvid),
      referer
    );
    cid = selectBilibiliCid(view) ?? undefined;
  }
  if (!cid) return null;

  const playUrl = await fetchBilibiliJson<BilibiliPlayUrlResponse>(
    buildBilibiliPlayUrlPath(bvid, cid),
    referer
  );
  return selectBilibiliAudioUrl(playUrl);
}

export async function proxyBilibiliAudio(
  bvid: string,
  url: string,
  range?: string | null
): Promise<Response> {
  const headers: Record<string, string> = buildBilibiliHeaders(
    `https://www.bilibili.com/video/${bvid}`
  );
  if (range) headers.Range = range;

  const response = await fetch(url, { headers });

  // 透传关键响应头，确保Range请求正常工作
  const responseHeaders = new Headers();
  const headersToPass = [
    "Content-Type",
    "Content-Length",
    "Content-Range",
    "Accept-Ranges",
    "ETag",
    "Last-Modified",
    "Cache-Control",
  ];

  for (const h of headersToPass) {
    const val = response.headers.get(h);
    if (val) responseHeaders.set(h, val);
  }

  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, ETag"
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

/**
 * 从视频搜索结果中提取唯一的系列/合集。
 */
function extractCollectionsFromSearch(
  _results: BilibiliSearchVideoRaw[]
): MusicTrack[] {
  return [];
}

export async function fetchBilibiliSearchCollections(
  keyword: string,
  page: number,
  rows = 20
): Promise<SearchPageResult<MusicTrack>> {
  const data = await fetchBilibiliJson<BilibiliSearchResponse>(
    buildBilibiliSearchPath(keyword, page, rows)
  );

  if (!data || data.code !== 0) return { items: [], hasMore: false };

  const results = (data.data?.result || []).filter((v) => v.bvid);
  return {
    items: extractCollectionsFromSearch(results),
    hasMore: false,
  };
}

export async function fetchBilibiliCollectionDetail(
  albumId: string,
  page = 1,
  pageSize = 30
): Promise<{ meta: unknown; tracks: MusicTrack[]; total: number } | null> {
  const parsed = parseBilibiliAlbumId(albumId);
  if (parsed) {
    const seriesId = Number(parsed.seriesId);
    if (!isNaN(seriesId)) {
      const mid = parsed.mid ? Number(parsed.mid) : undefined;

      const [detailData, archivesData] = await Promise.all([
        fetchBilibiliJson<BilibiliSeriesResponse>(
          buildBilibiliSeriesDetailPath(seriesId)
        ),
        fetchBilibiliJson<BilibiliSeriesArchivesResponse>(
          buildBilibiliSeriesArchivesPath(seriesId, page, pageSize)
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

      if (mid !== undefined && !isNaN(mid)) {
        const seasonsData =
          await fetchBilibiliJson<BilibiliSeasonsArchivesListResponse>(
            buildBilibiliSeasonsArchivesListPath(mid, seriesId, page, pageSize)
          );

        if (seasonsData) {
          const seasonsResult = parseBilibiliSeasonsArchivesList(seasonsData);
          if (seasonsResult.meta) {
            return {
              meta: seasonsResult.meta,
              tracks: seasonsResult.archives.map((archive) =>
                convertSeasonArchiveToMusicTrack(archive, undefined, albumId)
              ),
              total: seasonsResult.total,
            };
          }
        }
      }
    }
  }

  return null;
}

export async function proxyBilibiliCover(url: string): Promise<Response> {
  const parsed = new URL(url);
  if (!BILIBILI_COVER_HOST_RE.test(parsed.hostname)) {
    return new Response(JSON.stringify({ error: "invalid cover host" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const response = await fetch(url, {
    headers: buildBilibiliHeaders("https://www.bilibili.com/"),
  });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function proxyBilibiliAudioApi(
  path: string,
  search: string
): Promise<Response> {
  const targetUrl = `https://www.bilibili.com${path}${search}`;

  const response = await fetch(targetUrl, {
    headers: buildBilibiliHeaders("https://www.bilibili.com/"),
  });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
