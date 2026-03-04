import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import {
  Download,
  Heart,
  ListPlus,
  MoreVertical,
  Trash2,
  CornerDownRight,
  User,
  Disc,
  Link2,
  Zap,
} from "lucide-react";
import { ReactNode, useState } from "react";
import { MusicCover } from "./MusicCover";
import { useMusicCover } from "@/hooks/useMusicCover";
import { MusicTrack, SearchIntent, sourceLabels } from "@/types/music";
import { useNavigate } from "react-router-dom";
import { useMusicStore } from "@/store/music-store";
import { toSimplified } from "@/lib/utils/music-key";
import { musicApi } from "@/lib/music-api";
import { toastUtils } from "@/lib/utils/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MusicTrackMobileMenuProps {
  track: MusicTrack;
  playlistId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToNextPlay?: () => void;
  onAddToPlaylist: () => void;
  onDownload?: () => void;
  onToggleLike?: () => void;
  isFavorite?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  customActions?: ReactNode;
  triggerClassName?: string;
  onNavigate?: () => void;
}

// 辅助函数：替换列表中的指定歌曲
const replaceInList = (list: MusicTrack[], oldId: string, newTrack: MusicTrack) => {
  let replaced = false;
  const newList = list.map((item) => {
    if (item.id !== oldId) return item;
    replaced = true;
    return newTrack;
  });
  return { replaced, newList };
};

const ActionButton = ({ onClick, icon: Icon, children, className }: any) => (
  <Button variant="ghost" className={cn("justify-start w-full", className)} onClick={onClick}>
    <Icon className="mr-2 h-4 w-4" /> {children}
  </Button>
);

export function MusicTrackMobileMenu({
  track,
  playlistId,
  open,
  onOpenChange,
  onAddToNextPlay,
  onAddToPlaylist,
  onDownload,
  onToggleLike,
  isFavorite,
  onRemove,
  removeLabel = "移除",
  customActions,
  triggerClassName,
  onNavigate,
}: MusicTrackMobileMenuProps) {
  const coverUrl = useMusicCover(track, open);
  const navigate = useNavigate();
  const [showArtistSelection, setShowArtistSelection] = useState(false);

  // Zustand Store
  const setSearchQuery = useMusicStore((s) => s.setSearchQuery);
  const setSearchResults = useMusicStore((s) => s.setSearchResults);
  const setSearchIntent = useMusicStore((s) => s.setSearchIntent);
  const setSearchSource = useMusicStore((s) => s.setSearchSource);
  const updateTrackInQueue = useMusicStore((s) => s.updateTrackInQueue);
  const playTrackAsNext = useMusicStore((s) => s.playTrackAsNext);
  const removeFromQueue = useMusicStore((s) => s.removeFromQueue);
  const playlists = useMusicStore((s) => s.playlists);
  const setPlaylistTracks = useMusicStore((s) => s.setPlaylistTracks);
  const aggregatedSources = useMusicStore((s) => s.aggregatedSources);
  const favorites = useMusicStore((s) => s.favorites);
  const setFavorites = useMusicStore((s) => s.setFavorites);
  const isTrackFavorite = useMusicStore((s) => s.isFavorite);

  const handleMatch = async () => {
    onOpenChange(false);
    const toastId = toastUtils.loading("正在搜索完整版...");
    try {
      const targetName = track.name.trim().toLowerCase();
      const targetArtist = track.artist[0].trim().toLowerCase();

      const match = await musicApi.searchBestMatch(
        `${track.name} ${track.artist[0]}`,
        aggregatedSources,
        (item) =>
          item.name.trim().toLowerCase() === targetName &&
          item.artist.some((a) => a.trim().toLowerCase().includes(targetArtist)),
        5
      );

      if (!match) {
        toastUtils.error("未找到匹配的完整版", { id: toastId });
        return;
      }

      // 处理播放队列替换
      playTrackAsNext(match);
      if (match.id === track.id) {
        updateTrackInQueue(track.id, match);
      } else {
        setTimeout(() => removeFromQueue(track.id), 100);
      }

      // 处理收藏列表替换
      if (playlistId === "favorites" || isTrackFavorite(track.id)) {
        const { replaced, newList } = replaceInList(favorites, track.id, match);
        if (replaced) setFavorites(newList);
      }

      // 处理自定义歌单替换
      if (playlistId && playlistId !== "favorites") {
        const playlist = playlists.find((p) => p.id === playlistId);
        if (playlist) {
          const { replaced, newList } = replaceInList(playlist.tracks, track.id, match);
          if (replaced) setPlaylistTracks(playlistId, newList);
        }
      }

      toastUtils.success(`已切换至完整版: ${match.name}（${match.source}）`, { id: toastId });
    } catch (e) {
      console.error(e);
      toastUtils.error("匹配失败", { id: toastId });
    }
  };

  const handleSearch = (keyword: string, type: SearchIntent["type"] = "", artist?: string, id?: string) => {
    // 优先跳转到详情页 (仅 _netease 源支持)
    if (track.source === "_netease" && id) {
        if (type === "artist") {
            navigate(`/artist/${id}`);
            onOpenChange(false);
            setShowArtistSelection(false);
            onNavigate?.();
            return;
        }
        if (type === "album") {
            navigate(`/album/${id}`);
            onOpenChange(false);
            onNavigate?.();
            return;
        }
    }

    setSearchQuery(toSimplified(keyword));
    setSearchIntent({ type, artist });
    setSearchSource(track.source === "_netease" ? "netease" : track.source && track.source !== "local" ? track.source : "all");
    setSearchResults([]);
    navigate("/search");
    onOpenChange(false);
    setShowArtistSelection(false);
    onNavigate?.();
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-8 w-8", triggerClassName)}
            onClick={(e) => e.stopPropagation()}
            title="更多操作"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent onClick={(e) => e.stopPropagation()}>
          <DrawerTitle className="sr-only">歌曲操作菜单</DrawerTitle>
          <div className="flex items-center gap-4 px-6 py-4">
            <MusicCover
              src={coverUrl}
              alt={track.name}
              className="h-16 w-16 rounded-lg shadow-md"
              iconClassName="h-8 w-8"
            />
            <div className="min-w-0">
              <div className="font-bold truncate text-lg">{track.name}</div>
              <div className="text-sm text-muted-foreground truncate">
                {track.artist.join(" / ")}
                {track.album && ` • ${track.album}`}
              </div>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {onToggleLike && (
              <ActionButton
                icon={Heart}
                onClick={() => { onToggleLike(); onOpenChange(false); }}
                className={isFavorite ? "text-primary [&>svg]:fill-primary" : ""}
              >
                {isFavorite ? "取消喜欢" : "喜欢"}
              </ActionButton>
            )}
            {onDownload && (
              <ActionButton icon={Download} onClick={() => { onDownload(); onOpenChange(false); }}>
                下载
              </ActionButton>
            )}
            {onAddToPlaylist && (
              <ActionButton icon={ListPlus} onClick={() => { onAddToPlaylist(); onOpenChange(false); }}>
                添加到歌单
              </ActionButton>
            )}
            {onAddToNextPlay && (
              <ActionButton icon={CornerDownRight} onClick={() => { onAddToNextPlay(); onOpenChange(false); }}>
                下一首播放
              </ActionButton>
            )}

            <ActionButton
              icon={User}
              onClick={() => track.artist.length > 1 ? setShowArtistSelection(true) : handleSearch(track.artist[0], "artist", undefined, track.artist_ids?.[0])}
            >
              歌手：{track.artist.join(" / ")}
            </ActionButton>

            {track.album && (
              <ActionButton icon={Disc} onClick={() => handleSearch(track.album!, "album", track.artist[0], track.album_id)}>
                专辑：{track.album}
              </ActionButton>
            )}

            {track.privilege && [1, 4].includes(track.privilege.fee) && track.privilege.pl <= 0 && (
              <ActionButton
                icon={Zap}
                onClick={handleMatch}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              >
                解锁完整音源
              </ActionButton>
            )}

            <Button variant="ghost" className="justify-start w-full cursor-default hover:bg-primary/40">
              <Link2 className="mr-2 h-4 w-4" /> 来源：
              {track.source === "local" ? "本地音乐" : sourceLabels[track.source] || track.source}
            </Button>

            {onRemove && (
              <ActionButton
                icon={Trash2}
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  onOpenChange(false);
                  if (window.confirm(`确定${removeLabel}歌曲「${track.name}」吗？`)) onRemove();
                }}
              >
                {removeLabel}
              </ActionButton>
            )}

            {customActions && <div className="flex flex-col gap-2">{customActions}</div>}
          </div>
          <DrawerClose asChild>
            <Button variant="outline" className="mx-4 mb-4">取消</Button>
          </DrawerClose>
        </DrawerContent>
      </Drawer>

      <Dialog open={showArtistSelection} onOpenChange={setShowArtistSelection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择歌手</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {track.artist.map((artist, index) => (
              <Button key={artist} variant="ghost" className="justify-start w-full" onClick={() => handleSearch(artist, "artist", undefined, track.artist_ids?.[index])}>
                <User className="mr-2 h-4 w-4" />
                {artist}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
