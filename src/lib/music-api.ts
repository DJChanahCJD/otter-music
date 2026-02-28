import type { MusicSource, MusicTrack, SearchPageResult, MergedMusicTrack, SongLyric } from "@/types/music";
import { cachedFetch } from "@/lib/utils/cache";
import { mergeAndSortTracks } from "@/lib/utils/search-helper";
import { getApiUrl } from "./api";
import { retry } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";
import { LocalMusicPlugin } from "@/plugins/local-music";

const getApiBase = () => `${getApiUrl()}`;

const TTL_SHORT = 60 * 60 * 1000; // 60 minutes
const TTL_LONG = 7 * 24 * 60 * 60 * 1000; // 7 days

const cookieOf = (source: MusicSource) => localStorage.getItem(`cookie:${source}`);

const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';

const normalizeTrack = (t: any, source: MusicSource): MusicTrack => ({
  ...t,
  id: String(t.id),
  source,
  artist: Array.isArray(t.artist) ? t.artist : [t.artist],
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

    const json = await retry(
      () => requestJSON<Partial<MusicTrack>[]>(
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

  /* ---------------- URL ---------------- */

  async getUrl(id: string, source: MusicSource, br = 192): Promise<string | null> {
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

  async getPic(id: string, source: MusicSource, size: number = 800): Promise<string | null> {
    try {
      const key = `pic:${source}:${id}`;

      const res = await cachedFetch<{ url: string }>(
        key,
        async () => {
          const json = await requestJSON<{ url?: string }>(
            buildUrl({ types: 'pic', id, size }, source)
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