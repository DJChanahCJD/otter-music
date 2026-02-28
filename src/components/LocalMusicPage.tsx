"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { RefreshCw, Music, HardDrive } from "lucide-react";
import { LocalMusicPlugin } from "@/plugins/local-music";
import { MusicTrack } from "@/types/music";
import { MusicPlaylistView } from "./MusicPlaylistView";
import { cn } from "@/lib/utils";
import { PageLayout } from "./PageLayout";
import toast from "react-hot-toast";
import { convertToMusicTrack } from "@/lib/utils/download";
import { useMusicStore } from "@/store/music-store";
import { useLocalMusicStore } from "@/store/local-music-store";
import { LocalMusicPermissionDialog } from "./LocalMusicPermissionDialog";

interface LocalMusicPageProps {
  onBack?: () => void;
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

  /* =========================
     UI 状态
  ========================= */
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  /* =========================
     Store
  ========================= */
  const { queue, currentIndex, skipToNext } = useMusicStore();
  const {
    files,
    setFiles,
    updateFiles,
    setScanning
  } = useLocalMusicStore();

  /* =========================
     扫描逻辑（单一职责）
  ========================= */
  const performScan = useCallback(
    async (type: "quick" | "full") => {

      setIsLoading(true);
      setError(null);
      setScanning(true, type);

      try {
        const result =
          type === "quick"
            ? await LocalMusicPlugin.scanLocalMusic()
            : await LocalMusicPlugin.scanAllStorage();

        if (result.success) {
          setFiles(result.files);
          return result.files.length;
        }

        if (result.needManageStorage) {
          setShowPermissionDialog(true);
          throw new Error(result.error || "需要授予存储权限");
        }

        throw new Error(result.error || "扫描失败");

      } catch (err: any) {
        setError(err.message);
        throw err;

      } finally {
        setIsLoading(false);
        setScanning(false);
      }
    },
    [setFiles, setScanning]
  );

  /* =========================
     初始化扫描（安全写法）
  ========================= */
  useEffect(() => {

    if (files.length > 0) return;

    let mounted = true;

    (async () => {
      try {
        await performScan("quick");
      } catch (err) {
        if (mounted) {
          console.error("初始化扫描失败:", err);
        }
      }
    })();

    return () => {
      mounted = false;
    };

  }, [files.length, performScan]);

  /* =========================
     手动扫描（带 toast）
  ========================= */
  const handleScan = (type: "quick" | "full") => {

    if (isLoading) return;

    toast.promise(
      performScan(type),
      {
        loading: type === "full"
          ? "全盘扫描中..."
          : "正在扫描本地音乐...",
        success: (count: number) =>
          count === 0
            ? "未找到本地音乐"
            : `找到 ${count} 首本地音乐`,
        error: (err: Error) => err.message,
      }
    );
  };

  /* =========================
     删除
  ========================= */
  const handleDeleteTrack = async (track: MusicTrack) => {

    if (!confirm(`确认删除「${track.name}」？`)) return;

    const localPath = track.url_id;
    if (!localPath) {
      toast.error("缺少文件路径");
      return;
    }

    toast.promise(
      (async () => {

        const result = await LocalMusicPlugin.deleteLocalMusic({ localPath });

        if (!result.success) {
          throw new Error(result.error || "删除失败");
        }

        updateFiles((prev) =>
          prev.filter((f) => f.localPath !== localPath)
        );

        const currentTrack = queue[currentIndex];
        if (currentTrack?.id === track.id) {
          skipToNext();
        }

      })(),
      {
        loading: "正在删除...",
        success: "删除成功",
        error: (err: Error) => err.message,
      }
    );
  };

  /* =========================
     转换数据
  ========================= */
  const tracks = useMemo(
    () => files.map(convertToMusicTrack),
    [files]
  );

  const handlePlay = (track: MusicTrack | null, index?: number) => {

    if (track) {
      onPlay(track, tracks, "local");
      return;
    }

    if (index !== undefined && tracks[index]) {
      onPlay(tracks[index], tracks, "local");
      return;
    }

    if (tracks.length > 0) {
      onPlay(tracks[0], tracks, "local");
    }
  };

  /* =========================
     UI
  ========================= */

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
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <Music className="h-14 w-14 text-muted-foreground/30 mb-4" />
          <p className="text-sm mb-2">{error}</p>
          <button
            onClick={() => handleScan("quick")}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            重试
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="本地音乐"
      onBack={onBack}
      action={
        <button
          onClick={() => handleScan("full")}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          <HardDrive className="h-3.5 w-3.5" />
          全盘扫描
        </button>
      }
    >
      <MusicPlaylistView
        title="本地音乐"
        tracks={tracks}
        onPlay={handlePlay}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        onRemove={handleDeleteTrack}
      />

      <LocalMusicPermissionDialog
        open={showPermissionDialog}
        onOpenChange={setShowPermissionDialog}
      />
    </PageLayout>
  );
}