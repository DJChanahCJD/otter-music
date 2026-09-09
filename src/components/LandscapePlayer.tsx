import { useEffect, useRef, useState } from "react";
import {
  Heart,
  ListVideo,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  ChevronDown,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { LyricsPanel } from "@/components/LyricsPanel";
import { MusicCover } from "@/components/MusicCover";
import { PlayerProgressBar } from "@/components/PlayerProgressBar";
import { PlayerQueueDrawer } from "@/components/PlayerQueueDrawer";
import { useMusicStore } from "@/store/music-store";
import { usePlayerActions } from "@/hooks/usePlayerActions";
import toast from "react-hot-toast";

const TOP_BAR_AUTO_HIDE_DELAY = 3500;

interface LandscapePlayerProps {
  background: React.ReactNode;
  onExit: () => void;
}

export function LandscapePlayer({ background, onExit }: LandscapePlayerProps) {
  const {
    queue,
    currentIndex,
    setCurrentIndexAndPlay,
    clearQueue,
    reshuffle,
    removeFromQueue,
    playTrackAsNext,
    isPlaying,
    isLoading,
    togglePlay,
    isRepeat,
    isShuffle,
    toggleRepeat,
    toggleShuffle,
    coverUrl,
    coverRadius,
  } = useMusicStore(
    useShallow((s) => ({
      queue: s.queue,
      currentIndex: s.currentIndex,
      setCurrentIndexAndPlay: s.setCurrentIndexAndPlay,
      clearQueue: s.clearQueue,
      reshuffle: s.reshuffle,
      removeFromQueue: s.removeFromQueue,
      playTrackAsNext: s.playTrackAsNext,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      togglePlay: s.togglePlay,
      isRepeat: s.isRepeat,
      isShuffle: s.isShuffle,
      toggleRepeat: s.toggleRepeat,
      toggleShuffle: s.toggleShuffle,
      coverUrl: s.coverUrl,
      coverRadius: s.coverRadius,
    }))
  );

  const currentTrack = queue[currentIndex] || null;
  const { handleToggleLike, isCurrentTrackFavorite } = usePlayerActions(
    currentTrack,
    null
  );

  const hideTimerRef = useRef<number | null>(null);
  const [showTopBar, setShowTopBar] = useState(false);

  // 唤起顶部栏并重置隐藏定时器
  const revealTopBar = () => {
    setShowTopBar(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(
      () => setShowTopBar(false),
      TOP_BAR_AUTO_HIDE_DELAY
    );
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  // 切歌逻辑
  const switchTrack = (direction: "prev" | "next") => {
    if (!queue.length) return;
    const delta = direction === "next" ? 1 : -1;
    setCurrentIndexAndPlay((currentIndex + delta + queue.length) % queue.length);
  };

  const handleClearQueue = () => {
    if (confirm("确定要清空播放列表吗？")) {
      clearQueue();
      toast.success("播放列表已清空");
    }
  };

  // 循环切换播放模式：列表循环 → 单曲循环 → 随机 → 列表循环
  const handleModeToggle = () => {
    if (!isShuffle && !isRepeat) toggleRepeat();
    else if (isRepeat) {
      toggleRepeat();
      toggleShuffle();
    } else toggleShuffle();
  };

  // 歌词区/按钮内的点击只维持显示（避免与歌词滚动、跳转冲突），其余空白区切换显示
  const handleContentClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest("[data-lyrics-scroll], button")) {
      revealTopBar();
      return;
    }

    if (showTopBar) {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      setShowTopBar(false);
    } else {
      revealTopBar();
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden select-none">
      {background}

      {/* 顶部悬浮栏：左上退出，右上播放列表 */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-30 flex items-center justify-between pt-4 pb-8 pl-[max(1rem,var(--safe-area-left))] pr-[max(1rem,var(--safe-area-right))] bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300",
          showTopBar ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-white/80 hover:bg-white/15 hover:text-white rounded-full transition-transform active:scale-95"
          onClick={onExit}
          aria-label="退出横屏"
        >
          <ChevronDown className="h-6 w-6" />
        </Button>

        {/* 右侧： 播放列表 */}
        <div className="flex items-center gap-1">

          <PlayerQueueDrawer
            queue={queue}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            isShuffle={isShuffle}
            direction="right"
            onPlay={setCurrentIndexAndPlay}
            onClear={handleClearQueue}
            onReshuffle={reshuffle}
            onRemove={(track) => removeFromQueue(track.id)}
            onPlayTrack={playTrackAsNext}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 text-white/80 hover:bg-white/15 hover:text-white rounded-full transition-transform active:scale-95"
                aria-label="播放列表"
                title="播放列表"
              >
                <ListVideo className="h-6 w-6" />
              </Button>
            }
          />
        </div>
      </div>

      {/* 主内容区：调整封面占比至 36vw (<40%) */}
      <div
        className="flex min-h-0 flex-1 pl-[max(1.25rem,var(--safe-area-left))] pr-[max(1.25rem,var(--safe-area-right))] pt-6"
        onClick={handleContentClick}
      >
        {/* 左侧：封面与歌曲信息 (36vw) */}
        <div className="flex w-[36vw] shrink-0 flex-col items-center justify-center gap-3 pr-6">
          <div
            className="relative aspect-square overflow-hidden shadow-2xl ring-1 ring-white/10"
            style={{
              // 预留：顶部留白 36 + 底部控制条 56 + 间距与歌曲信息 62
              width: "min(100%, calc(100svh - 156px))",
              borderRadius: coverRadius,
            }}
          >
            <MusicCover
              src={coverUrl}
              alt={currentTrack?.name}
              className="h-full w-full object-cover touch-none"
              iconClassName="h-14 w-14 text-white/30"
            />
          </div>
          <div className="w-full min-w-0 text-center">
            <p className="truncate text-lg font-semibold text-white">
              {currentTrack?.name || "未知歌曲"}
            </p>
            <p className="mt-0.5 truncate text-sm text-white/50">
              {currentTrack?.artist?.join(", ") || "未知歌手"}
            </p>
          </div>
        </div>

        {/* 右侧：歌词 */}
        <div className="min-h-0 flex-1 py-2" data-lyrics-scroll>
          <LyricsPanel track={currentTrack} />
        </div>
      </div>

      {/* 底部播放控制条：宽度与上层 36vw + flex-1 精确对齐 */}
      <div className="flex shrink-0 items-center pl-[max(1.25rem,var(--safe-area-left))] pr-[max(1.25rem,var(--safe-area-right))] pb-[max(0.5rem,var(--safe-area-bottom))]">
        {/* 左侧控制按钮组（宽度设为 36vw，右边距 pr-6 与上面一致，保证按钮在封面正下方居中） */}
        <div className="flex w-[36vw] shrink-0 items-center justify-center gap-3 pr-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-white/80 hover:bg-white/10 hover:text-white active:scale-95 transition-transform"
            onClick={() => switchTrack("prev")}
            aria-label="上一首"
          >
            <SkipBack className="h-5 w-5 fill-current" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 shrink-0 rounded-full text-white hover:bg-white/10 active:scale-95 transition-transform"
            onClick={togglePlay}
            disabled={isLoading}
            aria-label={isPlaying ? "暂停" : "播放"}
          >
            {isLoading ? (
              <Spinner className="h-6 w-6" />
            ) : isPlaying ? (
              <Pause className="h-6 w-6 fill-current" />
            ) : (
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-white/80 hover:bg-white/10 hover:text-white active:scale-95 transition-transform"
            onClick={() => switchTrack("next")}
            aria-label="下一首"
          >
            <SkipForward className="h-5 w-5 fill-current" />
          </Button>
        </div>

        {/* 右侧进度条（占据剩余宽度，完美对齐歌词区域） */}
        <div className="flex-1 flex items-center">
          <PlayerProgressBar className="w-full" showTime={false} />
        </div>

        {/* 右侧附加控制：播放模式与喜欢，常驻显示 */}
        <div className="flex shrink-0 items-center gap-1 pl-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-white/80 hover:bg-white/10 hover:text-white active:scale-95 transition-transform"
            onClick={handleModeToggle}
            aria-label="播放模式"
            title="播放模式"
          >
            {isRepeat ? (
              <Repeat1 className="h-5 w-5" />
            ) : isShuffle ? (
              <Shuffle className="h-5 w-5" />
            ) : (
              <Repeat className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full text-white/80 hover:bg-white/10 hover:text-white active:scale-95 transition-transform"
            onClick={handleToggleLike}
            aria-label={isCurrentTrackFavorite ? "取消喜欢" : "喜欢"}
            title={isCurrentTrackFavorite ? "取消喜欢" : "喜欢"}
          >
            <Heart
              className={cn(
                "h-5 w-5 transition-all",
                isCurrentTrackFavorite && "fill-primary text-primary"
              )}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}