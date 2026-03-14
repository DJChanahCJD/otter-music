import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { MusicCover } from "@/components/MusicCover";
import { getArtistAlbums } from "@/lib/netease/netease-api";
import { ArtistAlbum } from "@/lib/netease/netease-raw-types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface ArtistAlbumSheetProps {
  artistId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  artistName?: string;
}

const PAGE_LIMIT = 20;
const SESSION_PROGRESS_PREFIX = "artist-album-flow:";
const ITEM_WIDTH = 192; // w-44 (176px) + gap-4 (16px)

type AlbumDrawerProgress = { flowLeft: number; selectedAlbumId: number | null };
const DEFAULT_PROGRESS: AlbumDrawerProgress = { flowLeft: 0, selectedAlbumId: null };

const readProgress = (key: string): AlbumDrawerProgress => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || "");
    return { flowLeft: Number(parsed.flowLeft || 0), selectedAlbumId: parsed.selectedAlbumId ? Number(parsed.selectedAlbumId) : null };
  } catch {
    return DEFAULT_PROGRESS;
  }
};

export function ArtistAlbumSheet({ artistId, isOpen, onOpenChange, artistName }: ArtistAlbumSheetProps) {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<ArtistAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);

  const flowRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<AlbumDrawerProgress>(DEFAULT_PROGRESS);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const hasRestoredRef = useRef(false);

  const progressKey = useMemo(() => (artistId ? `${SESSION_PROGRESS_PREFIX}${artistId}` : ""), [artistId]);

  const schedulePersist = useCallback((patch: Partial<AlbumDrawerProgress>) => {
    if (!progressKey) return;
    Object.assign(progressRef.current, patch);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      sessionStorage.setItem(progressKey, JSON.stringify(progressRef.current));
    }, 150);
  }, [progressKey]);

  const fetchAlbums = useCallback(async (isLoadMore = false) => {
    if (!artistId) return;
    const currentOffset = isLoadMore ? offset : 0;
    
    isLoadMore ? setLoadingMore(true) : setLoading(true);
    try {
      const res = await getArtistAlbums(artistId, PAGE_LIMIT, currentOffset);
      if (res?.hotAlbums) {
        setAlbums(prev => {
          const newData = isLoadMore ? [...prev, ...res.hotAlbums] : res.hotAlbums;
          // Map 去重，保证渲染稳定
          return Array.from(new Map(newData.map(item => [item.id, item])).values());
        });
        setHasMore(res.more);
        setOffset(currentOffset + PAGE_LIMIT);
      }
    } catch (error) {
      console.error("Fetch albums failed:", error);
    } finally {
      isLoadMore ? setLoadingMore(false) : setLoading(false);
    }
  }, [artistId, offset]);

  // 统一管理初始化与恢复逻辑
  useEffect(() => {
    if (!isOpen) {
      hasRestoredRef.current = false;
      return;
    }
    if (artistId && !hasRestoredRef.current) {
      const cached = readProgress(progressKey);
      progressRef.current = cached;
      setSelectedAlbumId(cached.selectedAlbumId);
      fetchAlbums(false);
    }
  }, [isOpen, artistId, progressKey, fetchAlbums]);

  // 恢复滚动位置
  useEffect(() => {
    if (isOpen && albums.length > 0 && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      requestAnimationFrame(() => {
        if (flowRef.current) {
          flowRef.current.scrollTo({ left: progressRef.current.flowLeft, behavior: "instant" });
        }
      });
    }
  }, [isOpen, albums.length]);

  // 组件卸载清理定时器
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const handleFlowScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollLeft, scrollWidth, clientWidth } = target;
    
    schedulePersist({ flowLeft: scrollLeft });

    // 触底加载更多
    if (hasMore && !loadingMore && scrollWidth - scrollLeft - clientWidth < 150) {
      fetchAlbums(true);
    }

    // 核心优化：O(1) 纯数学计算当前激活项，彻底抛弃 DOM 遍历
    if (albums.length > 0) {
      const activeIndex = Math.max(0, Math.min(albums.length - 1, Math.round(scrollLeft / ITEM_WIDTH)));
      const nearestId = albums[activeIndex]?.id;

      if (nearestId && nearestId !== selectedAlbumId) {
        setSelectedAlbumId(nearestId as number);
        schedulePersist({ selectedAlbumId: nearestId as number });
      }
    }
  }, [albums, hasMore, loadingMore, selectedAlbumId, fetchAlbums, schedulePersist]);

  const handleAlbumClick = (albumId: number | null) => {
    setSelectedAlbumId(albumId);
    schedulePersist({ selectedAlbumId: albumId });
    onOpenChange(false);
    navigate(`/netease-album/${albumId}`);
  };

  const selectedIndex = Math.max(0, albums.findIndex(a => a.id === selectedAlbumId));
  const activeAlbum = albums[selectedIndex] || albums[0];

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="border-none rounded-t-[28px] bg-background/95 backdrop-blur-xl pb-10">
        <DrawerHeader className="px-6 pb-6 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {artistName ? `${artistName} · 专辑` : "专辑"}
          </DrawerTitle>
        </DrawerHeader>

        {loading && albums.length === 0 ? (
          <div className="flex justify-center items-center h-44 opacity-50">
            <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
          </div>
        ) : albums.length > 0 ? (
          <div className="flex flex-col items-center">
            {/* 3D 封面流 */}
            <div
              ref={flowRef}
              onScroll={handleFlowScroll}
              className="flex items-center gap-4 overflow-x-auto snap-x snap-mandatory px-[calc(50%-88px)] w-full py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {albums.map((album, index) => {
                const relative = index - selectedIndex;
                const isCenter = relative === 0;
                
                return (
                  <button
                    key={album.id}
                    onClick={() => handleAlbumClick(album.id as number)}
                    className={cn(
                      "w-44 shrink-0 snap-center rounded-2xl transition-all duration-500 ease-out z-20",
                      isCenter 
                        ? "scale-100 opacity-100 z-30 transform-none" 
                        : `scale-[0.84] opacity-45 [transform:perspective(900px)_rotateY(${relative < 0 ? 26 : -26}deg)]`
                    )}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-2xl shadow-lg">
                      <MusicCover src={album.picUrl} alt={album.name} className="h-full w-full object-cover" />
                    </div>
                  </button>
                );
              })}
              
              {hasMore && (
                <div className="w-16 shrink-0 flex justify-center items-center h-44 opacity-50">
                   {loadingMore && <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />}
                </div>
              )}
            </div>

            {/* 专辑信息展示 (固定高度) */}
            <div className="mt-4 px-8 text-center flex flex-col justify-start min-h-20 w-full">
              {activeAlbum && (
                <div>
                  <h3 className="line-clamp-2 text-lg font-bold leading-tight text-foreground/90">
                    {activeAlbum.name}
                  </h3>
                  <p className="mt-2 text-sm font-medium tracking-[0.2em] text-muted-foreground/60">
                    {format(activeAlbum.publishTime, "yyyy-MM-dd")}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-20 text-sm tracking-widest text-muted-foreground/40">
            暂无专辑数据
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}