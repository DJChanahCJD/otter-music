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

type AlbumDrawerProgress = {
  flowLeft: number;
  selectedAlbumId: number | null;
};

const DEFAULT_PROGRESS: AlbumDrawerProgress = {
  flowLeft: 0,
  selectedAlbumId: null,
};

const readProgress = (key: string): AlbumDrawerProgress => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw);
    return {
      flowLeft: Number(parsed.flowLeft || 0),
      selectedAlbumId: parsed.selectedAlbumId ? Number(parsed.selectedAlbumId) : null,
    };
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
  const flowScrollRafRef = useRef<number | undefined>(undefined);
  const selectionFeedbackAtRef = useRef(0);
  const hasRestoredRef = useRef(false);

  const progressKey = useMemo(() => (artistId ? `${SESSION_PROGRESS_PREFIX}${artistId}` : ""), [artistId]);

  const persistProgress = useCallback((patch: Partial<AlbumDrawerProgress>) => {
    if (!progressKey) return;
    progressRef.current = { ...progressRef.current, ...patch };
    sessionStorage.setItem(progressKey, JSON.stringify(progressRef.current));
  }, [progressKey]);

  const schedulePersist = useCallback((patch: Partial<AlbumDrawerProgress>) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => persistProgress(patch), 150);
  }, [persistProgress]);

  const fetchAlbums = useCallback(async (isLoadMore = false) => {
    if (!artistId) return;
    isLoadMore ? setLoadingMore(true) : setLoading(true);

    try {
      const currentOffset = isLoadMore ? offset : 0;
      const res = await getArtistAlbums(artistId, PAGE_LIMIT, currentOffset);
      if (res?.hotAlbums) {
        setAlbums((prev) => (isLoadMore ? [...prev, ...res.hotAlbums] : res.hotAlbums));
        setHasMore(res.more);
        setOffset(currentOffset + PAGE_LIMIT);
      }
    } catch (error) {
      console.error("Fetch albums failed:", error);
    } finally {
      isLoadMore ? setLoadingMore(false) : setLoading(false);
    }
  }, [artistId, offset]);

  // 初始化加载 & 状态重置
  useEffect(() => {
    if (!isOpen) return;
    
    if (!hasRestoredRef.current && artistId) {
      const cached = readProgress(progressKey);
      progressRef.current = cached;
      setSelectedAlbumId(cached.selectedAlbumId);
      fetchAlbums(false);
    }
  }, [isOpen, artistId, progressKey, fetchAlbums]);

  // 重置标记
  useEffect(() => {
    if (!isOpen) hasRestoredRef.current = false;
  }, [isOpen]);

  // 恢复横向滚动位置
  useEffect(() => {
    if (isOpen && albums.length > 0 && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      requestAnimationFrame(() => {
        if (flowRef.current) {
          flowRef.current.scrollTo({ left: progressRef.current.flowLeft, behavior: "instant" as ScrollBehavior });
        }
      });
    }
  }, [isOpen, albums]);

  // 中心对齐计算与震动反馈
  const syncSelectedByFlowCenter = useCallback(() => {
    const container = flowRef.current;
    if (!container || albums.length === 0) return;
    const cards = Array.from(container.querySelectorAll<HTMLButtonElement>("[data-album-id]"));
    if (!cards.length) return;

    const center = container.scrollLeft + container.clientWidth / 2;
    let nearestId = selectedAlbumId;
    let nearestDist = Infinity;

    cards.forEach((card) => {
      const id = Number(card.dataset.albumId);
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const dist = Math.abs(cardCenter - center);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = id;
      }
    });

    if (nearestId && nearestId !== selectedAlbumId) {
      setSelectedAlbumId(nearestId);
      persistProgress({ selectedAlbumId: nearestId });
      
      const now = Date.now();
      if (now - selectionFeedbackAtRef.current > 150) {
        selectionFeedbackAtRef.current = now;
      }
    }
  }, [albums, persistProgress, selectedAlbumId]);

  // 监听横向滚动，包含无限加载逻辑
  const handleFlowScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    schedulePersist({ flowLeft: target.scrollLeft });

    // 触底加载更多 (距离右侧剩余 150px 时触发)
    if (hasMore && !loadingMore && target.scrollWidth - target.scrollLeft - target.clientWidth < 150) {
      fetchAlbums(true);
    }

    if (flowScrollRafRef.current) cancelAnimationFrame(flowScrollRafRef.current);
    flowScrollRafRef.current = requestAnimationFrame(syncSelectedByFlowCenter);
  }, [schedulePersist, syncSelectedByFlowCenter, hasMore, loadingMore, fetchAlbums]);

  // 清理 Timer
  useEffect(() => {
    return () => {
      cancelAnimationFrame(flowScrollRafRef.current!);
      clearTimeout(saveTimerRef.current!);
    };
  }, []);

  const handleAlbumClick = (albumId: number | string) => {
    const id = Number(albumId);
    setSelectedAlbumId(id);
    persistProgress({ selectedAlbumId: id });
    onOpenChange(false);
    navigate(`/netease-album/${id}`);
  };

  const selectedIndex = albums.findIndex((a) => a.id === selectedAlbumId);
  const activeAlbum = selectedIndex >= 0 ? albums[selectedIndex] : albums[0];

  const getCoverFlowClass = (index: number) => {
    const relative = index - selectedIndex;
    if (relative === 0) return "scale-100 opacity-100 z-30 [transform:perspective(900px)_rotateY(0deg)]";
    return `scale-[0.84] opacity-45 z-20 [transform:perspective(900px)_rotateY(${relative < 0 ? 26 : -26}deg)]`;
  };

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} direction="bottom">
      {/* 移除了固定高度，让内容自适应撑开 */}
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
              {albums.map((album, index) => (
                <button
                  key={album.id}
                  data-album-id={album.id}
                  onClick={() => handleAlbumClick(album.id)}
                  className={cn(
                    "w-44 shrink-0 snap-center rounded-2xl transition-all duration-500 ease-out",
                    getCoverFlowClass(index)
                  )}
                >
                  <div className="relative aspect-square overflow-hidden rounded-2xl shadow-[0_18px_40px_-24px_rgba(0,0,0,.8)]">
                    <MusicCover src={album.picUrl} alt={album.name} className="h-full w-full object-cover" />
                  </div>
                </button>
              ))}
              
              {/* 横向无限加载指示器 */}
              {hasMore && (
                <div className="w-16 shrink-0 flex justify-center items-center h-44 opacity-50">
                   {loadingMore && <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />}
                </div>
              )}
            </div>

            {/* 选中专辑的信息展示 */}
            {activeAlbum && (
              <div className="mt-4 px-8 text-center animate-in fade-in zoom-in-95 duration-300">
                <h3 className="line-clamp-2 text-lg font-bold leading-tight text-foreground/90">
                  {activeAlbum.name}
                </h3>
                <p className="mt-2 text-sm font-medium tracking-[0.2em] text-muted-foreground/60">
                  {format(activeAlbum.publishTime, "yyyy-MM-dd")}
                </p>
              </div>
            )}
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