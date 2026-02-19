"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, RefreshCw, Music } from "lucide-react";
import { LocalMusicPlugin, LocalMusicFile } from "@/plugins/local-music";
import { MusicTrack, MusicSource } from "@/types/music";
import { MusicPlaylistView } from "./MusicPlaylistView";
import { cn } from "@/lib/utils";
import { useBackButton } from "@/hooks/use-back-button";
import toast from "react-hot-toast";

interface LocalMusicPageProps {
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying: boolean;
}

const convertToMusicTrack = (file: LocalMusicFile): MusicTrack => ({
  id: `local-${file.id}`,
  name: file.name || "未知歌曲",
  artist: file.artist ? [file.artist] : ["未知艺术家"],
  album: file.album || "",
  pic_id: "",
  url_id: file.localPath,
  lyric_id: "",
  source: "local" as MusicSource,
});

export function LocalMusicPage({
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: LocalMusicPageProps) {
  const [files, setFiles] = useState<LocalMusicFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanLocalMusic = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await LocalMusicPlugin.scanLocalMusic();
      if (result.success) {
        setFiles(result.files);
        if (result.files.length === 0) {
          toast("未找到本地音乐文件", { icon: "📁" });
        } else {
          toast.success(`找到 ${result.files.length} 首本地音乐`);
        }
      } else {
        const errorMsg = result.error || "扫描失败";
        setError(errorMsg);
        toast.error(errorMsg);
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
    scanLocalMusic();
  }, [scanLocalMusic]);

  const handleRefresh = () => {
    if (!isLoading) {
      scanLocalMusic();
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

  // 使用返回按钮钩子，绑定 onBack 函数
  useBackButton(onBack);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">本地音乐</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
          <p className="text-muted-foreground text-sm">正在扫描本地音乐...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">本地音乐</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Music className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm mb-1">无法访问本地音乐</p>
          <p className="text-muted-foreground/60 text-xs mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">本地音乐</span>
        </button>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className={cn(
            "p-2 rounded-lg transition-colors",
            isLoading
              ? "text-muted-foreground/50 cursor-not-allowed"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <MusicPlaylistView
          title="本地音乐"
          tracks={tracks}
          onPlay={handlePlay}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          description={`${tracks.length} 首歌曲`}
        />
      </div>
    </div>
  );
}
