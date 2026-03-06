import { getExactKey, toSimplified } from "@/lib/utils/music-key";
import { cn } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { useMusicStore } from "@/store/music-store";
import { MusicTrack, MusicSource, searchOptions } from "@/types/music";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";
import { MusicTrackList } from "./MusicTrackList";
import { Button } from "./ui/button";
import { toastUtils } from "@/lib/utils/toast";
import { PlaylistMarket } from "./PlaylistMarket/PlaylistMarket";

interface MusicSearchViewProps {
  onPlay: (track: MusicTrack, list: MusicTrack[], contextId?: string) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

export function MusicSearchView({ onPlay, currentTrackId, isPlaying }: MusicSearchViewProps) {
  const { 
    source, 
    setSource,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searchLoading,
    setSearchLoading,
    searchHasMore,
    setSearchHasMore,
    searchPage,
    setSearchPage,
    aggregatedSources,
    searchIntent,
    setSearchIntent,
  } = useMusicStore(
    useShallow(s => ({
      source: s.searchSource, 
      setSource: s.setSearchSource,
      searchQuery: s.searchQuery,
      setSearchQuery: s.setSearchQuery,
      searchResults: s.searchResults,
      setSearchResults: s.setSearchResults,
      searchLoading: s.searchLoading,
      setSearchLoading: s.setSearchLoading,
      searchHasMore: s.searchHasMore,
      setSearchHasMore: s.setSearchHasMore,
      searchPage: s.searchPage,
      setSearchPage: s.setSearchPage,
      aggregatedSources: s.aggregatedSources,
      searchIntent: s.searchIntent,
      setSearchIntent: s.setSearchIntent,
    }))
  );

  const abortRef = useRef<AbortController | null>(null);
  const versionRef = useRef(0);
  const seenRef = useRef(new Set<string>());
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ---------------- 请求核心 ---------------- */

  // 1. 仅在有明确搜索意图（如从歌手/专辑跳转）时自动搜索
  useEffect(() => {
    if (searchResults.length === 0 && searchIntent && searchQuery.trim()) {
      fetchPage(1, true);
    }
    // 依赖中不包含 searchQuery，避免打字时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchIntent, searchResults.length]);


  const fetchPage = async (nextPage: number, reset = false) => {
    if (!searchQuery.trim()) return;
    if (searchLoading) return;

    const version = ++versionRef.current;

    if (reset) {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      seenRef.current.clear();
      setSearchResults([]);
      setSearchPage(0);
    }

    setSearchLoading(true);

    try {
      const signal = abortRef.current?.signal;
      const res =
        source === "all"
          ? await musicApi.searchAll(searchQuery, nextPage, 20, signal, aggregatedSources)
          : await musicApi.search(searchQuery, source, nextPage, 20, signal);

      if (version !== versionRef.current) return; // 过期响应

      // 排序逻辑：如果是专辑搜索，优先把同名专辑放到前面
      let items = res.items;
      if (searchIntent?.type === 'album') {
        const q = toSimplified(searchQuery);
        const targetArtist = searchIntent.artist ? toSimplified(searchIntent.artist) : null;

        items = [...items].sort((a, b) => {
          const aAlbumMatch = toSimplified(a.album) === q;
          const bAlbumMatch = toSimplified(b.album) === q;

          if (targetArtist) {
            const aArtistMatch = a.artist.some(art => toSimplified(art) === targetArtist);
            const bArtistMatch = b.artist.some(art => toSimplified(art) === targetArtist);

            // 优先匹配：专辑名完全一致且歌手一致
            const aFull = aAlbumMatch && aArtistMatch;
            const bFull = bAlbumMatch && bArtistMatch;
            if (aFull && !bFull) return -1;
            if (!aFull && bFull) return 1;
          }

          // 其次匹配：专辑名完全一致
          if (aAlbumMatch && !bAlbumMatch) return -1;
          if (!aAlbumMatch && bAlbumMatch) return 1;
          return 0;
        });
      } else if (searchIntent?.type === 'artist') {
        const q = toSimplified(searchQuery);
        items = [...items].sort((a, b) => {
          const aMatch = a.artist.some(artist => toSimplified(artist) === q);
          const bMatch = b.artist.some(artist => toSimplified(artist) === q);
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return 0;
        });
      }

      const filtered = items.filter(t => {
        const key = getExactKey(t);
        if (seenRef.current.has(key)) return false;
        seenRef.current.add(key);
        return true;
      });

      setSearchResults(reset ? filtered : [...searchResults, ...filtered]);
      setSearchHasMore(res.hasMore);
      setSearchPage(nextPage);

      if (reset && filtered.length === 0) {
        toastUtils.notFound("未找到相关歌曲");
      }

    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("搜索失败，请稍后重试");
    } finally {
      if (version === versionRef.current) setSearchLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-2 border-b">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearchIntent(null);
                  fetchPage(1, true);
                }
              }}
              placeholder="搜索歌曲 / 歌手 / 专辑"
              className={cn("pl-9 h-8 text-sm", searchQuery && "pr-8")}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Select value={source} onValueChange={(v) => setSource(v as MusicSource)}>
            <SelectTrigger className="w-[120px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(searchOptions).map(([k, v]) =>
                <SelectItem key={k} value={k}>{v}</SelectItem>
              )}
            </SelectContent>
          </Select>

          <Button 
            onClick={() => {
              setSearchIntent(null);
              fetchPage(1, true);
            }} 
            disabled={searchLoading}
            size="sm"
            className="h-8 px-3"
          >
            {searchLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {!searchQuery.trim() ? (
          <PlaylistMarket />
        ) : (
          <MusicTrackList
            tracks={searchResults}
            onPlay={(track) => onPlay(track, searchResults, "search")}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            loading={searchLoading}
            hasMore={searchHasMore}
            onLoadMore={() => fetchPage(searchPage + 1)}
            emptyMessage={searchLoading ? "搜索中..." : "未找到相关歌曲"}
          />
        )}
      </div>
    </div>
  );
}

