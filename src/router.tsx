import { createBrowserRouter, Outlet, useLocation, Navigate, useNavigate } from "react-router-dom";
import { MusicLayout } from "@/components/MusicLayout";
import { MusicNowPlayingBar } from "@/components/MusicNowPlayingBar";
import { MusicTabBar } from "@/components/MusicTabBar";
import { GlobalMusicPlayer } from "@/components/GlobalMusicPlayer";
import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import { useMusicStore } from "@/store/music-store";
import { useMusicCover } from "@/hooks/useMusicCover";
import { useSyncStore } from "@/store/sync-store";
import { checkAndSync } from "@/lib/sync";
import { useRef, useEffect } from "react";
import { App as CapacitorApp } from '@capacitor/app';
import {
  SearchRoute,
  FavoritesRoute,
  MineRoute,
  PlaylistDetailRoute,
  LocalMusicRoute,
  QueueRoute,
  HistoryRoute,
  SettingsRoute
} from "@/routes/RouteWrappers";

// --- Root Layout ---

function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isFullScreenPlayer, setIsFullScreenPlayer: setStoreFullScreen } = useMusicStore();
  
  // Back Button Logic
  const isFullScreenRef = useRef(isFullScreenPlayer);
  const locationRef = useRef(location);

  useEffect(() => {
    isFullScreenRef.current = isFullScreenPlayer;
    locationRef.current = location;
  }, [isFullScreenPlayer, location]);

  useEffect(() => {
    const handleBackButton = async () => {
        if (isFullScreenRef.current) {
            setStoreFullScreen(false);
        } else {
            const path = locationRef.current.pathname;
            // 如果是主 Tab 页，退出应用
            if (path === "/" || path === "/search" || path === "/favorites" || path === "/mine") {
                CapacitorApp.exitApp();
            } else {
                // 否则后退
                navigate(-1);
            }
        }
    };

    const listener = CapacitorApp.addListener('backButton', handleBackButton);
    return () => {
        listener.then(l => l.remove());
    };
  }, [navigate, setStoreFullScreen]);

  const {
    queue,
    currentIndex,
    isPlaying,
    duration,
    isLoading,
    isRepeat,
    isShuffle,
    togglePlay,
    setCurrentIndexAndPlay,
    seek,
    toggleRepeat,
    toggleShuffle,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
  } = useMusicStore();

  const currentTrack = queue[currentIndex] || null;
  const coverUrl = useMusicCover(currentTrack);

  // Sync Logic
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

  // Handlers
  const handlePrev = () => {
    if (queue.length === 0) return;
    setCurrentIndexAndPlay((currentIndex - 1 + queue.length) % queue.length);
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    setCurrentIndexAndPlay((currentIndex + 1) % queue.length);
  };

  const handleSeek = (value: number[]) => {
    seek(value[0]);
  };

  const handleToggleFavorite = () => {
    if (!currentTrack) return;
    if (isFavorite(currentTrack.id)) {
      removeFromFavorites(currentTrack.id);
    } else {
      addToFavorites(currentTrack);
    }
  };

  return (
    <>
      <MusicLayout
        hidePlayer={isFullScreenPlayer}
        player={<MusicNowPlayingBar onOpenFullScreen={() => setStoreFullScreen(true)} />}
        tabBar={<MusicTabBar />}
      >
        <Outlet />
      </MusicLayout>

      <GlobalMusicPlayer />

      <FullScreenPlayer
        isFullScreen={isFullScreenPlayer}
        onClose={() => setStoreFullScreen(false)}
        currentTrack={currentTrack}
        currentTime={useMusicStore.getState().currentAudioTime} // Note: this might not update reactively if not selected
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

// --- Router Config ---

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/search" replace />,
      },
      {
        path: "search",
        element: <SearchRoute />,
      },
      {
        path: "favorites",
        element: <FavoritesRoute />,
      },
      {
        path: "mine",
        element: <MineRoute />,
      },
      {
        path: "playlist/:id",
        element: <PlaylistDetailRoute />,
      },
      {
        path: "local",
        element: <LocalMusicRoute />,
      },
      {
        path: "queue",
        element: <QueueRoute />,
      },
      {
        path: "history",
        element: <HistoryRoute />,
      },
      {
        path: "settings",
        element: <SettingsRoute />,
      },
    ],
  },
]);
