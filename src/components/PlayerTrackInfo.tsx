"use client";

import { Button } from "@/components/ui/button";
import { Music2, ChevronUp, ChevronDown, Heart, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { MusicTrack } from "@/types/music";
import { useIsMobile } from "@/hooks/use-mobile";
import { MusicCover } from "./MusicCover";

interface PlayerTrackInfoProps {
  track: MusicTrack | null;
  coverUrl: string | null;
  isFullScreen: boolean;
  isFavorite?: boolean;
  onToggleFullScreen?: () => void;
  onToggleFavorite?: () => void;
  onDownload?: () => void;
}

export function PlayerTrackInfo({
  track,
  coverUrl,
  isFullScreen,
  isFavorite = false,
  onToggleFullScreen,
  onToggleFavorite,
  onDownload,
}: PlayerTrackInfoProps) {
  const isMobile = useIsMobile();
  const sizeClasses = "h-16 w-16";
  const iconSize = "h-8 w-8";
  const textSize = "text-lg";
  const subTextSize = "text-sm";

  if (!track) {
    return (
      <div className="flex items-center gap-3 opacity-50">
        <div className={`${sizeClasses} rounded bg-muted flex items-center justify-center`}>
          <Music2 className={iconSize} />
        </div>
        <div className={textSize}>未播放</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 min-w-0 cursor-pointer",
        !isMobile && "group",
        onToggleFullScreen && "cursor-pointer"
      )}
      onClick={onToggleFullScreen}
    >
      <div className={`${sizeClasses} rounded bg-muted flex items-center justify-center overflow-hidden shrink-0 relative`}>
        <MusicCover
          src={coverUrl}
          alt={track.name}
          className="h-full w-full"
          iconClassName={iconSize}
        />
        {!isMobile && onToggleFullScreen && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isFullScreen ? (
              <ChevronUp className="h-4 w-4 text-white" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white" />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col min-w-0 ml-1">
        <div className={`${textSize} font-semibold truncate`}>
          {track.name}
        </div>
        <div className={`${subTextSize} text-muted-foreground truncate`}>
          {track.artist.join(" / ")}
        </div>
      </div>

      {!isMobile && (
        <div
          className="flex items-center gap-1 ml-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              onClick={onToggleFavorite}
              title="喜欢"
            >
              <Heart
                className={cn(
                  "h-4 w-4",
                  isFavorite && "fill-primary text-primary"
                )}
              />
            </Button>
          )}
          {onDownload && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              onClick={onDownload}
              title="下载"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
