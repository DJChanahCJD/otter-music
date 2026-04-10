import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { MusicLayout } from "@/components/MusicLayout";
import { MusicNowPlayingBar } from "@/components/MusicNowPlayingBar";
import { MusicTabBar } from "@/components/MusicTabBar";
import { GlobalMusicPlayer } from "@/components/GlobalMusicPlayer";
import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import { useMusicStore } from "@/store/music-store";
import toast from "react-hot-toast";
import { toastUtils } from "@/lib/utils/toast";
import { useMusicCover } from "@/hooks/useMusicCover";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useRef, useEffect, useCallback } from "react";

const ROOT_TAB_PATHS = ["/", "/search", "/favorites", "/mine"] as const;

export function RootLayout() {
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

  const isRootTabPath = useCallback((path: string) => {
    return ROOT_TAB_PATHS.includes(path as (typeof ROOT_TAB_PATHS)[number]);
  }, []);

  const handleExitLayer = useCallback(() => {
    if (isFullScreenRef.current) {
      setStoreFullScreen(false);
      return true;
    }

    return false;
  }, [setStoreFullScreen]);

  const handleBackAction = useCallback(async () => {
    if (handleExitLayer()) return;

    const path = locationRef.current.pathname;

    if (isRootTabPath(path)) {
      if (Capacitor.isNativePlatform()) {
        await CapacitorApp.minimizeApp();
      }
      return;
    }

    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate("/search", { replace: true });
  }, [handleExitLayer, isRootTabPath, navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener("backButton", handleBackAction);

    return () => {
      listener.then((l) => l.remove());
    };
  }, [handleBackAction]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      const handled = handleExitLayer();
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleExitLayer]);

  const {
    queue,
    currentIndex,
    isPlaying,
    isLoading,
    isRepeat,
    isShuffle,
    togglePlay,
    setCurrentIndexAndPlay,
    toggleRepeat,
    toggleShuffle,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
  } = useMusicStore();

  const currentTrack = queue[currentIndex] || null;
  const coverUrl = useMusicCover(currentTrack);

  const isTab = isRootTabPath(location.pathname);
  
  // Handlers
  const handlePrev = () => {
    if (queue.length === 0) return;
    setCurrentIndexAndPlay((currentIndex - 1 + queue.length) % queue.length);
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    setCurrentIndexAndPlay((currentIndex + 1) % queue.length);
  };

  const handleToggleLike = () => {
    if (!currentTrack) return;
    if (isFavorite(currentTrack.id)) {
      removeFromFavorites(currentTrack.id);
      toast.success("已取消喜欢");
    } else {
      const error = addToFavorites(currentTrack);
      if (error) {
        toastUtils.info(error);
      } else {
        toast.success("已喜欢");
      }
    }
  };

  return (
    <>
      <MusicLayout
        hidePlayer={isFullScreenPlayer || !currentTrack}
        isTab={isTab}
        player={
          <MusicNowPlayingBar 
            onOpenFullScreen={() => setStoreFullScreen(true)} 
            isTab={isTab}
          />
        }
        tabBar={<MusicTabBar />}
      >
        <Outlet />
      </MusicLayout>

      <GlobalMusicPlayer />

      <FullScreenPlayer
        isFullScreen={isFullScreenPlayer}
        onClose={() => setStoreFullScreen(false)}
        currentTrack={currentTrack}
        coverUrl={coverUrl}
        isFavorite={currentTrack ? isFavorite(currentTrack.id) : false}
        onToggleLike={handleToggleLike}
        isPlaying={isPlaying}
        isLoading={isLoading}
        isRepeat={isRepeat}
        isShuffle={isShuffle}
        onTogglePlay={togglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onToggleRepeat={toggleRepeat}
        onToggleShuffle={toggleShuffle}
      />
    </>
  );
}
