import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { 
  getRecommendPlaylists,
  getUserPlaylists,
  getSubscribedAlbums,
} from "@/lib/netease/netease-api";
import type { ArtistAlbum } from "@/lib/netease/netease-types";
import { MusicCover } from "@/components/MusicCover";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useMusicStore, type MusicState } from "@/store/music-store";
import { useMarketSession } from "@/store/session/market-session";
import { PlaylistGrid } from "./PlaylistGrid";
import { useNeteaseStore } from "@/store/netease-store";
import { logger } from "@/lib/logger";

const SUB_TAB_HEIGHT = "h-8";

interface MineTabConfig {
  id: MusicState["lastMineTab"];
  label: string;
  count?: number;
  content: React.ReactNode;
  action?: React.ReactNode;
}

function useMineData() {
  const mineTab = useMusicStore((s) => s.lastMineTab);
  const setMineTab = useMusicStore((s) => s.setLastMineTab);
  const { mineData, setMineData } = useMarketSession();
  const { cookie, user } = useNeteaseStore();
  const currentUserId = user?.userId ?? null;
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMoreAlbums = async () => {
    if (!cookie || loadingMore || !mineData.hasMoreAlbums) return;
    
    try {
      setLoadingMore(true);
      const limit = 50;
      const offset = mineData.albums?.length || 0;
      const newAlbums = await getSubscribedAlbums(limit, offset, cookie);
      
      setMineData((prev) => ({
        ...prev,
        albums: [...(prev.albums || []), ...newAlbums],
        hasMoreAlbums: newAlbums.length >= limit,
      }));
    } catch (err) {
      logger.error("MineSection", "Load more subscribed albums failed", err, {
        tab: mineTab,
        loadedCount: mineData.albums?.length ?? 0,
      });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const fetchMineData = async () => {
      if (!cookie) return;

      if (mineTab === "recommend" && mineData.recommend) return;
      if ((mineTab === "created" || mineTab === "subscribed") && mineData.created) return;
      if (mineTab === "albums" && mineData.albums) return;

      try {
        setLoading(true);

        if (mineTab === "recommend" && !mineData.recommend) {
          const recommend = await getRecommendPlaylists(cookie).catch(() => []);
          setMineData((prev) => ({ ...prev, recommend }));
        } else if ((mineTab === "created" || mineTab === "subscribed") && !mineData.created) {
          if (!currentUserId) return;
          const userPlaylists = await getUserPlaylists(String(currentUserId), cookie);
          setMineData((prev) => ({
            ...prev,
            created: userPlaylists.filter((p) => p.userId === String(currentUserId)),
            subscribed: userPlaylists.filter((p) => p.userId !== String(currentUserId)),
          }));
        } else if (mineTab === "albums" && !mineData.albums) {
          const limit = 50;
          const albums = await getSubscribedAlbums(limit, 0, cookie).catch(() => []);
          setMineData((prev) => ({ 
            ...prev, 
            albums,
            hasMoreAlbums: albums.length >= limit 
          }));
        }
      } catch (err) {
        logger.error("MineSection", "Mine data load failed", err, {
          tab: mineTab,
          hasCookie: Boolean(cookie),
          currentUserId,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMineData();
  }, [mineTab, currentUserId, cookie, mineData.recommend, mineData.created, mineData.albums, setMineData]);

  return {
    mineTab,
    setMineTab,
    mineData,
    loading,
    loadingMore,
    loadMoreAlbums,
    currentUserId,
  };
}

function LoginPrompt() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
      <p className="text-sm">请先登录网易云账号以查看歌单</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>前往设置</Button>
    </div>
  );
}

function EmptyState({ text = "空空如也~", action }: { text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
      <p className={cn("text-sm", !action && "tracking-widest")}>{text}</p>
      {action}
    </div>
  );
}

const AlbumGrid = ({ list, onClick }: { list: ArtistAlbum[]; onClick: (id: string | number) => void }) => (
  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-4">
    {list.map((item) => (
      <div 
        key={item.id} 
        className="group flex flex-col gap-2.5 transition-all hover:translate-y-[-4px]" 
        onClick={() => onClick(item.id)}
      >
        <div className="relative aspect-square rounded-md overflow-hidden shadow-md ring-1 ring-black/5 hover:shadow-xl transition-shadow cursor-pointer">
          <MusicCover 
            src={item.picUrl} 
            alt={item.name} 
            className="transition-transform duration-500 group-hover:scale-110" 
          />
        </div>
        <div className="px-0.5 flex flex-col gap-0.5">
          <h3 className="text-[13px] font-medium leading-snug line-clamp-2 text-foreground/80 group-hover:text-primary transition-colors cursor-pointer">
            {item.name}
          </h3>
          <span className="text-[11px] text-muted-foreground/60 tracking-wider">
            {item.artist?.name}
          </span>
        </div>
      </div>
    ))}
  </div>
);

export function MineSection() {
  const navigate = useNavigate();
  const { mineTab, setMineTab, mineData, loading, loadingMore, loadMoreAlbums, currentUserId } = useMineData();

  // Tab Configurations
  const tabs: MineTabConfig[] = useMemo(() => [
    {
      id: "recommend",
      label: "推荐",
      count: mineData.recommend?.length,
      content: !currentUserId ? <LoginPrompt /> : (
        (mineData.recommend && mineData.recommend.length > 0) ? (
          <PlaylistGrid list={mineData.recommend} onClick={(id) => navigate(`/netease-playlist/${id}`)} />
        ) : <EmptyState />
      )
    },
    {
      id: "created",
      label: "创建",
      count: mineData.created?.length,
      content: !currentUserId ? <LoginPrompt /> : (
        (mineData.created && mineData.created.length > 0) ? (
          <PlaylistGrid list={mineData.created} onClick={(id) => navigate(`/netease-playlist/${id}`)} />
        ) : <EmptyState />
      )
    },
    {
      id: "subscribed",
      label: "收藏",
      count: mineData.subscribed?.length,
      content: !currentUserId ? <LoginPrompt /> : (
        (mineData.subscribed && mineData.subscribed.length > 0) ? (
          <PlaylistGrid list={mineData.subscribed} onClick={(id) => navigate(`/netease-playlist/${id}`)} />
        ) : <EmptyState />
      )
    },
    {
      id: "albums",
      label: "专辑",
      count: mineData.albums?.length,
      content: !currentUserId ? <LoginPrompt /> : (
        (mineData.albums && mineData.albums.length > 0) ? (
          <div className="space-y-6">
            <AlbumGrid list={mineData.albums} onClick={(id) => navigate(`/netease-album/${id}`)} />
            {mineData.hasMoreAlbums && (
              <div className="flex justify-center py-4">
                <Button 
                  variant="ghost" 
                  onClick={loadMoreAlbums} 
                  disabled={loadingMore}
                  className="w-full max-w-[200px]"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {loadingMore ? "加载中..." : "加载更多"}
                </Button>
              </div>
            )}
          </div>
        ) : <EmptyState />
      )
    },
  ], [mineData, currentUserId, navigate, loadingMore, loadMoreAlbums]);

  const activeTabConfig = tabs.find(t => t.id === mineTab) || tabs[0];
  const isDataReady = !!mineData[mineTab as keyof typeof mineData];

  return (
    <div className="p-4 pb-24 space-y-6">
      <div className={cn("flex items-center justify-between mb-4 px-1 relative", SUB_TAB_HEIGHT)}>
        <div className="flex items-center gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMineTab(tab.id)}
              className={cn(
                "text-[15px] transition-all whitespace-nowrap",
                mineTab === tab.id ? "font-bold text-foreground tracking-wide" : "font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label} {tab.count !== undefined && <span className="text-xs opacity-60 ml-0.5">{tab.count}</span>}
            </button>
          ))}
        </div>
        {/* Action Button Area */}
        <div className="transition-opacity animate-in fade-in duration-200">
          {activeTabConfig.action}
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {loading && !isDataReady ? (
          <div className="h-60 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          activeTabConfig.content
        )}
      </div>
    </div>
  );
}
