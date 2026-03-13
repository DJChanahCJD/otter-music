import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FEATURED_SUB_FILTERS, RECOMMEND_FILTERS } from "@/lib/netease/playlist-category";
import {
  getPlaylists,
  getToplist,
} from "@/lib/netease/netease-api";
import type { MarketPlaylist } from "@/lib/netease/netease-types";
import { cachedFetch } from "@/lib/utils/cache";
import { Loader2, LayoutGrid } from "lucide-react";
import { PlaylistCategorySelector } from "./PlaylistCategorySelector";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useMusicStore } from "@/store/music-store";
import { useScrollSave } from "@/hooks/use-scroll-save";
import { useMarketSession } from "@/store/session/market-session";
import { MineSection } from "./MineSection";
import { PlaylistGrid } from "./PlaylistGrid";

const PAGE_SIZE = 30;
const SUB_TAB_HEIGHT = "h-8";

// 构造唯一的快照 Key
const getSnapshotKey = (category: string, tab: string) => 
  `market-snapshot:${category}:${category === 'featured' ? tab : 'default'}`;

export function PlaylistMarket() {
  const navigate = useNavigate();
  const activeCategory = useMusicStore((s) => s.lastPlaylistCategory);
  const setActiveCategory = useMusicStore((s) => s.setLastPlaylistCategory);
  
  const featuredTab = useMusicStore((s) => s.lastFeaturedTab || FEATURED_SUB_FILTERS[0].id);
  const setFeaturedTab = useMusicStore((s) => s.setLastFeaturedTab);

  const [items, setItems] = useState<MarketPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  const { listSnapshots, saveListSnapshot } = useMarketSession();

  // 动态生成对应的缓存 Key
  const snapshotKey = useMemo(() => getSnapshotKey(activeCategory, featuredTab), [activeCategory, featuredTab]);
  
  // 绑定滚动 Hook：当 items 准备好或处于 mine 标签时触发恢复
  const { scrollRef } = useScrollSave(`scroll-${snapshotKey}`, items.length > 0 || activeCategory === "mine");

  const displayFilters = useMemo(() => {
    const baseFilters = [RECOMMEND_FILTERS[0], { id: "mine", name: "我的" }, ...RECOMMEND_FILTERS.slice(1)];
    if (!activeCategory || baseFilters.some((f) => f.id === activeCategory)) return baseFilters;
    return [...baseFilters, { id: activeCategory, name: activeCategory }];
  }, [activeCategory]);

  const fetchItems = useCallback(async (category: string, subTab: string, currentOffset: number) => {
    if (category === "mine") return;
    const requestCategory = category === "featured" ? subTab : category;
    
    if (currentOffset === 0) {
      setLoading(true);
      setItems([]);
    }
    setIsFetching(true);

    try {
      const isToplist = requestCategory === "toplist";
      const cacheKey = `market-playlist:v2:${requestCategory || "all"}:${isToplist ? 0 : currentOffset}`;
      
      const res = await cachedFetch<MarketPlaylist[]>(
        cacheKey,
        () => isToplist ? getToplist("") : getPlaylists(requestCategory || "全部", "hot", PAGE_SIZE, currentOffset, ""),
        1 * 24 * 60 * 60 * 1000
      );

      if (res) {
        setItems((prev) => {
          let nextItems = res;
          if (!isToplist) {
            const existingIds = new Set(prev.map((p) => p.id));
            const uniqueRes = res.filter((p) => !existingIds.has(p.id));
            nextItems = currentOffset === 0 ? res : [...prev, ...uniqueRes];
          }
          
          // 更新并写入 Store 快照
          const hasMoreData = isToplist ? false : res.length >= PAGE_SIZE;
          setHasMore(hasMoreData);
          
          const key = getSnapshotKey(category, subTab);
          saveListSnapshot(key, {
            items: nextItems,
            offset: currentOffset,
            hasMore: hasMoreData
          });

          return nextItems;
        });
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
  }, [saveListSnapshot]);

  // 初始挂载与分类切换监听
  useEffect(() => {
    if (activeCategory === "mine") return;

    // 1. 尝试从 Store 快照极速恢复
    const snapshot = listSnapshots[snapshotKey];
    if (snapshot) {
      setItems(snapshot.items);
      setOffset(snapshot.offset);
      setHasMore(snapshot.hasMore);
      setLoading(false);
      return; // 命中快照，跳过 Fetch
    }

    // 2. 未命中，正常加载
    setOffset(0);
    setHasMore(true);
    fetchItems(activeCategory, featuredTab, 0);
  }, [activeCategory, featuredTab, snapshotKey, fetchItems, listSnapshots]);

  // 无限下拉触发器
  useEffect(() => {
    const element = observerTarget.current;
    if (!element || loading || isFetching || !hasMore || activeCategory === "mine") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const nextOffset = offset + PAGE_SIZE;
          setOffset(nextOffset);
          fetchItems(activeCategory, featuredTab, nextOffset);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [offset, hasMore, isFetching, loading, activeCategory, featuredTab, fetchItems]);

  return (
    <div className="flex flex-col h-full bg-background/50 animate-in fade-in duration-500">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-white/5 shadow-sm">
        <div className="flex items-center justify-between px-3 py-1.5 gap-2">
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
              <div className="w-4 shrink-0" />
            </div>
          </div>
          <PlaylistCategorySelector
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
            trigger={
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full shrink-0 bg-secondary/50 hover:bg-secondary">
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              </Button>
            }
          />
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
        {activeCategory === "mine" ? (
          <MineSection />
        ) : (
          <div className="p-4 pb-24">
            {activeCategory === "featured" && (
              <div className={cn("flex items-center gap-6 mb-4 px-1", SUB_TAB_HEIGHT)}>
                {FEATURED_SUB_FILTERS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFeaturedTab(tab.id)}
                    className={cn(
                      "text-[15px] transition-all",
                      featuredTab === tab.id ? "font-bold text-foreground tracking-wide" : "font-medium text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="h-60 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs tracking-widest uppercase opacity-50">加载中...</span>
              </div>
            ) : (
              <>
                <PlaylistGrid list={items} onClick={(id) => navigate(`/netease-playlist/${id}`)} />
                
                <div ref={observerTarget} className="h-12 w-full mt-6 flex items-center justify-center opacity-80">
                  {isFetching && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>加载中...</span>
                    </div>
                  )}
                  {!hasMore && items.length > 0 && (
                    <span className="text-xs text-muted-foreground/50 tracking-wide uppercase">没有更多了-_-</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
