"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMediaTime } from "@/lib/utils/music";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";

interface PlayerProgressBarProps {
  className?: string;
  /** 是否显示左右时间文本，默认显示 */
  showTime?: boolean;
  leftTimeSuffix?: React.ReactNode;
  centerContent?: React.ReactNode;
  onLeftTimeClick?: () => void;
  onRightTimeClick?: () => void;
  onCenterClick?: () => void;
}

export function PlayerProgressBar({
  className,
  showTime = true,
  leftTimeSuffix,
  centerContent,
  onLeftTimeClick,
  onRightTimeClick,
  onCenterClick,
}: PlayerProgressBarProps) {
  const { currentTime, duration, seek } = useMusicStore(
    useShallow((state) => ({
      currentTime: state.currentAudioTime,
      duration: state.duration,
      seek: state.seek,
    }))
  );

  const barRef = React.useRef<HTMLDivElement>(null);
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

  const handleMove = React.useCallback(
    (clientX: number) => {
      const p = getPercent(clientX);
      const time = p * duration;
      setDragTime(time);
      dragTimeRef.current = time;
    },
    [duration]
  );

  const handleEnd = React.useCallback(() => {
    seek(dragTimeRef.current);
    setIsDragging(false);
  }, [seek]);

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
        onMouseDown={(e) => handleStart(e.clientX)}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      >
        <div className="relative w-full h-1.5 group-hover:h-2 transition-all rounded-full bg-white/20">
          <div
            className={cn(
              "absolute inset-y-0 left-0 bg-white rounded-full flex items-center justify-end shadow-[0_0_10px_rgba(255,255,255,0.3)]",
              !isDragging && "transition-all"
            )}
            style={{ width: `${displayProgress}%` }}
          >
            {/* 拖拽/悬停时显示的小圆点指示器 */}
            <div
              className={cn(
                "w-3 h-3 bg-white rounded-full shadow-md translate-x-1.5 transition-opacity duration-200",
                isDragging
                  ? "opacity-100 scale-110"
                  : "opacity-0 group-hover:opacity-100"
              )}
            />
          </div>
        </div>
      </div>
      {showTime && (
        <div className="relative flex justify-between text-xs text-white/60 font-medium mt-1.5 px-0.5 tracking-wider">
          <span
            className={cn(
              "flex items-baseline gap-0.5",
              onLeftTimeClick &&
                "cursor-pointer hover:text-white transition-colors"
            )}
            onClick={onLeftTimeClick}
            role={onLeftTimeClick ? "button" : undefined}
            tabIndex={onLeftTimeClick ? 0 : undefined}
          >
            {formatMediaTime(isDragging ? dragTime : currentTime)}
            {leftTimeSuffix}
          </span>
          {centerContent && (
            <span
              className={cn(
                "absolute left-1/2 -translate-x-1/2",
                onCenterClick &&
                  "cursor-pointer hover:text-white transition-colors"
              )}
              onClick={onCenterClick}
              role={onCenterClick ? "button" : undefined}
              tabIndex={onCenterClick ? 0 : undefined}
            >
              {centerContent}
            </span>
          )}
          <span
            className={cn(
              onRightTimeClick &&
                "cursor-pointer hover:text-white transition-colors"
            )}
            onClick={onRightTimeClick}
            role={onRightTimeClick ? "button" : undefined}
            tabIndex={onRightTimeClick ? 0 : undefined}
          >
            {formatMediaTime(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
