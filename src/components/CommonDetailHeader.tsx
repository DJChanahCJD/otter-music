import { useState, memo } from "react";
import { MusicCover } from "@/components/MusicCover";
import { format } from "date-fns";
import { cn } from "@/lib/utils"; // 假设你有 cn 工具函数

export interface CommonDetailHeaderProps {
  title: string;
  coverUrl: string;
  description?: string;
  creator?: string;
  publishTime?: number;
  countDesc?: string;
  fallbackIcon?: React.ReactNode;
}

export const CommonDetailHeader = memo(function CommonDetailHeader({
  title,
  coverUrl,
  description,
  creator,
  publishTime,
  countDesc,
  fallbackIcon,
}: CommonDetailHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

        {description && (
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
        )}
      </div>
    </div>
  );
});