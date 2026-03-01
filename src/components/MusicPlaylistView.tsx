import { Button } from "@/components/ui/button";
import { Play, MoreHorizontal, Search } from "lucide-react";
import { MusicTrackList } from "./MusicTrackList";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { MusicCover } from "./MusicCover";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MusicTrack } from "@/types/music";
import { useMusicStore } from "@/store/music-store";
import { useDownloadStore } from "@/store/download-store";
import { buildDownloadKey } from "@/lib/utils/download";
import toast from "react-hot-toast";
import { deduplicateTracks } from "@/lib/utils/music";
import { toastUtils } from "@/lib/utils/toast";

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
  onRename?: (playlistId: string, newName: string) => void;
  onDelete?: (playlistId: string) => void;
  description?: string;
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
  onRename,
  onDelete,
  description,
  currentTrackId,
  isPlaying,
  action,
  coverUrl,
  removeLabel,
  icon,
}: MusicPlaylistViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

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

    if (!confirm("确定要对当前歌单进行去重吗？\n\n规则：\n1. 繁简体转换后歌名、歌手完全相同的视为重复\n2. 保留优先级：已下载 > 已喜欢 > 序号较大\n3. 自动合并「已喜欢」状态")) {
      return;
    }

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

    // 1. Update Favorites (Merge logic)
    if (result.tracksToLike.length > 0) {
      result.tracksToLike.forEach(track => {
        musicStore.addToFavorites(track);
      });
      toast.success(`已合并 ${result.tracksToLike.length} 首歌曲的喜欢状态`);
    }

    // 2. Update Playlist
    musicStore.setPlaylistTracks(playlistId, result.tracks);
    toast.success(`已移除 ${result.removedCount} 首重复歌曲`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        "p-4 border-b flex items-end gap-4 bg-muted/10 relative",
      )}>
        <div className="h-22 w-22 bg-primary/10 rounded-lg flex items-center justify-center shadow-sm border overflow-hidden shrink-0">
          <MusicCover
            src={coverUrl}
            alt={title}
            className="h-full w-full"
            iconClassName="h-8 w-8 text-primary/80"
            fallbackIcon={icon}
          />
        </div>
        <div className="flex-1 space-y-1">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{tracks.length} 首歌曲</span>
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
             {playlistId && (onRename || onDelete) && (
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button
                     variant="secondary"
                     size="icon"
                     title="更多操作"
                   >
                     <MoreHorizontal className="h-4 w-4" />
                   </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent align="end">
                   {onRename && (
                     <DropdownMenuItem onClick={() => {
                       const newName = window.prompt("请输入新歌单名称", title);
                       if (newName && newName.trim()) {
                         onRename(playlistId, newName.trim());
                       }
                     }}>
                       重命名
                     </DropdownMenuItem>
                   )}
                   <DropdownMenuItem onClick={handleDeduplicate}>
                     歌单去重
                   </DropdownMenuItem>
                   {onDelete && (
                     <DropdownMenuItem onClick={() => {
                       if (confirm(`确定删除歌单「${title}」吗？`)) {
                         onDelete(playlistId);
                       }
                     }} className="text-red-500">
                       删除歌单
                     </DropdownMenuItem>
                   )}
                 </DropdownMenuContent>
               </DropdownMenu>
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
          onPlay={(track) => onPlay(track, tracks.findIndex(t => t.id === track.id))}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          onRemove={onRemove}
          removeLabel={removeLabel}
        />
      </div>
    </div>
  );
}
