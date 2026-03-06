import { useEffect, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { MusicTrackList } from "@/components/MusicTrackList";
import { getPlaylistDetail, getArtist, getAlbum, convertSongToMusicTrack } from "@/lib/netease/netease-api";
import { SongDetail } from "@/lib/netease/netease-types";
import { MusicTrack } from "@/types/music";
import { MoreVertical, Import, SquareArrowOutUpRight } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateZN, processBatchCPU } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMusicStore } from "@/store/music-store";

import { MusicCover } from "@/components/MusicCover";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";

interface NeteaseDetailProps {
  id: string | null;
  type?: 'playlist' | 'artist' | 'album';
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

interface UnifiedDetail {
  name: string;
  coverImgUrl: string;
  description?: string;
  creator?: string;
  trackCount: number;
  publishTime?: number;
}

function DetailHeader({ detail }: { detail: UnifiedDetail }) {
  const publishDate = detail.publishTime ? new Date(detail.publishTime).toLocaleDateString() : null;

  return (
    <div className="relative w-full overflow-hidden bg-muted/30 shrink-0">
      {/* 模糊背景 */}
      <div 
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-20 scale-125 pointer-events-none"
        style={{ backgroundImage: `url(${detail.coverImgUrl})` }}
      />
      
      <div className="relative z-10 p-5 flex gap-4 items-center">
        {/* 封面图 (稍微缩小以显得更精致) */}
        <MusicCover 
          src={detail.coverImgUrl} 
          alt={detail.name} 
          className="shrink-0 w-24 h-24 rounded-xl object-cover shadow-md ring-1 ring-white/10" 
        />

        {/* 信息区 */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h2 className="text-base font-bold leading-tight text-foreground/90 line-clamp-2" title={detail.name}>
            {detail.name}
          </h2>
          
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground/80">
            {detail.creator && <span className="truncate max-w-[120px]">{detail.creator}</span>}
            <span className="shrink-0">{detail.trackCount.toLocaleString()} 首</span>
            {publishDate && <span className="shrink-0">发布于 {formatDateZN(publishDate)}</span>}
          </div>

          {/* 描述 - 固定高度，截断显示，悬浮看全貌 */}
          {detail.description && (
            <p 
              className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-2 mt-1 cursor-help"
              title={detail.description} 
            >
              {detail.description}
            </p>
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
  const [state, setState] = useState({ loading: true, error: false });
  const [data, setData] = useState<{ detail: UnifiedDetail | null; tracks: MusicTrack[] }>({ detail: null, tracks: [] });
  
  const createPlaylist = useMusicStore((state) => state.createPlaylist);
  const setPlaylistTracks = useMusicStore((state) => state.setPlaylistTracks);

  const handleShare = async () => {
    if (!data.detail || !id) return;
    try {
      const typeLabel = { playlist: '歌单', artist: '歌手', album: '专辑' }[type];
      await navigator.clipboard.writeText(`【网易云${typeLabel}】${data.detail.name}\nhttps://music.163.com/#/${type}?id=${id}`);
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  const handleImportPlaylist = async () => {
    if (!data.detail || !data.tracks.length) return;
    const toastId = toast.loading(`正在导入 ${data.tracks.length} 首歌曲...`);
    try {
      const newPlaylistId = createPlaylist(data.detail.name, data.detail.coverImgUrl);
      // 优化：已经是 MusicTrack 数组了，没必要再跑一次 CPU 批处理
      setPlaylistTracks(newPlaylistId, data.tracks);
      toast.success(`成功导入 ${data.tracks.length} 首歌曲`, { id: toastId });
    } catch {
      toast.error("导入失败", { id: toastId });
    }
  };

  useEffect(() => {
    if (!id) return;
    let active = true;
    setState({ loading: true, error: false });
    setData({ detail: null, tracks: [] });
    
    const load = async () => {
      try {
        let rawDetail: UnifiedDetail | null = null;
        let rawTracks: SongDetail[] = [];

        switch (type) {
          case 'playlist': {
            const pRes = await getPlaylistDetail(id, "");
            if (!pRes) throw new Error("Not found");
            rawDetail = { name: pRes.name, coverImgUrl: pRes.coverImgUrl, description: pRes.description, creator: pRes.creator?.nickname ? `by ${pRes.creator.nickname}` : undefined, trackCount: pRes.trackCount };
            rawTracks = pRes.tracks;
            break;
          }
          case 'artist': {
            const aRes = await getArtist(id, "");
            if (!aRes) throw new Error("Not found");
            rawDetail = { name: aRes.artist.name, coverImgUrl: aRes.artist.picUrl, description: aRes.artist.briefDesc, trackCount: aRes.hotSongs.length };
            rawTracks = aRes.hotSongs;
            break;
          }
          case 'album': {
            const alRes = await getAlbum(id, "");
            if (!alRes?.album) throw new Error("Not found");
            rawDetail = { name: alRes.album.name, coverImgUrl: alRes.album.picUrl, description: alRes.album.description, creator: alRes.album.artist?.name, trackCount: alRes.songs.length, publishTime: alRes.album.publishTime };
            rawTracks = alRes.songs;
            break;
          }
        }

        if (active && rawDetail) {
          const musicTracks: MusicTrack[] = [];
          await processBatchCPU(rawTracks, (track) => {
            musicTracks.push(convertSongToMusicTrack(track));
          });
          if (active) setData({ detail: rawDetail, tracks: musicTracks });
        }
      } catch {
        if (active) setState({ loading: false, error: true });
      } finally {
        if (active) setState(s => ({ ...s, loading: false }));
      }
    };

    load();
    return () => { active = false; };
  }, [id, type]);

  if (state.loading) {
    return <DetailSkeleton onBack={onBack} />;
  }

  if (state.error) {
    return (
      <PageLayout title="错误" onBack={onBack}>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
          <p>加载失败</p>
          <Button variant="link" onClick={onBack}>返回</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={data.detail?.name || "详情"}
      onBack={onBack}
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleShare}>
              <SquareArrowOutUpRight className="w-4 h-4 mr-2" />分享
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportPlaylist}>
              <Import className="w-4 h-4 mr-2" />导入歌单
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {/* 确保父容器是 flex-col 和 min-h-0，这是 react-window 正常工作的关键 */}
      <div className="flex flex-col flex-1 min-h-0 h-full">
        {data.detail && <DetailHeader detail={data.detail} />}
        <div className="flex-1 min-h-0 relative">
          <MusicTrackList
            tracks={data.tracks}
            onPlay={(track) => onPlay(track, data.tracks)}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            emptyMessage="列表为空"
          />
        </div>
      </div>
    </PageLayout>
  );
}