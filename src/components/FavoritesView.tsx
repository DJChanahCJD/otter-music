import { Button } from "@/components/ui/button";
import { Play, MoreHorizontal, Search, Heart } from "lucide-react";
import { MusicTrackList } from "./MusicTrackList";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
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
import { exportPlaylist } from "@/lib/utils/playlist-backup";

interface FavoritesViewProps {
  tracks: MusicTrack[];
  onPlay: (track: MusicTrack | null, index?: number) => void;
  onRemove: (track: MusicTrack) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

export function FavoritesView({
  tracks,
  onPlay,
  onRemove,
  currentTrackId,
  isPlaying,
}: FavoritesViewProps) {
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
    if (!confirm("确定要对「我的喜欢」进行去重吗？\n\n规则：\n1. 繁简体转换后歌名、歌手完全相同的视为重复\n2. 保留优先级：已下载 > 序号较大")) {
      return;
    }

    const musicStore = useMusicStore.getState();
    const downloadStore = useDownloadStore.getState();

    const result = deduplicateTracks(
      tracks,
      () => true, // 在喜欢列表中，所有歌曲默认都是喜欢的
      (track) => downloadStore.hasRecord(buildDownloadKey(track.source, track.id))
    );

    if (result.removedCount === 0) {
      toastUtils.info("没有发现重复歌曲");
      return;
    }

    // Update Favorites
    musicStore.setFavorites(result.tracks);
    toast.success(`已移除 ${result.removedCount} 首重复歌曲`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        "p-4 border-b flex items-end gap-4 bg-muted/10 relative",
      )}>
        <div className="h-20 w-20 bg-primary/10 rounded-lg flex items-center justify-center shadow-sm border overflow-hidden shrink-0">
          <Heart className="h-8 w-8 text-primary/80 fill-current" />
        </div>
        <div className="flex-1 space-y-1">
          <h1 className="text-xl font-bold tracking-tight">我的喜欢</h1>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{tracks.length} 首歌曲</span>
          </div>
          <div className="pt-1 flex gap-2 items-center">
             <Button 
                onClick={() => onPlay(null)} 
                className="rounded-full px-3 h-8"
                size="sm"
             >
                <Play className="h-3 w-3 fill-current" />
             </Button>

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
                 <DropdownMenuItem onClick={handleDeduplicate}>
                   列表去重
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => exportPlaylist("我喜欢的音乐", tracks)}>
                   导出歌单
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
             
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
          onRemove={(track) => onRemove(track)}
          removeLabel="取消喜欢"
        />
      </div>
    </div>
  );
}
