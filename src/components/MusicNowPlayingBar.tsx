"use client";

import { ListVideo, Pause, Play } from "lucide-react";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { useMusicCover } from "@/hooks/useMusicCover";
import { PlayerQueuePopover } from "./PlayerQueuePopover";
import { MusicCover } from "./MusicCover";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface MusicNowPlayingBarProps {
  onOpenFullScreen?: () => void;
  isTab?: boolean;
}

export function MusicNowPlayingBar({ onOpenFullScreen, isTab = true }: MusicNowPlayingBarProps) {
  const {
    isPlaying,
    currentAudioTime,
    duration,
    isShuffle,
    queue,
    currentIndex,
    togglePlay,
    setCurrentIndexAndPlay,
    clearQueue,
    reshuffle,
  } = useMusicStore(
    useShallow((state) => ({
      isPlaying: state.isPlaying,
      currentAudioTime: state.currentAudioTime,
      duration: state.duration,
      isShuffle: state.isShuffle,
      queue: state.queue,
      currentIndex: state.currentIndex,
      togglePlay: state.togglePlay,
      setCurrentIndexAndPlay: state.setCurrentIndexAndPlay,
      clearQueue: state.clearQueue,
      reshuffle: state.reshuffle,
    }))
  );

  const currentTrack = queue[currentIndex] || null;
  const coverUrl = useMusicCover(currentTrack);

  const playTrack = useCallback(
    (index: number) => {
      setCurrentIndexAndPlay(index);
    },
    [setCurrentIndexAndPlay]
  );

  const handleClearQueue = () => {
    if (confirm("确定要清空播放列表吗？")) {
      clearQueue();
      toast.success("播放列表已清空");
    }
  };

  const progress = duration > 0 ? (currentAudioTime / duration) * 100 : 0;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress / 100);

  if (!currentTrack) {
    return null; // 使用 null 替代 undefined 更符合 React 规范
  }

  return (
    <div className={cn(isTab ? "px-3" : "w-full")}>
      <div
        className={cn(
          "flex items-center cursor-pointer backdrop-blur-sm transition-all duration-300",
          isTab
            ? "gap-2 px-2 py-1.5 rounded-2xl bg-card/95 shadow-md border border-border/50"
            : "gap-3 px-4 py-2.5 bg-background/95 border-t border-border/50 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        )}
        onClick={onOpenFullScreen}
      >
        {/* 专辑封面 */}
        <div 
          className={cn(
            "relative shrink-0 overflow-hidden rounded-md transition-all duration-300 shadow-sm",
            isTab ? "h-8 w-8" : "h-11 w-11"
          )}
        >
          <MusicCover
            src={coverUrl}
            alt={currentTrack.name}
            className="w-full h-full"
            iconClassName={isTab ? "h-4 w-4" : "h-5 w-5"}
          />
        </div>

        {/* 歌曲信息 - 单行 */}
        <p className="flex-1 min-w-0 truncate flex items-baseline gap-1.5">
          <span 
            className={cn(
              "font-medium text-foreground transition-all duration-300",
              isTab ? "text-sm" : "text-base"
            )}
          >
            {currentTrack.name}
          </span>
          <span 
            className={cn(
              "text-muted-foreground truncate transition-all duration-300",
              isTab ? "text-xs" : "text-sm"
            )}
          >
            - {currentTrack.artist?.join(", ")}
          </span>
        </p>

        {/* 圆环播放按钮 */}
        <div 
          className={cn(
            "relative shrink-0 transition-all duration-300",
            isTab ? "w-9 h-9" : "w-11 h-11"
          )}
        >
          {/* SVG 圆环进度 (利用 viewBox 自动等比缩放) */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 40 40"
          >
            {/* 背景圆环 */}
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={isTab ? "2" : "2.5"}
              className="text-muted/30 transition-all duration-300"
            />
            {/* 进度圆环 - 从上方开始 */}
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={isTab ? "2" : "2.5"}
              strokeLinecap="round"
              className="text-primary transition-[stroke-dashoffset] duration-300"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 20 20)"
            />
          </svg>

          {/* 播放按钮 */}
          <button
            className="absolute inset-0 flex items-center justify-center text-primary hover:text-primary/80 transition-colors focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={isPlaying ? "暂停" : "播放"}
          >
            {isPlaying ? (
              <Pause className={cn("fill-current transition-all duration-300", isTab ? "h-4 w-4" : "h-5 w-5")} />
            ) : (
              <Play className={cn("fill-current ml-0.5 transition-all duration-300", isTab ? "h-4 w-4" : "h-5 w-5")} />
            )}
          </button>
        </div>

        {/* 播放列表按钮 */}
        <PlayerQueuePopover
          queue={queue}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          isShuffle={isShuffle}
          onPlay={playTrack}
          onClear={handleClearQueue}
          onReshuffle={reshuffle}
          trigger={
            <button
              className={cn(
                "text-muted-foreground hover:text-foreground transition-all shrink-0 focus:outline-none",
                isTab ? "p-1.5" : "p-2 ml-1"
              )}
              onClick={(e) => e.stopPropagation()}
              aria-label="播放列表"
            >
              <ListVideo className={cn("transition-all duration-300", isTab ? "h-4 w-4" : "h-[22px] w-[22px]")} />
            </button>
          }
        />
      </div>
    </div>
  );
}