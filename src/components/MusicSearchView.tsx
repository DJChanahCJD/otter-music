import { getExactKey } from "@/lib/utils/music-key";
import { musicApi } from "@/lib/music-api";
import { useMusicStore } from "@/store/music-store";
import { MusicTrack, MusicSource, searchOptions } from "@/types/music";
import { Search, Loader2 } from "lucide-react";
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";
import { MusicTrackList } from "./MusicTrackList";
import { Button } from "./ui/button";
import { SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";

interface MusicSearchViewProps {
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
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
    setSearchPage
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
      setSearchPage: s.setSearchPage
    }))
  );

  const abortRef = useRef<AbortController | null>(null);
  const versionRef = useRef(0);
  const seenRef = useRef(new Set<string>());
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ---------------- 请求核心 ---------------- */

  useEffect(() => {
    if (searchResults.length === 0) {
      searchInputRef.current?.focus();
    }
  }, []);

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
          ? await musicApi.searchAll(searchQuery, nextPage, 20, signal)
          : await musicApi.search(searchQuery, source, nextPage, 20, signal);

      if (version !== versionRef.current) return; // 过期响应

      const filtered = res.items.filter(t => {
        const key = getExactKey(t);
        if (seenRef.current.has(key)) return false;
        seenRef.current.add(key);
        return true;
      });

      setSearchResults(reset ? filtered : [...searchResults, ...filtered]);
      setSearchHasMore(res.hasMore);
      setSearchPage(nextPage);

    } catch (e) {
      if ((e as any)?.name !== "AbortError") toast.error("搜索失败，请稍后重试");
    } finally {
      if (version === versionRef.current) setSearchLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchPage(1, true)}
              placeholder="搜索歌曲 / 歌手 / 专辑"
              className="pl-9"
            />
          </div>

          <Select value={source} onValueChange={(v) => setSource(v as MusicSource)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(searchOptions).map(([k, v]) =>
                <SelectItem key={k} value={k}>{v}</SelectItem>
              )}
            </SelectContent>
          </Select>

          <Button onClick={() => fetchPage(1, true)} disabled={searchLoading}>
            {searchLoading ? <Loader2 className="animate-spin" /> : <Search />}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <MusicTrackList
          tracks={searchResults}
          onPlay={(track) => onPlay(track, searchResults)}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          loading={searchLoading}
          hasMore={searchHasMore}
          onLoadMore={() => fetchPage(searchPage + 1)}
          emptyMessage={searchLoading ? "搜索中..." : "输入关键词开始搜索"}
        />
      </div>
    </div>
  );
}

