"use client";

import { ListVideo, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { useMusicCover } from "@/hooks/useMusicCover";
import { PlayerQueuePopover } from "./PlayerQueuePopover";
import { MusicCover } from "./MusicCover";
import { useCallback } from "react";
import toast from "react-hot-toast";

interface MusicNowPlayingBarProps {
  onOpenFullScreen?: () => void;
}

export function MusicNowPlayingBar({ onOpenFullScreen }: MusicNowPlayingBarProps) {
  const {
    isPlaying,
    currentAudioTime,
    duration,
    isShuffle,
    queue,
    currentIndex,
    togglePlay,
    setCurrentIndex,
    setIsPlaying,
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
      setCurrentIndex: state.setCurrentIndex,
      setIsPlaying: state.setIsPlaying,
      clearQueue: state.clearQueue,
      reshuffle: state.reshuffle,
    }))
  );

  const currentTrack = queue[currentIndex] || null;
  const coverUrl = useMusicCover(currentTrack);

  const playTrack = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      setIsPlaying(true);
    },
    [setCurrentIndex, setIsPlaying]
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
    return undefined;
  }

  return (
    <div className="px-3">
      <div
        className="flex items-center gap-2 rounded-xl bg-card/95 px-2 py-1.5 shadow-md cursor-pointer border border-border/50 backdrop-blur-sm"
        onClick={onOpenFullScreen}
      >
        {/* 专辑封面 */}
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md">
          <MusicCover
            src={coverUrl}
            alt={currentTrack.name}
            className="w-full h-full"
            iconClassName="h-4 w-4"
          />
        </div>

        {/* 歌曲信息 - 单行 */}
        <p className="flex-1 min-w-0 truncate text-sm gap-1">
          <span className="font-medium text-foreground">{currentTrack.name}</span>
          <span className="text-muted-foreground"> - {currentTrack.artist?.join(", ")}</span>
        </p>

        {/* 圆环播放按钮 */}
        <div className="relative w-9 h-9 shrink-0">
          {/* SVG 圆环进度 */}
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
              strokeWidth="2"
              className="text-muted/30"
            />
            {/* 进度圆环 - 从上方开始 */}
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-primary transition-[stroke-dashoffset] duration-300"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 20 20)"
            />
          </svg>

          {/* 播放按钮 */}
          <button
            className="absolute inset-0 flex items-center justify-center text-primary hover:text-primary/80 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={isPlaying ? "暂停" : "播放"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current ml-0.5" />
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
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              onClick={(e) => e.stopPropagation()}
              aria-label="播放列表"
            >
              <ListVideo className="h-4 w-4" />
            </button>
          }
        />
      </div>
    </div>
  );
}
