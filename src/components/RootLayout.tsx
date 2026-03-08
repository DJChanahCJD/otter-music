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
import { useRef, useEffect } from "react";
import { App as CapacitorApp } from '@capacitor/app';

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

  useEffect(() => {
    const handleBackButton = async () => {
        // 如果有弹窗/抽屉打开，模拟 ESC 关闭
        if (document.querySelector('[role="dialog"]') || document.querySelector('[role="alertdialog"]')) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            return;
        }

        if (isFullScreenRef.current) {
            setStoreFullScreen(false);
        } else {
            const path = locationRef.current.pathname;
            // 如果是主 Tab 页，最小化应用
            if (path === "/" || path === "/search" || path === "/favorites" || path === "/podcast" || path === "/mine") {
                CapacitorApp.minimizeApp();
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

  const isTab = ["/search", "/favorites", "/podcast", "/mine"].includes(location.pathname) || location.pathname === "/";
  
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
        currentTime={useMusicStore.getState().currentAudioTime} // Note: this might not update reactively if not selected
        duration={duration}
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
        onSeek={handleSeek}
        onToggleRepeat={toggleRepeat}
        onToggleShuffle={toggleShuffle}
      />
    </>
  );
}
