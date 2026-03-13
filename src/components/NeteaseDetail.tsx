import { useEffect, useState, useRef } from "react";
import { PageLayout } from "@/components/PageLayout";
import { MusicTrackList } from "@/components/MusicTrackList";
import { getPlaylistDetail, getArtist, getAlbum, convertSongToMusicTrack } from "@/lib/netease/netease-api";
import { MusicTrack } from "@/types/music";
import { MoreVertical, Import, SquareArrowOutUpRight, Album } from "lucide-react";
import toast from "react-hot-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMusicStore } from "@/store/music-store";
import { PageError } from "@/components/PageError";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";
import { CommonDetailHeader } from "@/components/CommonDetailHeader";
import { SongDetail } from "@/lib/netease/netease-raw-types";
import { ArtistAlbumSheet } from "@/components/ArtistAlbumSheet";

interface NeteaseDetailProps {
  id: string | null;
  type?: "playlist" | "artist" | "album";
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


export function NeteaseDetail({
  id,
  type = "playlist",
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: NeteaseDetailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isAlbumSheetOpen, setIsAlbumSheetOpen] = useState(false);

  const [{ loading, error, detail, tracks }, setState] = useState<{
    loading: boolean;
    error: boolean;
    detail: UnifiedDetail | null;
    tracks: MusicTrack[];
  }>({
    loading: true,
    error: false,
    detail: null,
    tracks: [],
  });

  const { createPlaylist, setPlaylistTracks } = useMusicStore();

  const handleShare = async () => {
    if (!detail || !id) return;
    try {
      const typeLabel = { playlist: "歌单", artist: "歌手", album: "专辑" }[type];
      await navigator.clipboard.writeText(
        `【网易云${typeLabel}】${detail.name}\nhttps://music.163.com/#/${type}?id=${id}`
      );
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  const handleImportPlaylist = () => {
    if (!detail || !tracks.length) return;
    const toastId = toast.loading(`正在导入 ${tracks.length} 首歌曲...`);
    try {
      const newPlaylistId = createPlaylist(detail.name, detail.coverImgUrl);
      setPlaylistTracks(newPlaylistId, tracks);
      toast.success(`成功导入 ${tracks.length} 首歌曲`, { id: toastId });
    } catch {
      toast.error("导入失败", { id: toastId });
    }
  };

  useEffect(() => {
    if (!id) return;

    let active = true;
    setState({ loading: true, error: false, detail: null, tracks: [] });

    const loadData = async () => {
      try {
        let rawDetail: UnifiedDetail;
        let rawTracks: SongDetail[] = [];

        if (type === "playlist") {
          const res = await getPlaylistDetail(id, "");
          if (!res) throw new Error("Not found");
          rawDetail = {
            name: res.name,
            coverImgUrl: res.coverImgUrl,
            description: res.description,
            creator: res.creator?.nickname ? res.creator.nickname : undefined,
            trackCount: res.trackCount,
          };
          rawTracks = res.tracks;
        } else if (type === "artist") {
          const res = await getArtist(id, "");
          if (!res) throw new Error("Not found");
          rawDetail = {
            name: res.artist.name,
            coverImgUrl: res.artist.picUrl,
            description: res.artist.briefDesc,
            trackCount: res.hotSongs.length,
          };
          rawTracks = res.hotSongs;
        } else {
          const res = await getAlbum(id, "");
          if (!res?.album) throw new Error("Not found");
          rawDetail = {
            name: res.album.name,
            coverImgUrl: res.album.picUrl,
            description: res.album.description,
            creator: res.album.artist?.name,
            trackCount: res.songs.length,
            publishTime: res.album.publishTime,
          };
          rawTracks = res.songs;
        }

        if (!active) return;

        setState({
          loading: false,
          error: false,
          detail: rawDetail,
          tracks: rawTracks.map(convertSongToMusicTrack),
        });
      } catch (err) {
        console.error(err);
        if (active) {
          setState((s) => ({ ...s, loading: false, error: true }));
        }
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [id, type, retryCount]);

  if (loading) return <DetailSkeleton onBack={onBack} />;

  if (error) {
    return (
      <PageLayout title="错误" onBack={onBack}>
        <PageError 
          onBack={onBack} 
          onRetry={() => setRetryCount((c) => c + 1)}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={detail?.name || "详情"}
      onBack={onBack}
      action={
        <div className="flex items-center">
          {type === "artist" && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setIsAlbumSheetOpen(true)}
            >
              <Album className="w-5 h-5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
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
        </div>
      }
    >
      <div
        ref={scrollRef}
        className="flex flex-col flex-1 min-h-0 h-full overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        {detail && (
          <CommonDetailHeader
            title={detail.name}
            coverUrl={detail.coverImgUrl}
            description={detail.description}
            creator={detail.creator}
            countDesc={`${detail.trackCount} 首`}
            publishTime={detail.publishTime}
          />
        )}
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
      
      <ArtistAlbumSheet 
        artistId={id} 
        isOpen={isAlbumSheetOpen} 
        onOpenChange={setIsAlbumSheetOpen}
        artistName={detail?.name}
      />
    </PageLayout>
  );
}
