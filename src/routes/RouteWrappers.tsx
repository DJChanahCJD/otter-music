import { Suspense, lazy } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMusicStore } from "@/store/music-store";
import { useHistoryStore } from "@/store/history-store";
import { usePlayHelper } from "@/hooks/usePlayHelper";
import { usePlayContextHandler } from "@/hooks/usePlayContextHandler";
import { PageLoader } from "@/components/PageLoader";
import { PageLayout } from "@/components/PageLayout";
import { MusicPlaylistView } from "@/components/MusicPlaylistView";
import { ListMusic, WifiOff } from "lucide-react";
import { useActivePlaylists } from "@/hooks/use-active-playlists";
import { useOfflinePlaylist } from "@/hooks/use-offline-playlist";

// ==========================================
// 1. 懒加载路由组件 (保持极速首屏)
// ==========================================
const MusicSearchView = lazy(() =>
  import("@/components/MusicSearchView").then((m) => ({
    default: m.MusicSearchView,
  }))
);
const FavoritesView = lazy(() =>
  import("@/components/FavoritesView").then((m) => ({
    default: m.FavoritesView,
  }))
);
const MinePage = lazy(() =>
  import("@/components/MinePage").then((m) => ({ default: m.MinePage }))
);
const QueuePage = lazy(() =>
  import("@/components/QueuePage").then((m) => ({ default: m.QueuePage }))
);
const HistoryPage = lazy(() =>
  import("@/components/HistoryPage").then((m) => ({ default: m.HistoryPage }))
);
const SettingsPage = lazy(() =>
  import("@/components/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const LocalMusicPage = lazy(() =>
  import("@/components/LocalMusicPage").then((m) => ({
    default: m.LocalMusicPage,
  }))
);
const NeteaseDetail = lazy(() =>
  import("@/components/NeteaseDetail").then((m) => ({
    default: m.NeteaseDetail,
  }))
);
const TrashPage = lazy(() =>
  import("@/components/TrashPage").then((m) => ({ default: m.TrashPage }))
);
const PodcastDetailPage = lazy(() =>
  import("@/components/Podcast/PodcastDetailPage").then((m) => ({
    default: m.PodcastDetailPage,
  }))
);
const BilibiliCollectionDetail = lazy(() =>
  import("@/components/BilibiliCollectionDetail").then((m) => ({
    default: m.BilibiliCollectionDetail,
  }))
);
const BilibiliArtistDetail = lazy(() =>
  import("@/components/BilibiliArtistDetail").then((m) => ({
    default: m.BilibiliArtistDetail,
  }))
);
const AlistBrowser = lazy(() =>
  import("@/components/PlaylistMarket/Alist/AlistBrowser").then((m) => ({
    default: m.AlistBrowser,
  }))
);
const BillboardChart = lazy(() =>
  import("@/components/BillboardChart").then((m) => ({
    default: m.BillboardChart,
  }))
);
const AwardsChart = lazy(() =>
  import("@/components/AwardsChart").then((m) => ({
    default: m.AwardsChart,
  }))
);

// ==========================================
// 2. 核心优化 Hooks & HOC
// ==========================================

/** * 精确订阅播放状态
 * 避免组件因为 queue 数组本身的变化（如添加/删除歌曲）而产生无意义的重渲染
 */
function usePlaybackState() {
  const currentTrackId = useMusicStore((s) => s.queue[s.currentIndex]?.id);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const isShuffle = useMusicStore((s) => s.isShuffle);
  return { currentTrackId, isPlaying, isShuffle };
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
  const favorites = useMusicStore((s) => s.favorites);
  const activeFavorites = favorites.filter((t) => !t.is_deleted);
  const onPlay = usePlayContextHandler(activeFavorites, "favorites");
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <FavoritesView
      tracks={activeFavorites}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
      onPlay={onPlay}
      onReorder={(newOrder) =>
        useMusicStore.getState().reorderFavorites(newOrder)
      }
    />
  );
});

export const PlaylistDetailRoute = withSuspense(() => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const offlineTracks = useOfflinePlaylist();
  const isOffline = id === "__offline__";

  const activePlaylists = useActivePlaylists();
  const playlist = isOffline ? null : activePlaylists.find((p) => p.id === id);
  const activeTracks = playlist?.tracks.filter((t) => !t.is_deleted) ?? [];
  const { currentTrackId, isPlaying } = usePlaybackState();

  const onPlay = usePlayContextHandler(
    isOffline ? offlineTracks : activeTracks,
    isOffline ? "offline" : `playlist-${id}`
  );

  if (isOffline) {
    return (
      <PageLayout title="离线歌单">
        <MusicPlaylistView
          title="离线歌单"
          tracks={offlineTracks}
          icon={<WifiOff className="h-8 w-8 text-primary/80" />}
          onPlay={onPlay}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
        />
      </PageLayout>
    );
  }

  if (!playlist) {
    return (
      <div className="p-4 text-center text-muted-foreground">歌单不存在</div>
    );
  }

  return (
    <PageLayout title={playlist.name}>
      <MusicPlaylistView
        title={playlist.name}
        createdAt={playlist.createdAt}
        description={playlist.description}
        coverUrl={playlist.coverUrl}
        tracks={activeTracks}
        playlistId={id}
        icon={<ListMusic className="h-8 w-8 text-primary/80" />}
        onPlay={onPlay}
        onRemove={(t) => useMusicStore.getState().removeFromPlaylist(id!, t.id)}
        onBatchRemove={(tracks) =>
          useMusicStore.getState().removeBatchFromPlaylist(
            id!,
            tracks.map((t) => t.id)
          )
        }
        onRename={(pid, newName) =>
          useMusicStore.getState().renamePlaylist(pid, newName)
        }
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
const createNeteaseRoute = (
  type: "playlist" | "artist" | "album",
  contextType: string
) => {
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

export const MarketPlaylistDetailRoute = createNeteaseRoute(
  "playlist",
  "playlist_market"
);
export const ArtistDetailRoute = createNeteaseRoute("artist", "artist");
export const AlbumDetailRoute = createNeteaseRoute("album", "album");

export const QueueRoute = withSuspense(() => {
  const queue = useMusicStore((s) => s.queue);
  const onPlay = usePlayContextHandler(queue, "queue");
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <QueuePage
      queue={queue}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
      onPlay={onPlay}
      onRemove={(track) => useMusicStore.getState().removeFromQueue(track.id)}
      onClear={() => useMusicStore.getState().clearQueue()}
    />
  );
});

export const HistoryRoute = withSuspense(() => {
  const history = useHistoryStore((s) => s.history);
  const onPlay = usePlayContextHandler(history, "history");
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <HistoryPage
      history={history}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
      onPlay={onPlay}
      onRemove={(track) =>
        useHistoryStore.getState().removeFromHistory(track.id)
      }
      onClear={() => useHistoryStore.getState().clearHistory()}
    />
  );
});

export const SettingsRoute = withSuspense(() => <SettingsPage />);
export const TrashRoute = withSuspense(() => <TrashPage />);

export const PodcastDetailRoute = withSuspense(() => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { handlePlay } = usePlayHelper();
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    // key 绑定播客 id：切换播客时重新挂载，重置分页、搜索等内部状态
    <PodcastDetailPage
      key={id ?? "none"}
      id={id || null}
      onBack={() => navigate(-1)}
      onPlay={(track, list) => handlePlay(track, list, "podcast")}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
    />
  );
});

export const BilibiliCollectionDetailRoute = withSuspense(() => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { handlePlay } = usePlayHelper();
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <BilibiliCollectionDetail
      id={id || null}
      onBack={() => navigate(-1)}
      onPlay={(track, list) => handlePlay(track, list, "bilibili_collection")}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
    />
  );
});

export const BilibiliArtistDetailRoute = withSuspense(() => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { handlePlay } = usePlayHelper();
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <BilibiliArtistDetail
      id={id || null}
      onBack={() => navigate(-1)}
      onPlay={(track, list) => handlePlay(track, list, "bilibili_artist")}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
    />
  );
});

export const AlistBrowserRoute = withSuspense(() => {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { handlePlay } = usePlayHelper();
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <AlistBrowser
      serverId={serverId || ""}
      onBack={() => navigate(-1)}
      onPlay={(track, list, contextId) => handlePlay(track, list, contextId)}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
    />
  );
});

export const BillboardChartRoute = withSuspense(() => {
  const { chartId } = useParams<{ chartId: string }>();
  const [searchParams] = useSearchParams();
  const date = searchParams.get("date") ?? undefined;
  const { currentTrackId, isPlaying } = usePlaybackState();

  return (
    <BillboardChart
      chartId={chartId ?? ""}
      date={date}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
    />
  );
});

export const AwardsChartRoute = withSuspense(() => {
  const { awardId } = useParams<{ awardId: string }>();
  const [searchParams] = useSearchParams();
  const yearParam = Number(searchParams.get("year"));
  const year =
    Number.isInteger(yearParam) && yearParam > 0 ? yearParam : undefined;

  return <AwardsChart awardId={awardId ?? ""} year={year} />;
});
