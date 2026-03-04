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

export function MusicTrackMobileMenu({
  track,
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
  const setSearchQuery = useMusicStore((state) => state.setSearchQuery);
  const setSearchResults = useMusicStore((state) => state.setSearchResults);
  const setSearchIntent = useMusicStore((state) => state.setSearchIntent);
  const setSearchSource = useMusicStore((state) => state.setSearchSource);
  const updateTrackInQueue = useMusicStore((state) => state.updateTrackInQueue);
  const playTrackAsNext = useMusicStore((state) => state.playTrackAsNext);
  const removeFromQueue = useMusicStore((state) => state.removeFromQueue);
  const [showArtistSelection, setShowArtistSelection] = useState(false);
  const aggregatedSources = useMusicStore((state) => state.aggregatedSources);

const handleMatch = async () => {
    onOpenChange(false);
    const toastId = toastUtils.loading("正在搜索完整版...");
    try {
      const targetName = track.name.trim().toLowerCase();
      const targetArtist = track.artist[0].trim().toLowerCase();
      
      // 使用聚合搜索，增加匹配成功率
      const res = await musicApi.searchAll(`${track.name} ${track.artist[0]}`, 1, 5, undefined, aggregatedSources);

      // 严格匹配：必须歌名相同且包含该歌手
      const match = res.items.find(item => 
        item.name.trim().toLowerCase() === targetName && 
        item.artist.some(a => a.trim().toLowerCase().includes(targetArtist))
      );

      if (match) {
        toastUtils.success(`已切换至完整版: ${match.name}`, { id: toastId });
        
        playTrackAsNext(match);
        if (match.id === track.id) {
          updateTrackInQueue(track.id, match);
        } else {
          setTimeout(() => removeFromQueue(track.id), 100);
        }
      } else {
        toastUtils.error("未找到完全匹配的完整版", { id: toastId });
      }
    } catch (e) {
      console.error(e);
      toastUtils.error("匹配失败", { id: toastId });
    }
  };

  const handleSearch = (keyword: string, type: SearchIntent['type'] = '', artist?: string) => {
    const simplified = toSimplified(keyword);
    setSearchQuery(simplified);
    setSearchIntent({ type, artist });
    if (track.source !== 'local') {
      setSearchSource(track.source || 'all');
    }
    if (track.source === '_netease') {
      setSearchSource('netease');
    }
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
            onClick={(e) => {
              e.stopPropagation();
            }}
            title="更多操作"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent onClick={(e) => e.stopPropagation()}>
          <DrawerTitle>
            {/* Header with Cover and Info */}
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
          </DrawerTitle>
          <div className="p-4 flex flex-col gap-2">
            {onToggleLike && (
              <Button
                variant="ghost"
                className="justify-start w-full"
                onClick={() => {
                  onToggleLike();
                  onOpenChange(false);
                }}
              >
                <Heart
                  className={cn(
                    "mr-2 h-4 w-4",
                    isFavorite && "fill-primary text-primary",
                  )}
                />
                {isFavorite ? "取消喜欢" : "喜欢"}
              </Button>
            )}
            {onDownload && (
              <Button
                variant="ghost"
                className="justify-start w-full"
                onClick={() => {
                  onDownload();
                  onOpenChange(false);
                }}
              >
                <Download className="mr-2 h-4 w-4" /> 下载
              </Button>
            )}
             {onAddToPlaylist && (
              <Button
                variant="ghost"
                className="justify-start w-full"
                onClick={() => {
                  onOpenChange(false);
                  onAddToPlaylist();
                }}
              >
                <ListPlus className="mr-2 h-4 w-4" /> 添加到歌单
              </Button>
            )}

            {onAddToNextPlay && (
              <Button
                variant="ghost"
                className="justify-start w-full"
                onClick={() => {
                  onAddToNextPlay();
                  onOpenChange(false);
                }}
              >
                <CornerDownRight className="mr-2 h-4 w-4" /> 下一首播放
              </Button>
            )}

            <Button
              variant="ghost"
              className="justify-start w-full"
              onClick={() => {
                if (track.artist.length > 1) {
                  setShowArtistSelection(true);
                } else {
                  handleSearch(track.artist[0], 'artist');
                }
              }}
            >
              <User className="mr-2 h-4 w-4" /> 歌手：{track.artist.join(" / ")}
            </Button>

            {track.album && (
              <Button
                variant="ghost"
                className="justify-start w-full"
                onClick={() => handleSearch(track.album!, 'album', track.artist[0])}
              >
                <Disc className="mr-2 h-4 w-4" /> 专辑：{track.album}
              </Button>
            )}

            {(track.privilege?.fee === 1 || track.privilege?.fee === 4) && track.privilege?.pl <= 0 && (
              <Button
                variant="ghost"
                className="justify-start w-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={handleMatch}
              >
                <Zap className="mr-2 h-4 w-4" /> 解锁完整音源
              </Button>
            )}

            <Button
              variant="ghost"
              className="justify-start w-full cursor-default hover:bg-transparent"
            >
              <Link2 className="mr-2 h-4 w-4" /> 来源：
              {track.source === "local"
                ? "本地音乐"
                : sourceLabels[track.source] || track.source}
            </Button>

            {onRemove && (
              <Button
                variant="ghost"
                className="justify-start w-full text-destructive hover:text-destructive"
                onClick={() => {
                  onOpenChange(false);
                  if (window.confirm(`确定${removeLabel}歌曲「${track.name}」吗？`)) {
                    onRemove();
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> {removeLabel}
              </Button>
            )}

            {customActions && (
              <div className="flex flex-col gap-2">
                {/* 
                    Since customActions is a ReactNode, we can't easily style it. 
                    But we wrap it to ensure layout.
                 */}
                {customActions}
              </div>
            )}
          </div>
          <DrawerClose asChild>
            <Button variant="outline" className="mx-4 mb-4">
              取消
            </Button>
          </DrawerClose>
        </DrawerContent>
      </Drawer>
      <Dialog open={showArtistSelection} onOpenChange={setShowArtistSelection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择歌手</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {track.artist.map((artist) => (
              <Button
                key={artist}
                variant="ghost"
                className="justify-start w-full"
                onClick={() => handleSearch(artist, 'artist')}
              >
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
