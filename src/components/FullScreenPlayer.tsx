"use client";

import { createPortal } from "react-dom";
import { memo, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LyricsPanel } from "./LyricsPanel";
import { MusicCover } from "./MusicCover";
import { PlayerProgressBar } from "./PlayerProgressBar";
import { MusicTrack } from "@/types/music";
import {
  ChevronDown,
  Heart,
  ListVideo,
  Shuffle,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  SquareArrowOutUpRight,
  ClockFading,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useMounted } from "@/hooks/use-mounted";
import { usePlayerActions } from "@/hooks/usePlayerActions";
import { usePlayerUIState } from "@/hooks/usePlayerUIState";
import { PlayerQueueDrawer } from "./PlayerQueueDrawer";
import { MusicTrackMobileMenu } from "./MusicTrackMobileMenu";
import { AddToPlaylistDrawer } from "./AddToPlaylistDrawer";
import { QualityDrawer } from "./settings/QualityDrawer";
import { PlaybackSpeedDrawer } from "./settings/PlaybackSpeedDrawer";
import { SleepTimerDrawer } from "./settings/SleepTimerDrawer";
import { downloadMusicTrack } from "@/lib/utils/download";
import { getQualityShortLabel } from "@/lib/utils/quality";
import { formatTime } from "@/lib/utils/time";
import {
  useMusicStore,
  type FullScreenBackgroundMode,
} from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import toast from "react-hot-toast";
import { useCoverColors } from "@/hooks/useCoverColors";
import { pickBestColor, createBackgroundColor } from "@/lib/utils/color";

interface ModeIconProps {
  isRepeat: boolean;
  isShuffle: boolean;
}

function ModeIcon({ isRepeat, isShuffle }: ModeIconProps) {
  if (isRepeat) return <Repeat1 className="h-5 w-5" />;
  if (isShuffle) return <Shuffle className="h-5 w-5" />;
  return <Repeat className="h-5 w-5" />;
}

const BackgroundLayer = memo(
  ({
    hslColor,
    coverUrl,
    mode,
  }: {
    hslColor: [number, number, number] | null;
    coverUrl: string | null;
    mode: FullScreenBackgroundMode;
  }) => {
    const showThemeColor = mode === "theme" && hslColor;
    const showCoverMask = mode === "cover" && coverUrl;
    const dynamicStyle = useMemo(() => {
      if (!showThemeColor) return undefined;
      const [h, s, l] = hslColor;
      return {
        "--bg-h": h,
        "--bg-s": `${s}%`,
        "--bg-l": `${l}%`,
        background: `linear-gradient(to bottom,
        hsl(var(--bg-h), var(--bg-s), var(--bg-l)),
        hsl(var(--bg-h), var(--bg-s), calc(var(--bg-l) - 8%)))`,
      } as React.CSSProperties;
    }, [hslColor, showThemeColor]);

    return (
      <div className="absolute inset-0 z-[-1] overflow-hidden bg-zinc-950">
        {/* 动态颜色层 */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-in-out",
            showThemeColor ? "opacity-100" : "opacity-0"
          )}
          style={dynamicStyle}
        />

        {/* 封面遮罩层 */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            showCoverMask ? "opacity-100" : "opacity-0"
          )}
        >
          {coverUrl && (
            <img
              src={coverUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-[-32px] h-[calc(100%+64px)] w-[calc(100%+64px)] object-cover blur-3xl scale-110"
            />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-0 bg-linear-to-b from-black/10 via-zinc-950/20 to-black/60" />
        </div>

        {/* 兜底背景层 */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            showThemeColor || showCoverMask ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="absolute inset-0 bg-linear-to-b from-zinc-900 via-zinc-950 to-black" />
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[60vh] opacity-30 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 70%)",
            }}
          />
        </div>

        {/* 噪点层 */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none select-none bg-[url('data:image/svg+xml,...')]" />
      </div>
    );
  }
);
BackgroundLayer.displayName = "BackgroundLayer";

interface FullScreenPlayerProps {
  isFullScreen: boolean;
  onClose: () => void;
}

export function FullScreenPlayer({
  isFullScreen,
  onClose,
}: FullScreenPlayerProps) {
  const isMounted = useMounted();
  const {
    showLyrics,
    setShowLyrics,
    moreDrawerOpen,
    setMoreDrawerOpen,
    isAddToPlaylistOpen,
    setIsAddToPlaylistOpen,
    qualityDrawerOpen,
    setQualityDrawerOpen,
    speedDrawerOpen,
    setSpeedDrawerOpen,
    sleepDrawerOpen,
    setSleepDrawerOpen,
  } = usePlayerUIState(isFullScreen);

  const {
    queue,
    quality,
    currentIndex,
    setCurrentIndexAndPlay,
    clearQueue,
    reshuffle,
    removeFromQueue,
    playTrackAsNext,
    currentAudioUrl,
    fullScreenBackgroundMode,
    coverSize,
    coverRadius,
    playbackSpeed,
    sleepTimerIsActive,
    sleepTimerRemaining,
    isPlaying,
    isLoading,
    isRepeat,
    isShuffle,
    togglePlay,
    toggleRepeat,
    toggleShuffle,
    coverUrl,
  } = useMusicStore(
    useShallow((state) => ({
      queue: state.queue,
      currentIndex: state.currentIndex,
      setCurrentIndexAndPlay: state.setCurrentIndexAndPlay,
      clearQueue: state.clearQueue,
      reshuffle: state.reshuffle,
      removeFromQueue: state.removeFromQueue,
      playTrackAsNext: state.playTrackAsNext,
      currentAudioUrl: state.currentAudioUrl,
      quality: state.quality,
      fullScreenBackgroundMode: state.fullScreenBackgroundMode,
      coverSize: state.coverSize,
      coverRadius: state.coverRadius,
      playbackSpeed: state.playbackSpeed,
      sleepTimerIsActive: state.sleepTimerIsActive,
      sleepTimerRemaining: state.sleepTimerRemaining,
      isPlaying: state.isPlaying,
      isLoading: state.isLoading,
      isRepeat: state.isRepeat,
      isShuffle: state.isShuffle,
      togglePlay: state.togglePlay,
      toggleRepeat: state.toggleRepeat,
      toggleShuffle: state.toggleShuffle,
      coverUrl: state.coverUrl,
    }))
  );

  const currentTrack = queue[currentIndex] || null;

  const [isCoverPreviewOpen, setIsCoverPreviewOpen] = useState(false);

  /** 封面长按 → 打开图片预览（无封面时提示） */
  const handleCoverLongPress = () => {
    if (!coverUrl) {
      toast.error("暂无封面");
      return;
    }
    setIsCoverPreviewOpen(true);
  };

  const {
    handleShare,
    handleToggleLike,
    isCurrentTrackFavorite,
    trackInfoPressHandlers,
    coverPressHandlers,
  } = usePlayerActions(currentTrack, currentAudioUrl, handleCoverLongPress);

  const { swatches } = useCoverColors(
    coverUrl && fullScreenBackgroundMode === "theme" ? coverUrl : null
  );

  const hslColor = useMemo(() => {
    if (!swatches) return null;
    const dominant = pickBestColor(swatches);
    return dominant ? createBackgroundColor(dominant) : null;
  }, [swatches]);

  const playTrack = (index: number) => setCurrentIndexAndPlay(index);

  const handleClearQueue = () => {
    if (confirm("确定要清空播放列表吗？")) {
      clearQueue();
      toast.success("播放列表已清空");
    }
  };

  const handleRemoveFromQueue = (track: MusicTrack) => {
    removeFromQueue(track.id);
  };

  if (!isMounted) return null;

  // 循环切换播放模式：none → repeat → shuffle → none
  const handleModeToggle = () => {
    if (!isShuffle && !isRepeat) toggleRepeat();
    else if (isRepeat) {
      toggleRepeat();
      toggleShuffle();
    } else toggleShuffle();
  };

  const handlePrev = () => {
    if (queue.length === 0) return;
    setCurrentIndexAndPlay((currentIndex - 1 + queue.length) % queue.length);
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    setCurrentIndexAndPlay((currentIndex + 1) % queue.length);
  };

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 transition-transform duration-500 ease-in-out flex flex-col",
        isFullScreen ? "translate-y-0" : "translate-y-full"
      )}
    >
      {/* 背景渲染层 */}
      <BackgroundLayer
        hslColor={hslColor}
        coverUrl={coverUrl}
        mode={fullScreenBackgroundMode}
      />

      <header className="shrink-0 flex items-center justify-between px-6 pt-[calc(1rem+var(--safe-area-top))] relative z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-white/60 hover:bg-white/10 hover:text-white"
          onClick={() => {
            onClose();
          }}
        >
          <ChevronDown className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs tracking-widest text-white/50 hover:text-white hover:bg-white/10 h-8 px-3"
          onClick={() => setQualityDrawerOpen(true)}
        >
          {!showLyrics && getQualityShortLabel(quality)}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-white/60 hover:bg-white/10 hover:text-white"
          onClick={handleShare}
        >
          <SquareArrowOutUpRight className="h-5 w-5" />
        </Button>
      </header>

      <div
        className="flex-1 flex flex-col items-center justify-center px-2 relative z-10 overflow-hidden cursor-pointer"
        onClick={() => {
          // 封面预览打开期间不切换歌词，避免长按后的 click 冒泡到这里
          if (isCoverPreviewOpen) return;
          setShowLyrics(!showLyrics);
        }}
      >
        {showLyrics ? (
          <div className="w-full h-full">
            <LyricsPanel track={currentTrack} active={isFullScreen} />
          </div>
        ) : (
          <div
            {...coverPressHandlers}
            title="长按预览图片"
            className={cn(
              "relative aspect-square max-w-[calc(100vw-16px)] overflow-hidden transition-transform duration-500 ring-1 ring-white/5",
              isPlaying ? "scale-100" : "scale-[0.95]"
            )}
            style={{
              width: coverSize,
              borderRadius: coverRadius,
              boxShadow:
                fullScreenBackgroundMode === "theme" && hslColor
                  ? `0 30px 60px -12px hsla(${hslColor[0]}, ${
                      hslColor[1]
                    }%, ${Math.max(0, hslColor[2] - 20)}%, 0.4)`
                  : "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            <MusicCover
              src={coverUrl}
              alt={currentTrack?.name}
              className="h-full w-full object-cover dark select-none touch-none"
              iconClassName="h-16 w-16 text-white/30"
              previewOpen={isCoverPreviewOpen}
              onPreviewOpenChange={setIsCoverPreviewOpen}
            />
          </div>
        )}
      </div>

      <div className="shrink-0 px-8 py-4 relative z-10">
        <div className="flex items-center justify-between">
          <div
            className={cn("min-w-0 flex-1 cursor-pointer select-none")}
            onMouseDown={trackInfoPressHandlers.onMouseDown}
            onMouseUp={trackInfoPressHandlers.onMouseUp}
            onMouseLeave={trackInfoPressHandlers.onMouseLeave}
            onTouchStart={trackInfoPressHandlers.onTouchStart}
            onTouchEnd={trackInfoPressHandlers.onTouchEnd}
            title="长按复制歌曲信息"
          >
            <h2 className="truncate text-xl font-semibold text-white">
              {currentTrack?.name || "未知歌曲"}
            </h2>
            <p className="truncate text-sm text-white/60 mt-1">
              {currentTrack?.artist?.join(", ") || "未知歌手"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleLike();
              }}
            >
              <Heart
                className={cn(
                  "h-6 w-6 transition-all",
                  isCurrentTrackFavorite && "fill-primary text-primary"
                )}
              />
            </Button>
            {currentTrack && (
              <>
                <MusicTrackMobileMenu
                  track={currentTrack}
                  open={moreDrawerOpen}
                  onOpenChange={setMoreDrawerOpen}
                  onAddToPlaylist={() => {
                    setIsAddToPlaylistOpen(true);
                  }}
                  onDownload={() => {
                    downloadMusicTrack(currentTrack, parseInt(quality));
                  }}
                  isFavorite={isCurrentTrackFavorite}
                  onToggleLike={() => {
                    handleToggleLike();
                  }}
                  triggerClassName="h-10 w-10 text-white/70 hover:bg-white/10 hover:text-white"
                  onNavigate={() => {
                    onClose();
                  }}
                />
                <AddToPlaylistDrawer
                  open={isAddToPlaylistOpen}
                  onOpenChange={setIsAddToPlaylistOpen}
                  track={currentTrack}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-8 relative z-10">
        <PlayerProgressBar
          className="relative"
          leftTimeSuffix={
            playbackSpeed !== 1.0 ? (
              <span className="ml-1 text-[0.7em] align-sub opacity-70">
                x{playbackSpeed.toFixed(1)}
              </span>
            ) : null
          }
          centerContent={
            sleepTimerIsActive ? (
              <span className="flex items-center gap-1 text-[0.85em]">
                <ClockFading className="w-2.5 h-2.5" />
                {formatTime(sleepTimerRemaining)}
              </span>
            ) : null
          }
          onLeftTimeClick={() => setSpeedDrawerOpen(true)}
          onRightTimeClick={() => setSleepDrawerOpen(true)}
          onCenterClick={() => setSleepDrawerOpen(true)}
        />
      </div>

      <div className="shrink-0 flex items-center justify-between px-8 py-6 pb-[calc(2rem+var(--safe-area-bottom))] relative z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 transition-colors text-white/70 hover:text-white hover:bg-white/10"
          onClick={handleModeToggle}
        >
          <ModeIcon isRepeat={isRepeat} isShuffle={isShuffle} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={handlePrev}
        >
          <SkipBack className="h-6 w-6 fill-current" />
        </Button>
        <Button
          size="icon"
          className="h-16 w-16 rounded-full bg-white text-black shadow-lg hover:scale-105 transition-all active:scale-95"
          onClick={togglePlay}
          disabled={isLoading}
        >
          {isLoading ? (
            <Spinner className="h-7 w-7 text-black" />
          ) : isPlaying ? (
            <Pause className="h-7 w-7 fill-current" />
          ) : (
            <Play className="h-7 w-7 fill-current ml-1" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={handleNext}
        >
          <SkipForward className="h-6 w-6 fill-current" />
        </Button>
        <PlayerQueueDrawer
          queue={queue}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          isShuffle={isShuffle}
          onPlay={playTrack}
          onClear={handleClearQueue}
          onReshuffle={reshuffle}
          onRemove={handleRemoveFromQueue}
          onPlayTrack={playTrackAsNext}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <ListVideo className="h-5 w-5" />
            </Button>
          }
        />
      </div>

      <QualityDrawer
        open={qualityDrawerOpen}
        onOpenChange={setQualityDrawerOpen}
      />
      <PlaybackSpeedDrawer
        open={speedDrawerOpen}
        onOpenChange={setSpeedDrawerOpen}
      />
      <SleepTimerDrawer
        open={sleepDrawerOpen}
        onOpenChange={setSleepDrawerOpen}
      />
    </div>,
    document.body
  );
}
