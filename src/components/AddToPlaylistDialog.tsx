import { useMusicStore } from "@/store/music-store";
import { useActivePlaylists } from "@/hooks/use-active-playlists";
import type { MusicTrack } from "@/types/music";
import { ListMusic, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "./ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "./ui/drawer";
import { ScrollArea } from "./ui/scroll-area";

interface AddToPlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track?: MusicTrack;
}

export function AddToPlaylistDialog({ open, onOpenChange, track }: AddToPlaylistDialogProps) {
  const { addToPlaylist, createPlaylist } = useMusicStore();
  const playlists = useActivePlaylists();

  if (!track) return null;

  const handleAddToPlaylist = (playlistId: string, playlistName: string) => {
    addToPlaylist(playlistId, track);
    toast.success(`已加入「${playlistName}」`);
    onOpenChange(false);
  };

  const handleCreatePlaylist = () => {
    const name = window.prompt("请输入新歌单名称");
    if (name) {
      const id = createPlaylist(name);
      addToPlaylist(id, track);
      toast.success(`已创建并加入「${name}」`);
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] p-0 gap-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <DrawerHeader className="px-6 py-4 border-b">
          <DrawerTitle>添加到歌单</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full p-2">
            {playlists.map((p) => (
              <div
                key={p.id}
                className="flex items-center px-4 py-3 text-sm rounded-md hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleAddToPlaylist(p.id, p.name)}
              >
                <ListMusic className="mr-3 h-5 w-5 text-muted-foreground" />
                <span className="truncate font-medium">{p.name}</span>
              </div>
            ))}
            {playlists.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                    暂无歌单
                </div>
            )}
          </ScrollArea>
        </div>
        <div className="p-2 border-t bg-muted/20">
            <Button variant="ghost" className="w-full justify-start pl-4 h-11" onClick={handleCreatePlaylist}>
                <Plus className="mr-2 h-5 w-5" />
                新建歌单
            </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
