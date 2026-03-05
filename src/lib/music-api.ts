import type { MusicSource, MusicTrack, SearchPageResult, MergedMusicTrack, SongLyric } from "@/types/music";
import { cachedFetch } from "@/lib/utils/cache";
import { mergeAndSortTracks, SOURCE_RANK } from "@/lib/utils/search-helper";
import { getMusicApiUrl } from "./api";
import { retry } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";
import { LocalMusicPlugin } from "@/plugins/local-music";
import { getSongUrl, getLyric, getSongDetail, search as neteaseSearch, convertSongToMusicTrack } from "@/lib/netease/netease-api";

const getApiBase = () => `${getMusicApiUrl()}`;

const TTL_SHORT = 60 * 60 * 1000; // 60 minutes
const TTL_LONG = 7 * 24 * 60 * 60 * 1000; // 7 days

const cookieOf = (source: MusicSource) => localStorage.getItem(`cookie:${source}`);

const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';

interface RawApiTrack {
  id: string | number;
  name: string;
  artist: string | string[];
  album: string;
  pic_id: string;
  url_id: string;
  lyric_id: string;
  artist_ids?: string[];
  album_id?: string;
}

export const forceHttps = (url: string | undefined | null) => {
    if (!url) return '';
    return url.replace(/^http:\/\//i, 'https://');
};

const normalizeTrack = (t: RawApiTrack, source: MusicSource): MusicTrack => ({
  id: String(t.id),
  name: t.name,
  artist: Array.isArray(t.artist) ? t.artist : [t.artist],
  album: t.album,
  pic_id: forceHttps(t.pic_id),
  url_id: forceHttps(t.url_id),
  lyric_id: forceHttps(t.lyric_id),
  source,
  artist_ids: t.artist_ids,
  album_id: t.album_id,
});

/* -------------------------------------------------- */
/* URL Builder */

const buildUrl = (
  params: Record<string, string | number | undefined>,
  source?: MusicSource
) => {
  const search = new URLSearchParams();

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) search.set(k, String(v));
  }

  if (source) {
    search.set('source', source);
    const cookie = cookieOf(source);
    if (cookie) search.set('cookie', cookie);
  }

  return `${getApiBase()}?${search.toString()}`;
};

/* -------------------------------------------------- */
/* fetch wrapper */

async function requestJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (e) {
    if (isAbort(e)) throw e;
    console.error('Request failed:', url, e);
    throw e;
  }
}

/* ================================================== */

export const musicApi = {

  /* ---------------- 搜索 ---------------- */

  async search(
    query: string,
    source: MusicSource = 'joox',
    page = 1,
    count = 20,
    signal?: AbortSignal
  ): Promise<SearchPageResult<MusicTrack>> {

    if (source === 'all') return this.searchAll(query, page, count, signal);

    if (source === '_netease') {
      const res = await neteaseSearch(query, 1, page, count);
      const songs = res.data.result.songs || [];
      const items = songs.map(convertSongToMusicTrack);
      return {
        items,
        hasMore: res.data.result.hasMore ?? ((res.data.result.songCount || 0) > page * count)
      };
    }

    const json = await retry(
      () => requestJSON<RawApiTrack[]>(
        buildUrl({ types: 'search', name: query, count, pages: page }, source),
        signal
      ),
      2,
      500
    );

    const items = json.map(t => normalizeTrack(t, source));
    return { items, hasMore: items.length >= count };
  },

  /* ---------------- 全网搜索 ---------------- */

  async searchAll(
    query: string,
    page = 1,
    count = 20,
    signal?: AbortSignal,
    sources: MusicSource[] = ['joox', 'netease']
  ): Promise<SearchPageResult<MergedMusicTrack>> {

    const results = await Promise.all(
      sources.map(s => this.search(query, s, page, count, signal))
    );

    if (signal?.aborted) return { items: [], hasMore: false };

    const merged = mergeAndSortTracks(results.flatMap(r => r.items), query);

    return {
      items: merged,
      hasMore: results.some(r => r.hasMore)
    };
  },

  /* ---------------- 最佳匹配搜索（串行） ---------------- */

  async searchBestMatch(
    query: string,
    sources: MusicSource[],
    predicate: (track: MusicTrack) => boolean,
    count = 5,
    signal?: AbortSignal
  ): Promise<MusicTrack | null> {
    const sortedSources = [...sources].sort((a, b) => {
      const rankA = SOURCE_RANK[a] ?? 999;
      const rankB = SOURCE_RANK[b] ?? 999;
      return rankA - rankB;
    });

    for (const source of sortedSources) {
      if (signal?.aborted) return null;
      try {
        const res = await this.search(query, source, 1, count, signal);
        const match = res.items.find(predicate);
        if (match) return match;
      } catch (e) {
        if (isAbort(e)) throw e;
        console.warn(`Search failed for source: ${source}`, e);
      }
    }
    return null;
  },

  /* ---------------- URL ---------------- */

  async getUrl(id: string, source: MusicSource, br = 192): Promise<string | null> {
    if (source === '_netease') {
      const key = `url:${source}:${id}:${br}`;
      return cachedFetch<string | null>(
        key,
        async () => {
          try {
            const res = await getSongUrl(id, br * 1000);
            return forceHttps(res.data?.data?.[0]?.url) || null;
          } catch (e) {
            console.error('getSongUrl failed:', e);
            return null;
          }
        },
        TTL_SHORT
      );
    }

    if (source === 'local') {
      if (Capacitor.isNativePlatform()) {
        try {
          const result = await LocalMusicPlugin.getLocalFileUrl({ localPath: id });
          if (result.success && result.url) {
            return Capacitor.convertFileSrc(result.url);
          }
          console.error('LocalMusicPlugin.getLocalFileUrl failed:', result.error);
          return null;
        } catch (e) {
          console.error('LocalMusicPlugin.getLocalFileUrl error:', e);
          return null;
        }
      }
      return Capacitor.convertFileSrc(id);
    }

    const key = `url:${source}:${id}:${br}`;

    const res = await cachedFetch<{ url: string }>(
      key,
      async () => {
        const json = await requestJSON<{ url?: string }>(
          buildUrl({ types: 'url', id, br }, source)
        );
        return json?.url ? { url: json.url } : null;
      },
      TTL_SHORT,
    );

    return res?.url ?? null;
  },

  /* ---------------- 封面 ---------------- */

  async getPic(idOrUrl: string, source: MusicSource, size: number = 800): Promise<string | null> {
    const idStr = String(idOrUrl || '');
    if (idStr.startsWith('http')) {
      return idStr.includes('163.com')
        ? forceHttps(`${idStr}?param=${size}y${size}`)
        : forceHttps(idStr);
    }

    if (source === '_netease') {
      const key = `pic:${source}:${idStr}:${size}`;
      return cachedFetch<string | null>(
        key,
        async () => {
          try {
            const song = await getSongDetail(idStr);
            const url = song?.al?.picUrl;
            return url ? forceHttps(`${url}?param=${size}y${size}`) : null;
          } catch (e) {
            console.error('getPic failed:', e);
            return null;
          }
        },
        TTL_LONG
      );
    }

    try {
      const key = `pic:${source}:${idOrUrl}`;

      const res = await cachedFetch<{ url: string }>(
        key,
        async () => {
          const json = await requestJSON<{ url?: string }>(
            buildUrl({ types: 'pic', id: idOrUrl, size }, source)
          );
          return json?.url ? { url: json.url } : null;
        },
        TTL_LONG,
      );

      return res?.url ?? null;
    } catch (e) {
      console.error('getPic failed:', e);
      return null;
    }
  },

  /* ---------------- 歌词 ---------------- */

  async getLyric(id: string, source: MusicSource): Promise<SongLyric | null> {
    const key = `lyric:${source}:${id}`;

    if (source === '_netease') {
      return cachedFetch<SongLyric | null>(
        key,
        async () => {
          try {
            const res = await getLyric(id);
            if (!res || !res.data) return { lyric: '', tlyric: '' };
            return {
              lyric: res.data.lrc?.lyric || '',
              tlyric: res.data.tlyric?.lyric || ''
            };
          } catch (e) {
            console.error('getLyric failed:', e);
            return null;
          }
        },
        TTL_LONG
      );
    }

    return cachedFetch<SongLyric>(
      key,
      async () => {
        const json = await requestJSON<{ lyric?: string; tlyric?: string }>(
          buildUrl({ types: 'lyric', id }, source)
        );
        if (!json) return null;
        return { lyric: json.lyric ?? '', tlyric: json.tlyric ?? '' };
      },
      TTL_LONG,
    );
  }
};