import { useMemo, useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import {
  ListChecks, Plus, Heart, Download, Trash2, ListMusic,
  Loader2, Search, Check, MoreVertical,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MusicTrackItem } from "./MusicTrackItem";
import { downloadMusicTrack, buildDownloadKey } from "@/lib/utils/download";
import { useMusicStore } from "@/store/music-store";
import { useActivePlaylists } from "@/hooks/use-active-playlists";
import { useDownloadStore } from "@/store/download-store";
import { MusicTrack } from "@/types/music";
import toast from "react-hot-toast";
import { processBatchCPU, processBatchIO } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow";

interface MusicTrackListProps {
  tracks: MusicTrack[];
  onPlay: (track: MusicTrack) => void;
  playlistId?: string;
  currentTrackId?: string;
  isPlaying?: boolean;
  onRemove?: (track: MusicTrack, silent?: boolean) => void | Promise<void>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  removeLabel?: string;
  showSourceBadge?: boolean;
}

const ROW_HEIGHT = 48; // 缩小默认估算行高

export function MusicTrackList({
  tracks, onPlay, playlistId, currentTrackId, isPlaying,
  onRemove, onLoadMore, hasMore, loading,
  emptyMessage = "暂无歌曲", removeLabel = "移除",
  showSourceBadge = true,
}: MusicTrackListProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const internalRef = useRef<HTMLDivElement | null>(null);

  const { addToFavorites, addToPlaylist, createPlaylist, addToNextPlay, quality } = useMusicStore(
    useShallow((state) => ({
      addToFavorites: state.addToFavorites,
      addToPlaylist: state.addToPlaylist,
      createPlaylist: state.createPlaylist,
      addToNextPlay: state.addToNextPlay,
      quality: state.quality,
    }))
  );
  const playlists = useActivePlaylists();

  const records = useDownloadStore((state) => state.records);

  const downloadedStatusMap = useMemo(() => {
    return new Map(tracks.map(track => [
      track.id,
      !!records[buildDownloadKey(track.source, track.id || "")]
    ]));
  }, [records, tracks]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(selectedIds.size === tracks.length ? new Set() : new Set(tracks.map((t) => t.id)));
  }, [selectedIds.size, tracks]);

  const resetSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const getSelectedTracks = useCallback(() => tracks.filter((t) => selectedIds.has(t.id)), [tracks, selectedIds]);

  const handleBatch = async (fn: (t: MusicTrack) => void, tip?: string) => {
    const selected = getSelectedTracks();
    const toastId = toast.loading(`处理中 0/${selected.length}`);
    await processBatchCPU(selected, fn, (current, total) => toast.loading(`处理中 ${current}/${total}`, { id: toastId }));
    tip ? toast.success(`${tip} ${selected.length} 首`, { id: toastId }) : toast.dismiss(toastId);
    resetSelection();
  };

  const handleBatchRemove = async () => {
    if (!onRemove) return;
    const count = selectedIds.size;
    if (!confirm(`确定${removeLabel}选中的 ${count} 首歌曲吗？`)) return;
    
    const toastId = toast.loading(`${removeLabel}中 0/${count}`);
    await processBatchCPU(getSelectedTracks(), (t) => onRemove(t, true), (c, t) => toast.loading(`${removeLabel}中 ${c}/${t}`, { id: toastId }));
    toast.success(`已${removeLabel} ${count} 首`, { id: toastId });
    resetSelection();
  };

  const handleBatchDownload = async () => {
    const selected = getSelectedTracks();
    const toastId = toast.loading(`准备下载 0/${selected.length}`);
    await processBatchIO(
      selected,
      async (track) => {
        await downloadMusicTrack(track, parseInt(quality));
      },
      (c, t) => toast.loading(`下载中 ${c}/${t}`, { id: toastId }),
      1
    );
    resetSelection();
  };

  const handleCreatePlaylist = () => {
    const name = window.prompt("输入歌单名称");
    if (!name) return;
    const id = createPlaylist(name);
    selectedIds.size > 0 
      ? handleBatch((t) => addToPlaylist(id, t), `已添加到「${name}」`)
      : toast.success("已创建歌单");
  };

  const virtualizer = useVirtualizer({
    count: tracks.length + 1,
    getScrollElement: () => internalRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  if (tracks.length === 0 && !loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground/60">
        <Search className="h-8 w-8 mb-3 opacity-20" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  const renderHeader = () => (
    <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      {/* 调整为 h-10, px-3, gap-3, text-xs */}
      <div className="grid items-center gap-4 px-4 h-10 text-xs text-muted-foreground grid-cols-[1.75rem_1fr_auto]">
        {!isSelectionMode ? (
          <>
            <div className="text-center">#</div>
            <div>标题</div>
            <div className="flex justify-end">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsSelectionMode(true)}>
                <ListChecks className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <Checkbox checked={selectedIds.size > 0 && selectedIds.size === tracks.length} onCheckedChange={toggleSelectAll} />
            </div>
            <div className="flex items-center min-w-0 justify-between">
              <span className="text-foreground">已选 {selectedIds.size} 首</span>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => handleBatch(addToNextPlay, "已添加")} disabled={selectedIds.size === 0}>
                  <Plus className="w-3 h-3 mr-1" /> 下一首
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={selectedIds.size === 0}>
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="end" className="w-40 p-1">
                    <div className="flex items-center px-2 py-1.5 text-xs rounded-sm hover:bg-accent cursor-pointer" onClick={() => handleBatch(addToFavorites, "已添加到喜欢")}><Heart className="mr-2 h-3.5 w-3.5" /> 喜欢</div>
                    <div className="flex items-center px-2 py-1.5 text-xs rounded-sm hover:bg-accent cursor-pointer" onClick={handleBatchDownload}><Download className="mr-2 h-3.5 w-3.5" /> 下载</div>
                    <div className="border-t my-1" />
                    {playlists.map((p) => (
                      <div key={p.id} className="flex items-center px-2 py-1.5 text-xs rounded-sm hover:bg-accent cursor-pointer" onClick={() => handleBatch((t) => addToPlaylist(p.id, t), `已添加到「${p.name}」`)}>
                        <ListMusic className="mr-2 h-3.5 w-3.5 opacity-50" /> <span className="truncate">{p.name}</span>
                      </div>
                    ))}
                    <div className="flex items-center px-2 py-1.5 text-xs rounded-sm hover:bg-accent cursor-pointer text-muted-foreground" onClick={handleCreatePlaylist}><Plus className="mr-2 h-3.5 w-3.5" /> 新建歌单</div>
                    {onRemove && (
                      <><div className="border-t my-1" /><div className="flex items-center px-2 py-1.5 text-xs rounded-sm hover:bg-accent cursor-pointer text-destructive" onClick={handleBatchRemove}><Trash2 className="mr-2 h-3.5 w-3.5" /> {removeLabel}</div></>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetSelection}><Check className="w-4 h-4" /></Button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col w-full" ref={internalRef}>
      {renderHeader()}
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const track = tracks[item.index];
          return (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {track ? (
                <MusicTrackItem
                  track={track} playlistId={playlistId} index={item.index}
                  isCurrent={track.id === currentTrackId} isPlaying={isPlaying}
                  onPlay={() => onPlay(track)} showCheckbox={isSelectionMode}
                  isSelected={selectedIds.has(track.id)} onSelect={() => toggleSelect(track.id)}
                  onRemove={!isSelectionMode && onRemove ? () => onRemove(track) : undefined}
                  removeLabel={removeLabel} isDownloaded={downloadedStatusMap.get(track.id) ?? false}
                  quality={quality} showSourceBadge={showSourceBadge}
                />
              ) : (
                <div className="px-3 pb-20 pt-2 h-full">
                  {onLoadMore ? (
                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground h-8" onClick={onLoadMore} disabled={!hasMore || loading}>
                      {loading ? <Loader2 className="animate-spin w-3.5 h-3.5 mr-2" /> : hasMore ? "加载更多" : "没有更多了"}
                    </Button>
                  ) : <div className="h-full" />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
