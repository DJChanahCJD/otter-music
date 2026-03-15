import { useEffect, useState, useRef } from "react";
import { PageLayout } from "@/components/PageLayout";
import { MusicTrackList } from "@/components/MusicTrackList";
import { 
  getPlaylistDetail, getArtist, getAlbum, getArtistSongs, 
  convertSongToMusicTrack, toggleSubAlbum, getAlbumDynamicDetail 
} from "@/lib/netease/netease-api";
import { MusicTrack } from "@/types/music";
import { MoreVertical, Import, SquareArrowOutUpRight, Album, Heart, HeartCrack } from "lucide-react";
import toast from "react-hot-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMusicStore } from "@/store/music-store";
import { useNeteaseStore } from "@/store/netease-store";
import { PageError } from "@/components/PageError";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";
import { CommonDetailHeader } from "@/components/CommonDetailHeader";
import { SongDetail } from "@/lib/netease/netease-raw-types";
import { ArtistAlbumSheet } from "@/components/ArtistAlbumSheet";
import { useMarketSession } from "@/store/session/market-session";

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
  sub?: boolean; 
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
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [{ loading, error, detail, tracks }, setState] = useState<{
    loading: boolean;
    error: boolean;
    detail: UnifiedDetail | null;
    tracks: MusicTrack[];
  }>({ loading: true, error: false, detail: null, tracks: [] });

  const { createPlaylist, setPlaylistTracks } = useMusicStore();
  const { cookie } = useNeteaseStore();
  const { toggleAlbumInSession } = useMarketSession();

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

  // 当前仅处理专辑的收藏逻辑
  const handleToggleSub = async () => {
    if (!id || !cookie || type !== "album") return;
    const isSub = !detail?.sub;
    try {
      const res = await toggleSubAlbum(id, isSub, cookie);
      if (res.data?.code === 200 || res.data?.code === 250) {
        toast.success(isSub ? "收藏成功" : "已取消收藏");
        setState((prev) => ({
          ...prev,
          detail: prev.detail ? { ...prev.detail, sub: isSub } : prev.detail,
        }));
        toggleAlbumInSession({
          id: Number(id),
          name: detail?.name || "",
          picUrl: detail?.coverImgUrl || "",
          artistName: detail?.creator || "",
        }, isSub);
      } else {
        toast.error(res.data?.message || "操作失败");
      }
    } catch (err) {
      toast.error("操作失败");
      console.error(err);
    }
  };

  const handleLoadMore = async () => {
    if (!id || loadingMore || !hasMore || type !== 'artist') return;
    setLoadingMore(true);
    try {
      const res = await getArtistSongs(id, 50, offset);
      if (res?.songs?.length) {
        const newTracks = res.songs.map(convertSongToMusicTrack);
        setState(prev => ({ ...prev, tracks: [...prev.tracks, ...newTracks] }));
        
        const nextOffset = offset + newTracks.length;
        setOffset(nextOffset);
        setHasMore(detail?.trackCount ? nextOffset < detail.trackCount && (res.more ?? true) : res.more ?? true);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      toast.error("加载更多失败");
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    let active = true;
    
    setState({ loading: true, error: false, detail: null, tracks: [] });
    setOffset(0);
    setHasMore(false);

    const loadData = async () => {
      try {
        let rawDetail: UnifiedDetail;
        let rawTracks: SongDetail[] = [];

        if (type === "playlist") {
          const res = await getPlaylistDetail(id, cookie);
          if (!res) throw new Error("Not found");
          rawDetail = {
            name: res.name, coverImgUrl: res.coverImgUrl, description: res.description,
            creator: res.creator?.nickname, trackCount: res.trackCount, sub: res.subscribed,
          };
          rawTracks = res.tracks;
        } else if (type === "artist") {
          const res = await getArtist(id, cookie);
          if (!res) throw new Error("Not found");
          rawDetail = {
            name: res.artist.name, coverImgUrl: res.artist.picUrl, description: res.artist.briefDesc,
            trackCount: res.artist.musicSize,
          };
          rawTracks = res.hotSongs;
          if (active) {
            setOffset(rawTracks.length);
            setHasMore(res.artist.musicSize > rawTracks.length);
          }
        } else {
          const [res, dynamicRes] = await Promise.all([
            getAlbum(id, cookie),
            getAlbumDynamicDetail(id, cookie).catch(() => null),
          ]);
          if (!res?.album) throw new Error("Not found");
          rawDetail = {
            name: res.album.name, coverImgUrl: res.album.picUrl, description: res.album.description,
            creator: res.album.artist?.name, trackCount: res.songs.length, publishTime: res.album.publishTime,
            sub: dynamicRes?.isSub || false,
          };
          rawTracks = res.songs;
        }

        if (!active) return;
        setState({
          loading: false, error: false, detail: rawDetail,
          tracks: rawTracks.map(convertSongToMusicTrack),
        });
      } catch (err) {
        console.error(err);
        if (active) setState((s) => ({ ...s, loading: false, error: true }));
      }
    };

    loadData();
    return () => { active = false; };
  }, [id, type, retryCount, cookie]);

  if (loading) return <DetailSkeleton onBack={onBack} />;

  if (error) {
    return (
      <PageLayout title="错误" onBack={onBack}>
        <PageError onBack={onBack} onRetry={() => setRetryCount((c) => c + 1)} />
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
              variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground"
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
              {/* 仅在类型为专辑时展示收藏/取消收藏按钮 */}
              {cookie && type === "album" && (
                <DropdownMenuItem onClick={handleToggleSub}>
                  {detail?.sub ? (
                    <><HeartCrack className="w-4 h-4 mr-2" />取消收藏</>
                  ) : (
                    <><Heart className="w-4 h-4 mr-2" />收藏专辑</>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleShare}>
                <SquareArrowOutUpRight className="w-4 h-4 mr-2" />分享
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImportPlaylist}>
                <Import className="w-4 h-4 mr-2" />导入歌单
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
            title={detail.name} coverUrl={detail.coverImgUrl} description={detail.description}
            creator={detail.creator} countDesc={`${detail.trackCount} 首`} publishTime={detail.publishTime}
          />
        )}
        <div className="flex-1 min-h-0">
          <MusicTrackList
            tracks={tracks} onPlay={(track) => onPlay(track, tracks)} currentTrackId={currentTrackId}
            isPlaying={isPlaying} emptyMessage="列表为空"
            onLoadMore={type === 'artist' ? handleLoadMore : undefined}
            hasMore={hasMore} loading={loading || loadingMore}
          />
        </div>
      </div>
      
      <ArtistAlbumSheet 
        artistId={id} isOpen={isAlbumSheetOpen} onOpenChange={setIsAlbumSheetOpen} artistName={detail?.name}
      />
    </PageLayout>
  );
}