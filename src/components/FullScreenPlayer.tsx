"use client";

import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LyricsPanel } from "./LyricsPanel";
import { MusicCover } from "./MusicCover";
import { PlayerProgressBar } from "./PlayerProgressBar";
import { MusicTrack } from "@/types/music";
import { ChevronDown, Heart, ListVideo, Shuffle, Repeat, Repeat1, SkipBack, SkipForward, Play, Pause, SquareArrowOutUpRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useMounted } from "@/hooks/use-mounted";
import { PlayerQueuePopover } from "./PlayerQueuePopover";
import { MusicTrackMobileMenu } from "./MusicTrackMobileMenu";
import { AddToPlaylistDialog } from "./AddToPlaylistDialog";
import { downloadMusicTrack } from "@/lib/utils/download";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import toast from "react-hot-toast";
import { FastAverageColor } from "fast-average-color";

/**
 * 压暗颜色并降低饱和度
 * @param rgba - 原始 RGBA 字符串
 * @returns 压暗后的 RGBA 字符串
 */
function toneDownColor(rgba: string) {
  const matches = rgba.match(/\d+/g);
  if (!matches || matches.length < 3) return rgba;

  const [r, g, b] = matches.slice(0, 3).map(Number);

  const factor = 0.55;

  const nr = Math.min(255, Math.round(r * factor * 1.05));
  const ng = Math.min(255, Math.round(g * factor * 1.05));
  const nb = Math.min(255, Math.round(b * factor * 1.05));

  return `rgba(${nr}, ${ng}, ${nb}, 1)`;
}

interface ModeIconProps {
  isRepeat: boolean;
  isShuffle: boolean;
}

function ModeIcon({ isRepeat, isShuffle }: ModeIconProps) {
  if (isRepeat) return <Repeat1 className="h-5 w-5" />;
  if (isShuffle) return <Shuffle className="h-5 w-5" />;
  return <Repeat className="h-5 w-5" />;
}

interface FullScreenPlayerProps {
  isFullScreen: boolean;
  onClose: () => void;
  currentTrack: MusicTrack | null;
  currentTime: number;
  duration: number;
  coverUrl: string | null;
  isFavorite?: boolean;
  onToggleLike?: () => void;
  isPlaying: boolean;
  isLoading: boolean;
  isRepeat: boolean;
  isShuffle: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (value: number[]) => void;
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
}

export function FullScreenPlayer({
  isFullScreen,
  onClose,
  currentTrack,
  currentTime,
  duration,
  coverUrl,
  isFavorite = false,
  onToggleLike,
  isPlaying,
  isLoading,
  isRepeat,
  isShuffle,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onToggleRepeat,
  onToggleShuffle,
}: FullScreenPlayerProps) {
  const isMounted = useMounted();
  const [showLyrics, setShowLyrics] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [dominantColor, setDominantColor] = useState<string>("rgba(24, 24, 27, 1)"); // 默认深锌色
  // 提取封面主色调
  useEffect(() => {
    if (!coverUrl) {
      return;
    }
    const fac = new FastAverageColor();
    fac.getColorAsync(coverUrl, { algorithm: "dominant" })
      .then((color) => {
        setDominantColor(toneDownColor(color.rgba));
      })
      .catch((e) => {
        console.error("提取主色失败:", e);
        setDominantColor("rgba(24, 24, 27, 1)");
      })
      .finally(() => fac.destroy());
  }, [coverUrl]);

  // 退出全屏时重置歌词显示状态
  useEffect(() => {
    if (!isFullScreen) {
      const timer = setTimeout(() => {
        setShowLyrics(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFullScreen]);

  const { queue, quality, currentIndex, setCurrentIndexAndPlay, clearQueue, reshuffle, currentAudioUrl } = useMusicStore(
    useShallow((state) => ({
      queue: state.queue,
      currentIndex: state.currentIndex,
      setCurrentIndexAndPlay: state.setCurrentIndexAndPlay,
      clearQueue: state.clearQueue,
      reshuffle: state.reshuffle,
      currentAudioUrl: state.currentAudioUrl,
      quality: state.quality,
    }))
  );

  const playTrack = (index: number) => setCurrentIndexAndPlay(index);

  const handleClearQueue = () => {
    if (confirm("确定要清空播放列表吗？")) {
      clearQueue();
      toast.success("播放列表已清空");
    }
  };

  const handleShare = async () => {
    if (!currentTrack || !currentAudioUrl) {
      toast.error("暂无歌曲或音频链接");
      return;
    }
    try {
      const shareText = `【OtterMusic】${currentTrack.name} - ${currentTrack.artist.join(", ")}\n${currentAudioUrl}`;
      await navigator.clipboard.writeText(shareText);
      toast.success("已复制到剪贴板");
    } catch (err) {
      console.error("复制失败:", err);
      toast.error("复制失败，请重试");
    }
  };

  if (!isMounted) return null;

  const getModeTitle = () => {
    if (isRepeat) return "单曲循环";
    if (isShuffle) return "随机播放";
    return "列表循环";
  };

  const handleModeToggle = () => {
    if (!isShuffle && !isRepeat) onToggleRepeat();
    else if (isRepeat) { onToggleRepeat(); onToggleShuffle(); }
    else onToggleShuffle();
  };

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 bg-zinc-950 transition-transform duration-500 ease-in-out flex flex-col dark",
        isFullScreen ? "translate-y-0" : "translate-y-full"
      )}
    >
      {/* 纯净沉浸式动态背景 */}
      <div className="absolute inset-0 z-[-1] overflow-hidden pointer-events-none">
        {/* 封面模糊背景 */}
        {coverUrl && (
          <div
            className="absolute inset-0 scale-125 blur-3xl opacity-40 transition-all duration-1000 will-change-transform"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}

        {/* 顶部主光源 (模拟舞台灯光) */}
        <div
          className="absolute -inset-[20%] opacity-50 transition-all duration-1000 ease-out"
          style={{
            background: `radial-gradient(circle at 50% -10%, ${dominantColor} 0%, transparent 65%)`,
          }}
        />

        {/* 底部氛围光 */}
        <div
          className="absolute -inset-[20%] opacity-25 transition-all duration-1000 ease-out delay-100"
          style={{
            background: `radial-gradient(circle at 50% 120%, ${dominantColor} 0%, transparent 70%)`,
          }}
        />

        {/* 全局文字与控件保护层（从下到上的深色渐变） */}
        <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/40 to-black/10" />

        {/* 进阶噪点纹理 (提升质感) */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none" 
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` 
          }} 
        />
      </div>

      {/* Top Control Bar */}
      <header className="shrink-0 flex items-center justify-between px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-6 relative z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-white/60 hover:bg-muted/40 hover:text-foreground"
          onClick={onClose}
        >
          <ChevronDown className="h-6 w-6" />
        </Button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-white/50">
            {!showLyrics && getModeTitle()}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-white/60 hover:bg-muted/40 hover:text-foreground"
          onClick={handleShare}
          title="分享"
        >
          <SquareArrowOutUpRight className="h-5 w-5" />
        </Button>
      </header>

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-2 relative z-10 overflow-hidden cursor-pointer"
        onClick={() => setShowLyrics(!showLyrics)}
      >
        {showLyrics ? (
          <div className="w-full h-full">
            <LyricsPanel
              track={currentTrack}
              currentTime={currentTime}
              active={isFullScreen}
            />
          </div>
        ) : (
          <div
            className={cn(
              "relative aspect-square w-72 max-w-[320px] overflow-hidden rounded-3xl shadow-2xl transition-transform duration-500",
              isPlaying ? "scale-100" : "scale-[0.95]"
            )}
          >
            <MusicCover
              src={coverUrl}
              alt={currentTrack?.name}
              className="h-full w-full"
              iconClassName="h-16 w-16 text-white/30"
            />
          </div>
        )}
      </div>

      {/* Song Info */}
      <div className="shrink-0 px-8 py-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold text-white" title={currentTrack?.name || "未知歌曲"}>
              {currentTrack?.name || "未知歌曲"}
            </h2>
            <p className="truncate text-sm text-white/60 mt-1" title={currentTrack?.artist?.join(", ") || "未知歌手"}>
              {currentTrack?.artist?.join(", ") || "未知歌手"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={(e) => { e.stopPropagation(); onToggleLike?.(); }}
            >
              <Heart
                className={cn(
                  "h-6 w-6 transition-all",
                  isFavorite && "fill-primary text-primary"
                )}
              />
            </Button>
            {currentTrack && (
              <>
                <MusicTrackMobileMenu
                  track={currentTrack}
                  open={moreDrawerOpen}
                  onOpenChange={setMoreDrawerOpen}
                  onAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
                  onDownload={() => downloadMusicTrack(currentTrack, parseInt(quality))}
                  isFavorite={isFavorite}
                  onToggleLike={onToggleLike}
                  triggerClassName="h-10 w-10 text-white/70 hover:bg-white/10 hover:text-white"
                  onNavigate={onClose}
                />
                <AddToPlaylistDialog
                  open={isAddToPlaylistOpen}
                  onOpenChange={setIsAddToPlaylistOpen}
                  track={currentTrack}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="shrink-0 px-8 relative z-10">
        <PlayerProgressBar
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
          className="relative"
        />
      </div>

      {/* Bottom Controls */}
      <div className="shrink-0 flex items-center justify-between px-8 py-6 pb-[calc(2rem+env(safe-area-inset-bottom))] relative z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 transition-colors text-white/70 hover:text-white hover:bg-white/10"
          onClick={handleModeToggle}
          title={getModeTitle()}
        >
          <ModeIcon isRepeat={isRepeat} isShuffle={isShuffle} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={onPrev}
        >
          <SkipBack className="h-6 w-6 fill-current" />
        </Button>
        <Button
          size="icon"
          className="h-16 w-16 rounded-full bg-white text-black shadow-lg hover:scale-105 transition-all active:scale-95"
          onClick={onTogglePlay}
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
          onClick={onNext}
        >
          <SkipForward className="h-6 w-6 fill-current" />
        </Button>

        <PlayerQueuePopover
          queue={queue}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          isShuffle={isShuffle}
          onPlay={playTrack}
          onClear={handleClearQueue}
          onReshuffle={reshuffle}
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
    </div>,
    document.body
  );
}