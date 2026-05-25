"use client";

import { useEffect, useRef, useState } from "react";
import { Shuffle, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { MusicCover } from "@/components/MusicCover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMusicCover } from "@/hooks/useMusicCover";
import { cn } from "@/lib/utils";
import type { MusicTrack } from "@/types/music";

interface PlayerQueueDrawerProps {
  queue: MusicTrack[];
  currentIndex: number;
  isPlaying: boolean;
  isShuffle: boolean;
  onPlay: (index: number) => void;
  onClear: () => void;
  onReshuffle: () => void;
  onRemove: (track: MusicTrack) => void;
  trigger: React.ReactNode;
}

interface QueueTrackItemProps {
  track: MusicTrack;
  isCurrent: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onRemove: () => void;
  itemRef?: (el: HTMLDivElement | null) => void;
}

function QueueTrackItem({
  track,
  isCurrent,
  isPlaying,
  onSelect,
  onRemove,
  itemRef,
}: QueueTrackItemProps) {
  const coverUrl = useMusicCover(track);

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrent && !confirm(`确定删除《${track.name}》吗？`)) {
      return;
    }
    onRemove();
  };

  return (
    <div
      ref={itemRef}
      role="button"
      tabIndex={0}
      aria-label={`播放 ${track.name}`}
      className={cn(
        "grid grid-cols-[48px_1fr_auto] items-center gap-4 rounded-2xl px-4 py-3 transition-colors hover:bg-muted/60 active:bg-muted",
        isCurrent && "bg-muted/50"
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onSelect();
      }}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
        <MusicCover
          src={coverUrl}
          alt=""
          className="rounded-lg"
          iconClassName="h-5 w-5 text-muted-foreground/40"
        />

        {/* 极致小巧的顺序波动动画 */}
        {isCurrent && isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center gap-[3px] rounded-lg bg-black/30 backdrop-blur-[2px]">
            <div className="h-1 w-[2.5px] rounded-full bg-primary animate-[audio-bar_1s_ease-in-out_infinite]" />
            <div className="h-1 w-[2.5px] rounded-full bg-primary animate-[audio-bar_1s_ease-in-out_infinite] [animation-delay:200ms]" />
            <div className="h-1 w-[2.5px] rounded-full bg-primary animate-[audio-bar_1s_ease-in-out_infinite] [animation-delay:400ms]" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex flex-col justify-center overflow-hidden">
        <span
          className={cn(
            "text-[15px] font-medium truncate leading-snug transition-colors",
            isCurrent ? "text-primary" : "text-foreground"
          )}
        >
          {track.name}
        </span>
        <span className="text-[13px] text-muted-foreground/70 truncate leading-snug">
          {track.artist.join(" / ")}
        </span>
      </div>

      <div className="flex items-center justify-center -mr-2">
        <button
          className="rounded-lg p-2 text-muted-foreground/50 hover:text-foreground"
          onClick={handleRemove}
          title={`删除`}
          aria-label={`删除 ${track.name}`}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

export function PlayerQueueDrawer({
  queue,
  currentIndex,
  isPlaying,
  isShuffle,
  onPlay,
  onClear,
  onReshuffle,
  onRemove,
  trigger,
}: PlayerQueueDrawerProps) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledOnOpen = useRef(false);

  useEffect(() => {
    hasScrolledOnOpen.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || hasScrolledOnOpen.current) return;
    hasScrolledOnOpen.current = true;

    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
    });

    return () => cancelAnimationFrame(id);
  }, [open, currentIndex]);

  const setCurrentRef = (el: HTMLDivElement | null) => {
    if (el) scrollRef.current = el;
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent
        className="h-[75vh] max-h-[75vh] gap-0 rounded-t-3xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <DrawerHeader className="shrink-0 px-6 pb-4 pt-6">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg font-medium tracking-tight">
              播放列表{" "}
              <span className="text-muted-foreground/60 text-base ml-1">
                ({queue.length})
              </span>
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              当前播放队列，可切换、清空或删除歌曲。
            </DrawerDescription>
            <div className="flex items-center gap-2">
              {isShuffle && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
                  onClick={onReshuffle}
                  title="再次打乱"
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={onClear}
                title="清空播放列表"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] flex flex-col gap-1">
              {queue.map((track, i) => (
                <QueueTrackItem
                  key={`${track.id}-${i}`}
                  track={track}
                  isCurrent={i === currentIndex}
                  isPlaying={isPlaying}
                  onSelect={() => {
                    onPlay(i);
                    setOpen(false);
                  }}
                  onRemove={() => onRemove(track)}
                  itemRef={i === currentIndex ? setCurrentRef : undefined}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
