import { useMemo, useRef, useState } from "react";
import { ListMusic } from "lucide-react";
import { filterTracks } from "@/lib/utils/filter-tracks";
import { MusicTrackList } from "@/components/MusicTrackList";
import {
  GenericDetailPage,
  type GenericDetailData,
} from "@/components/GenericDetailPage";
import { getQqAlbum } from "@/lib/qqmusic/qqmusic-api";
import { useDetailPage } from "@/hooks/useDetailPage";
import type { QqAlbumDetail as QqAlbumData } from "@otter-music/shared";
import type { MusicTrack } from "@/types/music";

interface QqAlbumDetailProps {
  albumMid: string | null;
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

/**
 * QQ 音乐专辑详情页。
 * 既是 QQ 歌曲的专辑跳转目标，也是网易云专辑取不到内容时的回退页，
 * 因此保持只读（不提供导入/收藏）。
 */
export function QqAlbumDetail({
  albumMid,
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: QqAlbumDetailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { loading, error, detail, tracks, retry } =
    useDetailPage<QqAlbumData>(async () => {
      if (!albumMid) throw new Error("缺少专辑 ID");
      const album = await getQqAlbum(albumMid);
      return { detail: album, tracks: album.tracks };
    }, [albumMid]);

  const filteredTracks = useMemo(
    () => filterTracks(tracks, searchQuery),
    [tracks, searchQuery]
  );

  const publishTime = detail?.publishDate
    ? Date.parse(detail.publishDate) || undefined
    : undefined;

  const genericDetail: GenericDetailData | undefined = detail
    ? {
        title: detail.name,
        coverUrl: detail.coverUrl,
        description: detail.description,
        creator: detail.creator,
        countDesc: `${detail.trackCount} 首`,
        publishTime,
        fallbackIcon: <ListMusic className="h-8 w-8 text-primary/80" />,
      }
    : undefined;

  return (
    <GenericDetailPage
      loading={loading}
      error={error}
      title="QQ 音乐专辑"
      onBack={onBack}
      onRetry={retry}
      detail={genericDetail}
      scrollRef={scrollRef}
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
          emptyMessage="该专辑暂无可用曲目"
        />
      </div>
    </GenericDetailPage>
  );
}
