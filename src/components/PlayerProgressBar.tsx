"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMediaTime } from "@/lib/utils/music";

interface PlayerProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (value: number[]) => void;
  className?: string;
}

export function PlayerProgressBar({
  currentTime,
  duration,
  onSeek,
  className,
}: PlayerProgressBarProps) {
  const barRef = React.useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = React.useState<number | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragTime, setDragTime] = React.useState(0);
  const dragTimeRef = React.useRef(0);

  const currentProgress = duration ? (currentTime / duration) * 100 : 0;
  const dragProgress = duration ? (dragTime / duration) * 100 : 0;
  const displayProgress = isDragging ? dragProgress : currentProgress;

  const getPercent = (clientX: number) => {
    if (!barRef.current) return 0;
    const { left, width } = barRef.current.getBoundingClientRect();
    return Math.min(Math.max((clientX - left) / width, 0), 1);
  };

  const handleStart = (clientX: number) => {
    setIsDragging(true);
    const p = getPercent(clientX);
    const time = p * duration;
    setDragTime(time);
    dragTimeRef.current = time;
  };

  const handleMove = React.useCallback((clientX: number) => {
    const p = getPercent(clientX);
    const time = p * duration;
    setDragTime(time);
    dragTimeRef.current = time;
  }, [duration]);

  const handleEnd = React.useCallback(() => {
    onSeek([dragTimeRef.current]);
    setIsDragging(false);
  }, [onSeek]);

  React.useEffect(() => {
    if (isDragging) {
      const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
      const onMouseUp = () => handleEnd();
      const onTouchMove = (e: TouchEvent) => {
        if (e.cancelable) e.preventDefault();
        handleMove(e.touches[0].clientX);
      };
      const onTouchEnd = () => handleEnd();

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);

      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
      };
    }
  }, [isDragging, handleMove, handleEnd]);

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={barRef}
        className="group relative w-full py-3 cursor-pointer select-none flex items-center z-10"
        onMouseMove={(e) => {
          const p = getPercent(e.clientX);
          setHoverTime(p * duration);
        }}
        onMouseLeave={() => setHoverTime(null)}
        onMouseDown={(e) => handleStart(e.clientX)}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      >
        <div className="relative w-full h-1.5 group-hover:h-2 transition-all">
          <div className="absolute inset-0 bg-muted/80 rounded-full" />
          <div
            className={cn(
              "absolute inset-y-0 left-0 bg-primary rounded-full",
              !isDragging && "transition-all"
            )}
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1 px-0.5">
        <span>{formatMediaTime(isDragging ? dragTime : currentTime)}</span>
        <span>{formatMediaTime(duration)}</span>
      </div>
    </div>
  );
}
