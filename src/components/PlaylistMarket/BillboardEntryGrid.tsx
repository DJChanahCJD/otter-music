import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMusicStore } from "@/store/music-store";
import { fetchBillboardChart } from "@/lib/billboard/billboard-api";
import { searchAlbums, searchArtists } from "@/lib/netease/netease-api";
import { isArtistMatch, isNameMatch } from "@/lib/utils/music-key";
import { DEFAULT_FALLBACK_SEARCH_SOURCE } from "@/lib/music-provider/search-source";
import { resolveQqAlbumMid } from "@/lib/qqmusic/qqmusic-api";
import { MusicCover } from "@/components/MusicCover";
import type { BillboardChartEntry } from "@otter-music/shared";
import { logger } from "@/lib/logger";

/** 取歌手串的第一位（"Shakira X Burna Boy" -> "Shakira"）作匹配词 */
const firstArtist = (artist: string): string =>
  artist.split(/\s*(?:X|Featuring|Feat\.)\s*|\s*&\s*|\s*\/\s*/i)[0]?.trim() ??
  artist;

interface BillboardEntryGridProps {
  chartId: string;
  group: "albums" | "artists";
  date?: string;
}

/**
 * 专辑 / 歌手榜单条目网格（封面图 + 名称，同 PlaylistGrid 骨架）。
 * 条目非歌曲，点击先对网易云做严格匹配搜索：命中跳详情页，未命中回落搜索页。
 */
export function BillboardEntryGrid({
  chartId,
  group,
  date,
}: BillboardEntryGridProps) {
  const navigate = useNavigate();
  const setSearchQuery = useMusicStore((s) => s.setSearchQuery);
  const setSearchIntent = useMusicStore((s) => s.setSearchIntent);
  const setSearchResults = useMusicStore((s) => s.setSearchResults);
  const setSearchSource = useMusicStore((s) => s.setSearchSource);
  const [entries, setEntries] = useState<BillboardChartEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchingId, setSearchingId] = useState<number | null>(null);
  const searchingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchBillboardChart(chartId, date));
    } catch (e) {
      logger.error(
        "Billboard",
        `Load ${chartId}${date ? ` at ${date}` : ""} entries failed`,
        e instanceof Error ? e : undefined
      );
      setError("加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [chartId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const fallbackToSearch = useCallback(
    (entry: BillboardChartEntry) => {
      const isAlbum = group === "albums";
      const artist = firstArtist(entry.artist);
      const keyword =
        isAlbum && artist ? `${artist} ${entry.title}` : entry.title;
      setSearchQuery(keyword);
      setSearchIntent({
        type: isAlbum ? "album" : "artist",
        name: entry.title,
        artist,
      });
      // 榜单条目来自网易云，回退搜索锁定网易云单音源，避免聚合搜索等待全部音源
      setSearchSource(DEFAULT_FALLBACK_SEARCH_SOURCE);
      setSearchResults([]);
      navigate("/search");
    },
    [
      group,
      navigate,
      setSearchQuery,
      setSearchIntent,
      setSearchResults,
      setSearchSource,
    ]
  );

  const onEntryClick = useCallback(
    async (entry: BillboardChartEntry) => {
      if (searchingRef.current) return;
      searchingRef.current = true;
      setSearchingId(entry.rank);
      try {
        if (group === "albums") {
          const artist = firstArtist(entry.artist);
          const albums = await searchAlbums(entry.title);
          const hit = albums.find(
            (a) =>
              isNameMatch(a.name, entry.title) &&
              isArtistMatch([a.artistName], [artist])
          );
          if (hit) {
            navigate(`/netease-album/${hit.id}`, {
              state: { albumFallback: { name: entry.title, artist } },
            });
            return;
          }
          // 网易云没有该专辑：回退到 QQ 音乐专辑页，仍失败则进入默认搜索
          const qqMid = await resolveQqAlbumMid(entry.title, artist);
          if (qqMid) {
            navigate(`/qq-album/${qqMid}`);
            return;
          }
        } else {
          const artists = await searchArtists(entry.title);
          const hit = artists.find((a) =>
            isArtistMatch([a.name], [entry.title])
          );
          if (hit) {
            navigate(`/netease-artist/${hit.id}`);
            return;
          }
        }
        fallbackToSearch(entry);
      } catch (e) {
        logger.error(
          "Billboard",
          "Search entry failed",
          e instanceof Error ? e : undefined
        );
        fallbackToSearch(entry);
      } finally {
        searchingRef.current = false;
        setSearchingId(null);
      }
    },
    [group, navigate, fallbackToSearch]
  );

  if (loading) {
    return (
      <div className="h-60 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-xs tracking-widest uppercase opacity-50">
          加载中...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-60 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <span className="text-sm">{error}</span>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-4">
      {entries.map((entry) => (
        <div
          key={entry.rank}
          className="group flex flex-col gap-2.5 transition-all hover:translate-y-[-4px]"
          onClick={() => onEntryClick(entry)}
        >
          <div
            className={`relative aspect-square rounded-md overflow-hidden shadow-md ring-1 ring-black/5 hover:shadow-xl transition-shadow cursor-pointer ${
              searchingId === entry.rank ? "opacity-60" : ""
            }`}
          >
            <MusicCover
              src={entry.cover}
              alt={entry.title}
              className="transition-transform duration-500 group-hover:scale-110"
            />
          </div>
          <div className="px-0.5">
            <h3 className="text-[13px] font-medium leading-snug line-clamp-2 text-foreground/80 group-hover:text-primary transition-colors cursor-pointer">
              {entry.title}
            </h3>
            {group === "albums" && (
              <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">
                {entry.artist}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
