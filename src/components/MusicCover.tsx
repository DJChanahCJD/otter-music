"use client";

import { useState } from "react";
import { Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { forceHttps } from "@/lib/music-provider";

interface MusicCoverProps {
  src?: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
  fallbackIcon?: React.ReactNode;
}

/**
 * 通用音乐封面组件
 * 支持封面图加载失败时自动回退到音乐图标
 */
export function MusicCover({
  src,
  alt = "Cover",
  className,
  iconClassName,
  fallbackIcon,
}: MusicCoverProps) {
  const [error, setError] = useState(false);
  const coverUrl = forceHttps(src);

  if (!src || error) {
    return (
      <div
        className={cn(
          "w-full h-full bg-muted flex items-center justify-center shrink-0",
          className
        )}
      >
        {fallbackIcon || (
          <Music2 className={cn("text-muted-foreground/50", iconClassName)} />
        )}
      </div>
    );
  }

  return (
    <img
      src={coverUrl}
      alt={alt}
      className={cn("w-full h-full object-cover shrink-0", className)}
      onError={() => setError(true)}
    />
  );
}
