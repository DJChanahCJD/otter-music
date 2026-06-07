import { useEffect, useRef, useState, useCallback } from "react";
import { MusicTrackList } from "@/components/MusicTrackList";
import {
  GenericDetailPage,
  type GenericDetailData,
} from "@/components/GenericDetailPage";
import { ListMusic } from "lucide-react";
import {
  getBilibiliCollectionDetail,
  getBilibiliMultiPDetail,
  getBilibiliCoverUrl,
} from "@/lib/bilibili/bilibili-api";
import {
  parseBilibiliAlbumId,
  parseBilibiliMultiPAlbumId,
} from "@otter-music/shared";
import { MusicTrack } from "@/types/music";
import { getUpNameCache } from "@/lib/bilibili/up-name-cache";

interface BilibiliCollectionDetailProps {
  id: string | null;
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

interface CollectionDetailData {
  title: string;
  coverUrl: string;
  trackCount: number;
  upName: string;
}

export function BilibiliCollectionDetail({
  id,
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: BilibiliCollectionDetailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);
  const pageRef = useRef(1);
  const totalRef = useRef(0);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState<CollectionDetailData | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const albumId = id || "";
  const isSeries = albumId ? !!parseBilibiliAlbumId(albumId) : false;
  const isMultiP = albumId ? !!parseBilibiliMultiPAlbumId(albumId) : false;

  useEffect(() => {
    if (!isSeries && !isMultiP) {
      setLoading(false);
      setError(true);
      setDetail(null);
      setTracks([]);
      return;
    }

    pageRef.current = 1;
    totalRef.current = 0;
    cancelledRef.current = false;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(false);

        if (isSeries) {
          const res = await getBilibiliCollectionDetail(albumId, 1);
          if (cancelledRef.current) return;
          if (!res || !res.meta) throw new Error("获取合集失败");
          const coverUrl = await getBilibiliCoverUrl(res.meta.cover || "");
          const cachedUpName = getUpNameCache(
            Number(parseBilibiliAlbumId(albumId)?.mid)
          );
          setDetail({
            title: res.meta.name || "合集",
            coverUrl: coverUrl || "",
            trackCount: res.total,
            upName: cachedUpName || res.meta.creator?.name || "",
          });
          setTracks(res.tracks);
          totalRef.current = res.total;
          pageRef.current = 1;
          setLoading(false);
        } else {
          const res = await getBilibiliMultiPDetail(albumId);
          if (cancelledRef.current) return;
          if (!res || !res.meta) throw new Error("获取分P失败");
          const coverUrl = await getBilibiliCoverUrl(res.meta.cover || "");
          setDetail({
            title: res.meta.name || "系列",
            coverUrl: coverUrl || "",
            trackCount: res.total,
            upName: res.tracks[0]?.artist?.[0] || "",
          });
          setTracks(res.tracks);
          setLoading(false);
        }
      } catch {
        if (!cancelledRef.current) {
          setLoading(false);
          setError(true);
          setDetail(null);
          setTracks([]);
        }
      }
    };

    fetchDetail();

    return () => {
      cancelledRef.current = true;
    };
  }, [albumId, isSeries, isMultiP, retryCount]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const res = await getBilibiliCollectionDetail(albumId, nextPage);
      if (cancelledRef.current) return;
      if (res && res.tracks.length > 0) {
        setTracks((prev) => [...prev, ...res.tracks]);
        pageRef.current = nextPage;
      }
    } finally {
      setLoadingMore(false);
    }
  }, [albumId, loadingMore]);

  const handleTrackPlay = useCallback(
    (track: MusicTrack) => {
      onPlay(track, tracks);
    },
    [onPlay, tracks]
  );

  const activeTracks = tracks.filter((t) => !t.is_deleted);
  const hasMore = isSeries && tracks.length < totalRef.current;

  const genericDetail: GenericDetailData | undefined = detail
    ? {
        title: detail.title,
        coverUrl: detail.coverUrl,
        creator: detail.upName || undefined,
        countDesc: `${detail.trackCount} 个视频`,
        fallbackIcon: <ListMusic className="h-8 w-8 text-primary/80" />,
      }
    : undefined;

  return (
    <GenericDetailPage
      loading={loading}
      error={error}
      title="合集"
      onBack={onBack}
      onRetry={() => setRetryCount((c) => c + 1)}
      detail={genericDetail}
      scrollRef={scrollRef}
    >
      <MusicTrackList
        tracks={activeTracks}
        onPlay={handleTrackPlay}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        scrollContainerRef={scrollRef}
        onLoadMore={isSeries ? loadMore : undefined}
        hasMore={hasMore}
        loading={loadingMore}
      />
    </GenericDetailPage>
  );
}
