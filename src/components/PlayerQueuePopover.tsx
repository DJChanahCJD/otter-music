"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { MusicTrack } from "@/types/music";

interface PlayerQueuePopoverProps {
  queue: MusicTrack[];
  currentIndex: number;
  isPlaying: boolean;
  isShuffle: boolean;
  onPlay: (index: number) => void;
  onClear: () => void;
  onReshuffle: () => void;
  trigger: React.ReactNode;
}

export function PlayerQueuePopover({
  queue,
  currentIndex,
  isPlaying,
  isShuffle,
  onPlay,
  onClear,
  onReshuffle,
  trigger,
}: PlayerQueuePopoverProps) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // 等待 Radix 定位 + ScrollArea 计算高度
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollIntoView({
        block: "center",
        behavior: "instant", // 打开时不要 smooth，否则会抖
      });
    });

    return () => cancelAnimationFrame(id);
  }, [open, currentIndex]);

  const setCurrentRef = (el: HTMLDivElement | null) => {
    if (el) scrollRef.current = el;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-80 p-0 h-96 flex flex-col"
        onOpenAutoFocus={(e) => {
          // 防止 Popover 打开时自动聚焦导致滚动跳动，或者可以在这里也触发一次滚动
           e.preventDefault();
        }}
      >
        <div className="p-3 border-b text-sm font-medium flex justify-between items-center">
          <span>播放列表 ({queue.length})</span>
          <div className="flex items-center gap-1">
            {isShuffle && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 text-muted-foreground hover:bg-transparent hover:text-primary"
                onClick={onReshuffle}
                title="再次打乱"
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 text-muted-foreground hover:bg-transparent hover:text-destructive"
              onClick={onClear}
              title="清空播放列表"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-1">
              {queue.map((track, i) => (
                <div
                  key={`${track.id}-${i}`}
                  ref={i === currentIndex ? setCurrentRef : undefined}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded text-sm cursor-pointer hover:bg-muted/50",
                    i === currentIndex && "bg-muted/50 text-primary",
                  )}
                  onClick={() => onPlay(i)}
                >
                  {i === currentIndex && isPlaying ? (
                    <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                      </span>
                    </div>
                  ) : (
                    <span className="w-4 text-center text-xs text-muted-foreground font-mono shrink-0">
                      {i + 1}
                    </span>
                  )}
                  <div className="flex-1 min-w-0 truncate">
                    <span className="font-medium">{track.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {" "}
                      - {track.artist.join("/")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
