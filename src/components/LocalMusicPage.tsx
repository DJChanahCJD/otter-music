"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, RefreshCw, Trash2, Play, Settings } from "lucide-react";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { MusicTrackItem } from "./MusicTrackItem";
import { scanLocalMusicFiles, deleteLocalFiles, openAppSettings } from "@/lib/utils/download";
import type { LocalMusicTrack } from "@/types/music";
import toast from "react-hot-toast";
import { useBackButton } from "@/hooks/use-back-button";

interface LocalMusicPageProps {
  onBack: () => void;
}

export function LocalMusicPage({ onBack }: LocalMusicPageProps) {
  const {
    localTracks,
    setLocalTracks,
    removeLocalTracks,
    playContext,
    currentIndex,
    isPlaying,
  } = useMusicStore(
    useShallow((state) => ({
      localTracks: state.localTracks,
      setLocalTracks: state.setLocalTracks,
      removeLocalTracks: state.removeLocalTracks,
      playContext: state.playContext,
      currentIndex: state.currentIndex,
      isPlaying: state.isPlaying,
    }))
  );

  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const hasMounted = useRef(false);

  useBackButton(onBack);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      // 组件挂载时扫描一次
      const scanOnMount = async () => {
        setIsScanning(true);
        const tracks = await scanLocalMusicFiles();
        setLocalTracks(tracks);
        setIsScanning(false);
        setSelectedTracks([]);
        // 如果没有扫描到任何文件且目录应该有文件，可能是权限问题
        if (tracks.length === 0) {
          setPermissionDenied(true);
        }
      };
      // 使用 setTimeout 避免同步调用 setState
      setTimeout(() => scanOnMount(), 0);
    }
  }, [setLocalTracks]);

  const handleScan = async () => {
    if (isScanning) return;
    
    setIsScanning(true);
    setPermissionDenied(false);
    const tracks = await scanLocalMusicFiles();
    setLocalTracks(tracks);
    setIsScanning(false);
    setSelectedTracks([]);
    if (tracks.length === 0) {
      setPermissionDenied(true);
    }
  };

  const handleOpenSettings = async () => {
    await openAppSettings();
  };

  const handlePlay = (track: LocalMusicTrack, index: number) => {
    playContext(localTracks, index);
  };

  const handlePlayAll = () => {
    if (localTracks.length > 0) {
      playContext(localTracks, 0);
    }
  };

  const handleToggleSelect = (trackId: string) => {
    setSelectedTracks((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTracks.length === localTracks.length) {
      setSelectedTracks([]);
    } else {
      setSelectedTracks(localTracks.map((track) => track.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTracks.length === 0) return;

    if (confirm(`确定要删除选中的 ${selectedTracks.length} 首音乐吗？`)) {
      const tracksToDelete = localTracks.filter((track) =>
        selectedTracks.includes(track.id)
      );
      const filePaths = tracksToDelete.map((track) => track.localPath);

      const success = await deleteLocalFiles(filePaths);
      if (success) {
        removeLocalTracks(selectedTracks);
        setSelectedTracks([]);
        toast.success(`已删除 ${selectedTracks.length} 首音乐`);
      } else {
        toast.error("删除失败");
      }
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 bg-background border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">本地音乐</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleScan}
            disabled={isScanning}
            className="h-8 w-8"
          >
            <RefreshCw
              className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Play All Button */}
        {localTracks.length > 0 && (
          <div className="mb-4">
            <Button
              onClick={handlePlayAll}
              className="w-full justify-start gap-2"
            >
              <Play className="h-4 w-4" />
              播放全部 ({localTracks.length})
            </Button>
          </div>
        )}

        {/* Selection Bar */}
        {selectedTracks.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedTracks.length === localTracks.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm">已选择 {selectedTracks.length} 项</span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              删除
            </Button>
          </div>
        )}

        {/* Empty State */}
        {localTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
              <Play className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-muted-foreground mb-2">暂无本地音乐</h3>
            <p className="text-muted-foreground/60 text-sm mb-6">
              请将音乐文件放入 Download/OtterMusic 目录
            </p>
            
            {permissionDenied && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 max-w-xs">
                <p className="text-sm text-destructive mb-2">
                  可能缺少存储权限
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleOpenSettings}
                  className="w-full"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  打开设置授权
                </Button>
              </div>
            )}
            
            <Button onClick={handleScan}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重新扫描
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {localTracks.map((track, index) => {
              const isCurrent = index === currentIndex;
              
              return (
                <div
                  key={track.id}
                  className="group flex items-center gap-3 p-3 rounded-lg bg-card/50 hover:bg-card transition-colors"
                >
                  {/* Checkbox */}
                  <div className="shrink-0">
                    <Checkbox
                      checked={selectedTracks.includes(track.id)}
                      onCheckedChange={() => handleToggleSelect(track.id)}
                    />
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <MusicTrackItem
                      track={track}
                      index={index}
                      isCurrent={isCurrent}
                      isPlaying={isPlaying}
                      onPlay={() => handlePlay(track, index)}
                      hideLike
                      hideAddToPlaylist
                      className="group"
                    />
                  </div>

                  {/* File Size */}
                  <div className="shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {formatFileSize(track.fileSize)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
