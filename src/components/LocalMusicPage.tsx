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
        "p-2 rounded-lg transition-colors",
        isLoading
          ? "text-muted-foreground/50 cursor-not-allowed"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      )}
    >
      <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
    </button>
  );

  const scanModeSelector = (
    <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
      <button
        onClick={() => handleModeChange("quick")}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
          scanMode === "quick"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
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
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
          scanMode === "full"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
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
        <div className="flex-1 flex flex-col items-center justify-center">
          <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
          <p className="text-muted-foreground text-sm">
            {scanMode === "quick"
              ? "正在扫描本地音乐..."
              : "正在进行全盘扫描..."}
          </p>
          {scanMode === "full" && (
            <p className="text-muted-foreground/60 text-xs mt-1">
              全盘扫描可能需要较长时间
            </p>
          )}
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="本地音乐" onBack={onBack} action={refreshAction}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Music className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm mb-1">无法访问本地音乐</p>
          <p className="text-muted-foreground/60 text-xs mb-4">{error}</p>
          {needManageStorage ? (
            <button
              onClick={handleOpenSettings}
              className="px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
            >
              打开设置授予权限
            </button>
          ) : (
            <button
              onClick={handleRefresh}
              className="px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
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
      <div className="px-4 pb-3">{scanModeSelector}</div>
      <MusicPlaylistView
        title="本地音乐"
        tracks={tracks}
        onPlay={handlePlay}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        action={refreshAction}
        description={`${tracks.length} 首歌曲`}
      />
    </PageLayout>
  );
}
