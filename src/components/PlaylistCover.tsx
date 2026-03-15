import { useEffect } from "react";
import { MusicCover } from "./MusicCover";
import { useMusicCover } from "@/hooks/useMusicCover";
import { useMusicStore } from "@/store/music-store";
import type { Playlist } from "@/types/music";
import { ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaylistCoverProps {
  playlist: Playlist;
  className?: string;
  iconClassName?: string;
  fallbackIcon?: React.ReactNode;
}

/**
 * 带有自动持久化逻辑的歌单封面组件
 * 
 * 优雅实现：
 * - 只有在渲染需要时，且歌单没有 coverUrl，才去尝试获取首曲封面（懒加载）。
 * - 成功获取后，通过 updatePlaylist 自动将 url 持久化到状态管理中。
 * - 这样可以避免不必要的后台并发请求，同时确保二次进入时可以无缝显示封面。
 */
export function PlaylistCover({ playlist, className, iconClassName, fallbackIcon }: PlaylistCoverProps) {
  const updatePlaylist = useMusicStore(state => state.updatePlaylist);
  
  // 取第一首有效歌曲
  const validTracks = playlist.tracks.filter(t => !t.is_deleted);
  const firstTrack = validTracks[0];

  // 只有当没有歌单封面，且存在至少一首歌曲时，才需要触发获取
  const needsCover = !playlist.coverUrl && !!firstTrack;
  const firstTrackCoverUrl = useMusicCover(firstTrack, needsCover);

  useEffect(() => {
    if (needsCover && firstTrackCoverUrl) {
      updatePlaylist(playlist.id, { coverUrl: firstTrackCoverUrl });
    }
  }, [needsCover, firstTrackCoverUrl, playlist.id, updatePlaylist]);

  const coverUrl = playlist.coverUrl || firstTrackCoverUrl;

  return (
    <MusicCover
      src={coverUrl}
      alt={playlist.name}
      className={className}
      iconClassName={iconClassName}
      fallbackIcon={fallbackIcon || <ListMusic className={cn("h-5 w-5 text-muted-foreground/70", iconClassName)} />}
    />
  );
}
