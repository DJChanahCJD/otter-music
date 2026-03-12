import type { MusicSource, MusicTrack, SearchPageResult, MergedMusicTrack, SongLyric, SearchIntent, SearchSuggestionItem } from "@/types/music";
import { cachedFetch } from "@/lib/utils/cache";
import { SOURCE_RANK } from "@/lib/utils/search-helper";
import { searchSuggest } from "@/lib/netease/netease-api";
import { MusicProviderFactory, isAbort } from "./music-provider";

const TTL_SHORT = 60 * 60 * 1000; // 60 minutes
const TTL_LONG = 7 * 24 * 60 * 60 * 1000; // 7 days


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

    if (source === 'all') {
        return this.searchAll(query, page, count, signal, searchIntent);
    }

    return MusicProviderFactory.getProvider(source).search(query, page, count, signal, searchIntent);
  },

  /* ---------------- 全网搜索 ---------------- */

  async searchAll(
    query: string,
    page = 1,
    count = 20,
    signal?: AbortSignal,
    searchIntent?: SearchIntent | null
  ): Promise<SearchPageResult<MergedMusicTrack>> {
    const provider = MusicProviderFactory.createAggregateProvider();
    return provider.search(query, page, count, signal, searchIntent) as Promise<SearchPageResult<MergedMusicTrack>>;
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
        const res = await MusicProviderFactory.getProvider(source).search(query, 1, count, signal);
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

  async getUrl(idOrUrl: string, source: MusicSource, br = 192): Promise<string | null> {
    const key = `url:${source}:${idOrUrl}:${br}`;

    return cachedFetch<string | null>(
      key,
      async () => {
        try {
            const track = { id: idOrUrl, url_id: idOrUrl, source } as MusicTrack;
            return await MusicProviderFactory.getProvider(source).getUrl(track, br);
        } catch (e) {
            console.error('getUrl failed:', e);
            return null;
        }
      },
      TTL_SHORT
    );
  },

  /* ---------------- 封面 ---------------- */

  async getPic(idOrUrl: string, source: MusicSource, size: number = 800): Promise<string | null> {
    const idStr = String(idOrUrl || '');
    const key = `pic:${source}:${idStr}:${size}`;
    return cachedFetch<string | null>(
      key,
      async () => {
        try {
          const track = { id: idStr, pic_id: idStr, source } as MusicTrack;
          return await MusicProviderFactory.getProvider(source).getPic(track, size);
        } catch (e) {
          console.error('getPic failed:', e);
          return null;
        }
      },
      TTL_LONG
    );
  },

  /* ---------------- 歌词 ---------------- */

  async getLyric(id: string, source: MusicSource): Promise<SongLyric | null> {
    const key = `lyric:${source}:${id}`;

    return cachedFetch<SongLyric | null>(
      key,
      async () => {
        try {
            const track = { id, lyric_id: id, source } as MusicTrack;
            return await MusicProviderFactory.getProvider(source).getLyric(track);
        } catch (e) {
            console.error('getLyric failed:', e);
            return null;
        }
      },
      TTL_LONG
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
