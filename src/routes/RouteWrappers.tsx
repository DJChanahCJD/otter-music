import { Suspense, lazy } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMusicStore } from "@/store/music-store";
import { useHistoryStore } from "@/store/history-store";
import { usePlayHelper } from "@/hooks/usePlayHelper";
import { PageLoader } from "@/components/PageLoader";
import { MusicTrack } from "@/types/music";
import { PageLayout } from "@/components/PageLayout";
import { ListMusic } from "lucide-react";

// Lazy load components
const MusicSearchView = lazy(() => import("@/components/MusicSearchView").then(m => ({ default: m.MusicSearchView })));
const MusicPlaylistView = lazy(() => import("@/components/MusicPlaylistView").then(m => ({ default: m.MusicPlaylistView })));
const FavoritesView = lazy(() => import("@/components/FavoritesView").then(m => ({ default: m.FavoritesView })));
const MinePage = lazy(() => import("@/components/MinePage").then(m => ({ default: m.MinePage })));
const QueuePage = lazy(() => import("@/components/QueuePage").then(m => ({ default: m.QueuePage })));
const HistoryPage = lazy(() => import("@/components/HistoryPage").then(m => ({ default: m.HistoryPage })));
const SettingsPage = lazy(() => import("@/components/SettingsPage").then(m => ({ default: m.SettingsPage })));
const LocalMusicPage = lazy(() => import("@/components/LocalMusicPage").then(m => ({ default: m.LocalMusicPage })));
const NeteaseDetail = lazy(() => import("@/components/NeteaseDetail").then(m => ({ default: m.NeteaseDetail })));
const TrashPage = lazy(() => import("@/components/TrashPage").then(m => ({ default: m.TrashPage })));

export function SearchRoute() {
  const { handlePlay } = usePlayHelper();
  const { queue, currentIndex, isPlaying } = useMusicStore();
  const currentTrack = queue[currentIndex] || null;

  return (
    <Suspense fallback={<PageLoader />}>
      <MusicSearchView
        onPlay={handlePlay}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
      />
    </Suspense>
  );
}

export function FavoritesRoute() {
  const { favorites, removeFromFavorites, queue, currentIndex, isPlaying, playContext, togglePlay } = useMusicStore();
  const currentTrack = queue[currentIndex] || null;
  const activeFavorites = favorites.filter((track) => track.is_deleted !== true);
  
  const handlePlayInPlaylist = (track: MusicTrack | null, index?: number) => {
    if (track && index !== undefined && currentTrack?.id === track.id) {
      togglePlay();
      return;
    }
    playContext(activeFavorites, index, "favorites");
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <FavoritesView
        tracks={activeFavorites}
        onPlay={handlePlayInPlaylist}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
        onRemove={(track) => removeFromFavorites(track.id)}
      />
    </Suspense>
  );
}

export function PlaylistDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    playlists, 
    removeFromPlaylist, 
    renamePlaylist, 
    deletePlaylist,
    queue, 
    currentIndex, 
    isPlaying, 
    playContext, 
    togglePlay 
  } = useMusicStore();
  
  const playlist = playlists.find((p) => p.id === id && p.is_deleted !== true);
  const currentTrack = queue[currentIndex] || null;

  if (!playlist) {
    return <div className="p-4 text-center text-muted-foreground">歌单不存在</div>;
  }

  const activeTracks = playlist.tracks.filter((track) => track.is_deleted !== true);

  const handlePlayInPlaylist = (track: MusicTrack | null, index?: number) => {
    if (track && index !== undefined && currentTrack?.id === track.id) {
      togglePlay();
      return;
    }
    playContext(activeTracks, index, `playlist-${id}`);
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <PageLayout title={playlist.name}>
        <MusicPlaylistView
        title={playlist.name}
        showTitle={false}
        createdAt={playlist.createdAt}
        description={playlist.description}
        coverUrl={playlist.coverUrl}
        tracks={activeTracks}
        playlistId={id}
        icon={<ListMusic className="h-8 w-8 text-primary/80" />}
        onPlay={handlePlayInPlaylist}
        onRemove={(t) => removeFromPlaylist(id!, t.id)}
        onRename={renamePlaylist}
        onDelete={(pid) => {
            deletePlaylist(pid);
            navigate(-1);
        }}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
      />
      </PageLayout>
    </Suspense>
  );
}

export function MineRoute() {
    const navigate = useNavigate();
    return (
        <Suspense fallback={<PageLoader />}>
            <MinePage onSelectPlaylist={(id) => navigate(`/playlist/${id}`)} />
        </Suspense>
    );
}

export function LocalMusicRoute() {
  const { handlePlay } = usePlayHelper();
  const { queue, currentIndex, isPlaying } = useMusicStore();
  const currentTrack = queue[currentIndex] || null;

  return (
    <Suspense fallback={<PageLoader />}>
      <LocalMusicPage
        onPlay={handlePlay}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
      />
    </Suspense>
  );
}

export function MarketPlaylistDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { handlePlay } = usePlayHelper();
  const { queue, currentIndex, isPlaying } = useMusicStore();
  const currentTrack = queue[currentIndex] || null;

  return (
    <Suspense fallback={<PageLoader />}>
      <NeteaseDetail
        id={id || null}
        type="playlist"
        onBack={() => navigate(-1)}
        onPlay={(track, list) => handlePlay(track, list, "playlist_market")}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
      />
    </Suspense>
  );
}

export function ArtistDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { handlePlay } = usePlayHelper();
  const { queue, currentIndex, isPlaying } = useMusicStore();
  const currentTrack = queue[currentIndex] || null;

  return (
    <Suspense fallback={<PageLoader />}>
      <NeteaseDetail
        id={id || null}
        type="artist"
        onBack={() => navigate(-1)}
        onPlay={(track, list) => handlePlay(track, list, "artist")}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
      />
    </Suspense>
  );
}

export function AlbumDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { handlePlay } = usePlayHelper();
  const { queue, currentIndex, isPlaying } = useMusicStore();
  const currentTrack = queue[currentIndex] || null;

  return (
    <Suspense fallback={<PageLoader />}>
      <NeteaseDetail
        id={id || null}
        type="album"
        onBack={() => navigate(-1)}
        onPlay={(track, list) => handlePlay(track, list, "album")}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
      />
    </Suspense>
  );
}

export function QueueRoute() {
  const { queue, currentIndex, isPlaying, playContext, togglePlay, clearQueue, removeFromQueue } = useMusicStore();
  const currentTrack = queue[currentIndex] || null;

  const handlePlayInQueue = (track: MusicTrack | null, index?: number) => {
    if (track && index !== undefined && currentTrack?.id === track.id) {
      togglePlay();
      return;
    }
    playContext(queue, index, "queue");
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <QueuePage
        queue={queue}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
        onPlay={handlePlayInQueue}
        onRemove={(track) => removeFromQueue(track.id)}
        onClear={clearQueue}
      />
    </Suspense>
  );
}

export function HistoryRoute() {
    const { history, removeFromHistory, clearHistory } = useHistoryStore();
    const { playContext, togglePlay, queue, currentIndex, isPlaying } = useMusicStore();
    const currentTrack = queue[currentIndex] || null;

    const handlePlayInHistory = (track: MusicTrack | null, index?: number) => {
        if (track && index !== undefined && currentTrack?.id === track.id) {
          togglePlay();
          return;
        }
        playContext(history, index, "history");
    };

    return (
        <Suspense fallback={<PageLoader />}>
          <HistoryPage
            history={history}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
            onPlay={handlePlayInHistory}
            onRemove={(track) => removeFromHistory(track.id)}
            onClear={clearHistory}
          />
        </Suspense>
    );
}

export function SettingsRoute() {
    return (
        <Suspense fallback={<PageLoader />}>
            <SettingsPage />
        </Suspense>
    );
}

export function TrashRoute() {
    return (
        <Suspense fallback={<PageLoader />}>
            <TrashPage />
        </Suspense>
    );
}
