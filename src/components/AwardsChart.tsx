import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import {
  Disc3,
  Import,
  Loader2,
  Mic2,
  Play,
  RefreshCw,
  Search,
  Trophy,
} from "lucide-react";
import {
  awardTitleIsAlbum,
  awardWinnerIsTechnicalCredit,
  cleanAwardTitle,
  fetchAward,
  splitAwardArtists,
  toAwardTracks,
  type AwardData,
} from "@/lib/awards/awards-api";
import { getAwardMeta } from "@/lib/awards/awards-meta";
import { searchAlbums, searchArtists } from "@/lib/netease/netease-api";
import { isArtistMatch, isNameMatch } from "@/lib/utils/music-key";
import { DEFAULT_FALLBACK_SEARCH_SOURCE } from "@/lib/music-provider/search-source";
import { resolveQqAlbumMid } from "@/lib/qqmusic/qqmusic-api";
import { useMusicStore } from "@/store/music-store";
import { useMarketSession } from "@/store/session/market-session";
import type { SearchIntent } from "@/types/music";
import { usePlayContextHandler } from "@/hooks/usePlayContextHandler";
import { useImportPlaylist } from "@/hooks/useImportPlaylist";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

/** 分类名的首位获奖者（"Kendrick Lamar , SZA" -> "Kendrick Lamar"）作匹配词 */
const firstWinner = (winner: string): string =>
  splitAwardArtists(winner)[0] ?? winner;

const KIND_ICONS = {
  song: Play,
  album: Disc3,
  artist: Mic2,
} as const;

interface AwardRowProps {
  row: AwardData["categories"][number] & { index: number };
  searching: boolean;
  onClick: () => void;
}

/** 获奖清单行：分类名（小）+ 作品/人物（粗）+ 获奖者 + kind 图标 */
function AwardRow({ row, searching, onClick }: AwardRowProps) {
  const KindIcon = row.kind ? KIND_ICONS[row.kind] : Search;
  return (
    <div
      className="flex items-center gap-3 py-3 cursor-pointer active:opacity-60 transition-opacity"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-tight text-muted-foreground/60 truncate">
          {row.name}
        </p>
        {row.title ? (
          <p className="mt-1 text-[15px] font-semibold leading-snug text-foreground truncate">
            {cleanAwardTitle(row.title)}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
          {splitAwardArtists(row.winner).join(" / ")}
        </p>
      </div>
      {/* 外层 div 固定尺寸 + shrink-0，避免低版本 WebView 把 SVG 压缩至 0（见 AGENTS.md） */}
      <div
        className={cn(
          "h-8 w-8 shrink-0 flex-[0_0_32px] min-w-8 min-h-8 rounded-full flex items-center justify-center transition-colors",
          row.kind === "song"
            ? "bg-amber-400/15 text-amber-500"
            : "bg-secondary/60 text-muted-foreground",
          searching && "opacity-40"
        )}
      >
        <KindIcon className="h-4 w-4" />
      </div>
    </div>
  );
}

interface AwardsChartProps {
  awardId: string;
  year?: number;
}

/**
 * 奖项页（金曲奖 / 格莱美奖）：品牌化 Hero + 获奖清单。
 * kind=song 点击直接播放（占位换源）；album/artist 网易云严格匹配跳详情
 * （GMA 表演者奖按专辑解析——其 title 即获奖专辑）；未命中或无 kind
 * （制作人/作词作曲/技术类）回落聚合搜索，关键词为「作品 人」
 * （装帧/录音/工程等技术署名类只搜作品名），无 kind 且 title 为
 * 专辑名时另设 album 意图加权排序。
 * year 缺省时优先恢复会话缓存的上次浏览年份（无缓存则最新一届），
 * 通过 ?year= 切换（年份只在详情页内用原生 select 更改）。
 */
export function AwardsChart({ awardId, year }: AwardsChartProps) {
  const meta = getAwardMeta(awardId);
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const setSearchQuery = useMusicStore((s) => s.setSearchQuery);
  const setSearchIntent = useMusicStore((s) => s.setSearchIntent);
  const setSearchResults = useMusicStore((s) => s.setSearchResults);
  const setSearchSource = useMusicStore((s) => s.setSearchSource);
  const savedYear = useMarketSession((s) => s.awardYears[awardId]);
  const setAwardYear = useMarketSession((s) => s.setAwardYear);
  const [data, setData] = useState<AwardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchingIndex, setSearchingIndex] = useState<number | null>(null);
  const searchingRef = useRef(false);

  // 年份优先级：URL ?year= > 会话缓存的上次年份（需在 meta.years 内）> 最新一届
  const activeYear =
    year && meta?.years.includes(year)
      ? year
      : savedYear && meta?.years.includes(savedYear)
        ? savedYear
        : (meta?.latestYear ?? 0);

  // 记录当前浏览的年份，供下次进入时恢复
  useEffect(() => {
    if (meta && activeYear) setAwardYear(awardId, activeYear);
  }, [awardId, meta, activeYear, setAwardYear]);

  const songTracks = useMemo(() => (data ? toAwardTracks(data) : []), [data]);
  const onPlay = usePlayContextHandler(
    songTracks,
    `award:${awardId}:${activeYear}`
  );
  const importPlaylist = useImportPlaylist();

  const loadAward = useCallback(async () => {
    if (!meta) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAward(meta.id, activeYear));
    } catch (e) {
      logger.error(
        "Awards",
        `Load ${meta.id} at ${activeYear} failed`,
        e instanceof Error ? e : undefined
      );
      setError("获奖名单加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [meta, activeYear]);

  useEffect(() => {
    if (meta) loadAward();
  }, [meta, loadAward]);

  const changeYear = (y: number) => {
    if (!meta) return;
    // replace 模式：切年份不污染历史栈，返回键直接回到进入前的页面；
    // 年份记忆由会话缓存（awardYears）承担
    setSearchParams(y === meta.latestYear ? {} : { year: String(y) }, {
      replace: true,
    });
  };

  const fallbackToSearch = useCallback(
    (row: AwardData["categories"][number]) => {
      const artist = firstWinner(row.winner);
      const title = row.title ? cleanAwardTitle(row.title) : "";
      // 兜底关键词默认「作品 人」；技术署名类（装帧/录音/工程等）获奖者非
      // 音乐人，人名只会污染搜索结果，只保留作品名
      const keyword =
        title && artist && !awardWinnerIsTechnicalCredit(awardId, row.name)
          ? `${title} ${artist}`
          : title || artist;
      let intent: SearchIntent | null = null;
      if (row.kind === "album" || row.kind === "artist") {
        intent = {
          type: row.kind,
          name: title || undefined,
          artist: artist || undefined,
        };
      } else if (title && awardTitleIsAlbum(awardId, row.name)) {
        // 无 kind（制作人/作词作曲/技术类）：title 为专辑名时设 album 意图，
        // 不带 artist（winner 是制作人/工程师而非专辑艺人）
        intent = { type: "album", name: title };
      }
      setSearchQuery(keyword);
      setSearchIntent(intent);
      // 获奖条目来自网易云，回退搜索锁定网易云单音源，避免聚合搜索等待全部音源
      setSearchSource(DEFAULT_FALLBACK_SEARCH_SOURCE);
      setSearchResults([]);
      navigate("/search");
    },
    [
      awardId,
      navigate,
      setSearchQuery,
      setSearchIntent,
      setSearchResults,
      setSearchSource,
    ]
  );

  const onRowClick = useCallback(
    async (row: AwardData["categories"][number] & { index: number }) => {
      if (!data || !meta) return;
      if (row.kind === "song" && row.title) {
        const track = songTracks.find(
          (t) => t.id === `award:${data.award}:${data.year}:${row.index}`
        );
        if (track) onPlay(track);
        return;
      }
      if (searchingRef.current) return;
      searchingRef.current = true;
      setSearchingIndex(row.index);
      const artist = firstWinner(row.winner);
      try {
        if (row.kind === "album" && row.title) {
          const title = row.title;
          const albums = await searchAlbums(title);
          const hit = albums.find(
            (a) =>
              isNameMatch(a.name, title) &&
              isArtistMatch([a.artistName], [artist])
          );
          if (hit) {
            navigate(`/netease-album/${hit.id}`, {
              state: { albumFallback: { name: title, artist } },
            });
            return;
          }
          // 网易云没有该专辑：回退到 QQ 音乐专辑页，仍失败则进入默认搜索
          const qqMid = await resolveQqAlbumMid(title, artist);
          if (qqMid) {
            navigate(`/qq-album/${qqMid}`);
            return;
          }
        } else if (row.kind === "artist") {
          const artists = await searchArtists(artist);
          const hit = artists.find((a) => isArtistMatch([a.name], [artist]));
          if (hit) {
            navigate(`/netease-artist/${hit.id}`);
            return;
          }
        }
        fallbackToSearch(row);
      } catch (e) {
        logger.error(
          "Awards",
          "Resolve award entry failed",
          e instanceof Error ? e : undefined
        );
        fallbackToSearch(row);
      } finally {
        searchingRef.current = false;
        setSearchingIndex(null);
      }
    },
    [data, meta, songTracks, onPlay, navigate, fallbackToSearch]
  );

  if (!meta) return null;

  const rows = data
    ? data.categories
        .map((c, index) => ({ ...c, index }))
        .filter((c) => c.title || c.kind === "artist")
    : [];

  return (
    <PageLayout
      title={meta.name}
      action={
        <div className="flex items-center gap-1">
          <select
            aria-label="选择年份"
            value={activeYear}
            onChange={(e) => changeYear(Number(e.target.value))}
            className="h-8 rounded-full bg-secondary/60 px-2.5 text-xs font-medium tabular-nums text-foreground outline-none cursor-pointer"
          >
            {meta.years.map((y) => (
              <option key={y} value={y}>
                {y}
                {y === activeYear && data?.edition
                  ? ` · 第${data.edition}届`
                  : ""}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full text-xs gap-1"
            disabled={songTracks.length === 0}
            onClick={() =>
              importPlaylist(
                `${meta.name} ${activeYear}`,
                undefined,
                songTracks
              )
            }
          >
            <Import className="h-3.5 w-3.5" />
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs tracking-widest uppercase opacity-50">
            加载中...
          </span>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <span className="text-sm">{error}</span>
          <button
            onClick={loadAward}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重新加载
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-bottom-stack">
          {/* 品牌色 Hero：奖项气质横幅 */}
          <div
            className="relative overflow-hidden"
            style={{
              backgroundImage: `linear-gradient(135deg, ${meta.colors[0]}, ${meta.colors[1]})`,
            }}
          >
            <div className="absolute right-4 top-4 h-14 w-14 shrink-0 flex-[0_0_56px] min-w-14 min-h-14 opacity-15">
              <Trophy className="h-full w-full text-white" />
            </div>
            <div className="px-5 py-7">
              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-white/50">
                {meta.enName}
              </p>
              <p className="mt-2 text-white font-black tracking-tight leading-none text-4xl tabular-nums">
                {activeYear}
                {data?.edition ? (
                  <span className="ml-2 text-sm font-bold text-white/70 align-middle">
                    第{data.edition}届
                  </span>
                ) : null}
              </p>
              <p className="mt-2 text-sm font-bold text-white/85">
                {meta.name}
              </p>
              <div className="mt-3 h-px w-12 bg-white/30" />
            </div>
          </div>

          {/* 获奖清单 */}
          <div className="px-4 divide-y divide-border/40">
            {rows.map((row) => (
              <AwardRow
                key={`${row.index}-${row.name}`}
                row={row}
                searching={searchingIndex === row.index}
                onClick={() => onRowClick(row)}
              />
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
