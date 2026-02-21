"use client";

import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { format } from "date-fns";
import { GlobalMusicPlayer } from "./components/GlobalMusicPlayer";
import { MusicLayout } from "./components/MusicLayout";
import { MusicTabBar, TabId } from "./components/MusicTabBar";
import { MusicNowPlayingBar } from "./components/MusicNowPlayingBar";
import { FullScreenPlayer } from "./components/FullScreenPlayer";
import { useMusicStore } from "./store/music-store";
import { useHistoryStore } from "./store/history-store";
import { useSyncStore } from "./store/sync-store";
import { useMusicCover } from "./hooks/useMusicCover";
import { checkAndSync } from "./lib/sync";
import type { MusicTrack } from "./types/music";

const MusicPlaylistView = lazy(() => import("./components/MusicPlaylistView").then(m => ({ default: m.MusicPlaylistView })));
const MusicSearchView = lazy(() => import("./components/MusicSearchView").then(m => ({ default: m.MusicSearchView })));
const MinePage = lazy(() => import("./components/MinePage").then(m => ({ default: m.MinePage })));
const QueuePage = lazy(() => import("./components/QueuePage").then(m => ({ default: m.QueuePage })));
const HistoryPage = lazy(() => import("./components/HistoryPage").then(m => ({ default: m.HistoryPage })));
const SettingsPage = lazy(() => import("./components/SettingsPage").then(m => ({ default: m.SettingsPage })));
const LocalMusicPage = lazy(() => import("./components/LocalMusicPage").then(m => ({ default: m.LocalMusicPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-primary shadow-lg bg-primary/10"></div>
    </div>
  );
}

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
    setCurrentIndexAndPlay,
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

  const { syncKey } = useSyncStore();
  const syncInProgress = useRef(false);

  useEffect(() => {
    if (syncKey && !syncInProgress.current) {
      syncInProgress.current = true;
      checkAndSync().finally(() => {
        syncInProgress.current = false;
      });
    }
  }, [syncKey]);


  const [currentTab, setCurrentTab] = useState<TabId>("search");
  const [activePlaylistId, setActivePlaylistId] = useState<string>();
  const [isFullScreenPlayer, setIsFullScreenPlayer] = useState(false);
  const [isQueuePage, setIsQueuePage] = useState(false);
  const [isHistoryPage, setIsHistoryPage] = useState(false);
  const [isSettingsPage, setIsSettingsPage] = useState(false);
  const [isLocalMusicPage, setIsLocalMusicPage] = useState(false);

  const currentTrack = queue[currentIndex];
  const coverUrl = useMusicCover(currentTrack);
  const { history, removeFromHistory, clearHistory } = useHistoryStore();

  const handlePlayContext = (track: MusicTrack, list: MusicTrack[], contextId?: string) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    const index = list.findIndex((t) => t.id === track.id);
    if (index === -1) return;

    playContext(list, index, contextId);
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

    const contextId = currentTab === "favorites"
      ? "favorites"
      : activePlaylistId ? `playlist-${activePlaylistId}` : undefined;

    playContext(list, index, contextId);
  };

  const handlePlayInQueue = (track: MusicTrack | null, index?: number) => {
    if (track && index !== undefined && currentTrack?.id === track.id) {
      togglePlay();
      return;
    }
    playContext(queue, index, "queue");
  };

  const handlePlayInHistory = (track: MusicTrack | null, index?: number) => {
    if (track && index !== undefined && currentTrack?.id === track.id) {
      togglePlay();
      return;
    }
    playContext(history, index, "history");
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
    setIsSettingsPage(false);
  };

  const handleBackFromPlaylist = () => {
    setActivePlaylistId(undefined);
  };

  const handlePrev = useCallback(() => {
    if (queue.length === 0) return;
    setCurrentIndexAndPlay((currentIndex - 1 + queue.length) % queue.length);
  }, [queue.length, currentIndex, setCurrentIndexAndPlay]);

  const handleNext = useCallback(() => {
    if (queue.length === 0) return;
    setCurrentIndexAndPlay((currentIndex + 1) % queue.length);
  }, [queue.length, currentIndex, setCurrentIndexAndPlay]);

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
    playContext(newQueue, nextIndex, "queue");
  };

  const renderContent = () => {
    if (isLocalMusicPage) {
      return (
        <Suspense fallback={<PageLoader />}>
          <LocalMusicPage
            onBack={() => setIsLocalMusicPage(false)}
            onPlay={handlePlayContext}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
          />
        </Suspense>
      );
    }

    if (isSettingsPage) {
      return (
        <Suspense fallback={<PageLoader />}>
          <SettingsPage
            onBack={() => setIsSettingsPage(false)}
          />
        </Suspense>
      );
    }

    if (isQueuePage) {
      return (
        <Suspense fallback={<PageLoader />}>
          <QueuePage
            queue={queue}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
            onPlay={handlePlayInQueue}
            onRemove={handleRemoveFromQueue}
            onClear={handleClearQueue}
            onBack={() => setIsQueuePage(false)}
          />
        </Suspense>
      );
    }

    if (isHistoryPage) {
      return (
        <Suspense fallback={<PageLoader />}>
          <HistoryPage
            history={history}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
            onPlay={handlePlayInHistory}
            onRemove={(track: MusicTrack) => removeFromHistory(track.id)}
            onClear={clearHistory}
            onBack={() => setIsHistoryPage(false)}
          />
        </Suspense>
      );
    }

    if (activePlaylistId) {
      const playlist = playlists.find((p) => p.id === activePlaylistId);
      return (
        <Suspense fallback={<PageLoader />}>
          <MusicPlaylistView
            title={playlist?.name || "歌单"}
            description={`创建于 ${format(playlist?.createdAt || 0, "yyyy-MM-dd")}`}
            tracks={playlist?.tracks || []}
            playlistId={activePlaylistId}
            onPlay={handlePlayInPlaylist}
            onRemove={(t: MusicTrack) => removeFromPlaylist(activePlaylistId, t.id)}
            onRename={renamePlaylist}
            onDelete={(id: string) => {
              deletePlaylist(id);
              handleBackFromPlaylist();
            }}
            onBack={handleBackFromPlaylist}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
          />
        </Suspense>
      );
    }

    if (currentTab === "search") {
      return (
        <Suspense fallback={<PageLoader />}>
          <MusicSearchView
            onPlay={handlePlayContext}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
          />
        </Suspense>
      );
    }

    if (currentTab === "favorites") {
      return (
        <Suspense fallback={<PageLoader />}>
          <MusicPlaylistView
            title="我的喜欢"
            tracks={favorites}
            onPlay={handlePlayInPlaylist}
            onRemove={(t: MusicTrack) => removeFromFavorites(t.id)}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
          />
        </Suspense>
      );
    }

    if (currentTab === "mine") {
      return (
        <Suspense fallback={<PageLoader />}>
          <MinePage
            onOpenHistory={() => setIsHistoryPage(true)}
            onOpenQueue={() => setIsQueuePage(true)}
            onOpenSettings={() => setIsSettingsPage(true)}
            onOpenLocalMusic={() => setIsLocalMusicPage(true)}
            onSelectPlaylist={handleSelectPlaylist}
          />
        </Suspense>
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
              setIsHistoryPage(false);
              setIsSettingsPage(false);
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
