import { Suspense, lazy } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMusicStore } from "@/store/music-store";
import { useHistoryStore } from "@/store/history-store";
import { usePlayHelper } from "@/hooks/usePlayHelper";
import { PageLoader } from "@/components/PageLoader";
import { PageLayout } from "@/components/PageLayout";
import { ListMusic } from "lucide-react";

// ==========================================
// 1. 懒加载路由组件 (保持极速首屏)
// ==========================================
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

// ==========================================
// 2. 核心优化 Hooks & HOC
// ==========================================

/** * 精确订阅播放状态 
 * 避免组件因为 queue 数组本身的变化（如添加/删除歌曲）而产生无意义的重渲染
 */
function usePlaybackState() {
  const currentTrackId = useMusicStore(s => s.queue[s.currentIndex]?.id);
  const isPlaying = useMusicStore(s => s.isPlaying);
  return { currentTrackId, isPlaying };
}

/** 消除 Suspense 模板代码的高阶组件 */
function withSuspense<P extends object>(Component: React.ComponentType<P>) {
  return function RouteComponent(props: P) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Component {...props} />
      </Suspense>
    );
  };
}

// ==========================================
// 3. 路由组件实现
// ==========================================

export const SearchRoute = withSuspense(() => {
  const { handlePlay } = usePlayHelper();
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <MusicSearchView
      onPlay={handlePlay}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
    />
  );
});

export const FavoritesRoute = withSuspense(() => {
  const favorites = useMusicStore(s => s.favorites);
  const activeFavorites = favorites.filter(t => !t.is_deleted);
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <FavoritesView
      tracks={activeFavorites}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
      onPlay={(track, index) => {
        const store = useMusicStore.getState();
        if (track && currentTrackId === track.id) return store.togglePlay();
        const idx = index ?? activeFavorites.findIndex(t => t.id === track?.id);
        store.playContext(activeFavorites, Math.max(0, idx), "favorites");
      }}
      onRemove={(track) => useMusicStore.getState().removeFromFavorites(track.id)}
    />
  );
});

export const PlaylistDetailRoute = withSuspense(() => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // 精确查找特定歌单
  const playlist = useMusicStore(s => s.playlists.find(p => p.id === id && !p.is_deleted));
  const { currentTrackId, isPlaying } = usePlaybackState();

  if (!playlist) {
    return <div className="p-4 text-center text-muted-foreground">歌单不存在</div>;
  }

  const activeTracks = playlist.tracks.filter(t => !t.is_deleted);

  return (
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
        onPlay={(track, index) => {
          const store = useMusicStore.getState();
          if (track && currentTrackId === track.id) return store.togglePlay();
          const idx = index ?? activeTracks.findIndex(t => t.id === track?.id);
          store.playContext(activeTracks, Math.max(0, idx), `playlist-${id}`);
        }}
        onRemove={(t) => useMusicStore.getState().removeFromPlaylist(id!, t.id)}
        onRename={(pid, newName) => useMusicStore.getState().renamePlaylist(pid, newName)}
        onDelete={(pid) => {
          useMusicStore.getState().deletePlaylist(pid);
          navigate(-1);
        }}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
      />
    </PageLayout>
  );
});

export const MineRoute = withSuspense(() => {
  const navigate = useNavigate();
  return <MinePage onSelectPlaylist={(id) => navigate(`/playlist/${id}`)} />;
});

export const LocalMusicRoute = withSuspense(() => {
  const { handlePlay } = usePlayHelper();
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <LocalMusicPage
      onPlay={handlePlay}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
    />
  );
});

// -- 网易云API详情路由复用逻辑 --
const createNeteaseRoute = (type: "playlist" | "artist" | "album", contextType: string) => {
  return withSuspense(() => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { handlePlay } = usePlayHelper();
    const { currentTrackId, isPlaying } = usePlaybackState();

    return (
      <NeteaseDetail
        id={id || null}
        type={type}
        onBack={() => navigate(-1)}
        onPlay={(track, list) => handlePlay(track, list, contextType)}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
      />
    );
  });
};

export const MarketPlaylistDetailRoute = createNeteaseRoute("playlist", "playlist_market");
export const ArtistDetailRoute = createNeteaseRoute("artist", "artist");
export const AlbumDetailRoute = createNeteaseRoute("album", "album");

export const QueueRoute = withSuspense(() => {
  const queue = useMusicStore(s => s.queue);
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <QueuePage
      queue={queue}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
      onPlay={(track, index) => {
        const store = useMusicStore.getState();
        if (track && currentTrackId === track.id) return store.togglePlay();
        const idx = index ?? queue.findIndex(t => t.id === track?.id);
        store.playContext(queue, Math.max(0, idx), "queue");
      }}
      onRemove={(track) => useMusicStore.getState().removeFromQueue(track.id)}
      onClear={() => useMusicStore.getState().clearQueue()}
    />
  );
});

export const HistoryRoute = withSuspense(() => {
  const history = useHistoryStore(s => s.history);
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <HistoryPage
      history={history}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
      onPlay={(track, index) => {
        const store = useMusicStore.getState();
        if (track && currentTrackId === track.id) return store.togglePlay();
        const idx = index ?? history.findIndex(t => t.id === track?.id);
        store.playContext(history, Math.max(0, idx), "history");
      }}
      onRemove={(track) => useHistoryStore.getState().removeFromHistory(track.id)}
      onClear={() => useHistoryStore.getState().clearHistory()}
    />
  );
});

export const SettingsRoute = withSuspense(() => <SettingsPage />);
export const TrashRoute = withSuspense(() => <TrashPage />);