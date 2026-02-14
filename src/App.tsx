"use client";

import { useState, useMemo } from 'react';
import { format } from "date-fns";
import { PlayerBar } from './components/PlayerBar';
import { GlobalMusicPlayer } from './components/GlobalMusicPlayer';
import { MusicLayout } from './components/MusicLayout';
import { MusicPlaylistView } from './components/MusicPlaylistView';
import { MusicSearchView } from './components/MusicSearchView';
import { MusicSidebar } from './components/MusicSidebar';
import { useMusicStore } from './store/music-store';
import type { MusicTrack } from './types/music';


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
    setCurrentIndex
  } = useMusicStore();

  const [currentView, setCurrentView] = useState<"search" | "favorites" | "playlist" | "queue" >("search");
  const [activePlaylistId, setActivePlaylistId] = useState<string>();

  const currentTrack = queue[currentIndex];

  /* ---------------- 播放逻辑 ---------------- */

  const handlePlayContext = (track: MusicTrack, list: MusicTrack[]) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    const index = list.findIndex(t => t.id === track.id);
    if (index === -1) return;

    const isSameContext = queue.length === list.length && queue[0]?.id === list[0]?.id;

    if (isSameContext) {
      setCurrentIndex(index);
      setIsPlaying(true);
    } else {
      playContext(list, index);
      // playContext now sets isPlaying: true
    }
  };

  const handlePlayInPlaylist = (track: MusicTrack | null, index?: number) => {
    if (track && index !== undefined && currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    const list = currentView === 'favorites' 
      ? favorites 
      : currentView === 'queue'
      ? queue
      : playlists.find(p => p.id === activePlaylistId)?.tracks || [];

    playContext(list, index);
  };

  /* ---------------- UI ---------------- */

  const renderContent = () => (
    <div className="h-full w-full relative">

      <div className={currentView === 'search' ? 'h-full w-full' : 'hidden'}>
        <MusicSearchView 
          onPlay={handlePlayContext} 
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
        />
      </div>

      {currentView === 'favorites' && (
        <MusicPlaylistView 
          title="我的喜欢"
          tracks={favorites}
          onPlay={handlePlayInPlaylist}
          onRemove={(t) => removeFromFavorites(t.id)}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
        />
      )}

      {currentView === 'playlist' && activePlaylistId && (
        <MusicPlaylistView 
          title={playlists.find(p => p.id === activePlaylistId)?.name || "歌单"}
          description={`创建于 ${format(playlists.find(p => p.id === activePlaylistId)?.createdAt || 0, 'yyyy-MM-dd')}`}
          tracks={playlists.find(p => p.id === activePlaylistId)?.tracks || []}
          playlistId={activePlaylistId}
          onPlay={handlePlayInPlaylist}
          onRemove={(t) => removeFromPlaylist(activePlaylistId, t.id)}
          onRename={renamePlaylist}
          onDelete={(id) => {
            deletePlaylist(id);
            if (activePlaylistId === id) {
              setCurrentView('search');
              setActivePlaylistId(undefined);
            }
          }}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
        />
      )}

      {currentView === 'queue' && (
        <MusicPlaylistView 
          title="播放队列"
          description={`共 ${queue.length} 首歌曲`}
          tracks={queue}
          onPlay={handlePlayInPlaylist}
          onRemove={(t) => {
            // 从队列中移除歌曲
            const newQueue = queue.filter(item => item.id !== t.id);
            if (newQueue.length === 0) {
              clearQueue();
              setIsPlaying(false);
              setCurrentIndex(0);
              return;
            }

            const nextIndex = Math.min(currentIndex, newQueue.length - 1);
            playContext(newQueue, nextIndex);
          }}
          onDelete={() => {
            if (confirm('确定清空播放队列吗？')) {
              clearQueue();
            }
          }}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
        />
      )}
    </div>
  );

  const sidebar = useMemo(() => (
    <MusicSidebar 
      currentView={currentView}
      currentPlaylistId={activePlaylistId}
      onViewChange={(v, pid) => {
        setCurrentView(v);
        if (pid) setActivePlaylistId(pid);
      }}
    />
  ), [currentView, activePlaylistId]);

  return (
    <>
      <MusicLayout
        sidebar={sidebar}
        player={
          <>
            <PlayerBar />
            <GlobalMusicPlayer />
          </>
        }
      >
        {renderContent()}
      </MusicLayout>
    </>
  );
}
