import { useEffect, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { MusicTrackList } from "@/components/MusicTrackList";
import { getPlaylistDetail, getArtist, getAlbum, convertSongToMusicTrack } from "@/lib/netease/netease-api";
import { MusicTrack } from "@/types/music";
import { Loader2, MoreVertical, Import, SquareArrowOutUpRight } from "lucide-react";
import toast from "react-hot-toast";
import { cn, processBatchCPU } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMusicStore } from "@/store/music-store";

interface NeteaseDetailProps {
  id: string | null;
  type?: 'playlist' | 'artist' | 'album';
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

// Unified detail structure
interface UnifiedDetail {
  name: string;
  coverImgUrl: string;
  description?: string;
  creator?: string;
  trackCount: number;
}

function DetailHeader({ detail }: { detail: UnifiedDetail }) {
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
              <span className="truncate">{detail.creator}</span>
              {/* 歌曲数量 */}
              <span className="text-xs text-muted-foreground/60">
                {detail.trackCount.toLocaleString()} 首
              </span>
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

export function NeteaseDetail({
  id,
  type = 'playlist',
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: NeteaseDetailProps) {
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [detail, setDetail] = useState<UnifiedDetail | null>(null);
  const [error, setError] = useState(false);
  const createPlaylist = useMusicStore((state) => state.createPlaylist);
  const setPlaylistTracks = useMusicStore((state) => state.setPlaylistTracks);

  const handleShare = async () => {
    if (!detail || !id) return;
    
    try {
      const typeLabel = type === 'playlist' ? '歌单' : type === 'artist' ? '歌手' : '专辑';
      const text = `【网易云${typeLabel}】${detail.name}\nhttps://music.163.com/#/${type}?id=${id}`;
      await navigator.clipboard.writeText(text);
      toast.success("链接已复制");
    } catch (err) {
      console.error("Copy failed", err);
      toast.error("复制失败");
    }
  };

  const handleImportPlaylist = async () => {
    if (!detail || tracks.length === 0) return;
    
    const count = tracks.length;
    const toastId = toast.loading(`正在导入 0/${count}...`);

    try {
      const newPlaylistId = createPlaylist(detail.name, detail.coverImgUrl);
      
      const tracksToImport: MusicTrack[] = [];
      await processBatchCPU(
        tracks,
        (track) => {
          tracksToImport.push(track);
        },
        (current, total) => {
          toast.loading(`正在导入 ${current}/${total}...`, { id: toastId });
        }
      );

      setPlaylistTracks(newPlaylistId, tracksToImport);
      toast.success(`已导入 ${count} 首歌曲`, { id: toastId });
    } catch (error) {
      console.error("Import playlist failed", error);
      toast.error("导入失败", { id: toastId });
    }
  };

  useEffect(() => {
    if (!id) return;

    let active = true;
    setLoading(true);
    setError(false);
    // 重置之前的状态，避免闪烁
    setTracks([]); 
    setDetail(null);
    
    const load = async () => {
      try {
        let rawDetail: UnifiedDetail | null = null;
        let rawTracks: any[] = [];

        if (type === 'playlist') {
            const res = await getPlaylistDetail(id, "");
            rawDetail = {
                name: res.name,
                coverImgUrl: res.coverImgUrl,
                description: res.description,
                creator: res.creator ? `by ${res.creator.nickname}` : undefined,
                trackCount: res.trackCount,
            };
            rawTracks = res.tracks;
        } else if (type === 'artist') {
            const res = await getArtist(id, "");
            rawDetail = {
                name: res.artist.name,
                coverImgUrl: res.artist.picUrl,
                description: res.artist.briefDesc,
                trackCount: res.hotSongs.length,
            };
            rawTracks = res.hotSongs;
        } else if (type === 'album') {
            const res = await getAlbum(id, "");
            console.log('Netease Album Response:', res);
            
            // 兼容可能的数据结构差异
            const data = res.album ? res : (res.data || res.result || res);

            if (!data || !data.album) {
                throw new Error("Invalid album data");
            }

            rawDetail = {
                name: data.album.name,
                coverImgUrl: data.album.picUrl,
                description: data.album.description,
                creator: data.album.artist ? `Artist: ${data.album.artist.name}` : undefined,
                trackCount: data.songs.length,
            };
            rawTracks = data.songs;
        }

        if (active && rawDetail) {
          setDetail(rawDetail);
          // 使用 processBatchCPU 处理大量歌曲的转换，避免阻塞主线程
          const musicTracks: MusicTrack[] = [];
          await processBatchCPU(rawTracks, (track) => {
            musicTracks.push(convertSongToMusicTrack(track));
          });
          
          if (active) {
            setTracks(musicTracks);
          }
        }
      } catch (e) {
        console.error("Failed to load detail", e);
        if (active) {
          setError(true);
          toast.error("加载失败");
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
  }, [id, type]);

  if (loading) {
    return (
      <PageLayout title="加载中..." onBack={onBack}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="错误" onBack={onBack}>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
          <p>加载失败</p>
          <button onClick={onBack} className="underline">
            返回
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={detail?.name || "详情"}
      onBack={onBack}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleShare}>
              <SquareArrowOutUpRight className="w-4 h-4 mr-2" />
              分享
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportPlaylist}>
              <Import className="w-4 h-4 mr-2" />
              导入歌单
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="flex flex-col flex-1 min-h-0">
        {detail && <DetailHeader detail={detail} />}
        <div className="flex-1 min-h-0">
          <MusicTrackList
            tracks={tracks}
            onPlay={(track) => onPlay(track, tracks)}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            emptyMessage="列表为空"
          />
        </div>
      </div>
    </PageLayout>
  );
}
