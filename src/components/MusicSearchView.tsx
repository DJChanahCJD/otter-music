import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import toast from "react-hot-toast";
import { Search, X, Loader2 } from "lucide-react";

import { getExactKey } from "@/lib/utils/music-key";
import { useDebounce } from "@/hooks/use-debounce";
import { useAggregatedSourcesForSearch } from "@/hooks/use-aggregated-sources";
import { musicApi } from "@/lib/music-api";
import { useMusicStore } from "@/store/music-store";
import {
  applySearchIntentSort,
  mergeAndSortTracks,
} from "@/lib/utils/search-helper";
import { toastUtils } from "@/lib/utils/toast";

import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { SearchSuggestions } from "./SearchSuggestions";
import { MusicTrackList } from "./MusicTrackList";
import { PlaylistMarket } from "./PlaylistMarket/PlaylistMarket";
import {
  type MusicTrack,
  type MusicSource,
  type SearchSuggestionItem,
  searchOptions,
} from "@/types/music";

interface MusicSearchViewProps {
  onPlay: (track: MusicTrack, list: MusicTrack[], contextId?: string) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

export function MusicSearchView({
  onPlay,
  currentTrackId,
  isPlaying,
}: MusicSearchViewProps) {
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
    searchIntent,
    setSearchIntent,
  } = useMusicStore(
    useShallow((s) => ({
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
      searchIntent: s.searchIntent,
      setSearchIntent: s.setSearchIntent,
    })),
  );

  const aggregatedSources = useAggregatedSourcesForSearch();

  const abortRef = useRef<AbortController | null>(null);
  const versionRef = useRef(0);
  const seenRef = useRef(new Set<string>());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  /* ---------------- 搜索建议 ---------------- */
  const [suggestions, setSuggestions] = useState<SearchSuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSuggestions([]);
        return;
      }
      try {
        const results = await musicApi.getSearchSuggestions(
          debouncedSearchQuery,
        );
        setSuggestions(results);
        setActiveSuggestionIndex(-1);
      } catch (e) {
        console.error("Failed to fetch suggestions", e);
      }
    };
    fetchSuggestions();
  }, [debouncedSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: SearchSuggestionItem) => {
    if (suggestion.type === "playlist" && suggestion.id) {
      navigate(`/netease-playlist/${suggestion.id}`);
      setShowSuggestions(false);
      return;
    }
    setSearchQuery(suggestion.text);
    setShowSuggestions(false);
    if (searchIntent?.type !== "album") setSearchIntent(null);
    fetchPage(1, true, suggestion.text);
  };

  /* ---------------- 请求核心 ---------------- */
  useEffect(() => {
    if (searchResults.length === 0 && searchIntent && searchQuery.trim()) {
      fetchPage(1, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchIntent, searchResults.length]);

  const fetchPage = async (
    nextPage: number,
    reset = false,
    queryOverride?: string,
  ) => {
    const query = queryOverride ?? searchQuery;
    if (!query.trim() || searchLoading) return;

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
          ? await musicApi.searchAll(
              query,
              nextPage,
              20,
              signal,
              aggregatedSources,
              searchIntent,
            )
          : await musicApi.search(
              query,
              source,
              nextPage,
              20,
              signal,
              searchIntent,
            );

      if (version !== versionRef.current) return;

      let items = source === "all" ? res.items : mergeAndSortTracks(res.items);
      items = applySearchIntentSort(items, searchIntent, query);

      const currentLength = reset ? 0 : searchResults.length;
      const filtered = items.filter((t) => {
        const key = getExactKey(t);
        if (seenRef.current.has(key)) return false;
        seenRef.current.add(key);
        return true;
      });

      setSearchResults(reset ? filtered : [...searchResults, ...filtered]);
      setSearchHasMore(
        res.hasMore && currentLength + filtered.length > currentLength,
      );
      setSearchPage(nextPage);

      if (reset && filtered.length === 0) toastUtils.notFound("未找到相关歌曲");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError")
        toast.error("搜索失败，请稍后重试");
    } finally {
      if (version === versionRef.current) setSearchLoading(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 border-b border-border/40 p-3">
        <div ref={wrapperRef} className="relative mx-auto max-w-3xl">
          {/* 搜索框主体 */}
          <div className="relative flex h-11 items-center rounded-xl bg-muted/40 px-3 transition-colors focus-within:bg-background focus-within:ring-1 focus-within:ring-ring focus-within:shadow-sm hover:bg-muted/60">
            {searchLoading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : (
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}

            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
                setActiveSuggestionIndex(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setSearchIntent(null);
                  fetchPage(1, true);
                  setShowSuggestions(false);
                }
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="搜索音乐、歌手或专辑..."
              className="h-full flex-1 border-0 bg-transparent! px-3 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
            />

            {/* 清空按钮 */}
            <button
              type="button"
              className={`flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 ${
                searchQuery
                  ? "opacity-100 scale-100"
                  : "pointer-events-none opacity-0 scale-90"
              } text-muted-foreground hover:bg-muted hover:text-foreground`}
              onClick={() => {
                setSearchQuery("");
                setSuggestions([]);
                setShowSuggestions(false);
                searchInputRef.current?.focus();
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="mx-2 h-4 w-px shrink-0 bg-border/60" />

            {/* 音源选择 */}
            <Select
              value={source}
              onValueChange={(v) => setSource(v as MusicSource)}
            >
              <SelectTrigger className="h-7 w-auto min-w-[72px] shrink-0 border-0 bg-transparent! px-2 text-xs text-muted-foreground shadow-none hover:text-foreground focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {Object.entries(searchOptions).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 搜索建议弹窗 */}
          {showSuggestions && suggestions.length > 0 && (
            <SearchSuggestions
              suggestions={suggestions}
              onSelect={handleSelectSuggestion}
              activeIndex={activeSuggestionIndex}
              onClose={() => setShowSuggestions(false)}
            />
          )}
        </div>
      </div>

      {/* 列表区域 */}
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
            emptyMessage={searchLoading ? "搜索中..." : "未找到相关结果"}
          />
        )}
      </div>
    </div>
  );
}
