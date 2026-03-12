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
import { DatabaseZap, DollarSign, Gem } from "lucide-react";
import { NeteasePrivilege } from "@/lib/netease/netease-types";

// 预定义 Badge 样式，避免每次渲染都重新计算
const PRIVILEGE_BADGES = {
  1: { label: "VIP", icon: Gem, className: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  4: { label: "付费", icon: DollarSign, className: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
} as const;

function getNeteaseBadge(p?: NeteasePrivilege) {
  if (!p || p.pl > 0) return null; // 可完整播放则不显示任何标记
  
  if (p.fee === 1) return PRIVILEGE_BADGES[1];
  if (p.fee === 4) return PRIVILEGE_BADGES[4];
  
  return null;
}

interface MusicTrackItemProps {
  track: MusicTrack | MergedMusicTrack;
  playlistId?: string;
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
  showSourceBadge?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function MusicTrackItem({
  track,
  playlistId,
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
  showSourceBadge = true,
  className,
  style,
}: MusicTrackItemProps) {
  const { addToFavorites, removeFromFavorites, isFavorite, addToNextPlay } =
    useMusicStore(
      useShallow((state) => ({
        addToFavorites: state.addToFavorites,
        removeFromFavorites: state.removeFromFavorites,
        isFavorite: state.isFavorite,
        addToNextPlay: state.addToNextPlay,
      }))
    );

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  
  const variants = (track as MergedMusicTrack).variants || [];
  const badge = getNeteaseBadge(track.privilege);

  return (
    <div
      style={style}
      className={cn(
        "group grid gap-4 items-center px-4 py-2.5 transition-all text-sm cursor-pointer",
        "grid-cols-[1.75rem_1fr_auto]",
        isSelected && showCheckbox ? "bg-primary/10" : "hover:bg-muted/50",
        className
      )}
    >
      <div
        className="col-span-2 grid grid-cols-[1.75rem_1fr] gap-4 items-center"
        onClick={showCheckbox ? onSelect : onPlay}
      >
        <div className="flex justify-center shrink-0">
          {showCheckbox ? (
            <Checkbox
              checked={isSelected}
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={() => onSelect?.()}
            />
          ) : (
            <div className="relative w-4 h-4 flex items-center justify-center">
              {isCurrent && isPlaying ? (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
              ) : (
                <span
                  className={cn(
                    "font-mono text-muted-foreground opacity-70",
                    isCurrent && "text-primary opacity-100"
                  )}
                >
                  {index + 1}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex flex-col gap-0.5">
          <div
            className={cn(
              "font-medium flex items-center gap-1.5",
              isCurrent && "text-primary"
            )}
          >
            <span className="truncate" title={track.name}>
              {track.name}
            </span>

            {showSourceBadge && (
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 text-[9px] px-1 py-0 h-3.5 leading-none font-normal",
                  sourceBadgeStyles[track.source] || sourceBadgeStyles.default
                )}
              >
                {sourceLabels[track.source] || track.source}
              </Badge>
            )}

            {badge && (
              <Badge
                variant="secondary"
                className={cn(
                  "h-3.5 px-1 text-[9px] gap-0.5 flex items-center leading-none font-bold border",
                  badge.className
                )}
              >
                <badge.icon className="h-2.5 w-2.5" />
                {badge.label}
              </Badge>
            )}

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
      </div>

      {/* Column 3: Actions */}
      <div className="flex items-center justify-end gap-1">
        <MusicTrackMobileMenu
          track={track}
          playlistId={playlistId}
          open={isMobileMenuOpen}
          onOpenChange={setIsMobileMenuOpen}
          onAddToNextPlay={() => {
            addToNextPlay(track);
            toast.success("已添加到下一首播放");
          }}
          onAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
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
  );
}
