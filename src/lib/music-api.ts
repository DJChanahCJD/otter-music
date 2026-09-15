import type {
  MusicSource,
  MusicTrack,
  SearchPageResult,
  MergedMusicTrack,
  SongLyric,
  SearchIntent,
  SearchSuggestionItem,
} from "@/types/music";
import { cachedFetch } from "@/lib/utils/cache";
import { searchSuggest } from "@/lib/netease/netease-api";
import { MusicProviderFactory, isAbort } from "./music-provider";
import { logger } from "@/lib/logger";

// const TTL_SHORT = 60 * 60 * 1000; // 60 minutes
const TTL_LONG = 7 * 24 * 60 * 60 * 1000; // 7 days
/** 签名直链时效不定，与 url-cache-store 的内存 TTL 保持一致，过期即重新解析 */
const TTL_URL = 15 * 60 * 1000; // 15 minutes

export const musicApi = {
  /* ---------------- 搜索 ---------------- */

  async search(
    query: string,
    source: MusicSource = "joox",
    page = 1,
    count = 20,
    signal?: AbortSignal,
    searchIntent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    if (source === "all") {
      return this.searchAll(query, page, count, signal, searchIntent);
    }

    return MusicProviderFactory.getProvider(source).search(
      query,
      page,
      count,
      signal,
      searchIntent
    );
  },

  /* ---------------- 全网搜索 ---------------- */

  async searchAll(
    query: string,
    page = 1,
    count = 20,
    signal?: AbortSignal,
    searchIntent?: SearchIntent | null
  ): Promise<SearchPageResult<MergedMusicTrack>> {
    const provider = MusicProviderFactory.getProvider("all");
    return provider.search(query, page, count, signal, searchIntent) as Promise<
      SearchPageResult<MergedMusicTrack>
    >;
  },

  /* ---------------- 最佳匹配搜索（串行） ---------------- */

  async searchBestMatch({
    query,
    sources,
    predicate,
    count = 20,
    signal,
    ranker,
    targetTrack,
  }: {
    query: string;
    sources: MusicSource[];
    predicate: (track: MusicTrack) => boolean;
    count?: number;
    signal?: AbortSignal;
    ranker?: (track: MusicTrack, originalIndex: number) => number;
    targetTrack?: MusicTrack;
  }): Promise<MusicTrack | null> {
    for (const source of sources) {
      if (signal?.aborted) return null;
      try {
        const provider = MusicProviderFactory.getProvider(source);
        const effectivePredicate =
          targetTrack && provider.getAutoMatchPredicate
            ? provider.getAutoMatchPredicate(targetTrack)
            : predicate;
        const effectiveQuery =
          targetTrack && provider.getAutoMatchQuery
            ? provider.getAutoMatchQuery(targetTrack, query)
            : query;
        const effectiveCount =
          targetTrack && provider.getAutoMatchCount
            ? provider.getAutoMatchCount(targetTrack)
            : count;
        const effectiveRanker =
          targetTrack && provider.getAutoMatchRanker
            ? provider.getAutoMatchRanker(targetTrack)
            : ranker;
        const res = await provider.search(
          effectiveQuery,
          1,
          effectiveCount,
          signal
        );
        const match = effectiveRanker
          ? res.items
              .map((track, originalIndex) => ({ track, originalIndex }))
              .filter(({ track }) => effectivePredicate(track))
              .sort(
                (a, b) =>
                  effectiveRanker(b.track, b.originalIndex) -
                    effectiveRanker(a.track, a.originalIndex) ||
                  a.originalIndex - b.originalIndex
              )[0]?.track
          : res.items.find(effectivePredicate);
        if (match) return match;
      } catch (e) {
        if (isAbort(e)) throw e;
        logger.warn("music-api", `Search failed for source: ${source}`, e);
      }
    }
    return null;
  },

  /* ---------------- URL ---------------- */

  async getUrl(
    idOrUrl: string,
    source: MusicSource,
    br = 192,
    options?: { forceRefresh?: boolean }
  ): Promise<string | null> {
    if (idOrUrl.startsWith("http")) return idOrUrl;
    const key = `url:${source}:${idOrUrl}:${br}`;

    return cachedFetch<string | null>(
      key,
      async () => {
        try {
          const track = { id: idOrUrl, url_id: idOrUrl, source } as MusicTrack;
          return await MusicProviderFactory.getProvider(source).getUrl(
            track,
            br
          );
        } catch (e) {
          logger.error("music-api", "getUrl failed", e);
          return null;
        }
      },
      TTL_URL,
      options?.forceRefresh
    );
  },

  /* ---------------- 封面 ---------------- */

  async getPic(
    idOrUrl: string,
    source: MusicSource,
    size: number = 800
  ): Promise<string | null> {
    if (idOrUrl.startsWith("http") && source !== "bilibili") return idOrUrl;
    // v2：咪咕封面由相对路径改为补全 CDN 域名，旧缓存需作废，避免继续命中失效地址
    const key = `pic:v2:${source}:${idOrUrl}:${size}`;
    return cachedFetch<string | null>(
      key,
      async () => {
        try {
          const track = { id: idOrUrl, pic_id: idOrUrl, source } as MusicTrack;
          return await MusicProviderFactory.getProvider(source).getPic(
            track,
            size
          );
        } catch (e) {
          logger.error("music-api", "getPic failed", e);
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
          logger.error("music-api", "getLyric failed", e);
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

      addTop(s.artists, "artist", (a) => a.name);
      addTop(
        s.songs,
        "song",
        (song) =>
          `${song.name} - ${song.artists?.map((a) => a.name).join("/") ?? ""}`
      );
      addTop(s.albums, "album", (a) => `${a.name} - ${a.artist?.name ?? ""}`);
      addTop(s.playlists, "playlist", (p) => p.name);

      return suggestions;
    } catch (e) {
      logger.warn("music-api", "Search suggest failed", e);
      return [];
    }
  },
};
