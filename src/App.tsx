"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { GlobalMusicPlayer } from "./components/GlobalMusicPlayer";
import { MusicLayout } from "./components/MusicLayout";
import { MusicTabBar, TabId } from "./components/MusicTabBar";
import { MusicNowPlayingBar } from "./components/MusicNowPlayingBar";
import { MusicPlaylistView } from "./components/MusicPlaylistView";
import { MusicSearchView } from "./components/MusicSearchView";
import { FullScreenPlayer } from "./components/FullScreenPlayer";
import { MinePage } from "./components/MinePage";
import { QueuePage } from "./components/QueuePage";
import { LocalMusicPage } from "./components/LocalMusicPage";
import { useMusicStore } from "./store/music-store";
import { useMusicCover } from "./hooks/useMusicCover";
import type { MusicTrack } from "./types/music";



export default function MusicPage() {
  const {
    queue,
    playContext,
    favorites,
    playlists,
    removeFromFavorites,
    removeFromPlaylist,
    renamePlaylist,
    deletePlaylist,
    clearQueue,
    currentIndex,
    isPlaying,
    setIsPlaying,
    togglePlay,
    setCurrentIndex,
    isFavorite,
    addToFavorites,
    removeFromFavorites: removeFavorite,
    duration,
    isLoading,
    isRepeat,
    isShuffle,
    seek,
    toggleRepeat,
    toggleShuffle,
  } = useMusicStore();

  const [currentTab, setCurrentTab] = useState<TabId>("search");
  const [activePlaylistId, setActivePlaylistId] = useState<string>();
  const [isFullScreenPlayer, setIsFullScreenPlayer] = useState(false);
  const [isQueuePage, setIsQueuePage] = useState(false);
  const [isLocalMusicPage, setIsLocalMusicPage] = useState(false);

  const currentTrack = queue[currentIndex];
  const coverUrl = useMusicCover(currentTrack);

  const handlePlayContext = (track: MusicTrack, list: MusicTrack[]) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    const index = list.findIndex((t) => t.id === track.id);
    if (index === -1) return;

    const isSameContext =
      queue.length === list.length && queue[0]?.id === list[0]?.id;

    if (isSameContext) {
      setCurrentIndex(index);
      setIsPlaying(true);
    } else {
      playContext(list, index);
    }
  };

  const handlePlayInPlaylist = (track: MusicTrack | null, index?: number) => {
    if (track && index !== undefined && currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    const list =
      currentTab === "favorites"
        ? favorites
        : playlists.find((p) => p.id === activePlaylistId)?.tracks || [];

    playContext(list, index);
  };

  const handlePlayInQueue = (track: MusicTrack | null, index?: number) => {
    if (track && index !== undefined && currentTrack?.id === track.id) {
      togglePlay();
      return;
    }
    playContext(queue, index);
  };

  const handleToggleFavorite = () => {
    if (!currentTrack) return;
    if (isFavorite(currentTrack.id)) {
      removeFavorite(currentTrack.id);
    } else {
      addToFavorites(currentTrack);
    }
  };

  const handleSelectPlaylist = (playlistId: string) => {
    setActivePlaylistId(playlistId);
    setIsLocalMusicPage(false);
  };

  const handleBackFromPlaylist = () => {
    setActivePlaylistId(undefined);
  };

  const handlePrev = useCallback(() => {
    if (queue.length === 0) return;
    setCurrentIndex((currentIndex - 1 + queue.length) % queue.length);
  }, [queue.length, currentIndex, setCurrentIndex]);

  const handleNext = useCallback(() => {
    if (queue.length === 0) return;
    setCurrentIndex((currentIndex + 1) % queue.length);
  }, [queue.length, currentIndex, setCurrentIndex]);

  const handleSeek = useCallback((value: number[]) => {
    seek(value[0]);
  }, [seek]);

  const handleClearQueue = () => {
    clearQueue();
    setIsPlaying(false);
    setCurrentIndex(0);
    setIsQueuePage(false);
  };

  const handleRemoveFromQueue = (track: MusicTrack) => {
    const newQueue = queue.filter((item) => item.id !== track.id);
    if (newQueue.length === 0) {
      handleClearQueue();
      return;
    }
    const nextIndex = Math.min(currentIndex, newQueue.length - 1);
    playContext(newQueue, nextIndex);
  };

  const renderContent = () => {
    if (isLocalMusicPage) {
      return (
        <LocalMusicPage
          onBack={() => setIsLocalMusicPage(false)}
        />
      );
    }

    if (isQueuePage) {
      return (
        <QueuePage
          queue={queue}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
          onPlay={handlePlayInQueue}
          onRemove={handleRemoveFromQueue}
          onClear={handleClearQueue}
          onBack={() => setIsQueuePage(false)}
        />
      );
    }

    if (activePlaylistId) {
      const playlist = playlists.find((p) => p.id === activePlaylistId);
      return (
        <MusicPlaylistView
          title={playlist?.name || "歌单"}
          description={`创建于 ${format(playlist?.createdAt || 0, "yyyy-MM-dd")}`}
          tracks={playlist?.tracks || []}
          playlistId={activePlaylistId}
          onPlay={handlePlayInPlaylist}
          onRemove={(t) => removeFromPlaylist(activePlaylistId, t.id)}
          onRename={renamePlaylist}
          onDelete={(id) => {
            deletePlaylist(id);
            handleBackFromPlaylist();
          }}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
        />
      );
    }

    if (currentTab === "search") {
      return (
        <MusicSearchView
          onPlay={handlePlayContext}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
        />
      );
    }

    if (currentTab === "favorites") {
      return (
        <MusicPlaylistView
          title="我的喜欢"
          tracks={favorites}
          onPlay={handlePlayInPlaylist}
          onRemove={(t) => removeFromFavorites(t.id)}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
        />
      );
    }

    if (currentTab === "mine") {
      return (
        <MinePage
          onOpenQueue={() => setIsQueuePage(true)}
          onOpenLocalMusic={() => setIsLocalMusicPage(true)}
          onSelectPlaylist={handleSelectPlaylist}
        />
      );
    }

    return null;
  };

  return (
    <>
      <MusicLayout
        hidePlayer={isFullScreenPlayer}
        hasCurrentTrack={!!currentTrack}
        player={<MusicNowPlayingBar onOpenFullScreen={() => setIsFullScreenPlayer(true)} />}
        tabBar={
          <MusicTabBar
            activeTab={currentTab}
            onTabChange={(tab) => {
              setCurrentTab(tab);
              setActivePlaylistId(undefined);
              setIsQueuePage(false);
              setIsLocalMusicPage(false);
            }}
          />
        }
      >
        {renderContent()}
      </MusicLayout>

      <GlobalMusicPlayer />

      <FullScreenPlayer
        isFullScreen={isFullScreenPlayer}
        onClose={() => setIsFullScreenPlayer(false)}
        currentTrack={currentTrack}
        currentTime={useMusicStore.getState().currentAudioTime}
        duration={duration}
        coverUrl={coverUrl}
        isFavorite={currentTrack ? isFavorite(currentTrack.id) : false}
        onToggleFavorite={handleToggleFavorite}
        isPlaying={isPlaying}
        isLoading={isLoading}
        isRepeat={isRepeat}
        isShuffle={isShuffle}
        onTogglePlay={togglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onSeek={handleSeek}
        onToggleRepeat={toggleRepeat}
        onToggleShuffle={toggleShuffle}
      />
    </>
  );
}
