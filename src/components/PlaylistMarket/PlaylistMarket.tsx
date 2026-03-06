import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RECOMMEND_FILTERS } from "@/lib/netease/playlist-category";
import {
  getPlaylists,
  getToplist,
  getUserPlaylists,
  getMyInfo,
  NETEASE_COOKIE_KEY,
  getRecommendPlaylists,
} from "@/lib/netease/netease-api";
import { Toplist, UserPlaylist } from "@/lib/netease/netease-types";
import { cachedFetch } from "@/lib/utils/cache";
import { MusicCover } from "@/components/MusicCover";
import { Loader2, Headphones, LayoutGrid } from "lucide-react";
import { PlaylistCategorySelector } from "./PlaylistCategorySelector";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useMusicStore } from "@/store/music-store";
import { forceHttps } from "@/lib/music-api";
import { toast } from "react-hot-toast";

const PAGE_SIZE = 30;

interface MarketPlaylist {
  id: number | string;
  name: string;
  coverImgUrl: string;
  playCount: number;
  userId?: number | string;
}

export function PlaylistMarket() {
  const navigate = useNavigate();
  const activeCategory = useMusicStore((s) => s.lastPlaylistCategory);
  const setActiveCategory = useMusicStore((s) => s.setLastPlaylistCategory);
  const [items, setItems] = useState<MarketPlaylist[]>([]);
  const [loading, setLoading] = useState(true);

  // 更新数据结构，加入 recommend
  const [mineData, setMineData] = useState<{
    recommend: MarketPlaylist[];
    created: MarketPlaylist[];
    subscribed: MarketPlaylist[];
  } | null>(null);

  const mineTab = useMusicStore((s) => s.lastMineTab);
  const setMineTab = useMusicStore((s) => s.setLastMineTab);

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  const displayFilters = useMemo(() => {
    const baseFilters = [
      RECOMMEND_FILTERS[0],
      { id: "mine", name: "我的" },
      ...RECOMMEND_FILTERS.slice(1),
    ];
    const exists = baseFilters.some((f) => f.id === activeCategory);
    if (exists || !activeCategory) return baseFilters;
    return [...baseFilters, { id: activeCategory, name: activeCategory }];
  }, [activeCategory]);

  const fetchItems = useCallback(
    async (category: string, currentOffset: number) => {
      if (currentOffset === 0) {
        setLoading(true);
        setItems([]);
        if (category === "mine") {
          setMineData(null);
          // 移除重置，保持用户上次选择的 Tab
        }
      }
      setIsFetching(true);

      try {
        if (category === "mine") {
          const cookie = localStorage.getItem(NETEASE_COOKIE_KEY);
          if (!cookie) {
            toast.error("请先登录网易云音乐");
            setLoading(false);
            setIsFetching(false);
            return;
          }

          const userInfo = await getMyInfo(cookie);
          const userId =
            userInfo?.data?.profile?.userId || userInfo?.profile?.userId;
          if (!userId) {
            toast.error("获取用户信息失败");
            return;
          }

          // 并发请求：同时获取用户歌单和每日推荐
          const [userRes, recRes] = await Promise.all([
            getUserPlaylists(String(userId), cookie),
            getRecommendPlaylists(cookie).catch(() => null),
          ]);

          let recommend: MarketPlaylist[] = [];
          if (recRes) {
            const rawRecommend = recRes.result || recRes.data?.result;
            if (rawRecommend && Array.isArray(rawRecommend)) {
              recommend = rawRecommend.map((i) => ({
                id: i.id,
                name: i.name,
                coverImgUrl: forceHttps(i.picUrl || (i as any).coverImgUrl || (i as any).coverUrl || ""),
                playCount: i.playCount,
              }));
            }
          }

          if (userRes?.code === 200) {
            const all: MarketPlaylist[] = userRes.playlist.map((i) => ({
              id: i.id,
              name: i.name,
              coverImgUrl: forceHttps(i.coverImgUrl || (i as any).coverUrl || (i as any).picUrl),
              playCount: i.playCount || 0,
              userId: i.creator.userId,
            }));
            const created = all.filter(
              (p) => String(p.userId) === String(userId),
            );
            const subscribed = all.filter(
              (p) => String(p.userId) !== String(userId),
            );

            setMineData({ recommend, created, subscribed });
            setHasMore(false);
          }
        } else {
          const isToplist = category === "toplist";
          const cacheKey = `market-playlist:${category || "all"}:${
            isToplist ? 0 : currentOffset
          }`;

          const fetcher = async () => {
            return isToplist
              ? await getToplist("")
              : await getPlaylists(
                  category || "全部",
                  "hot",
                  PAGE_SIZE,
                  currentOffset,
                  "",
                );
          };

          const res = await cachedFetch(
            cacheKey,
            fetcher,
            1 * 24 * 60 * 60 * 1000,
          );

          if (res) {
            const rawList = isToplist
              ? (res.data as { list: Toplist[] }).list
              : (res.data as { playlists: UserPlaylist[] }).playlists;
            const newItems: MarketPlaylist[] = rawList.map((i: Toplist | UserPlaylist) => ({
              id: i.id,
              name: i.name,
              coverImgUrl: forceHttps(i.coverImgUrl || (i as any).coverUrl || (i as any).picUrl),
              playCount: i.playCount || 0,
              userId: (i as any).creator?.userId,
            }));

            if (isToplist) {
              setItems(newItems);
              setHasMore(false);
            } else {
              setItems((prev) => {
                if (currentOffset === 0) return newItems;
                const existingIds = new Set(prev.map((p) => p.id));
                return [
                  ...prev,
                  ...newItems.filter((p) => !existingIds.has(p.id)),
                ];
              });
              if (newItems.length < PAGE_SIZE) setHasMore(false);
            }
          } else {
            setHasMore(false);
          }
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

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchItems(activeCategory, 0);
  }, [activeCategory, fetchItems]);

  useEffect(() => {
    const element = observerTarget.current;
    if (!element || loading || isFetching || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const nextOffset = offset + PAGE_SIZE;
          setOffset(nextOffset);
          fetchItems(activeCategory, nextOffset);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [offset, hasMore, isFetching, loading, activeCategory, fetchItems]);

  const renderGrid = (list: MarketPlaylist[]) => (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-4">
      {list.map((item) => (
        <div
          key={item.id}
          className="group flex flex-col gap-2.5 transition-all hover:translate-y-[-4px]"
          onClick={() => navigate(`/playlist-market/${item.id}`)}
        >
          <div className="relative aspect-square rounded-md overflow-hidden shadow-md ring-1 ring-black/5 hover:shadow-xl transition-shadow cursor-pointer">
            <MusicCover
              src={item.coverImgUrl}
              alt={item.name}
              className="transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-linear-to-t from-black/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-1.5 right-2 flex items-center gap-1 text-white/90 text-[10px] font-medium z-10">
              <Headphones className="w-3 h-3 filter drop-shadow-sm" />
              <span className="tracking-wide drop-shadow-sm">
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
  );

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
                      : "text-muted-foreground hover:text-foreground bg-secondary/30",
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

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs tracking-widest uppercase opacity-50">
              加载中...
            </span>
          </div>
        ) : activeCategory === "mine" ? (
          <div className="p-4 pb-24 space-y-6">
            {!mineData ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
                <p className="flex items-center gap-1 text-sm">
                  请先登录网易云账号
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/settings")}
                >
                  前往设置
                </Button>
              </div>
            ) : (
              <>
                {/* 极简文本切换栏 */}
                <div className="flex items-center gap-6 mb-4 px-1">
                  {[
                    {
                      id: "recommend",
                      label: "推荐",
                      count: mineData.recommend.length,
                    },
                    {
                      id: "created",
                      label: "创建",
                      count: mineData.created.length,
                    },
                    {
                      id: "subscribed",
                      label: "收藏",
                      count: mineData.subscribed.length,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setMineTab(tab.id as "recommend" | "created" | "subscribed")}
                      className={cn(
                        "text-[15px] transition-all",
                        mineTab === tab.id
                          ? "font-bold text-foreground tracking-wide"
                          : "font-medium text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {tab.label}{" "}
                      <span className="text-xs opacity-60 ml-0.5">
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 动态渲染对应列表 */}
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {mineData[mineTab].length > 0 ? (
                    renderGrid(mineData[mineTab])
                  ) : (
                    <div className="text-center py-16 text-muted-foreground text-sm tracking-widest">
                      空空如也~
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-4 pb-24">
            {renderGrid(items)}
            <div
              ref={observerTarget}
              className="h-12 w-full mt-6 flex items-center justify-center opacity-80"
            >
              {isFetching && !loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>加载中...</span>
                </div>
              )}
              {!hasMore && items.length > 0 && (
                <span className="text-xs text-muted-foreground/50 tracking-wide uppercase">
                  没有更多了-_-
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
  if (count >= 10000) return `${(count / 10000).toFixed(0)}万`;
  return count;
}
