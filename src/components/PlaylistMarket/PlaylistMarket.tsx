import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RECOMMEND_FILTERS } from "@/lib/netease/playlist-category";
import { getPlaylists, getToplist } from "@/lib/netease/netease-api";
import { Toplist, UserPlaylist } from "@/lib/netease/netease-types";
import { cachedFetch } from "@/lib/utils/cache";
import { MusicCover } from "@/components/MusicCover";
import { Loader2, Headphones, LayoutGrid } from "lucide-react";
import { PlaylistCategorySelector } from "./PlaylistCategorySelector";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useMusicStore } from "@/store/music-store";
import { forceHttps } from "@/lib/music-api";

export function PlaylistMarket() {
  const navigate = useNavigate();
  const activeCategory = useMusicStore((s) => s.lastPlaylistCategory);
  const setActiveCategory = useMusicStore((s) => s.setLastPlaylistCategory);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  const displayFilters = useMemo(() => {
    const exists = RECOMMEND_FILTERS.some((f) => f.id === activeCategory);
    if (exists || !activeCategory) return RECOMMEND_FILTERS;

    // 如果当前选中的分类不在推荐列表中，手动添加进去
    return [...RECOMMEND_FILTERS, { id: activeCategory, name: activeCategory }];
  }, [activeCategory]);

  const fetchItems = useCallback(
    async (category: string, currentOffset: number) => {
      if (currentOffset === 0) {
        setLoading(true);
        setItems([]);
      }
      setIsFetching(true);

      try {
        const isToplist = category === "toplist";
        const cacheKey = `market-playlist:${category || "all"}:${
          isToplist ? 0 : currentOffset
        }`;

        // 定义 fetcher 给 cachedFetch 使用
        const fetcher = async () => {
          const res = isToplist
            ? await getToplist("")
            : await getPlaylists(
                category || "全部",
                "hot",
                35,
                currentOffset,
                "",
              );
          return res;
        };

        // 使用 1 天缓存 (1 * 24h)
        const res = await cachedFetch(
          cacheKey,
          fetcher,
          1 * 24 * 60 * 60 * 1000,
        );

        if (res) {
          const rawList = isToplist
            ? (res.data as { list: Toplist[] }).list
            : (res.data as { playlists: UserPlaylist[] }).playlists;
          const newItems = rawList.map((i: any) => ({
            id: i.id,
            name: i.name,
            coverImgUrl: forceHttps(i.coverImgUrl),
            playCount: i.playCount,
          }));

          if (isToplist) {
            setItems(newItems);
            setHasMore(false);
          } else {
            setItems((prev) =>
              currentOffset === 0 ? newItems : [...prev, ...newItems],
            );
            // 如果返回数量少于预期，说明没有更多了
            if (newItems.length < 35) setHasMore(false);
          }
        } else {
          setHasMore(false);
        }
      } catch (err) {
        console.error("Market Load Error:", err);
        setHasMore(false);
      } finally {
        setLoading(false);
        setIsFetching(false);
      }
    },
    [],
  );

  // 切换分类时，重置状态并加载第一页
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchItems(activeCategory, 0);
  }, [activeCategory, fetchItems]);

  // 无限滚动监听
  useEffect(() => {
    const element = observerTarget.current;
    if (!element || loading || isFetching || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const nextOffset = offset + 35;
          setOffset(nextOffset);
          fetchItems(activeCategory, nextOffset);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [offset, hasMore, isFetching, loading, activeCategory, fetchItems]);

  return (
    <div className="flex flex-col h-full bg-background/50 animate-in fade-in duration-500">
      {/* 极简导航栏 */}
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-white/5 shadow-sm">
        <div className="flex items-center justify-between px-3 py-1.5 gap-2">
          {/* 左侧：当前分类展示 */}
          <div className="flex-1 overflow-hidden relative">
             <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mask-[linear-gradient(to_right,black_calc(100%-32px),transparent_100%)]">
                {displayFilters.map((f) => (
                  <Button
                    key={f.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveCategory(f.id)}
                    className={cn(
                      "h-8 px-3 rounded-full transition-all text-xs font-medium whitespace-nowrap shrink-0",
                      activeCategory === f.id
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        : "text-muted-foreground hover:text-foreground bg-secondary/30"
                    )}
                  >
                    {f.name}
                  </Button>
                ))}
                {/* Spacer matching mask fade width to ensure last item visibility */}
                <div className="w-4 shrink-0" />
             </div>
          </div>

          {/* 右侧：全部分类展开 */}
          <PlaylistCategorySelector
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-full shrink-0 bg-secondary/50 hover:bg-secondary"
              >
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              </Button>
            }
          />
        </div>
      </header>

      {/* 瀑布流内容区 */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs tracking-widest uppercase opacity-50">
              加载中...
            </span>
          </div>
        ) : (
          <div className="p-4 pb-24">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group flex flex-col gap-2.5 transition-all hover:translate-y-[-4px]"
                  onClick={() => {
                    navigate(`/playlist-market/${item.id}`);
                  }}
                >
                  <div className="relative aspect-square rounded-md overflow-hidden shadow-md ring-1 ring-black/5 hover:shadow-xl transition-shadow cursor-pointer">
                    <MusicCover
                      src={item.coverImgUrl}
                      alt={item.name}
                      className="w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />

                    {/* 播放量 - 右下角 */}
                    <div className="absolute bottom-1.5 right-2 flex items-center gap-1 text-white/90 text-[10px] font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      <Headphones className="w-3 h-3 filter drop-shadow-sm" />
                      <span className="tracking-wide">
                        {formatPlayCount(item.playCount)}
                      </span>
                    </div>
                  </div>

                  <div className="px-0.5">
                    <h3 className="text-[13px] font-medium leading-snug line-clamp-2 text-foreground/80 group-hover:text-primary transition-colors cursor-pointer">
                      {item.name}
                    </h3>
                  </div>
                </div>
              ))}
            </div>

            {/* 加载更多 / 到底提示 */}
            <div
              ref={observerTarget}
              className="h-12 w-full mt-6 flex items-center justify-center opacity-80"
            >
              {isFetching && !loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading more...</span>
                </div>
              )}
              {!hasMore && items.length > 0 && (
                <span className="text-xs text-muted-foreground/50 tracking-wide uppercase">
                  End of List
                </span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function formatPlayCount(count: number) {
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
  if (count >= 100000) return `${(count / 10000).toFixed(0)}万`;
  return count;
}
