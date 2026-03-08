import type { MusicSource, MusicTrack, SearchPageResult, MergedMusicTrack, SongLyric, SearchIntent, SearchSuggestionItem } from "@/types/music";
import { cachedFetch } from "@/lib/utils/cache";
import { mergeAndSortTracks, SOURCE_RANK } from "@/lib/utils/search-helper";
import { getOrderedMusicApiUrls, markMusicApiUrlFailure, markMusicApiUrlSuccess } from "./api";
import { retry } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";
import { LocalMusicPlugin } from "@/plugins/local-music";
import { getSongUrl, getLyric, getSongDetail, search as neteaseSearch, convertSongToMusicTrack, searchSuggest } from "@/lib/netease/netease-api";

const TTL_SHORT = 60 * 60 * 1000; // 60 minutes
const TTL_LONG = 7 * 24 * 60 * 60 * 1000; // 7 days
const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_AGGREGATED_SEARCH_SOURCES: MusicSource[] = ['joox', 'netease'];

const cookieOf = (source: string) => localStorage.getItem(`cookie:${source.replace('_album', '')}`);

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
  apiBase: string,
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

  return `${apiBase}?${search.toString()}`;
};

/* -------------------------------------------------- */
/* fetch wrapper */

async function requestJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (e) {
    if (isAbort(e)) throw e;
    console.error('Request failed:', url, e);
    throw e;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function requestMusicApiJSON<T>(
  params: Record<string, string | number | undefined>,
  source: MusicSource,
  signal?: AbortSignal
): Promise<T> {
  const apiBases = getOrderedMusicApiUrls();
  let lastError: unknown;

  for (const apiBase of apiBases) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    const url = buildUrl(apiBase, params, source);
    try {
      const result = await requestJSON<T>(url, signal);
      markMusicApiUrlSuccess(apiBase);
      return result;
    } catch (e) {
      if (isAbort(e)) throw e;
      markMusicApiUrlFailure(apiBase);
      lastError = e;
    }
  }

  throw lastError ?? new Error('No available music API endpoint');
}

/* ================================================== */

export const musicApi = {

  /* ---------------- 搜索 ---------------- */

  async search(
    query: string,
    source: MusicSource = 'joox',
    page = 1,
    count = 20,
    signal?: AbortSignal,
    searchIntent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {

    if (source === 'all') return this.searchAll(query, page, count, signal, undefined, searchIntent);

    if (source === '_netease') {
      const res = await neteaseSearch(query, 1, page, count);
      const songs = res.data.result.songs || [];
      const items = songs.map(convertSongToMusicTrack);
      return {
        items,
        hasMore: res.data.result.hasMore ?? ((res.data.result.songCount || 0) > page * count)
      };
    }

    let requestSource: string = source;
    if (searchIntent?.type === 'album') {
      requestSource += "_album";
    }

    const json = await retry(
      () => requestMusicApiJSON<RawApiTrack[]>({ types: 'search', name: query, count, pages: page }, requestSource as MusicSource, signal),
      2,
      500
    );

    const items = json.map(t => normalizeTrack(t, source));
    return { items, hasMore: items.length === count };
  },

  /* ---------------- 全网搜索 ---------------- */

  async searchAll(
    query: string,
    page = 1,
    count = 20,
    signal?: AbortSignal,
    sources: MusicSource[] = DEFAULT_AGGREGATED_SEARCH_SOURCES,
    searchIntent?: SearchIntent | null
  ): Promise<SearchPageResult<MergedMusicTrack>> {
    const normalizedSources = Array.from(new Set(sources))
      .filter((s): s is MusicSource => s !== 'all' && s !== 'local');
    const effectiveSources = normalizedSources.length
      ? normalizedSources
      : DEFAULT_AGGREGATED_SEARCH_SOURCES;

    const results = await Promise.all(
      effectiveSources.map(s => this.search(query, s, page, count, signal, searchIntent))
    );

    if (signal?.aborted) return { items: [], hasMore: false };

    const merged = mergeAndSortTracks(results.flatMap(r => r.items), query);

    return {
      items: merged,
      hasMore: results.every(r => r.hasMore)
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
    if (source === 'podcast') {
      return forceHttps(id);
    }

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
        const json = await requestMusicApiJSON<{ url?: string }>({ types: 'url', id, br }, source);
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
          const json = await requestMusicApiJSON<{ url?: string }>({ types: 'pic', id: idOrUrl, size }, source);
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
    if (source === 'podcast') {
      return null
    }
    
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
        const json = await requestMusicApiJSON<{ lyric?: string; tlyric?: string }>({ types: 'lyric', id }, source);
        if (!json) return null;
        return { lyric: json.lyric ?? '', tlyric: json.tlyric ?? '' };
      },
      TTL_LONG,
    );
  },

  /* ---------------- 搜索建议 ---------------- */

  async getSearchSuggestions(query: string): Promise<SearchSuggestionItem[]> {
    const q = query.trim();
    if (!q) return [];

    try {
      const s = await searchSuggest(q);
      if (!s) return [];

      const seen = new Set<string>();
      const suggestions: SearchSuggestionItem[] = [];

      const pushUnique = (
        text: string,
        type: SearchSuggestionItem["type"],
        id?: string | number
      ) => {
        text = text.trim();
        if (!text) return;

        const key = `${type}:${text}`;
        if (seen.has(key)) return;

        seen.add(key);
        suggestions.push({
          text,
          type,
          id: id === null ? undefined : String(id),
          source: "_netease",
        });
      };

      const addTop = <T>(
        list: T[] | undefined,
        type: SearchSuggestionItem["type"],
        format: (item: T) => string
      ) => {
        for (const item of list?.slice(0, 3) ?? []) {
          pushUnique(format(item), type, (item as { id?: string | number }).id);
        }
      };

      addTop(s.artists, "artist", a => a.name);
      addTop(s.songs, "song", song => `${song.name} ${song.artists?.map(a => a.name).join('/') ?? ""}`);
      addTop(s.albums, "album", a => `${a.name} ${a.artist?.name ?? ""}`);
      addTop(s.playlists, "playlist", p => p.name);

      return suggestions;
    } catch (e) {
      console.warn("Search suggest failed:", e);
      return [];
    }
  }
};
