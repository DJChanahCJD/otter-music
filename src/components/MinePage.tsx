"use client";

import { useState } from "react";
import { ListVideo, Download, ListMusic, SquarePlus, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { format } from "date-fns";
import toast from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface MinePageProps {
  onOpenQueue: () => void;
  onOpenLocalMusic: () => void;
  onSelectPlaylist: (playlistId: string) => void;
}

export function MinePage({ onOpenQueue, onOpenLocalMusic, onSelectPlaylist }: MinePageProps) {
  const { playlists, createPlaylist, renamePlaylist, deletePlaylist } = useMusicStore(
    useShallow((state) => ({
      playlists: state.playlists,
      createPlaylist: state.createPlaylist,
      renamePlaylist: state.renamePlaylist,
      deletePlaylist: state.deletePlaylist,
    }))
  );

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
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

  return (
    <div className="p-5">
      <div className="flex gap-3 mb-6">
        <button
          onClick={onOpenQueue}
          className="flex-1 flex items-center gap-3 p-4 rounded-2xl bg-card/60 hover:bg-card/80 border border-border/50 transition-colors"
        >
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ListVideo className="h-5 w-5 text-primary" />
          </div>
          <span className="font-medium text-foreground">播放列表</span>
        </button>

        <button
          onClick={onOpenLocalMusic}
          className="flex-1 flex items-center gap-3 p-4 rounded-2xl bg-card/60 hover:bg-card/80 border border-border/50 transition-colors"
        >
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <span className="font-medium text-foreground">下载管理</span>
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">我的歌单</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              <SquarePlus className="h-4 w-4" />
              新建
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建歌单</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="歌单名称"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
              />
            </div>
            <DialogFooter>
              <Button onClick={handleCreatePlaylist}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <ListMusic className="h-10 w-10 text-muted-foreground/40 mb-2" />
          <p className="text-muted-foreground text-sm">暂无歌单</p>
          <p className="text-muted-foreground/60 text-xs mt-1">点击"新建"创建你的第一个歌单</p>
        </div>
      ) : (
        <div className="space-y-2">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-card/50 hover:bg-card transition-colors cursor-pointer group"
              onClick={() => onSelectPlaylist(playlist.id)}
            >
              <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ListMusic className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {editingPlaylistId === playlist.id ? (
                  <Input
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
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <p className="font-medium text-foreground truncate">{playlist.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {playlist.tracks.length} 首 · {format(playlist.createdAt, "yyyy-MM-dd")}
                    </p>
                  </>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 text-muted-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
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
                    <Trash2 className="h-4 w-4 mr-2" />
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
