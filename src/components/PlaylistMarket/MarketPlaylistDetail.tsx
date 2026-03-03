import { useEffect, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { MusicTrackList } from "@/components/MusicTrackList";
import { getPlaylistDetail, convertSongToMusicTrack } from "@/lib/netease/netease-api";
import { MusicTrack } from "@/types/music";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface MarketPlaylistDetailProps {
  playlistId: string | null;
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketPlaylistDetail({
  playlistId,
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
  open,
  onOpenChange,
}: MarketPlaylistDetailProps) {
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [playlistName, setPlaylistName] = useState("歌单详情");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!playlistId || !open) return;

    let active = true;
    setLoading(true);
    setError(false);
    // 重置之前的状态，避免闪烁
    setTracks([]); 
    
    const load = async () => {
      try {
        const detail = await getPlaylistDetail(playlistId, "");
        if (active) {
          setPlaylistName(detail.name);
          const musicTracks = detail.tracks.map(convertSongToMusicTrack);
          setTracks(musicTracks);
        }
      } catch (e) {
        console.error("Failed to load playlist detail", e);
        if (active) {
          setError(true);
          toast.error("加载歌单失败");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [playlistId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-none p-0 border-none outline-none">
        {loading ? (
          <PageLayout title="加载中..." onBack={onBack}>
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          </PageLayout>
        ) : error ? (
          <PageLayout title="错误" onBack={onBack}>
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <p>加载失败</p>
              <button onClick={onBack} className="underline">
                返回
              </button>
            </div>
          </PageLayout>
        ) : (
          <PageLayout title={playlistName} onBack={onBack}>
            <div className="flex-1 min-h-0">
              <MusicTrackList
                tracks={tracks}
                onPlay={(track) => onPlay(track, tracks)}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                emptyMessage="歌单为空"
              />
            </div>
          </PageLayout>
        )}
      </SheetContent>
    </Sheet>
  );
}
