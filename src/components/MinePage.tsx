"use client";

import { useState } from "react";
import {
  ListVideo,
  Settings,
  ListMusic,
  SquarePlus,
  MoreVertical,
  Trash2,
  Pencil,
  HardDriveDownload,
  History,
  Link2,
  WifiOff,
  Pause,
  Play,
} from "lucide-react";
import { PlaylistCover } from "./PlaylistCover";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "./ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "./ui/drawer";
import { Input } from "./ui/input";
import { format } from "date-fns";
import toast from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

import { useNavigate } from "react-router-dom";
import { useActivePlaylists } from "@/hooks/use-active-playlists";
import { PlaylistImportDrawer } from "./PlaylistImportDrawer";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useOfflinePlaylist } from "@/hooks/use-offline-playlist";
import { getPlayAllStartIndex } from "@/hooks/usePlayHelper";
import type { MusicTrack } from "@/types/music";

interface MinePageProps {
  onSelectPlaylist: (playlistId: string) => void;
}

export function MinePage({ onSelectPlaylist }: MinePageProps) {
  const navigate = useNavigate();
  const { createPlaylist, renamePlaylist, deletePlaylist } = useMusicStore(
    useShallow((state) => ({
      createPlaylist: state.createPlaylist,
      renamePlaylist: state.renamePlaylist,
      deletePlaylist: state.deletePlaylist,
    }))
  );
  const { playContext, togglePlay, isShuffle, isPlaying, contextId } =
    useMusicStore(
      useShallow((state) => ({
        playContext: state.playContext,
        togglePlay: state.togglePlay,
        isShuffle: state.isShuffle,
        isPlaying: state.isPlaying,
        contextId: state.contextId,
      }))
    );
  const activePlaylists = useActivePlaylists();
  const isOnline = useNetworkStatus();
  const offlineTracks = useOfflinePlaylist();
  const showOfflinePlaylist = !isOnline;

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(
    null
  );
  const [editingName, setEditingName] = useState("");

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) {
      toast.error("请输入歌单名称");
      return;
    }
    createPlaylist(newPlaylistName);
    setNewPlaylistName("");
    setIsCreateOpen(false);
    toast.success("歌单创建成功");
  };

  const handleRename = (playlistId: string) => {
    if (!editingName.trim()) {
      toast.error("请输入歌单名称");
      return;
    }
    renamePlaylist(playlistId, editingName);
    setEditingPlaylistId(null);
    setEditingName("");
    toast.success("歌单重命名成功");
  };

  const handleDelete = (playlistId: string) => {
    if (confirm("确定要删除这个歌单吗？")) {
      deletePlaylist(playlistId);
      toast.success("歌单已删除");
    }
  };

  /**
   * 点击封面直接播放歌单
   * - 空歌单提示；同一歌单正在上下文中则暂停/继续；否则整单播放
   */
  const playPlaylist = (tracks: MusicTrack[], ctxId: string) => {
    if (!tracks.length) {
      toast.error("歌单暂无歌曲");
      return;
    }
    if (contextId === ctxId) {
      togglePlay();
      return;
    }
    playContext(tracks, getPlayAllStartIndex(tracks.length, isShuffle), ctxId);
  };

  /**
   * 封面播放状态角标：仅当前歌单是播放上下文时显示，
   * 播放中显示暂停图标，暂停时显示播放图标；非当前歌单不渲染
   */
  const renderPlaybackBadge = (ctxId: string) => {
    if (contextId !== ctxId) return null;
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
        <div className="h-5 w-5 shrink-0 flex-[0_0_20px] min-w-5 min-h-5">
          {isPlaying ? (
            <Pause
              size={20}
              className="h-full w-full text-white fill-current"
            />
          ) : (
            <Play size={20} className="h-full w-full text-white fill-current" />
          )}
        </div>
      </div>
    );
  };

  const quickNavs = [
    { label: "历史", icon: History, path: "/history" },
    { label: "列表", icon: ListVideo, path: "/queue" },
    { label: "本地", icon: HardDriveDownload, path: "/local" },
    { label: "设置", icon: Settings, path: "/settings" },
  ];

  return (
    <div className="p-5 pb-bottom-stack">
      <div className="grid grid-cols-4 gap-2 mb-6">
        {quickNavs.map(({ label, icon: Icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-1.5 py-2 rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 flex-[0_0_40px] min-w-10 min-h-10">
              <div className="h-5 w-5 shrink-0 flex-[0_0_20px] min-w-5 min-h-5">
                <Icon size={20} className="h-full w-full text-primary" />
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{label}</span>
          </button>
        ))}
      </div>

      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-base font-semibold text-foreground">我的歌单</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground px-2"
            onClick={() => setIsImportOpen(true)}
          >
            <Link2 className="h-3.5 w-3.5" />
            导入
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground px-2"
            onClick={() => setIsCreateOpen(true)}
          >
            <SquarePlus className="h-3.5 w-3.5" />
            新建
          </Button>
        </div>
        <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DrawerContent className="max-h-[80vh]">
            <DrawerHeader>
              <DrawerTitle>新建歌单</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <Input
                autoFocus
                placeholder="歌单名称"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
              />
            </div>
            <DrawerFooter className="pt-0">
              <Button onClick={handleCreatePlaylist} className="h-11">
                创建
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        <PlaylistImportDrawer
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
        />
      </div>

      {showOfflinePlaylist && (
        <div className="space-y-2 mb-2">
          <div
            className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer"
            onClick={() => onSelectPlaylist("__offline__")}
          >
            <div
              className="relative shrink-0 flex-[0_0_44px] rounded-lg overflow-hidden"
              onClick={(e) => {
                e.stopPropagation();
                playPlaylist(offlineTracks, "offline");
              }}
            >
              <div className="h-11 w-11 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 flex-[0_0_44px] min-w-11 min-h-11">
                <WifiOff size={24} className="h-6 w-6 text-primary" />
              </div>
              {renderPlaybackBadge("offline")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">离线歌单</p>
              <p className="text-xs text-muted-foreground">
                {offlineTracks.length} 首
              </p>
            </div>
          </div>
        </div>
      )}

      {activePlaylists.length === 0 && !showOfflinePlaylist ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <ListMusic className="h-10 w-10 text-muted-foreground/40 mb-2" />
          <p className="text-muted-foreground text-sm">暂无歌单</p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            点击"新建"创建你的第一个歌单
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {activePlaylists.map((playlist) => (
            <div
              key={playlist.id}
              className="flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer group"
              onClick={() => onSelectPlaylist(playlist.id)}
            >
              <div
                className="relative shrink-0 overflow-hidden rounded-lg"
                role="button"
                aria-label={`播放歌单 ${playlist.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  playPlaylist(
                    playlist.tracks.filter(
                      (track) => track.is_deleted !== true
                    ),
                    `playlist-${playlist.id}`
                  );
                }}
              >
                <PlaylistCover
                  playlist={playlist}
                  className="h-13 w-13 rounded-lg object-cover"
                  previewable={false}
                />
                {renderPlaybackBadge(`playlist-${playlist.id}`)}
              </div>
              <div className="flex-1 min-w-0">
                {editingPlaylistId === playlist.id ? (
                  <Input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") handleRename(playlist.id);
                      if (e.key === "Escape") {
                        setEditingPlaylistId(null);
                        setEditingName("");
                      }
                    }}
                    onBlur={() => handleRename(playlist.id)}
                    className="h-7 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <p
                      className={`font-medium text-sm truncate transition-colors ${
                        contextId === `playlist-${playlist.id}`
                          ? "text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {playlist.name}
                    </p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">
                      {
                        playlist.tracks.filter(
                          (track) => track.is_deleted !== true
                        ).length
                      }{" "}
                      首 · {format(playlist.createdAt, "yyyy-MM-dd")}
                    </p>
                  </>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 text-muted-foreground/60 hover:text-foreground transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPlaylistId(playlist.id);
                      setEditingName(playlist.name);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    重命名
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(playlist.id);
                    }}
                  >
                    <Trash2 className="text-destructive h-4 w-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
