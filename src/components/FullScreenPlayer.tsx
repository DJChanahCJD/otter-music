"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LyricsPanel } from "./LyricsPanel";
import { MusicCover } from "./MusicCover";
import { PlayerProgressBar } from "./PlayerProgressBar";
import { MusicTrack } from "@/types/music";
import { ChevronDown, Heart, ListVideo, Shuffle, Repeat, Repeat1, SkipBack, SkipForward, Play, Pause, SquareArrowOutUpRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useMounted } from "@/hooks/use-mounted";
import { useBackButton } from "@/hooks/use-back-button";
import { PlayerQueuePopover } from "./PlayerQueuePopover";
import { MusicTrackMobileMenu } from "./MusicTrackMobileMenu";
import { AddToPlaylistDialog } from "./AddToPlaylistDialog";
import { downloadMusicTrack } from "@/lib/utils/download";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import toast from "react-hot-toast";

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
  onToggleFavorite?: () => void;
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
  onToggleFavorite,
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

  useBackButton(onClose, isFullScreen);

  const { queue, quality, currentIndex, setCurrentIndex, setIsPlaying, clearQueue, reshuffle, addToNextPlay, currentAudioUrl } = useMusicStore(
    useShallow((state) => ({
      queue: state.queue,
      currentIndex: state.currentIndex,
      setCurrentIndex: state.setCurrentIndex,
      setIsPlaying: state.setIsPlaying,
      clearQueue: state.clearQueue,
      reshuffle: state.reshuffle,
      addToNextPlay: state.addToNextPlay,
      currentAudioUrl: state.currentAudioUrl,
      quality: state.quality,
    }))
  );

  const playTrack = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  const handleClearQueue = () => {
    if (confirm("确定要清空播放列表吗？")) {
      clearQueue();
      toast.success("播放列表已清空");
    }
  };

  const handleShare = async () => {
    if (!currentTrack) {
      toast.error("暂无歌曲信息");
      return;
    }
    if (!currentAudioUrl) {
      toast.error("暂无音频链接");
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
    if (!isShuffle && !isRepeat) {
      onToggleRepeat();
    } else if (isRepeat) {
      onToggleRepeat();
      onToggleShuffle();
    } else {
      onToggleShuffle();
    }
  };

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 bg-transparent transition-transform duration-500 ease-in-out flex flex-col dark",
        isFullScreen ? "translate-y-0" : "translate-y-full"
      )}
    >
      {/* Dynamic Background Layer */}
      <div className="absolute inset-0 z-[-1] overflow-hidden bg-zinc-950">
        {coverUrl ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center transition-all duration-700 blur-2xl scale-110 opacity-40"
              style={{ backgroundImage: `url(${coverUrl})` }}
            />
            <div className="absolute inset-0 bg-black/60" />
          </>
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-zinc-900 via-slate-900 to-black" />
        )}
      </div>

      {/* Top Control Bar */}
      <header className="shrink-0 flex items-center justify-between px-6 pt-14 pb-6 relative z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          onClick={onClose}
        >
          <ChevronDown className="h-6 w-6" />
        </Button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            { !showLyrics && getModeTitle() }
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          onClick={handleShare}
          title="分享"
        >
          <SquareArrowOutUpRight className="h-5 w-5" />
        </Button>
      </header>

      {/* Main Content Area */}
      <div 
        className="flex-1 flex flex-col items-center justify-center px-8 relative z-10 overflow-hidden cursor-pointer"
        onClick={() => setShowLyrics(!showLyrics)}
      >
        {showLyrics ? (
          <div
            className="w-full h-full"
          >
            <LyricsPanel
              track={currentTrack}
              currentTime={currentTime}
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
              iconClassName="h-16 w-16"
            />
          </div>
        )}
      </div>

      {/* Song Info */}
      <div className="shrink-0 px-8 py-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold text-foreground">
              {currentTrack?.name || "未知歌曲"}
            </h2>
            <p className="truncate text-sm text-muted-foreground mt-1">
              {currentTrack?.artist?.join(", ") || "未知歌手"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              onClick={onToggleFavorite}
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
                  onAddToNextPlay={() => {
                    addToNextPlay(currentTrack);
                    toast.success("已添加到下一首播放");
                  }}
                  onAddToPlaylistTrigger={() => setIsAddToPlaylistOpen(true)}
                  onDownload={() => downloadMusicTrack(currentTrack, parseInt(quality))}
                  onToggleLike={() => onToggleFavorite?.()}
                  hideLike={true}
                  triggerClassName="h-10 w-10 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
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
          className={cn(
            "h-12 w-12 transition-colors",
            "text-muted-foreground hover:text-foreground"
          )}
          onClick={handleModeToggle}
          title={getModeTitle()}
        >
          <ModeIcon isRepeat={isRepeat} isShuffle={isShuffle} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          onClick={onPrev}
          title="上一首"
        >
          <SkipBack className="h-6 w-6 fill-current" />
        </Button>

        <Button
          size="icon"
          className="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all active:scale-95"
          onClick={onTogglePlay}
          disabled={isLoading}
          title={isPlaying ? "暂停" : "播放"}
        >
          {isLoading ? (
            <Spinner className="h-7 w-7" />
          ) : isPlaying ? (
            <Pause className="h-7 w-7 fill-current" />
          ) : (
            <Play className="h-7 w-7 fill-current ml-1" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          onClick={onNext}
          title="下一首"
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
              className="h-12 w-12 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              title="播放列表"
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
