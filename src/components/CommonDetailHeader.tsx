import { useState } from "react";
import { MusicCover } from "@/components/MusicCover";
import { formatDateZN } from "@/lib/utils/index";

export interface CommonDetailHeaderProps {
  title: string;
  coverUrl: string;
  description?: string;
  creator?: string;
  trackCount: number;
  publishTime?: number;
  unit?: string;
  fallbackIcon?: React.ReactNode;
}

export function CommonDetailHeader({
  title,
  coverUrl,
  description,
  creator,
  trackCount,
  publishTime,
  unit = "首",
  fallbackIcon,
}: CommonDetailHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const publishDateStr = publishTime
    ? new Date(publishTime).toLocaleDateString()
    : null;

  return (
    <div className="w-full shrink-0">
      <div className="p-5 flex gap-4 items-start">
        <MusicCover
          src={coverUrl}
          alt={title}
          // 封面图固定大小，防止被压缩
          className="shrink-0 w-24 h-24 rounded-xl object-cover shadow-md ring-1 ring-white/10"
          fallbackIcon={fallbackIcon}
        />

        <div className="flex-1 min-w-0 flex flex-col gap-1.5 py-0.5">
          <h2
            className="text-base font-bold leading-tight text-foreground/90 line-clamp-2"
            title={title}
          >
            {title}
          </h2>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground/80">
            {creator && (
              <span className="truncate max-w-[120px]">{creator}</span>
            )}
            <span className="shrink-0">
              {trackCount.toLocaleString()} {unit}
            </span>
            {publishDateStr && (
              <span className="shrink-0">发布于 {formatDateZN(publishDateStr)}</span>
            )}
          </div>

          {description && (
            <div className="mt-1 group">
              <p
                className={`text-[11px] text-muted-foreground/70 leading-relaxed cursor-pointer hover:text-muted-foreground/90 transition-colors ${
                  isExpanded ? "" : "line-clamp-2"
                }`}
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
