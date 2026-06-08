import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MusicTrackList } from "@/components/MusicTrackList";
import {
  GenericDetailPage,
  type GenericDetailData,
} from "@/components/GenericDetailPage";
import {
  getPlaylistDetail,
  getArtist,
  getAlbum,
  getArtistSongs,
  convertSongToMusicTrack,
  toggleSubAlbum,
  getAlbumDynamicDetail,
} from "@/lib/netease/netease-api";
import { MusicTrack } from "@/types/music";
import {
  MoreVertical,
  Import,
  SquareArrowOutUpRight,
  Album,
  Bookmark,
  ListMusic,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMusicStore } from "@/store/music-store";
import { useNeteaseStore } from "@/store/netease-store";
import { SongDetail } from "@/lib/netease/netease-raw-types";
import { ArtistAlbumSheet } from "@/components/ArtistAlbumSheet";
import {
  ArtistAlbumSheetNavigationState,
  createArtistAlbumSheetState,
  getArtistAlbumSheetBackTarget,
  shouldRestoreArtistAlbumSheet,
} from "@/lib/navigation/netease-detail-navigation";
import { useMarketSession } from "@/store/session/market-session";
import { logger } from "@/lib/logger";
import { useDetailPage } from "@/hooks/useDetailPage";

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
  albumCount?: number;
  publishTime?: number;
  sub?: boolean;
  playCount?: number;
  creatorId?: string | number;
}

export function NeteaseDetail({
  id,
  type = "playlist",
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: NeteaseDetailProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAlbumSheetOpen, setIsAlbumSheetOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { createPlaylist, setPlaylistTracks } = useMusicStore();
  const isShuffle = useMusicStore((state) => state.isShuffle);
  const { cookie } = useNeteaseStore();
  const { toggleAlbumInSession } = useMarketSession();
  const navigationState =
    (location.state as ArtistAlbumSheetNavigationState | null | undefined) ??
    null;

  const { loading, error, detail, tracks, setDetail, setTracks, retry } =
    useDetailPage<UnifiedDetail>(
      async (_signal) => {
        if (!id) throw new Error("No id");

        let rawDetail: UnifiedDetail;
        let rawTracks: SongDetail[] = [];

        if (type === "playlist") {
          const res = await getPlaylistDetail(id, cookie);
          if (!res) throw new Error("Not found");
          rawDetail = {
            name: res.name,
            coverImgUrl: res.coverImgUrl,
            description: res.description,
            creator: res.creator?.nickname,
            trackCount: res.trackCount,
            playCount: res.playCount,
            creatorId: res.creator?.userId,
          };
          rawTracks = res.tracks;
        } else if (type === "artist") {
          const res = await getArtist(id, cookie);
          if (!res) throw new Error("Not found");
          rawDetail = {
            name: res.artist.name,
            coverImgUrl: res.artist.picUrl,
            description: res.artist.briefDesc,
            trackCount: res.artist.musicSize,
            albumCount: res.artist.albumSize,
          };
          rawTracks = res.hotSongs;
        } else {
          const [res, dynamicRes] = await Promise.all([
            getAlbum(id, cookie),
            getAlbumDynamicDetail(id, cookie).catch(() => null),
          ]);
          if (!res?.album) throw new Error("Not found");
          rawDetail = {
            name: res.album.name,
            coverImgUrl: res.album.picUrl,
            description: res.album.description,
            creator: res.album.artist?.name,
            trackCount: res.songs.length,
            publishTime: res.album.publishTime,
            sub: dynamicRes?.isSub || false,
          };
          rawTracks = res.songs;
        }

        return {
          detail: rawDetail,
          tracks: rawTracks.map(convertSongToMusicTrack),
        };
      },
      [id, type, cookie]
    );

  useEffect(() => {
    if (type === "artist" && detail) {
      setOffset(tracks.length);
      setHasMore(detail.trackCount > tracks.length);
    }
  }, [type, detail, tracks]);

  useEffect(() => {
    if (!shouldRestoreArtistAlbumSheet(type, id, navigationState)) return;
    setIsAlbumSheetOpen(true);

    navigate(location.pathname, { replace: true, state: null });
  }, [id, location.pathname, navigate, navigationState, type]);

  const handleBack = () => {
    const backTarget = getArtistAlbumSheetBackTarget(type, navigationState);
    if (backTarget) {
      navigate(`/netease-artist/${backTarget.artistId}`, {
        replace: true,
        state: createArtistAlbumSheetState(
          backTarget.artistId,
          backTarget.artistName
        ),
      });
      return;
    }

    onBack();
  };

  const handleShare = async () => {
    if (!detail || !id) return;
    try {
      const typeLabel = { playlist: "歌单", artist: "歌手", album: "专辑" }[
        type
      ];
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

  const handleToggleAlbumSub = async () => {
    if (!id || !cookie || type !== "album" || !detail) return;
    const shouldSub = !detail.sub;

    if (!shouldSub && !confirm("确定不再收藏吗？")) return;

    try {
      let success = false;
      let msg = "";

      const res = await toggleSubAlbum(id, shouldSub, cookie);
      success = res.data?.code === 200;
      msg = res.data?.message || "";
      if (success) {
        toggleAlbumInSession(
          {
            id: Number(id),
            name: detail.name || "",
            picUrl: detail.coverImgUrl || "",
            artistName: detail.creator || "",
          },
          shouldSub
        );
      }

      if (success) {
        toast.success(shouldSub ? "收藏成功" : "已取消收藏");
        setDetail((prev) => (prev ? { ...prev, sub: shouldSub } : prev));
      } else {
        toast.error(msg || "操作失败");
      }
    } catch (err) {
      toast.error("操作失败");
      logger.error("NeteaseDetail", "Toggle album subscription failed", err, {
        id,
        type,
        shouldSub,
      });
    }
  };

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const lower = searchQuery.toLowerCase();
    return tracks.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.artist?.some((a) => a?.toLowerCase().includes(lower)) ||
        t.album?.toLowerCase().includes(lower)
    );
  }, [tracks, searchQuery]);

  const handleLoadMore = async () => {
    if (!id || loadingMore || !hasMore || type !== "artist") return;
    setLoadingMore(true);
    try {
      const res = await getArtistSongs(id, 50, offset);
      if (res?.songs?.length) {
        const newTracks = res.songs.map(convertSongToMusicTrack);
        setTracks((prev) => [...prev, ...newTracks]);

        const nextOffset = offset + newTracks.length;
        setOffset(nextOffset);
        setHasMore(
          detail?.trackCount
            ? nextOffset < detail.trackCount && (res.more ?? true)
            : (res.more ?? true)
        );
      } else {
        setHasMore(false);
      }
    } catch (err) {
      toast.error("加载更多失败");
      logger.error("NeteaseDetail", "Load more artist songs failed", err, {
        id,
        type,
        offset,
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const genericDetail: GenericDetailData | undefined = detail
    ? {
        title: detail.name,
        coverUrl: detail.coverImgUrl,
        description: detail.description,
        creator: detail.creator,
        countDesc: `${detail.trackCount} 首`,
        publishTime: detail.publishTime,
        fallbackIcon: <ListMusic className="h-8 w-8 text-primary/80" />,
      }
    : undefined;

  const action = (
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
      {cookie && type === "album" && (
        <Button
          variant="ghost"
          size="icon"
          className={
            detail?.sub
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }
          onClick={handleToggleAlbumSub}
        >
          <Bookmark
            className={`w-5 h-5 ${detail?.sub ? "fill-current" : ""}`}
          />
        </Button>
      )}
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
    </div>
  );

  return (
    <GenericDetailPage
      loading={loading}
      error={error}
      title="详情"
      onBack={handleBack}
      onRetry={retry}
      detail={genericDetail}
      scrollRef={scrollRef}
      action={action}
      isShuffle={isShuffle}
      tracks={tracks}
      onPlayTrack={
        tracks.length > 0 ? (track) => onPlay(track, tracks) : undefined
      }
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="flex-1 min-h-0">
        <MusicTrackList
          tracks={filteredTracks}
          scrollContainerRef={scrollRef}
          onPlay={(track) => onPlay(track, tracks)}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          emptyMessage="列表为空"
          onLoadMore={type === "artist" ? handleLoadMore : undefined}
          hasMore={hasMore}
          loading={loading || loadingMore}
        />
      </div>
      <ArtistAlbumSheet
        artistId={id}
        isOpen={isAlbumSheetOpen}
        onOpenChange={setIsAlbumSheetOpen}
        artistName={detail?.name}
        albumCount={detail?.albumCount}
      />
    </GenericDetailPage>
  );
}
