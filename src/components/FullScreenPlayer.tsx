"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, memo, useMemo } from "react";
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

const BackgroundLayer = memo(({ hslColor }: { hslColor: [number, number, number] | null }) => {
  const dynamicStyle = useMemo(() => {
    if (!hslColor) return undefined;
    const [h, s, l] = hslColor;
    return {
      "--bg-h": h,
      "--bg-s": `${s}%`,
      "--bg-l": `${l}%`,
      background: `linear-gradient(to bottom, 
        hsl(var(--bg-h), var(--bg-s), var(--bg-l)), 
        hsl(var(--bg-h), var(--bg-s), calc(var(--bg-l) - 8%)))`,
    } as React.CSSProperties;
  }, [hslColor]);

  return (
    <div className="absolute inset-0 z-[-1] overflow-hidden bg-zinc-950">
      {/* 动态颜色层 */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-1000 ease-in-out",
          hslColor ? "opacity-100" : "opacity-0"
        )}
        style={dynamicStyle}
      />

      {/* 兜底背景层 */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-1000",
          hslColor ? "opacity-0" : "opacity-100"
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
});
BackgroundLayer.displayName = "BackgroundLayer";

interface FullScreenPlayerProps {
  isFullScreen: boolean;
  onClose: () => void;
  currentTrack: MusicTrack | null;
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
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
}

export function FullScreenPlayer({
  isFullScreen,
  onClose,
  currentTrack,
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
      <BackgroundLayer hslColor={hslColor} />

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
            <LyricsPanel track={currentTrack} active={isFullScreen} />
          </div>
        ) : (
          <div 
            className={cn("relative aspect-square w-72 max-w-[320px] overflow-hidden rounded-3xl transition-transform duration-500 ring-1 ring-white/5", isPlaying ? "scale-100" : "scale-[0.95]")}
            style={{
              boxShadow: hslColor 
                ? `0 30px 60px -12px hsla(${hslColor[0]}, ${hslColor[1]}%, ${Math.max(0, hslColor[2] - 20)}%, 0.4)`
                : "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
            }}
          >
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
        <PlayerProgressBar className="relative" />
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