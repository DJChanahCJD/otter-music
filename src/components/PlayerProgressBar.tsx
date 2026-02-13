"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMediaTime } from "@/lib/utils/audio";

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
    <div
      ref={barRef}
      className={cn(
        "group absolute -top-1 w-full h-1 hover:h-3 cursor-pointer select-none transition-all flex items-center z-10",
        className
      )}
      onMouseMove={(e) => {
        const p = getPercent(e.clientX);
        setHoverTime(p * duration);
      }}
      onMouseLeave={() => setHoverTime(null)}
      onMouseDown={(e) => handleStart(e.clientX)}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-muted/30 group-hover:bg-muted/50 transition-colors" />

      {/* Progress */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 bg-primary",
          !isDragging && "transition-all"
        )}
        style={{ width: `${displayProgress}%` }}
      />

      {/* Tooltip */}
      {(hoverTime !== null || isDragging) && (
        <div
          className="absolute -top-8 -translate-x-1/2 bg-background border shadow-sm text-xs px-1.5 py-0.5 rounded whitespace-nowrap"
          style={{ left: `${((isDragging ? dragTime : hoverTime!) / duration) * 100}%` }}
        >
          {formatMediaTime(isDragging ? dragTime : hoverTime!)} / {formatMediaTime(duration)}
        </div>
      )}

      {/* Handle */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-primary rounded-full shadow-md transition-opacity",
          isDragging ? "opacity-100 scale-125" : "opacity-0 group-hover:opacity-100"
        )}
        style={{ left: `calc(${displayProgress}% - 6px)` }}
      />
    </div>
  );
}
