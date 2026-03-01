import { cn } from "@/lib/utils";
import { downloadMusicTrack } from "@/lib/utils/download";
import { useMusicStore } from "@/store/music-store";
import {
  MusicTrack,
  MergedMusicTrack,
  sourceBadgeStyles,
  sourceLabels,
} from "@/types/music";
import { useState } from "react";
import { toastUtils } from "@/lib/utils/toast";
import toast from "react-hot-toast";
import { useShallow } from "zustand/react/shallow";
import { AddToPlaylistDialog } from "./AddToPlaylistDialog";
import { MusicTrackMobileMenu } from "./MusicTrackMobileMenu";
import { MusicTrackVariants } from "./MusicTrackVariants";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { DatabaseZap } from "lucide-react";

interface MusicTrackItemProps {
  track: MusicTrack | MergedMusicTrack;
  index: number;
  isCurrent?: boolean;
  isPlaying?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  showCheckbox?: boolean;
  onPlay: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  isDownloaded?: boolean;
  quality?: string;
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
  onRemove,
  removeLabel,
  isDownloaded,
  quality = "192",
  className,
  style,
}: MusicTrackItemProps) {
  const {
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    addToNextPlay,
  } = useMusicStore(
    useShallow((state) => ({
      addToFavorites: state.addToFavorites,
      removeFromFavorites: state.removeFromFavorites,
      isFavorite: state.isFavorite,
      addToNextPlay: state.addToNextPlay,
    })),
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
        isSelected && showCheckbox ? "bg-primary/10" : "hover:bg-muted/50",
        className,
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
                <span
                  className={cn(
                    "font-mono text-muted-foreground opacity-70",
                    isCurrent && "text-primary opacity-100",
                  )}
                >
                  {index + 1}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Column 2: Title & Artist & Album */}
      <div className="min-w-0 flex flex-col gap-0.5">
        <div
          className={cn(
            "font-medium flex items-center gap-1.5",
            isCurrent && "text-primary",
          )}
        >
          <span className="truncate" title={track.name}>
            {track.name}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-[10px] px-1 py-0 h-4 leading-none font-normal border",
              sourceBadgeStyles[track.source] || sourceBadgeStyles.default,
            )}
          >
            {sourceLabels[track.source] || track.source}
          </Badge>

          {isDownloaded && (
            <DatabaseZap className="h-3.5 w-3.5 text-muted-foreground/60" />
          )}

          <MusicTrackVariants variants={variants} />
        </div>
        <div className="text-xs text-muted-foreground truncate opacity-70">
          {track.artist.join(" / ")}
          {track.album && ` • ${track.album}`}
        </div>
      </div>

      {/* Column 3: Actions */}
      <div className="flex items-center justify-end gap-1">
        {/* 移动端菜单 */}
        <div className="flex items-center">
          <MusicTrackMobileMenu
            track={track}
            open={isMobileMenuOpen}
            onOpenChange={setIsMobileMenuOpen}
            onAddToNextPlay={() => {
              addToNextPlay(track);
              toast.success("已添加到下一首播放");
            }}
            onAddToPlaylist={() => {
              setIsAddToPlaylistOpen(true);
            }}
            onDownload={() => downloadMusicTrack(track, parseInt(quality))}
            onToggleLike={() => {
              if (isFavorite(track.id)) {
                removeFromFavorites(track.id);
                toast.success("已取消喜欢");
              } else {
                const error = addToFavorites(track);
                if (error) {
                  toastUtils.info(error);
                } else {
                  toast.success("已喜欢");
                }
              }
            }}
            isFavorite={isFavorite(track.id)}
            onRemove={onRemove}
            removeLabel={removeLabel}
          />

          <AddToPlaylistDialog
            open={isAddToPlaylistOpen}
            onOpenChange={setIsAddToPlaylistOpen}
            track={track}
          />
        </div>
      </div>
    </div>
  );
}
