import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FEATURED_SUB_FILTERS, RECOMMEND_FILTERS } from "@/lib/netease/playlist-category";
import {
  getPlaylists,
  getToplist,
  getUserPlaylists,
  getMyInfo,
  NETEASE_COOKIE_KEY,
  getRecommendPlaylists,
} from "@/lib/netease/netease-api";
import type { MarketPlaylist } from "@/lib/netease/netease-types";
import { cachedFetch } from "@/lib/utils/cache";
import { MusicCover } from "@/components/MusicCover";
import { Loader2, LayoutGrid, Plus } from "lucide-react";
import { PlaylistCategorySelector } from "./PlaylistCategorySelector";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useMusicStore, type MusicState } from "@/store/music-store";
import { toast } from "react-hot-toast";
import { PodcastAdd } from "@/components/Podcast/PodcastAdd";
import { PodcastCard } from "@/components/Podcast/PodcastCard";
import { usePodcastStore } from "@/store/podcast-store";
import { useScrollSave } from "@/hooks/use-scroll-save";

const PAGE_SIZE = 30;
const SUB_TAB_HEIGHT = "h-8";

// 构造唯一的快照 Key
const getSnapshotKey = (category: string, tab: string) => 
  `market-snapshot:${category}:${category === 'featured' ? tab : 'default'}`;

const PlaylistGrid = ({ list, onClick }: { list: MarketPlaylist[]; onClick: (id: string) => void; }) => (
  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-4">
    {list.map((item) => (
      <div key={item.id} className="group flex flex-col gap-2.5 transition-all hover:translate-y-[-4px]" onClick={() => onClick(item.id)}>
        <div className="relative aspect-square rounded-md overflow-hidden shadow-md ring-1 ring-black/5 hover:shadow-xl transition-shadow cursor-pointer">
          <MusicCover src={item.coverUrl} alt={item.name} className="transition-transform duration-500 group-hover:scale-110" />
        </div>
        <div className="px-0.5">
          <h3 className="text-[13px] font-medium leading-snug line-clamp-2 text-foreground/80 group-hover:text-primary transition-colors cursor-pointer">{item.name}</h3>
        </div>
      </div>
    ))}
  </div>
);

interface MineDataState {
  recommend: MarketPlaylist[] | null;
  created: MarketPlaylist[] | null;
  subscribed: MarketPlaylist[] | null;
}

interface MineSectionProps {
  mineData: MineDataState;
  setMineData: React.Dispatch<React.SetStateAction<MineDataState>>;
  currentUserId: number | null;
  setCurrentUserId: React.Dispatch<React.SetStateAction<number | null>>;
}

function MineSection({
  mineData,
  setMineData,
  currentUserId,
  setCurrentUserId
}: MineSectionProps) {
  const navigate = useNavigate();
  const mineTab = useMusicStore((s) => s.lastMineTab);
  const setMineTab = useMusicStore((s) => s.setLastMineTab);
  const rssSources = usePodcastStore((s) => s.rssSources);
  
  const [showPodcastDialog, setShowPodcastDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMineData = async () => {
      const cookie = localStorage.getItem(NETEASE_COOKIE_KEY);
      if (!cookie) return setLoading(false);

      try {
        setLoading(true);
        let userId = currentUserId;
        if (!userId) {
          const userInfo = await getMyInfo(cookie);
          userId = userInfo?.userId ?? null;
          if (!userId) {
            toast.error("获取用户信息失败");
            return setLoading(false);
          }
          setCurrentUserId(userId);
        }

        if (mineTab === "recommend" && !mineData.recommend) {
          const recommend = await getRecommendPlaylists(cookie).catch(() => []);
          setMineData((prev) => ({ ...prev, recommend }));
        } else if ((mineTab === "created" || mineTab === "subscribed") && !mineData.created) {
          const userPlaylists = await getUserPlaylists(String(userId), cookie);
          setMineData((prev) => ({
            ...prev,
            created: userPlaylists.filter((p) => p.userId === String(userId)),
            subscribed: userPlaylists.filter((p) => p.userId !== String(userId)),
          }));
        }
      } catch (err) {
        console.error("Mine Data Load Error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (mineTab !== "podcast") fetchMineData();
    else setLoading(false);
  }, [mineTab, currentUserId, mineData.recommend, mineData.created, setMineData, setCurrentUserId]);

  const activeDataList = mineTab !== "podcast" ? mineData[mineTab as keyof typeof mineData] : [];
  const validRssSources = rssSources.filter((s) => !s.is_deleted);

  return (
    <div className="p-4 pb-24 space-y-6">
      <div className={cn("flex items-center justify-between mb-4 px-1 relative", SUB_TAB_HEIGHT)}>
        <div className="flex items-center gap-6">
          {[
            { id: "recommend", label: "推荐", count: mineData.recommend?.length },
            { id: "created", label: "创建", count: mineData.created?.length },
            { id: "subscribed", label: "收藏", count: mineData.subscribed?.length },
            { id: "podcast", label: "播客", count: validRssSources.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMineTab(tab.id as MusicState["lastMineTab"])}
              className={cn(
                "text-[15px] transition-all whitespace-nowrap",
                mineTab === tab.id ? "font-bold text-foreground tracking-wide" : "font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label} {tab.count !== undefined && <span className="text-xs opacity-60 ml-0.5">{tab.count}</span>}
            </button>
          ))}
        </div>
        {/* 核心高度防抖：透明度切换占位 */}
        <div className={cn("transition-opacity", mineTab === "podcast" ? "opacity-100" : "opacity-0 pointer-events-none")}>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => setShowPodcastDialog(true)}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {loading && !activeDataList ? (
          <div className="h-60 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : mineTab === "podcast" ? (
          <>
            {validRssSources.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-4">
                {validRssSources.map((rss) => <PodcastCard key={rss.id} rssSource={rss} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
                <p>暂无订阅播客</p>
                <Button onClick={() => setShowPodcastDialog(true)}>立即添加</Button>
              </div>
            )}
            <PodcastAdd open={showPodcastDialog} onOpenChange={setShowPodcastDialog} />
          </>
        ) : !currentUserId ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
            <p className="text-sm">请先登录网易云账号以查看歌单</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>前往设置</Button>
          </div>
        ) : activeDataList && activeDataList.length > 0 ? (
          <PlaylistGrid list={activeDataList} onClick={(id) => navigate(`/netease-playlist/${id}`)} />
        ) : (
          <div className="text-center py-16 text-muted-foreground text-sm tracking-widest">空空如也~</div>
        )}
      </div>
    </div>
  );
}

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

  // 动态生成对应的缓存 Key
  const snapshotKey = useMemo(() => getSnapshotKey(activeCategory, featuredTab), [activeCategory, featuredTab]);
  
  const [mineData, setMineData] = useState<MineDataState>({
    recommend: null,
    created: null,
    subscribed: null
  });
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

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
          
          // 更新并写入快照
          const hasMoreData = isToplist ? false : res.length >= PAGE_SIZE;
          setHasMore(hasMoreData);
          sessionStorage.setItem(
            getSnapshotKey(category, subTab),
            JSON.stringify({ items: nextItems, offset: currentOffset, hasMore: hasMoreData })
          );

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
  }, []);

  // 初始挂载与分类切换监听
  useEffect(() => {
    if (activeCategory === "mine") return;

    // 1. 尝试从快照极速恢复
    const snapStr = sessionStorage.getItem(snapshotKey);
    if (snapStr) {
      try {
        const snap = JSON.parse(snapStr);
        setItems(snap.items);
        setOffset(snap.offset);
        setHasMore(snap.hasMore);
        setLoading(false);
        return; // 命中快照，跳过 Fetch
      } catch (e) {
        console.warn("解析快照失败", e);
      }
    }

    // 2. 未命中，正常加载
    setOffset(0);
    setHasMore(true);
    fetchItems(activeCategory, featuredTab, 0);
  }, [activeCategory, featuredTab, snapshotKey, fetchItems]);

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
          <MineSection 
            mineData={mineData} 
            setMineData={setMineData} 
            currentUserId={currentUserId} 
            setCurrentUserId={setCurrentUserId} 
          />
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
