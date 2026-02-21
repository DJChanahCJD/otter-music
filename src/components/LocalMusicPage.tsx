"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Music, HardDrive } from "lucide-react";
import { LocalMusicPlugin, LocalMusicFile } from "@/plugins/local-music";
import { MusicTrack } from "@/types/music";
import { MusicPlaylistView } from "./MusicPlaylistView";
import { cn } from "@/lib/utils";
import { PageLayout } from "./PageLayout";
import toast from "react-hot-toast";
import { convertToMusicTrack } from "@/lib/utils/download";
import { useMusicStore } from "@/store/music-store";
import { useLocalMusicStore } from "@/store/local-music-store";

interface LocalMusicPageProps {
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[], contextId?: string) => void;
  currentTrackId?: string;
  isPlaying: boolean;
}

export function LocalMusicPage({
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: LocalMusicPageProps) {
  const [files, setFiles] = useState<LocalMusicFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needManageStorage, setNeedManageStorage] = useState(false);
  const { queue, currentIndex, skipToNext } = useMusicStore();
  const { setFiles: setCachedFiles, updateFiles: updateCachedFiles, setScanning } = useLocalMusicStore();

  const scanLocalMusic = async (type: "quick" | "full", silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    setNeedManageStorage(false);

    setScanning(true, type);

    const toastId = type === "full"
      ? toast.loading("全盘扫描中，请稍候...", { duration: Infinity })
      : toast.loading("正在扫描本地音乐...", { duration: 10000 });

    try {
      const result =
        type === "quick"
          ? await LocalMusicPlugin.scanLocalMusic()
          : await LocalMusicPlugin.scanAllStorage();

      if (result.success) {
        setFiles(result.files);
        setCachedFiles(result.files);

        if (!silent) {
          if (result.files.length === 0) {
            toast("未找到本地音乐文件", { id: toastId, icon: "📁" });
          } else {
            toast.success(`找到 ${result.files.length} 首本地音乐`, { id: toastId });
          }
        }
      } else {
        if (result.needManageStorage) {
          setNeedManageStorage(true);
          setError(result.error || '需要授予"允许管理所有文件"权限');
          toast.error(result.error || "需要授予权限", { id: toastId });
        } else {
          const errorMsg = result.error || "扫描失败";
          setError(errorMsg);
          if (!silent) toast.error(errorMsg, { id: toastId });
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "扫描失败";
      setError(errorMessage);
      if (!silent) toast.error(errorMessage, { id: toastId });
    } finally {
      setIsLoading(false);
      setScanning(false);
    }
  };

  useEffect(() => {
    const cached = useLocalMusicStore.getState();
    if (cached.files.length > 0) {
      setFiles(cached.files);
    } else {
      scanLocalMusic("quick", false);
    }
  }, []);

  const handleRefresh = () => {
    if (!isLoading) {
      scanLocalMusic("quick", false);
    }
  };

  const handleFullScan = () => {
    if (!isLoading) {
      toast.loading("全盘扫描中...", { duration: Infinity });
      scanLocalMusic("full", false);
    }
  };

  const handleOpenSettings = async () => {
    await LocalMusicPlugin.openManageStorageSettings();
  };

  const handleDeleteTrack = async (track: MusicTrack) => {
    if (!confirm(`确认删除本地音频「${track.name}」？`)) {
      return;
    }
    const localPath = track.url_id;
    if (!localPath) {
      toast.error("无法删除：缺少文件路径");
      return;
    }

    try {
      const result = await LocalMusicPlugin.deleteLocalMusic({ localPath });
      if (result.success) {
        setFiles((prev) => prev.filter((f) => f.localPath !== localPath));
        updateCachedFiles((files) => files.filter((f) => f.localPath !== localPath));
        toast.success("删除成功");

        const currentTrack = queue[currentIndex];
        if (currentTrack && currentTrack.id === track.id) {
          skipToNext();
        }
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "删除失败";
      toast.error(errorMessage);
    }
  };

  const tracks = useMemo(() => files.map(convertToMusicTrack), [files]);

  const handlePlay = (track: MusicTrack | null, index?: number) => {
    if (track) {
      onPlay(track, tracks, "local");
    } else if (index !== undefined) {
      onPlay(tracks[index], tracks, "local");
    } else {
      if (tracks.length > 0) {
        onPlay(tracks[0], tracks, "local");
      }
    }
  };

  const fullScanAction = (
    <button
      onClick={handleFullScan}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
        "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
        isLoading && "opacity-50 cursor-not-allowed"
      )}
    >
      <HardDrive className="h-3.5 w-3.5" />
      全盘扫描
    </button>
  );

  if (isLoading && files.length === 0) {
    return (
      <PageLayout title="本地音乐" onBack={onBack}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <RefreshCw className="h-10 w-10 text-primary/80 animate-spin" />
          <p className="text-foreground text-sm font-medium">正在扫描本地音乐...</p>
        </div>
      </PageLayout>
    );
  }

  if (error && files.length === 0) {
    return (
      <PageLayout title="本地音乐" onBack={onBack}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="flex flex-col items-center gap-3 mb-4">
            <Music className="h-14 w-14 text-muted-foreground/30" />
            <div className="flex flex-col gap-1">
              <p className="text-foreground text-sm font-medium">无法访问本地音乐</p>
              <p className="text-muted-foreground/70 text-xs">{error}</p>
            </div>
          </div>
          {needManageStorage ? (
            <button
              onClick={handleOpenSettings}
              className="px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              打开设置授予权限
            </button>
          ) : (
            <button
              onClick={handleRefresh}
              className="px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all active:scale-[0.98]"
            >
              重试
            </button>
          )}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="本地音乐"
      onBack={onBack}
      action={fullScanAction}
    >
      <MusicPlaylistView
        title="本地音乐"
        tracks={tracks}
        onPlay={handlePlay}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        onRemove={handleDeleteTrack}
      />
    </PageLayout>
  );
}
