import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { neteaseApi } from '@/lib/api/netease';
import { RECOMMEND_FILTERS, ALL_FILTERS } from './netease/constants';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NeteasePlaylist, Toplist } from '@/types/netease';

const PAGE_SIZE = 30;

// 1. 抽离通用卡片组件，大幅减少重复代码并提升渲染性能
const MediaCard = memo(({ item, isToplist, onClick }: { item: NeteasePlaylist | Toplist, isToplist: boolean, onClick: (p: NeteasePlaylist | Toplist) => void }) => (
  <div className="cursor-pointer group space-y-1.5" onClick={() => onClick(item)}>
    <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
      <img src={item.coverImgUrl} alt={item.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" loading="lazy" />
      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
      
      {isToplist ? (
        <div className="absolute bottom-1.5 right-1.5 text-[10px] text-white bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-md">
          {(item as Toplist).updateFrequency}
        </div>
      ) : (
        <>
          <div className="absolute top-1.5 right-1.5 text-[10px] text-white bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-md flex items-center gap-0.5">
            <span className="text-[8px]">▶</span> {formatPlayCount(item.playCount || 0)}
          </div>
          <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <div className="text-[10px] text-white/90 truncate">{(item as NeteasePlaylist).creator?.nickname}</div>
          </div>
        </>
      )}
    </div>
    <p className="text-xs sm:text-sm font-medium line-clamp-2 leading-tight group-hover:text-primary transition-colors">
      {item.name}
    </p>
  </div>
));
MediaCard.displayName = 'MediaCard';

export function NetEaseDiscoverView({ cookie, onPlaylistClick }: { cookie: string, onPlaylistClick: (p: NeteasePlaylist | Toplist) => void }) {
  const [selectedCategory, setSelectedCategory] = useState({ id: '', name: '全部' });
  const [data, setData] = useState<(NeteasePlaylist | Toplist)[]>([]); // 合并数据源
  const [status, setStatus] = useState<'idle' | 'loading' | 'loadingMore'>('idle');
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isToplist = selectedCategory.id === 'toplist';

  const loadInitialData = useCallback(async () => {
    setStatus('loading');
    setData([]);
    setOffset(0);
    setHasMore(true);
    
    try {
      if (isToplist) {
        const topRes = await neteaseApi.getToplist(cookie).catch(() => null);
        if (topRes?.data?.list) {
          setData(topRes.data.list);
          setHasMore(false);
        }
      } else {
        const plRes = await neteaseApi.getPlaylists(selectedCategory.id || '全部', undefined, PAGE_SIZE, 0, cookie).catch(() => null);
        if (plRes?.data?.playlists) {
          setData(plRes.data.playlists);
          setOffset(PAGE_SIZE);
          setHasMore(plRes.data.playlists.length >= PAGE_SIZE);
        }
      }
    } catch {
      toast.error('数据加载失败');
    } finally {
      setStatus('idle');
    }
  }, [cookie, isToplist, selectedCategory.id]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const loadMore = useCallback(async () => {
    if (status !== 'idle' || !hasMore || isToplist) return;

    setStatus('loadingMore');
    try {
      const plRes = await neteaseApi.getPlaylists(selectedCategory.id || '全部', undefined, PAGE_SIZE, offset, cookie).catch(() => null);
      if (plRes?.data?.playlists) {
        const newPlaylists = plRes.data.playlists || [];
        if (newPlaylists.length > 0) {
          setData(prev => [...prev, ...newPlaylists]);
          setOffset(prev => prev + newPlaylists.length);
          setHasMore(newPlaylists.length >= PAGE_SIZE);
        } else {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch {
      toast.error('加载更多失败');
      setHasMore(false);
    } finally {
      setStatus('idle');
    }
  }, [cookie, hasMore, status, offset, selectedCategory.id, isToplist]);

  // 优化 IntersectionObserver 性能
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && loadMore(),
      { root: viewportRef.current, rootMargin: '100px', threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 分类导航栏 (隐藏滚动条，保持清爽) */}
      <div className="flex items-center px-3 py-2 border-b gap-2 shrink-0 bg-background/90 backdrop-blur-md z-10 sticky top-0">
        <ScrollArea className="w-full whitespace-nowrap **:data-radix-scroll-area-scrollbar:hidden">
          <div className="flex w-max space-x-1.5 pb-1 pt-1 items-center">
            {RECOMMEND_FILTERS.map((filter) => {
              const isActive = selectedCategory.name === filter.name;
              return (
                <Button
                  key={filter.id}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-7 px-3 text-xs rounded-full transition-all ${isActive ? "font-medium bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
                  onClick={() => { setSelectedCategory(filter); setIsOpen(false); }}
                >
                  {filter.name}
                </Button>
              );
            })}
            
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-3 text-xs rounded-full text-muted-foreground flex items-center gap-1">
                  更多 <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              {/* 移动端适配：限制最大宽度为屏幕宽度减去边距 */}
              <PopoverContent className="w-[calc(100vw-24px)] sm:w-[500px] p-4 rounded-xl shadow-xl" align="end">
                <ScrollArea className="h-[50vh] sm:max-h-[400px] pr-3">
                  <div className="grid gap-5">
                    {ALL_FILTERS.map((group) => (
                      <div key={group.category} className="space-y-2.5">
                        <h4 className="font-semibold text-xs text-foreground/70">{group.category}</h4>
                        <div className="flex flex-wrap gap-2">
                          {group.filters.map((filter) => (
                            <Button
                              key={filter.id}
                              variant={selectedCategory.name === filter.name ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-xs rounded-full px-3"
                              onClick={() => { setSelectedCategory(filter); setIsOpen(false); }}
                            >
                              {filter.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full" viewportRef={viewportRef}>
          <div className="p-3 sm:p-4 min-h-[200px]">
            {status === 'loading' ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
              </div>
            ) : data.length > 0 ? (
              <>
                {/* 移动端间距 gap-3，PC端 gap-4 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {data.map((item) => (
                    <MediaCard key={item.id} item={item} isToplist={isToplist} onClick={onPlaylistClick} />
                  ))}
                </div>

                {/* 加载更多指示器 */}
                {!isToplist && (
                  <div ref={loadMoreRef} className="py-8 flex justify-center w-full">
                    {status === 'loadingMore' ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      !hasMore && <p className="text-xs text-muted-foreground/60">到底啦~</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60 text-sm">
                暂无内容
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function formatPlayCount(count: number) {
  if (count > 100000000) return (count / 100000000).toFixed(1) + '亿';
  if (count > 10000) return (count / 10000).toFixed(1) + '万';
  return count;
}