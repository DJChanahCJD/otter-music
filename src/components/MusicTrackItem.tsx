import { cn } from "@/lib/utils";
import { downloadMusicTrack } from "@/lib/utils/download";
import { useMusicStore } from "@/store/music-store";
import { MusicTrack, MergedMusicTrack, sourceBadgeStyles, sourceLabels } from "@/types/music";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";
import { AddToPlaylistDialog } from "./AddToPlaylistDialog";
import { MusicTrackMobileMenu } from "./MusicTrackMobileMenu";
import { MusicTrackVariants } from "./MusicTrackVariants";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";


interface MusicTrackItemProps {
  track: MusicTrack | MergedMusicTrack;
  index: number;
  isCurrent?: boolean;
  isPlaying?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  showCheckbox?: boolean;
  onPlay: () => void;
  // Optional overrides or disabling default actions
  hideLike?: boolean;
  hideAddToQueue?: boolean;
  hideAddToPlaylist?: boolean;
  // Custom actions to render (e.g. Delete button)
  onRemove?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function MusicTrackItem({
  track,
  index,
  isCurrent,
  isPlaying,
  isSelected,
  onSelect,
  showCheckbox,
  onPlay,
  hideLike,
  hideAddToQueue,
  hideAddToPlaylist,
  onRemove,
  className,
  style,
}: MusicTrackItemProps) {
  const { 
    addToFavorites, 
    removeFromFavorites, 
    isFavorite, 
    addToQueue, 
  } = useMusicStore(
    useShallow((state) => ({
      addToFavorites: state.addToFavorites,
      removeFromFavorites: state.removeFromFavorites,
      isFavorite: state.isFavorite,
      addToQueue: state.addToQueue,
    }))
  );
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const variants = (track as MergedMusicTrack).variants || [];

  return (
    <div
      style={style}
      onClick={showCheckbox ? onSelect : onPlay}
      className={cn(
        "group grid gap-4 items-center px-4 py-2.5 rounded-md cursor-pointer transition-all text-sm",
        "grid-cols-[2.5rem_1fr_auto]",
        isSelected && showCheckbox
          ? "bg-primary/10" 
          : "hover:bg-muted/50",
        className
      )}
    >
      {/* Column 1: Index / Checkbox / Play State */}
      <div className="flex justify-center shrink-0">
          {showCheckbox ? (
            <Checkbox 
              checked={isSelected} 
              onCheckedChange={() => onSelect?.()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="relative w-4 h-4 flex items-center justify-center">
                {/* Playing State */}
                {isCurrent && isPlaying ? (
                   <>
                     <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                     </span>
                   </>
                ) : (
                   <>
                      <span className={cn("font-mono text-muted-foreground opacity-70", isCurrent && "text-primary opacity-100")}>
                        {index + 1}
                      </span>
                   </>
                )}
            </div>
          )}
      </div>

      {/* Column 2: Title & Artist & Album */}
      <div className="min-w-0 flex flex-col gap-0.5">
        <div className={cn("font-medium flex items-center gap-1.5", isCurrent && "text-primary")}>
          <span className="truncate" title={track.name}>{track.name}</span>
          <Badge 
            variant="outline" 
            className={cn(
              "shrink-0 text-[10px] px-1 py-0 h-4 leading-none font-normal border",
              sourceBadgeStyles[track.source] || sourceBadgeStyles.default
            )}
          >
            {sourceLabels[track.source] || track.source}
          </Badge>
          
          <MusicTrackVariants variants={variants} />
        </div>
        <div className="text-xs text-muted-foreground truncate opacity-70">
          {track.artist.join(" / ")}
          {track.album && ` • ${track.album}`}
        </div>
      </div>

      {/* Column 3: Actions */}
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <>
              {/* 移动端菜单 */}
              <div className="flex items-center">
                  <MusicTrackMobileMenu
                      track={track}
                      open={isMobileMenuOpen}
                      onOpenChange={setIsMobileMenuOpen}
                      onAddToQueue={() => {
                          addToQueue(track);
                          toast.success("已加入播放列表");
                      }}
                      onAddToPlaylistTrigger={() => {
                          setIsAddToPlaylistOpen(true);
                      }}
                      onDownload={() => downloadMusicTrack(track)}
                      onToggleLike={() => {
                          if (isFavorite(track.id)) {
                              removeFromFavorites(track.id);
                              toast.success("已取消喜欢");
                          } else {
                              addToFavorites(track);
                              toast.success("已喜欢");
                          }
                      }}
                      isFavorite={isFavorite(track.id)}
                      onRemove={onRemove}
                      hideLike={hideLike}
                      hideAddToQueue={hideAddToQueue}
                      hideAddToPlaylist={hideAddToPlaylist}
                  />
                  
                  <AddToPlaylistDialog 
                      open={isAddToPlaylistOpen} 
                      onOpenChange={setIsAddToPlaylistOpen} 
                      track={track} 
                  />
              </div>
          </>
      </div>
    </div>
  );
}
