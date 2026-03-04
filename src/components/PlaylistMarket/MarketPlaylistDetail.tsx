import { useEffect, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { MusicTrackList } from "@/components/MusicTrackList";
import { getPlaylistDetail, convertSongToMusicTrack } from "@/lib/netease/netease-api";
import { PlaylistDetail } from "@/lib/netease/netease-types";
import { MusicTrack } from "@/types/music";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface MarketPlaylistDetailProps {
  playlistId: string | null;
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PlaylistHeader({ detail }: { detail: PlaylistDetail }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative w-full overflow-hidden bg-muted/30 shrink-0">
      {/* 模糊背景 */}
      <div 
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-20 scale-125 pointer-events-none"
        style={{ backgroundImage: `url(${detail.coverImgUrl})` }}
      />
      
      <div className="relative z-10 p-5 flex gap-4 items-start">
        {/* 封面图 */}
        <div className="shrink-0 w-28 h-28 rounded-xl overflow-hidden shadow-xl ring-1 ring-white/10">
          <img 
            src={detail.coverImgUrl} 
            alt={detail.name} 
            className="w-full h-full object-cover" 
          />
        </div>

        {/* 信息区 */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <h2 className="text-base font-bold leading-tight text-foreground/90 line-clamp-2">
            {detail.name}
          </h2>
          
          {/* 作者信息 */}
          {detail.creator && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">by {detail.creator.nickname}</span>
            </div>
          )}

          {/* 描述 - 点击展开 */}
          {detail.description && (
            <div 
              className="group cursor-pointer mt-1"
              onClick={() => setExpanded(!expanded)}
            >
              <p className={cn(
                "text-[11px] text-muted-foreground/80 leading-relaxed transition-all",
                !expanded && "line-clamp-3"
              )}>
                {detail.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!playlistId || !open) return;

    let active = true;
    setLoading(true);
    setError(false);
    // 重置之前的状态，避免闪烁
    setTracks([]); 
    setDetail(null);
    
    const load = async () => {
      try {
        const res = await getPlaylistDetail(playlistId, "");
        if (active) {
          setDetail(res);
          const musicTracks = res.tracks.map(convertSongToMusicTrack);
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
          <PageLayout title={detail?.name || "歌单详情"} onBack={onBack}>
            <div className="flex flex-col flex-1 min-h-0">
              {detail && <PlaylistHeader detail={detail} />}
              <div className="flex-1 min-h-0">
                <MusicTrackList
                  tracks={tracks}
                  onPlay={(track) => onPlay(track, tracks)}
                  currentTrackId={currentTrackId}
                  isPlaying={isPlaying}
                  emptyMessage="歌单为空"
                />
              </div>
            </div>
          </PageLayout>
        )}
      </SheetContent>
    </Sheet>
  );
}
