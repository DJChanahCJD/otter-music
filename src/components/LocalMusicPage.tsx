"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Music, Zap, HardDrive } from "lucide-react";
import { LocalMusicPlugin, LocalMusicFile } from "@/plugins/local-music";
import { MusicTrack } from "@/types/music";
import { MusicPlaylistView } from "./MusicPlaylistView";
import { cn } from "@/lib/utils";
import { PageLayout } from "./PageLayout";
import toast from "react-hot-toast";
import { convertToMusicTrack } from "@/lib/utils/download";
import { useMusicStore } from "@/store/music-store";

type ScanMode = "quick" | "full";

interface LocalMusicPageProps {
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
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
  const [scanMode, setScanMode] = useState<ScanMode>("quick");
  const [needManageStorage, setNeedManageStorage] = useState(false);
  const { queue, currentIndex, skipToNext } = useMusicStore();

  const scanLocalMusic = useCallback(async (mode: ScanMode) => {
    setIsLoading(true);
    setError(null);
    setNeedManageStorage(false);
    try {
      const result =
        mode === "quick"
          ? await LocalMusicPlugin.scanLocalMusic()
          : await LocalMusicPlugin.scanAllStorage();

      if (result.success) {
        setFiles(result.files);
        if (result.files.length === 0) {
          toast("未找到本地音乐文件", { icon: "📁" });
        } else {
          toast.success(`找到 ${result.files.length} 首本地音乐`);
        }
      } else {
        if (result.needManageStorage) {
          setNeedManageStorage(true);
          setError(result.error || '需要授予"允许管理所有文件"权限');
        } else {
          const errorMsg = result.error || "扫描失败";
          setError(errorMsg);
          toast.error(errorMsg);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "扫描失败";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    scanLocalMusic(scanMode);
  }, []);

  const handleRefresh = () => {
    if (!isLoading) {
      scanLocalMusic(scanMode);
    }
  };

  const handleModeChange = (mode: ScanMode) => {
    if (mode !== scanMode && !isLoading) {
      setScanMode(mode);
      scanLocalMusic(mode);
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
        toast.success("已删除");

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
      onPlay(track, tracks);
    } else if (index !== undefined) {
      onPlay(tracks[index], tracks);
    } else {
      if (tracks.length > 0) {
        onPlay(tracks[0], tracks);
      }
    }
  };

  const refreshAction = (
    <button
      onClick={handleRefresh}
      disabled={isLoading}
      className={cn(
        "p-2 rounded-lg transition-all duration-200",
        isLoading
          ? "text-muted-foreground/30 cursor-not-allowed"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-95",
      )}
    >
      <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
    </button>
  );

  const scanModeSelector = (
    <div className="flex gap-1.5 p-1.5 bg-muted/40 rounded-xl">
      <button
        onClick={() => handleModeChange("quick")}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200",
          scanMode === "quick"
            ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50",
          isLoading && "cursor-not-allowed opacity-50",
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        快速扫描
      </button>
      <button
        onClick={() => handleModeChange("full")}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200",
          scanMode === "full"
            ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50",
          isLoading && "cursor-not-allowed opacity-50",
        )}
      >
        <HardDrive className="h-3.5 w-3.5" />
        全盘扫描
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <PageLayout title="本地音乐" onBack={onBack} action={refreshAction}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <RefreshCw className="h-10 w-10 text-primary/80 animate-spin" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-foreground text-sm font-medium">
              {scanMode === "quick"
                ? "正在扫描本地音乐..."
                : "正在进行全盘扫描..."}
            </p>
            {scanMode === "full" && (
              <p className="text-muted-foreground/60 text-xs">
                全盘扫描可能需要较长时间
              </p>
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="本地音乐" onBack={onBack} action={refreshAction}>
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
    <PageLayout title="本地音乐" onBack={onBack} action={refreshAction}>
      <div className="px-4 pb-4">{scanModeSelector}</div>
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
