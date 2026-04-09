import { useMusicStore } from "@/store/music-store";
import { useActivePlaylists } from "@/hooks/use-active-playlists";
import type { MusicTrack, Playlist } from "@/types/music";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "./ui/drawer";
import { ScrollArea } from "./ui/scroll-area";
import { PlaylistCover } from "./PlaylistCover";

interface AddToPlaylistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track?: MusicTrack;
  tracks?: MusicTrack[];
  onDone?: () => void;
}

function PlaylistItem({ 
  playlist, 
  onClick 
}: { 
  playlist: Playlist; 
  onClick: () => void;
}) {
  const validTracks = playlist.tracks.filter(t => !t.is_deleted);
  const trackCount = validTracks.length;

  return (
    <div
      className="flex items-center px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent active:scale-[0.98] transition-all group"
      onClick={onClick}
    >
      <PlaylistCover
        playlist={playlist}
        className="w-12 h-12 rounded-lg shadow-sm transition-all group-hover:shadow-md bg-muted/50 shrink-0"
        iconClassName="h-5 w-5 text-muted-foreground/70"
      />
      <div className="ml-4 flex-1 overflow-hidden flex flex-col justify-center gap-0.5">
        <p className="text-base font-medium truncate leading-tight">{playlist.name}</p>
        <p className="text-xs text-muted-foreground/80 truncate">{trackCount} 首歌曲</p>
      </div>
    </div>
  );
}

export function AddToPlaylistDrawer({ open, onOpenChange, track, tracks, onDone }: AddToPlaylistDrawerProps) {
  const { addToPlaylist, addBatchToPlaylist, createPlaylist } = useMusicStore();
  const playlists = useActivePlaylists();

  const isBatch = !track && !!tracks?.length;

  if (!track && !tracks?.length) return null;

  const handleAddToPlaylist = (playlistId: string, playlistName: string) => {
    if (isBatch) {
      addBatchToPlaylist(playlistId, tracks!);
      toast.success(`已加入「${playlistName}」${tracks!.length} 首`);
    } else {
      addToPlaylist(playlistId, track!);
      toast.success(`已加入「${playlistName}」`);
    }
    onDone?.();
    onOpenChange(false);
  };

  const handleCreatePlaylist = () => {
    const name = window.prompt("请输入新歌单名称");
    if (name) {
      const id = createPlaylist(name);
      if (isBatch) {
        addBatchToPlaylist(id, tracks!);
        toast.success(`已创建并加入「${name}」${tracks!.length} 首`);
      } else {
        addToPlaylist(id, track!);
        toast.success(`已创建并加入「${name}」`);
      }
      onDone?.();
      onOpenChange(false);
    }
  };

  const title = isBatch ? `添加 ${tracks!.length} 首到歌单` : "添加到歌单";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] flex flex-col p-0 gap-0 outline-none" onClick={(e) => e.stopPropagation()}>
        <DrawerHeader className="px-5 pt-6 pb-4 shrink-0">
          <DrawerTitle className="text-lg font-semibold text-center">{title}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full px-2">
            <div className="space-y-1 pb-6">
              <div
                className="flex items-center px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent active:scale-[0.98] transition-all group"
                onClick={handleCreatePlaylist}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Plus className="h-6 w-6" />
                </div>
                <span className="ml-4 text-base font-medium">新建歌单</span>
              </div>

              {playlists.map((p) => (
                <PlaylistItem
                  key={p.id}
                  playlist={p}
                  onClick={() => handleAddToPlaylist(p.id, p.name)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
