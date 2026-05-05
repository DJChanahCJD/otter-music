import { useState, memo, useCallback } from "react";
import { MusicCover } from "@/components/MusicCover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import type { MusicTrack } from "@/types/music";

export interface CommonDetailHeaderProps {
  title: string;
  coverUrl: string;
  description?: string;
  creator?: string;
  publishTime?: number;
  countDesc?: string;
  fallbackIcon?: React.ReactNode;
  /** @deprecated 使用 onPlayTrack 替代以支持随机播放 */
  onPlay?: () => void;
  onPlayTrack?: (track: MusicTrack) => void;
  isShuffle?: boolean;
  tracks?: MusicTrack[];
}

export const CommonDetailHeader = memo(function CommonDetailHeader({
  title,
  coverUrl,
  description,
  creator,
  publishTime,
  countDesc,
  fallbackIcon,
  onPlay,
  onPlayTrack,
  isShuffle,
  tracks,
}: CommonDetailHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePlay = useCallback(() => {
    if (onPlayTrack && tracks && tracks.length > 0) {
      if (isShuffle) {
        const randomIndex = Math.floor(Math.random() * tracks.length);
        onPlayTrack(tracks[randomIndex]);
      } else {
        onPlayTrack(tracks[0]);
      }
    } else {
      onPlay?.();
    }
  }, [isShuffle, tracks, onPlay, onPlayTrack]);

  return (
    <div className="w-full shrink-0 p-5 flex gap-4 items-start">
      <MusicCover
        src={coverUrl}
        alt={title}
        className="shrink-0 size-24 rounded-xl shadow-md ring-1 ring-white/10 object-cover"
        fallbackIcon={fallbackIcon}
      />

      <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
        <h2 className="text-base font-bold text-foreground/90 line-clamp-2" title={title}>
          {title}
        </h2>

        <div className="flex items-center flex-wrap gap-x-3 text-xs text-muted-foreground/80">
          {creator && <span className="truncate max-w-[140px]">{creator}</span>}
          {countDesc && <span>{countDesc}</span>}
          {publishTime && <span>{format(publishTime, "yyyy-MM-dd")}</span>}
        </div>

        {description ? (
          <p
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "mt-1 text-[11px] leading-relaxed transition-colors cursor-pointer",
              "text-muted-foreground/60 hover:text-muted-foreground/90",
              isExpanded ? "whitespace-pre-line" : "line-clamp-2"
            )}
          >
            {description}
          </p>
        ) : (onPlay || onPlayTrack) && (
          <div className="mt-1">
            <Button size="sm" className="rounded-full px-3 h-8" onClick={handlePlay}>
              <Play className="h-3 w-3 fill-current" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});