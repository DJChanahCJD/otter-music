import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { Download, Heart, ListPlus, MoreVertical, Trash2, CornerDownRight } from "lucide-react";
import { ReactNode } from "react";
import { MusicCover } from "./MusicCover";
import { useMusicCover } from "@/hooks/useMusicCover";
import { MusicTrack } from "@/types/music";

interface MusicTrackMobileMenuProps {
  track: MusicTrack;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToNextPlay: () => void;
  onAddToPlaylistTrigger: () => void;
  onDownload: () => void;
  onToggleLike: () => void;
  isFavorite?: boolean;
  onRemove?: () => void;
  hideLike?: boolean;
  hideAddToPlaylist?: boolean;
  customActions?: ReactNode;
  triggerClassName?: string;
}

export function MusicTrackMobileMenu({
  track,
  open,
  onOpenChange,
  onAddToNextPlay,
  onAddToPlaylistTrigger,
  onDownload,
  onToggleLike,
  isFavorite,
  onRemove,
  hideLike,
  hideAddToPlaylist,
  customActions,
  triggerClassName,
}: MusicTrackMobileMenuProps) {
  const coverUrl = useMusicCover(track, open);

  return (
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
          {!hideLike && (
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
                  isFavorite && "fill-primary text-primary"
                )}
              />
              {isFavorite ? "取消喜欢" : "喜欢"}
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

          {!hideAddToPlaylist && (
            <Button
              variant="ghost"
              className="justify-start w-full"
              onClick={() => {
                onOpenChange(false);
                onAddToPlaylistTrigger();
              }}
            >
              <ListPlus className="mr-2 h-4 w-4" /> 添加到歌单
            </Button>
          )}

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


          {onRemove && (
            <Button
              variant="ghost"
              className="justify-start w-full text-destructive hover:text-destructive"
              onClick={() => {
                onOpenChange(false);
                if (window.confirm(`确定移除歌曲「${track.name}」吗？`)) {
                   onRemove();
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> 移除
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
  );
}
