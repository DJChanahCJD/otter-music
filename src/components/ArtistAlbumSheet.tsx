import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
  albumCount?: number;
}

const PAGE_LIMIT = 30;
const SESSION_PREFIX = "artist-album-flow:";

export function ArtistAlbumSheet({
  artistId,
  isOpen,
  onOpenChange,
  artistName,
  albumCount,
}: ArtistAlbumSheetProps) {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<ArtistAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollSaveTimer = useRef<NodeJS.Timeout>(undefined);

  const cacheKey = artistId ? `${SESSION_PREFIX}${artistId}` : null;

  // 1. 初始化与数据恢复 (仅在 artistId 切换时执行一次)
  useEffect(() => {
    if (!cacheKey) return;
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "{}");
      if (cached.albums?.length) {
        setAlbums(cached.albums);
        setOffset(cached.offset);
        setHasMore(cached.hasMore);
        return;
      }
    } catch (e) {
      console.error("Parse cache failed", e);
    }
    // 无缓存或解析失败，重置状态
    setAlbums([]);
    setOffset(0);
    setHasMore(true);
  }, [cacheKey]);

  // 2. 优雅的滚动位置恢复 (依赖 isOpen 和数据就绪)
  useEffect(() => {
    if (!isOpen || !cacheKey || albums.length === 0) return;

    try {
      const { scrollTop } = JSON.parse(
        sessionStorage.getItem(cacheKey) || "{}",
      );
      if (scrollTop) {
        // 延迟 50ms 等待 Drawer 布局就绪，使用 instant 瞬间归位
        const timer = setTimeout(() => {
          scrollRef.current?.scrollTo({ top: scrollTop, behavior: "instant" });
        }, 50);
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error("Parse scrollTop failed", error);
    }
  }, [isOpen, albums.length, cacheKey]);

  // 3. 核心获取逻辑
  const fetchAlbums = useCallback(
    async (isLoadMore = false) => {
      if (!artistId || !cacheKey) return;
      const currentOffset = isLoadMore ? offset : 0;

      isLoadMore ? setLoadingMore(true) : setLoading(true);
      try {
        const res = await getArtistAlbums(artistId, PAGE_LIMIT, currentOffset);
        if (res?.hotAlbums) {
          setAlbums((prev) => {
            const newData = isLoadMore
              ? [...prev, ...res.hotAlbums]
              : res.hotAlbums;
            const uniqueData = Array.from(
              new Map(newData.map((item) => [item.id, item])).values(),
            );

            // 更新数据时同步更新缓存
            const existingCache = JSON.parse(
              sessionStorage.getItem(cacheKey) || "{}",
            );
            sessionStorage.setItem(
              cacheKey,
              JSON.stringify({
                ...existingCache,
                albums: uniqueData,
                offset: currentOffset + PAGE_LIMIT,
                hasMore: res.more,
              }),
            );

            return uniqueData;
          });
          setHasMore(res.more);
          setOffset(currentOffset + PAGE_LIMIT);
        }
      } catch (error) {
        console.error("Fetch albums failed:", error);
      } finally {
        isLoadMore ? setLoadingMore(false) : setLoading(false);
      }
    },
    [artistId, offset, cacheKey],
  );

  // 4. 打开时如果没数据则加载
  useEffect(() => {
    if (isOpen && albums.length === 0 && hasMore) {
      fetchAlbums(false);
    }
  }, [isOpen, albums.length, hasMore, fetchAlbums]);

  // 5. 滚动监听：触底加载 + 防抖记录进度
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    // 防抖记录滚动位置 (200ms)
    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      if (!cacheKey) return;
      try {
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "{}");
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ ...cached, scrollTop }),
        );
      } catch (error) {
        console.error("Save scrollTop failed", error);
      }
    }, 200);

    // 触底检测
    if (
      hasMore &&
      !loadingMore &&
      scrollHeight - scrollTop - clientHeight < 150
    ) {
      fetchAlbums(true);
    }
  };

  const handleAlbumClick = (albumId: number) => {
    onOpenChange(false);
    navigate(`/netease-album/${albumId}`);
  };

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="border-none rounded-t-[28px] bg-background/95 backdrop-blur-xl max-h-[85vh]">
        <DrawerHeader className="px-6 pt-6 pb-2 text-left flex justify-between">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {artistName}
          </DrawerTitle>
          {albumCount !== undefined && albums.length > 0 && (
            <span className="text-xs font-mono text-muted-foreground/60 mb-1">
              {albumCount} ALBUMS
            </span>
          )}
        </DrawerHeader>

        <div
          ref={scrollRef}
          className="overflow-y-auto px-4 pb-12 pt-4 [scrollbar-width:none]"
          onScroll={handleScroll}
        >
          {loading && albums.length === 0 ? (
            <div className="flex justify-center items-center h-44 opacity-50">
              <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
            </div>
          ) : albums.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-6">
              {albums.map((album, index) => (
                <button
                  key={album.id}
                  onClick={() => handleAlbumClick(album.id as number)}
                  className={cn(
                    "group flex flex-col gap-2 text-left outline-none animate-in fade-in slide-in-from-bottom-4 fill-mode-both",
                    "hover:translate-y-[-4px] transition-all",
                  )}
                  style={{ animationDelay: `${(index % PAGE_LIMIT) * 30}ms` }}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow-sm transition-all duration-300 group-active:scale-95 group-hover:shadow-xl ring-1 ring-black/5">
                    <MusicCover
                      src={album.picUrl}
                      alt={album.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  <div className="px-0.5 flex flex-col gap-0.5">
                    <h4 className="text-[13px] font-medium leading-tight line-clamp-2 text-foreground/80 group-hover:text-primary transition-colors">
                      {album.name}
                    </h4>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                      {format(album.publishTime, "yyyy-MM-dd")}
                    </p>
                  </div>
                </button>
              ))}

              {loadingMore ? (
                <div className="col-span-full flex justify-center py-6">
                  <Loader2 className="animate-spin h-5 w-5 text-primary/40" />
                </div>
              ) : (
                !hasMore &&
                albums.length > 0 && (
                  <div className="col-span-full text-center text-[11px] font-medium tracking-[0.2em] text-muted-foreground/30 uppercase">
                    － End of Collection －
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="flex justify-center py-20 text-sm tracking-widest text-muted-foreground/40">
              暂无专辑数据
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
