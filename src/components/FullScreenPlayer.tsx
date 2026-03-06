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
import { ColorExtractor } from "react-color-extractor";
import { pickBestColor } from "@/lib/utils/color";

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
  
  const [hslColor, setHslColor] = useState<[number, number, number] | null>(null);
  const [prevCoverUrl, setPrevCoverUrl] = useState(coverUrl);

  if (coverUrl !== prevCoverUrl) {
    setPrevCoverUrl(coverUrl);
    setHslColor(null);
  }

  useEffect(() => {
    if (!isFullScreen) {
      const timer = setTimeout(() => setShowLyrics(false), 500);
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
    if (!currentTrack || !currentAudioUrl) return toast.error("暂无歌曲或音频链接");
    try {
      await navigator.clipboard.writeText(`【OtterMusic】${currentTrack.name} - ${currentTrack.artist.join(", ")}\n${currentAudioUrl}`);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请重试");
    }
  };

  if (!isMounted) return null;

  const modeTitle = isRepeat ? "单曲循环" : isShuffle ? "随机播放" : "列表循环";
  const handleModeToggle = () => {
    if (!isShuffle && !isRepeat) onToggleRepeat();
    else if (isRepeat) { onToggleRepeat(); onToggleShuffle(); }
    else onToggleShuffle();
  };

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 transition-transform duration-500 ease-in-out flex flex-col dark",
        isFullScreen ? "translate-y-0" : "translate-y-full"
      )}
    >
      {coverUrl && (
        <div className="hidden">
          <ColorExtractor
            src={coverUrl}
            maxColors={10}
            getColors={(colors: string[]) => setHslColor(pickBestColor(colors))}
            onError={() => setHslColor(null)}
          />
        </div>
      )}

      {/* 背景渲染层 */}
      <div className="absolute inset-0 z-[-1] overflow-hidden bg-zinc-950">
        {hslColor ? (
          <div
            className="absolute inset-0 transition-colors duration-1000 ease-in-out"
            style={{
              background: `linear-gradient(to bottom, hsl(${hslColor[0]}, ${hslColor[1]}%, ${hslColor[2]}%), hsl(${hslColor[0]}, ${hslColor[1]}%, ${Math.max(5, hslColor[2] - 8)}%))`
            }}
          />
        ) : (
          /* 极简深色兜底背景 - 优化版 */
          <div className="absolute inset-0 transition-all duration-1000 ease-in-out bg-zinc-950">
            {/* 深邃的对角线渐变底色 */}
            <div className="absolute inset-0 bg-linear-to-br from-zinc-800/40 via-zinc-950 to-black" />
            
            {/* 顶部柔和的聚光灯光晕 */}
            <div 
              className="absolute top-0 left-1/2 -translate-x-1/2 w-screen max-w-2xl h-[60vh] opacity-40 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 70%)' }}
            />
          </div>
        )}

        {/* 统一的质感噪点层 (覆盖在提取色和默认色之上，增加整体高级感) */}
        <div 
          className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
        />
      </div>

      <header className="shrink-0 flex items-center justify-between px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-6 relative z-10">
        <Button variant="ghost" size="icon" className="h-12 w-12 text-white/60 hover:bg-white/10 hover:text-white" onClick={onClose}>
          <ChevronDown className="h-6 w-6" />
        </Button>
        <p className="text-xs uppercase tracking-widest text-white/50">{!showLyrics && modeTitle}</p>
        <Button variant="ghost" size="icon" className="h-12 w-12 text-white/60 hover:bg-white/10 hover:text-white" onClick={handleShare}>
          <SquareArrowOutUpRight className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-2 relative z-10 overflow-hidden cursor-pointer" onClick={() => setShowLyrics(!showLyrics)}>
        {showLyrics ? (
          <div className="w-full h-full">
            <LyricsPanel track={currentTrack} currentTime={currentTime} active={isFullScreen} />
          </div>
        ) : (
          <div className={cn("relative aspect-square w-72 max-w-[320px] overflow-hidden rounded-3xl shadow-xl shadow-black/40 transition-transform duration-500 ring-1 ring-white/5", isPlaying ? "scale-100" : "scale-[0.95]")}>
            <MusicCover src={coverUrl} alt={currentTrack?.name} className="h-full w-full object-cover" iconClassName="h-16 w-16 text-white/30" />
          </div>
        )}
      </div>

      <div className="shrink-0 px-8 py-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold text-white">{currentTrack?.name || "未知歌曲"}</h2>
            <p className="truncate text-sm text-white/60 mt-1">{currentTrack?.artist?.join(", ") || "未知歌手"}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-10 w-10 text-white/70 hover:bg-white/10 hover:text-white" onClick={(e) => { e.stopPropagation(); onToggleLike?.(); }}>
              <Heart className={cn("h-6 w-6 transition-all", isFavorite && "fill-primary text-primary")} />
            </Button>
            {currentTrack && (
              <>
                <MusicTrackMobileMenu track={currentTrack} open={moreDrawerOpen} onOpenChange={setMoreDrawerOpen} onAddToPlaylist={() => setIsAddToPlaylistOpen(true)} onDownload={() => downloadMusicTrack(currentTrack, parseInt(quality))} isFavorite={isFavorite} onToggleLike={onToggleLike} triggerClassName="h-10 w-10 text-white/70 hover:bg-white/10 hover:text-white" onNavigate={onClose} />
                <AddToPlaylistDialog open={isAddToPlaylistOpen} onOpenChange={setIsAddToPlaylistOpen} track={currentTrack} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-8 relative z-10">
        <PlayerProgressBar currentTime={currentTime} duration={duration} onSeek={onSeek} className="relative" />
      </div>

      <div className="shrink-0 flex items-center justify-between px-8 py-6 pb-[calc(2rem+env(safe-area-inset-bottom))] relative z-10">
        <Button variant="ghost" size="icon" className="h-12 w-12 transition-colors text-white/70 hover:text-white hover:bg-white/10" onClick={handleModeToggle}>
          <ModeIcon isRepeat={isRepeat} isShuffle={isShuffle} />
        </Button>
        <Button variant="ghost" size="icon" className="h-12 w-12 text-white/70 hover:bg-white/10 hover:text-white" onClick={onPrev}>
          <SkipBack className="h-6 w-6 fill-current" />
        </Button>
        <Button size="icon" className="h-16 w-16 rounded-full bg-white text-black shadow-lg hover:scale-105 transition-all active:scale-95" onClick={onTogglePlay} disabled={isLoading}>
          {isLoading ? <Spinner className="h-7 w-7 text-black" /> : isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current ml-1" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-12 w-12 text-white/70 hover:bg-white/10 hover:text-white" onClick={onNext}>
          <SkipForward className="h-6 w-6 fill-current" />
        </Button>
        <PlayerQueuePopover queue={queue} currentIndex={currentIndex} isPlaying={isPlaying} isShuffle={isShuffle} onPlay={playTrack} onClear={handleClearQueue} onReshuffle={reshuffle} trigger={<Button variant="ghost" size="icon" className="h-12 w-12 text-white/70 hover:bg-white/10 hover:text-white"><ListVideo className="h-5 w-5" /></Button>} />
      </div>
    </div>,
    document.body
  );
}