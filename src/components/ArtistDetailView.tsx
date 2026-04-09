import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MusicTrackList } from "@/components/MusicTrackList";
import { 
  getArtist, getArtistAlbums, getArtistSongs, 
  convertSongToMusicTrack, 
  getArtistDynamicDetail
} from "@/lib/netease/netease-api";
import { ArtistDetail, ArtistAlbum } from "@/lib/netease/netease-raw-types";
import { MusicTrack } from "@/types/music";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNeteaseStore } from "@/store/netease-store";
import { ChevronLeft, Share2 } from "lucide-react";
import toast from "react-hot-toast";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";
import { cn } from "@/lib/utils";
import { MusicCover } from "@/components/MusicCover";
import { format } from "date-fns";
import { logger } from "@/lib/logger";

interface ArtistDetailViewProps {
  id: string;
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

export function ArtistDetailView({
  id,
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: ArtistDetailViewProps) {
  const navigate = useNavigate();
  const { cookie } = useNeteaseStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState("songs");
  const [scrollY, setScrollY] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ArtistDetail | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [songOffset, setSongOffset] = useState(0);
  const [hasMoreSongs, setHasMoreSongs] = useState(false);
  const [songsLoading, setSongsLoading] = useState(false);
  const [albums, setAlbums] = useState<ArtistAlbum[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [hasMoreAlbums, setHasMoreAlbums] = useState(true);
  const [albumOffset, setAlbumOffset] = useState(0);

  // 初始化加载
  useEffect(() => {
    let active = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const [res] = await Promise.all([
          getArtist(id, cookie),
          cookie ? getArtistDynamicDetail(id, cookie) : Promise.resolve(null)
        ]);
        
        if (!active || !res) return;
        setDetail(res);
        setTracks(res.hotSongs?.map(convertSongToMusicTrack) || []);
        setSongOffset(res.hotSongs?.length || 0);
        setHasMoreSongs(res.artist?.musicSize > (res?.hotSongs?.length || 0));
        
      } catch (err: any) {
        logger.error("ArtistDetailView", "Load artist detail failed", err, {
          artistId: id,
        });
        toast.error("加载歌手信息失败：" + err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => { active = false; };
  }, [id, cookie]);

  // 加载更多歌曲
  const loadMoreSongs = async () => {
    if (songsLoading || !hasMoreSongs) return;
    setSongsLoading(true);
    try {
      const res = await getArtistSongs(id, 50, songOffset, 'hot', cookie);
      if (res?.songs?.length) {
        const newTracks = res.songs.map(convertSongToMusicTrack);
        setTracks(prev => [...prev, ...newTracks]);
        setSongOffset(prev => prev + newTracks.length);
        setHasMoreSongs(res.more);
      } else {
        setHasMoreSongs(false);
      }
    } catch (err: any) {
      toast.error("加载失败：" + err.message);
    } finally {
      setSongsLoading(false);
    }
  };

  // Tab 切换处理
  const handleTabChange = (value: string) => {
    setActiveTab(value);

    if (value === "albums" && albums.length === 0 && !albumsLoading) {
      loadAlbums();
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      setScrollY(scrollRef.current.scrollTop);
    }
  };

  // 加载专辑
  const loadAlbums = async () => {
    if (albumsLoading || !hasMoreAlbums) return;
    setAlbumsLoading(true);
    try {
      const res = await getArtistAlbums(id, 30, albumOffset, cookie);
      if (res?.hotAlbums) {
        setAlbums(prev => [...prev, ...res.hotAlbums]);
        setHasMoreAlbums(res.more);
        setAlbumOffset(prev => prev + 30);
      }
    } catch (err: any) {
      toast.error("加载专辑失败：" + err.message);
    } finally {
      setAlbumsLoading(false);
    }
  };

  const handleShare = async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(
        `【网易云歌手】${detail.artist.name}\nhttps://music.163.com/#/artist?id=${id}`
      );
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  if (loading) return <DetailSkeleton onBack={onBack} />;
  if (!detail) return null;

  const { artist } = detail;

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-smooth relative"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* Sticky Top Bar */}
        <div className={cn(
          "sticky top-0 z-50 flex items-center justify-between px-4 h-16 transition-all duration-300",
          scrollY > 150 ? "bg-background/95 backdrop-blur-md" : "bg-transparent"
        )}>
          <Button 
            variant="secondary" size="icon" 
            className={cn("rounded-full border-none transition-colors", scrollY > 150 ? "bg-transparent text-foreground hover:bg-muted" : "bg-black/20 backdrop-blur-md hover:bg-black/40 text-white")}
            onClick={onBack}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className={cn("font-bold text-lg transition-opacity duration-300", scrollY > 150 ? "opacity-100" : "opacity-0")}>
            {artist.name}
          </div>
          <Button 
            variant="secondary" size="icon"
            className={cn("rounded-full border-none transition-colors", scrollY > 150 ? "bg-transparent text-foreground hover:bg-muted" : "bg-black/20 backdrop-blur-md hover:bg-black/40 text-white")}
            onClick={handleShare}
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Hero Section */}
        <div className="relative -mt-16 h-[40vh] min-h-[300px] w-full flex flex-col justify-end pb-4">
          <div className="absolute inset-0 z-0">
             <img 
               src={artist.picUrl} 
               alt={artist.name}
               className="w-full h-full object-cover object-top"
             />
             <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-background" />
             <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
          </div>

          {/* Artist Info */}
          <div className="relative z-10 px-6 flex flex-col gap-3">
            <h1 className="text-4xl font-bold text-foreground drop-shadow-md tracking-tight">
              {artist.name}
            </h1>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                <span>歌曲 {artist.musicSize}</span>
                <span>专辑 {artist.albumSize}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Tabs */}
        <div className={cn(
          "sticky top-16 z-40 transition-all duration-300",
          scrollY > 150 ? "bg-background/95 backdrop-blur-md border-b" : "bg-transparent"
        )}>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="w-full justify-start h-12 bg-transparent p-0 px-6 gap-8">
              <TabsTrigger 
                value="intro"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:border-b-[3px] data-[state=active]:border-primary rounded-none px-1 py-3 text-base font-medium text-muted-foreground/80 hover:text-foreground transition-colors"
              >
                简介
              </TabsTrigger>
              <TabsTrigger 
                value="songs"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:border-b-[3px] data-[state=active]:border-primary rounded-none px-1 py-3 text-base font-medium text-muted-foreground/80 hover:text-foreground transition-colors"
              >
                歌曲
              </TabsTrigger>
              <TabsTrigger 
                value="albums"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:border-b-[3px] data-[state=active]:border-primary rounded-none px-1 py-3 text-base font-medium text-muted-foreground/80 hover:text-foreground transition-colors"
              >
                专辑
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content Area */}
        <div className="min-h-[50vh] bg-background">
          {activeTab === "songs" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <MusicTrackList
                tracks={tracks}
                scrollContainerRef={scrollRef}
                onPlay={(track) => onPlay(track, tracks)}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                emptyMessage="暂无热门歌曲"
                onLoadMore={loadMoreSongs}
                hasMore={hasMoreSongs}
                loading={loading || songsLoading}
              />
            </div>
          )}

          {activeTab === "albums" && (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {albums.map((album) => (
                <div 
                  key={album.id} 
                  className="group cursor-pointer space-y-2.5"
                  onClick={() => navigate(`/netease-album/${album.id}`)}
                >
                  <div className="aspect-square overflow-hidden rounded-xl shadow-sm relative">
                    <MusicCover 
                      src={album.picUrl} 
                      alt={album.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-medium text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                      {album.name}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      {format(album.publishTime, "yyyy-MM-dd")}
                    </p>
                  </div>
                </div>
              ))}
              {hasMoreAlbums && (
                <div className="col-span-full py-8 flex justify-center">
                  <Button 
                    variant="ghost" 
                    disabled={albumsLoading} 
                    onClick={loadAlbums}
                    className="text-muted-foreground"
                  >
                    {albumsLoading ? "加载中..." : "加载更多专辑"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === "intro" && (
            <div className="p-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              {artist.briefDesc && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <div className="w-1 h-5 bg-primary rounded-full" />
                    歌手简介
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground/90 whitespace-pre-wrap pl-3 border-l-2 border-muted ml-0.5">
                    {artist.briefDesc}
                  </p>
                </div>
              )}
              {/* 这里可以扩展更多信息，如相似歌手、演艺经历等 */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
