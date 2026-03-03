import { useEffect, useState, useCallback } from "react";
import { PageLayout } from "@/components/PageLayout";
import { MusicTrackList } from "@/components/MusicTrackList";
import { MusicCover } from "@/components/MusicCover";
import { useMusicStore } from "@/store/music-store";
import { Loader2, Disc, Play, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MusicTrack } from "@/types/music";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { neteaseApi } from "@/lib/api/netease";

interface NeteasePlaylistDetailProps {
  id: string;
}

interface PlaylistViewData {
  name: string;
  coverImgUrl: string;
  creator: { nickname: string; avatarUrl: string };
  description: string;
  playCount: number;
  trackCount: number;
  tracks: MusicTrack[];
}

export function NeteasePlaylistDetail({ id }: NeteasePlaylistDetailProps) {
  const [data, setData] = useState<PlaylistViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const { playContext, togglePlay, queue, currentIndex, isPlaying } = useMusicStore();
  const currentTrack = queue[currentIndex] || null;

  // 数据标准化函数：将网易云原生 SongDetail 转换为项目的 MusicTrack 格式
  const formatNeteaseTrack = (t: any): MusicTrack => {
    return {
      id: `ne_track_${t.id}`,
      name: t.name,
      artist: t.ar.map((a: any) => a.name),
      album: t.al.name,
      pic_id: t.al.picUrl,
      url_id: String(t.id),
      lyric_id: String(t.id),
      source: '_netease',
      artist_id: t.ar?.[0]?.id ? String(t.ar[0].id) : undefined,
      album_id: t.al?.id ? String(t.al.id) : undefined,
    };
  };

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      
      try {
        const result = await neteaseApi.getPlaylistDetail(id);
        if (mounted && result) {
          // 关键修复点：对 tracks 进行 map 转换，确保数据符合 MusicTrack 定义
          const formattedTracks = (result.tracks || []).map(formatNeteaseTrack);

          setData({
            name: result.name,
            coverImgUrl: result.coverImgUrl,
            creator: result.creator,
            description: result.description,
            playCount: result.playCount,
            trackCount: result.trackCount,
            tracks: formattedTracks
          });
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed to fetch playlist detail:", err);
          setError("获取歌单详情失败，请稍后重试");
          toast.error("获取歌单详情失败");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [id]);

  const handlePlay = useCallback((track: MusicTrack) => {
    if (!data) return;
    if (track.id === currentTrack?.id) {
      togglePlay();
      return;
    }
    const index = data.tracks.findIndex(t => t.id === track.id);
    if (index !== -1) {
      playContext(data.tracks, index, `_netease-playlist-${id}`);
    }
  }, [data, currentTrack?.id, togglePlay, playContext, id]);

  const handlePlayAll = () => {
    if (!data || data.tracks.length === 0) return;
    playContext(data.tracks, 0, `_netease-playlist-${id}`);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full items-center justify-center space-y-4">
        <p className="text-muted-foreground">{error || "歌单不存在"}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回
        </Button>
      </div>
    );
  }

  return (
    <PageLayout title={data.name}>
      <div className="flex flex-col h-full">
        {/* Header 部分：精简模式 */}
        <div className={cn("p-4 border-b flex items-center gap-4 bg-muted/5")}>
          <div className="h-24 w-24 bg-primary/10 rounded-lg flex items-center justify-center shadow-sm border overflow-hidden shrink-0">
            <MusicCover
              src={data.coverImgUrl}
              alt={data.name}
              className="h-full w-full"
              iconClassName="h-8 w-8 text-primary/80"
              fallbackIcon={<Disc className="h-8 w-8 text-primary/80" />}
            />
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <div className="space-y-1">
              <h1 className="text-lg font-bold tracking-tight line-clamp-2">{data.name}</h1>
              {data.creator && (
                <p className="text-xs text-muted-foreground font-medium">
                  {data.trackCount} 首
                </p>
              )}
            </div>

            <Button 
              onClick={handlePlayAll} 
              className="rounded-full px-5 h-9"
              size="sm"
            >
              <Play className="mr-2 h-4 w-4 fill-current" /> 播放全部
            </Button>
          </div>
        </div>

        {/* List 部分 */}
        <div className="flex-1 min-h-0 bg-background/50">
          <MusicTrackList
            tracks={data.tracks}
            onPlay={handlePlay}
            currentTrackId={currentTrack?.id}
            isPlaying={isPlaying}
            emptyMessage="暂无歌曲"
          />
        </div>
      </div>
    </PageLayout>
  );
}