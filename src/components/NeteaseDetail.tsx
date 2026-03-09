import { useEffect, useState, useRef } from "react";
import { PageLayout } from "@/components/PageLayout";
import { MusicTrackList } from "@/components/MusicTrackList";
import { getPlaylistDetail, getArtist, getAlbum, convertSongToMusicTrack } from "@/lib/netease/netease-api";
import { MusicTrack } from "@/types/music";
import { MoreVertical, Import, SquareArrowOutUpRight } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateZN } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMusicStore } from "@/store/music-store";
import { MusicCover } from "@/components/MusicCover";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";
import { SongDetail } from "@/lib/netease/netease-raw-types";

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

function DetailHeader({ detail }: { detail: UnifiedDetail }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const publishDate = detail.publishTime
    ? new Date(detail.publishTime).toLocaleDateString()
    : null;

  return (
    <div className="w-full shrink-0">
      <div className="p-5 flex gap-4 items-center">
        <MusicCover
          src={detail.coverImgUrl}
          alt={detail.name}
          className="shrink-0 w-24 h-24 rounded-xl object-cover shadow-md ring-1 ring-white/10"
        />

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h2
            className="text-base font-bold leading-tight text-foreground/90 line-clamp-2"
            title={detail.name}
          >
            {detail.name}
          </h2>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground/80">
            {detail.creator && (
              <span className="truncate max-w-[120px]">{detail.creator}</span>
            )}
            <span className="shrink-0">{detail.trackCount.toLocaleString()} 首</span>
            {publishDate && (
              <span className="shrink-0">发布于 {formatDateZN(publishDate)}</span>
            )}
          </div>

          {detail.description && (
            <p
              className={`text-[11px] text-muted-foreground/70 leading-relaxed mt-1 cursor-pointer hover:text-muted-foreground/90 transition-colors ${
                isExpanded ? "" : "line-clamp-2"
              }`}
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? undefined : detail.description}
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
  type = "playlist",
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: NeteaseDetailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

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
            creator: res.creator?.nickname ? `by ${res.creator.nickname}` : undefined,
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
      } catch {
        if (active) {
          setState((s) => ({ ...s, loading: false, error: true }));
        }
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [id, type]);

  if (loading) return <DetailSkeleton onBack={onBack} />;

  if (error) {
    return (
      <PageLayout title="错误" onBack={onBack}>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
          <p>加载失败</p>
          <Button variant="link" onClick={onBack}>
            返回
          </Button>
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
      }
    >
      <div
        ref={scrollRef}
        className="flex flex-col flex-1 min-h-0 h-full overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
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
