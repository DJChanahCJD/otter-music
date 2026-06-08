import { useRef, useState, useCallback, useMemo } from "react";
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
import { useDetailPage } from "@/hooks/useDetailPage";

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
  const pageRef = useRef(1);
  const totalRef = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const albumId = id || "";
  const isSeries = albumId ? !!parseBilibiliAlbumId(albumId) : false;
  const isMultiP = albumId ? !!parseBilibiliMultiPAlbumId(albumId) : false;

  const { loading, error, detail, tracks, setTracks, retry } =
    useDetailPage<CollectionDetailData>(async () => {
      if (!isSeries && !isMultiP) throw new Error("Invalid");

      pageRef.current = 1;
      totalRef.current = 0;

      if (isSeries) {
        const res = await getBilibiliCollectionDetail(albumId, 1);
        if (!res || !res.meta) throw new Error("获取合集失败");
        const coverUrl = await getBilibiliCoverUrl(res.meta.cover || "");
        const cachedUpName = getUpNameCache(
          Number(parseBilibiliAlbumId(albumId)?.mid)
        );
        totalRef.current = res.total;
        return {
          detail: {
            title: res.meta.name || "合集",
            coverUrl: coverUrl || "",
            trackCount: res.total,
            upName: cachedUpName || res.meta.creator?.name || "",
          },
          tracks: res.tracks,
        };
      } else {
        const res = await getBilibiliMultiPDetail(albumId);
        if (!res || !res.meta) throw new Error("获取分P失败");
        const coverUrl = await getBilibiliCoverUrl(res.meta.cover || "");
        return {
          detail: {
            title: res.meta.name || "系列",
            coverUrl: coverUrl || "",
            trackCount: res.total,
            upName: res.tracks[0]?.artist?.[0] || "",
          },
          tracks: res.tracks,
        };
      }
    }, [albumId, isSeries, isMultiP]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const res = await getBilibiliCollectionDetail(albumId, nextPage);
      if (res && res.tracks.length > 0) {
        setTracks((prev) => [...prev, ...res.tracks]);
        pageRef.current = nextPage;
      }
    } finally {
      setLoadingMore(false);
    }
  }, [albumId, loadingMore, setTracks]);

  const activeTracks = tracks.filter((t) => !t.is_deleted);
  const hasMore = isSeries && tracks.length < totalRef.current;

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return activeTracks;
    const lower = searchQuery.toLowerCase();
    return activeTracks.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.artist?.some((a) => a?.toLowerCase().includes(lower))
    );
  }, [activeTracks, searchQuery]);

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
      onRetry={retry}
      detail={genericDetail}
      scrollRef={scrollRef}
      tracks={activeTracks}
      onPlayTrack={(track) => onPlay(track, activeTracks)}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <MusicTrackList
        tracks={filteredTracks}
        onPlay={(track) => onPlay(track, activeTracks)}
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
