import { useEffect, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { MusicTrackList } from "@/components/MusicTrackList";
import { MusicCover } from "@/components/MusicCover";
import { useMusicStore } from "@/store/music-store";
import { Loader2, Mic2, Play, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MusicTrack } from "@/types/music";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { neteaseApi } from "@/lib/api/netease";

interface NeteaseArtistDetailProps {
  id: string;
}

interface ArtistViewData {
  name: string;
  coverImgUrl: string;
  description?: string;
  tracks: MusicTrack[];
}

export function NeteaseArtistDetail({ id }: NeteaseArtistDetailProps) {
  const [data, setData] = useState<ArtistViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const { playContext, togglePlay, queue, currentIndex, isPlaying } = useMusicStore();
  const currentTrack = queue[currentIndex] || null;

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      if (!id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const result = await neteaseApi.getArtist(id, "");
        if (mounted && result) {
          setData({
            name: result.artist.name,
            coverImgUrl: result.artist.picUrl,
            description: result.artist.briefDesc,
            tracks: result.hotSongs
          });
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed to fetch artist detail:", err);
          setError("获取歌手详情失败，请稍后重试");
          toast.error("获取歌手详情失败");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [id]);

  const handlePlay = (track: MusicTrack) => {
    if (!data) return;
    
    // Check if we are playing the same track
    if (track.id === currentTrack?.id) {
      togglePlay();
      return;
    }

    // Play context needs full list and index
    const index = data.tracks.findIndex(t => t.id === track.id);
    if (index !== -1) {
      playContext(data.tracks, index, `_netease-artist-${id}`);
    }
  };

  const handlePlayAll = () => {
    if (!data || data.tracks.length === 0) return;
    playContext(data.tracks, 0, `_netease-artist-${id}`);
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
        <p className="text-muted-foreground">{error || "歌手不存在"}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回
        </Button>
      </div>
    );
  }

  return (
    <PageLayout title={data.name}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className={cn(
          "p-4 border-b flex items-end gap-4 bg-muted/10 relative",
        )}>
          <div className="h-24 w-24 sm:h-32 sm:w-32 bg-primary/10 rounded-lg flex items-center justify-center shadow-sm border overflow-hidden shrink-0">
            <MusicCover
              src={data.coverImgUrl}
              alt={data.name}
              className="h-full w-full"
              iconClassName="h-8 w-8 text-primary/80"
              fallbackIcon={<Mic2 className="h-8 w-8 text-primary/80" />}
            />
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight line-clamp-2">{data.name}</h1>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              {data.tracks.length > 0 && (
                <span>热门歌曲 {data.tracks.length} 首</span>
              )}
            </div>
            
            {data.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-3 max-w-prose">
                {data.description}
              </p>
            )}

            <div className="pt-2 flex gap-2 items-center">
               <Button 
                  onClick={handlePlayAll} 
                  className="rounded-full px-4 h-8"
                  size="sm"
               >
                  <Play className="mr-2 h-3 w-3 fill-current" /> 播放热门
               </Button>
            </div>
          </div>
        </div>

        {/* List */}
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
