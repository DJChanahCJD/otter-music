import { Button } from "@/components/ui/button";
import { Play, Search } from "lucide-react";
import { MusicTrackList } from "./MusicTrackList";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useRef } from "react";
import { MusicCover } from "./MusicCover";
import { PlaylistCover } from "./PlaylistCover";
import { PlaylistOperations } from "./PlaylistOperations";
import { MusicTrack } from "@/types/music";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { useDownloadStore } from "@/store/download-store";
import { buildDownloadKey } from "@/lib/utils/download";
import toast from "react-hot-toast";
import { createTrackFromUrl, deduplicateTracks } from "@/lib/utils/music";
import { toastUtils } from "@/lib/utils/toast";
import { exportPlaylist } from "@/lib/utils/playlist-backup";
import { musicApi } from "@/lib/music-api";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";

import { format } from "date-fns";
import { AddByUrlDrawer } from "./AddByUrlDrawer";
import { logger } from "@/lib/logger";

interface MusicPlaylistViewProps {
  title: string;
  tracks: MusicTrack[];
  playlistId?: string;
  /**
   * index 可选：
   * - 传入 index：播放指定歌曲
   * - 不传 index：播放全部（由上层/Store 决定起始点，如随机播放）
   */
  onPlay: (track: MusicTrack | null, index?: number) => void;
  onRemove?: (track: MusicTrack, silent?: boolean) => void | Promise<void>;
  onBatchRemove?: (tracks: MusicTrack[]) => void;
  onRename?: (playlistId: string, newName: string) => void;
  onDelete?: (playlistId: string) => void;
  description?: string;
  createdAt?: number;
  currentTrackId?: string;
  isPlaying?: boolean;
  action?: React.ReactNode;
  coverUrl?: string;
  removeLabel?: string;
  icon?: React.ReactNode;
}

export function MusicPlaylistView({
  title,
  tracks,
  playlistId,
  onPlay,
  onRemove,
  onBatchRemove,
  onRename,
  onDelete,
  description,
  createdAt,
  currentTrackId,
  isPlaying,
  action,
  coverUrl,
  removeLabel,
  icon,
}: MusicPlaylistViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCoverDialogOpen, setIsCoverDialogOpen] = useState(false);
  const [isAddByUrlOpen, setIsAddByUrlOpen] = useState(false);
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [dedupeSelectedIds, setDedupeSelectedIds] = useState<Set<string> | undefined>();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const playlists = useMusicStore(useShallow(state => state.playlists));
  const playlist = playlists.find(p => p.id === playlistId);
  const isPersonalPlaylist = useMemo(() => {
    return !!playlist;
  }, [playlist]);

  const handleReorder = (newOrder: MusicTrack[]) => {
    if (playlistId && isPersonalPlaylist) {
      useMusicStore.getState().replaceActivePlaylistTracks(playlistId, newOrder);
    }
  };

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const lower = searchQuery.toLowerCase();
    return tracks.filter(t =>
      t.name.toLowerCase().includes(lower) ||
      t.artist?.some(a => a?.toLowerCase().includes(lower)) ||
      t.album?.toLowerCase().includes(lower)
    );
  }, [tracks, searchQuery]);

  const handleDeduplicate = () => {
    if (!playlistId) return;

    const musicStore = useMusicStore.getState();
    const downloadStore = useDownloadStore.getState();

    const result = deduplicateTracks(
      tracks,
      (id) => musicStore.isFavorite(id),
      (track) => downloadStore.hasRecord(buildDownloadKey(track.source, track.id))
    );

    if (result.removedCount === 0) {
      toastUtils.info("没有发现重复歌曲");
      return;
    }

    // 自动合并喜欢状态（元数据修正，非删除操作）
    if (result.tracksToLike.length > 0) {
      result.tracksToLike.forEach(track => {
        musicStore.addToFavorites(track);
      });
      toast.success(`已合并 ${result.tracksToLike.length} 首歌曲的喜欢状态`);
    }

    setDedupeSelectedIds(new Set(result.trackIdsToDelete));
    toast.success(`发现 ${result.removedCount} 首重复歌曲，已自动选中`);
  };

  const handleSetCover = () => {
    setCoverUrlInput(coverUrl || "");
    setIsCoverDialogOpen(true);
  };

  const handleUseFirstTrackCover = async () => {
    const firstTrack = tracks[0];
    if (firstTrack?.pic_id) {
      try {
        const url = await musicApi.getPic(firstTrack.pic_id, firstTrack.source);
        if (url) {
          setCoverUrlInput(url);
        } else {
          toast.error("获取封面失败");
        }
      } catch (e) {
        logger.error("MusicPlaylistView", "Get cover failed", e, {
          playlistId,
          trackId: firstTrack.id,
          source: firstTrack.source,
        });
        toast.error("获取封面出错");
      }
    } else {
      toast.error("第一首歌曲没有封面");
    }
  };

  const handleSaveCover = () => {
    if (!playlistId) return;

    // 如果为空，则是清除封面
    if (coverUrlInput && !coverUrlInput.startsWith("http")) {
      toast.error("请输入有效的图片链接");
      return;
    }

    useMusicStore.getState().updatePlaylist(playlistId, { coverUrl: coverUrlInput });
    setIsCoverDialogOpen(false);
    toast.success("封面设置成功");
  };

  const handleAddByUrl = (title: string, url: string, artist?: string) => {
    if (!playlistId) return;

    const track = createTrackFromUrl(title, url, artist);
    useMusicStore.getState().addToPlaylist(playlistId, track);
    toast.success("添加成功");
  };

  return (
    <div ref={scrollContainerRef} className="flex flex-1 min-h-0 flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b flex gap-4 bg-muted/10 relative items-end">
        <div className="h-22 w-22 bg-primary/10 rounded-lg flex items-center justify-center shadow-sm border overflow-hidden shrink-0">
          {playlist ? (
            <PlaylistCover
              playlist={playlist}
              className="h-full w-full"
              iconClassName="h-8 w-8 text-primary/80"
              fallbackIcon={icon}
            />
          ) : (
            <MusicCover
              src={coverUrl}
              alt={title}
              className="h-full w-full"
              iconClassName="h-8 w-8 text-primary/80"
              fallbackIcon={icon}
            />
          )}
        </div>
        <div className="flex-1 space-y-1">
          <h2 className="text-base font-bold tracking-tight line-clamp-1">{title}</h2>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{tracks.length} 首歌曲</span>
            {createdAt && (
              <>
                <span>•</span>
                <span>{format(createdAt, "yyyy-MM-dd")}</span>
              </>
            )}
            {description && (
              <>
                <span>•</span>
                <span>{description}</span>
              </>
            )}
          </div>
          <div className="pt-1 flex gap-2 items-center">
             <Button
                onClick={() => onPlay(null)}
                className="rounded-full px-3 h-8"
                size="sm"
             >
                <Play className="h-3 w-3 fill-current" />
             </Button>
             {action}
             {playlistId && (
               <PlaylistOperations
                 onRename={onRename ? () => {
                   const newName = window.prompt("请输入新歌单名称", title);
                   if (newName && newName.trim()) {
                     onRename(playlistId, newName.trim());
                   }
                 } : undefined}
                 onDeduplicate={handleDeduplicate}
                 onExport={() => exportPlaylist(title, tracks)}
                 onDelete={onDelete ? () => {
                   if (confirm(`确定删除歌单「${title}」吗？`)) {
                     onDelete(playlistId);
                   }
                 } : undefined}
                 onSetCover={handleSetCover}
                 onAddByUrl={isPersonalPlaylist ? () => setIsAddByUrlOpen(true) : undefined}
               />
             )}

             <div className="relative ml-auto w-32">
                <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
             </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 bg-background/50">
        <MusicTrackList
          tracks={filteredTracks}
          scrollContainerRef={scrollContainerRef}
          onPlay={(track) => onPlay(track, tracks.findIndex(t => t.id === track.id))}
          playlistId={playlistId}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          onRemove={onRemove}
          onBatchRemove={onBatchRemove}
          removeLabel={removeLabel}
          onReorder={isPersonalPlaylist && !searchQuery ? handleReorder : undefined}
          preselectedIds={dedupeSelectedIds}
          onSelectionModeChange={(active) => { if (!active) setDedupeSelectedIds(undefined); }}
        />
      </div>

      <Drawer open={isCoverDialogOpen} onOpenChange={setIsCoverDialogOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>设置封面</DrawerTitle>
          </DrawerHeader>
          <div className="grid gap-4 px-4 pb-4">
            <div className="grid gap-2">
              <Label htmlFor="coverUrl">封面图片链接</Label>
              <Input
                id="coverUrl"
                value={coverUrlInput}
                onChange={(e) => setCoverUrlInput(e.target.value)}
                placeholder="请输入图片 URL"
              />
            </div>
            <Button variant="secondary" onClick={handleUseFirstTrackCover} disabled={tracks.length === 0}>
              从第一首歌曲获取
            </Button>
          </div>
          <DrawerFooter className="pt-0">
            <Button onClick={handleSaveCover} className="h-11">保存</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AddByUrlDrawer
        isOpen={isAddByUrlOpen}
        onClose={() => setIsAddByUrlOpen(false)}
        onConfirm={handleAddByUrl}
      />
    </div>
  );
}
