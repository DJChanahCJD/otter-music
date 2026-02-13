"use client";

import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import {
  Shuffle,
  Repeat,
  Repeat1,
  ListVideo,
} from "lucide-react";
import { downloadMusicTrack } from "@/lib/utils/download";
import { cn } from "@/lib/utils";
import { PlayerProgressBar } from "./PlayerProgressBar";
import { useShallow } from "zustand/react/shallow";
import { FullScreenPlayer } from "./FullScreenPlayer";
import { useMusicCover } from "@/hooks/useMusicCover";
import { PlayerQueuePopover } from "./PlayerQueuePopover";
import { PlayerControls } from "./PlayerControls";
import { PlayerTrackInfo } from "./PlayerTrackInfo";
import { AddToPlaylistDialog } from "./AddToPlaylistDialog";
import { MusicTrackMobileMenu } from "./MusicTrackMobileMenu";
import { useMusicStore } from "@/store/music-store";
import toast from "react-hot-toast";

const ModeIcon = ({ isRepeat, isShuffle }: { isRepeat: boolean; isShuffle: boolean }) => {
  if (isRepeat) return <Repeat1 className="h-4 w-4" />;
  if (isShuffle) return <Shuffle className="h-4 w-4" />;
  return <Repeat className="h-4 w-4" />;
};

const getModeTitle = (isRepeat: boolean, isShuffle: boolean) => {
  if (isRepeat) return "单曲循环";
  if (isShuffle) return "随机播放";
  return "列表循环";
};

export function GlobalPlayer() {
  const {
    isPlaying,
    currentAudioTime: currentTime,
    duration,
    isRepeat,
    isShuffle,
    isLoading,
    togglePlay,
    setIsPlaying,
    seek,
    toggleRepeat,
    toggleShuffle,
    
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    queue,
    currentIndex,
    setCurrentIndex,
    clearQueue,
    reshuffle,
    addToQueue
  } = useMusicStore(
    useShallow((state) => ({
      isPlaying: state.isPlaying,
      currentAudioTime: state.currentAudioTime,
      duration: state.duration,
      isRepeat: state.isRepeat,
      isShuffle: state.isShuffle,
      isLoading: state.isLoading,
      togglePlay: state.togglePlay,
      setIsPlaying: state.setIsPlaying,
      seek: state.seek,
      toggleRepeat: state.toggleRepeat,
      toggleShuffle: state.toggleShuffle,
      
      isFavorite: state.isFavorite,
      addToFavorites: state.addToFavorites,
      removeFromFavorites: state.removeFromFavorites,
      queue: state.queue,
      currentIndex: state.currentIndex,
      setCurrentIndex: state.setCurrentIndex,
      clearQueue: state.clearQueue,
      reshuffle: state.reshuffle,
      addToQueue: state.addToQueue
    }))
  );

  const currentTrack = queue[currentIndex] || null;

  // Controls Implementation
  const next = useCallback(() => {
    if (queue.length === 0) return;
    setCurrentIndex((currentIndex + 1) % queue.length);
  }, [queue.length, currentIndex, setCurrentIndex]);

  const previous = useCallback(() => {
    if (queue.length === 0) return;
    setCurrentIndex((currentIndex - 1 + queue.length) % queue.length);
  }, [queue.length, currentIndex, setCurrentIndex]);

  const playTrack = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  }, [setCurrentIndex, setIsPlaying]);
  

  const handleClearQueue = () => {
    if (confirm("确定要清空播放列表吗？")) {
      clearQueue();
      toast.success("播放列表已清空");
    }
  };

  const coverUrl = useMusicCover(currentTrack);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);

  const handleToggleFavorite = () => {
    if (!currentTrack) return;
    if (isFavorite(currentTrack.id)) {
      removeFromFavorites(currentTrack.id);
      toast.success("已取消喜欢");
    } else {
      addToFavorites(currentTrack);
      toast.success("已喜欢");
    }
  };

  const handleDownload = async () => {
    if (!currentTrack) return;
    downloadMusicTrack(currentTrack);
  };

  const handleToggleMode = () => {
    if (isRepeat) {
      toggleRepeat();
      if (!isShuffle) toggleShuffle();
    } else if (isShuffle) {
      toggleShuffle();
    } else {
      toggleRepeat();
    }
  };

  return (
    <>
      <FullScreenPlayer
        isFullScreen={isFullScreen}
        onClose={() => setIsFullScreen(false)}
        currentTrack={currentTrack}
        currentTime={currentTime}
        coverUrl={coverUrl}
        isFavorite={currentTrack ? isFavorite(currentTrack.id) : false}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Bottom Player Bar */}
      <div
        className={cn(
          "relative flex flex-col w-full backdrop-blur-md border-t z-50 pt-1 transition-all duration-500",
          isFullScreen
            ? "bg-black/80 border-white/10 text-white dark"
            : "bg-background/70 border-border",
        )}
      >
        {/* 1. Top Progress Bar */}
        <PlayerProgressBar
          currentTime={currentTime}
          duration={duration}
          onSeek={(val) => seek(val[0])}
        />

        {/* 2. Main Controls Area */}
        <div className="flex items-center justify-between px-4 h-24 gap-4">
          
          {/* Left - Album + Song Name (Non-Fullscreen Only) */}
          {!isFullScreen && (
            <div className="flex-1 min-h-0">
              <PlayerTrackInfo
                track={currentTrack}
                coverUrl={coverUrl}
                isFullScreen={isFullScreen}
                onToggleFullScreen={() => setIsFullScreen(true)}
              />
            </div>
          )}

          {/* Center: Controls */}
          <div className="flex-1 flex items-center justify-center gap-4">
            
            {/* Non-Fullscreen - Play Button and Queue Button */}
            {!isFullScreen && (
              <div className="flex flex-end items-center gap-2">
                <PlayerControls
                  isPlaying={isPlaying}
                  isLoading={isLoading}
                  onPlayToggle={togglePlay}
                  onPrev={previous}
                  onNext={next}
                  size="lg"
                  showPrevNext={false}
                />
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
                      className="h-10 w-10 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      title="播放列表"
                    >
                      <ListVideo className="h-5 w-5" />
                    </Button>
                  }
                />
                
                {currentTrack && (
                   <>
                     <MusicTrackMobileMenu 
                        track={currentTrack}
                        open={isMobileMenuOpen}
                        onOpenChange={setIsMobileMenuOpen}
                        onAddToQueue={() => {
                           addToQueue(currentTrack);
                           toast.success("已加入播放列表");
                        }}
                        onAddToPlaylistTrigger={() => setIsAddToPlaylistOpen(true)}
                        onDownload={handleDownload}
                        onToggleLike={handleToggleFavorite}
                        isFavorite={isFavorite(currentTrack.id)}
                        showThemeToggle={true}
                     />
                     <AddToPlaylistDialog 
                        open={isAddToPlaylistOpen}
                        onOpenChange={setIsAddToPlaylistOpen}
                        track={currentTrack}
                     />
                   </>
                )}
              </div>
            )}

            {/* Fullscreen - 5 Buttons Centered */}
            {isFullScreen && (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  onClick={handleToggleMode}
                  title={getModeTitle(isRepeat, isShuffle)}
                >
                  <ModeIcon isRepeat={isRepeat} isShuffle={isShuffle} />
                </Button>

                <PlayerControls
                  isPlaying={isPlaying}
                  isLoading={isLoading}
                  onPlayToggle={togglePlay}
                  onPrev={previous}
                  onNext={next}
                  size="lg"
                />

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
                      className="h-8 w-8 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      title="播放列表"
                    >
                      <ListVideo className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
