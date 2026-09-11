import { useRef, useState, useMemo } from "react";
import { filterTracks } from "@/lib/utils/filter-tracks";
import { MusicTrackList } from "@/components/MusicTrackList";
import {
  GenericDetailPage,
  type GenericDetailData,
} from "@/components/GenericDetailPage";
import { Button } from "@/components/ui/button";
import { Podcast, SquareArrowOutUpRight } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateZN } from "@/lib/utils/format-date";
import { parsePodcastRss } from "@/lib/api/podcast";
import { writeClipboardText } from "@/lib/clipboard";
import { usePodcastStore } from "@/store/podcast-store";
import { forceHttps } from "@otter-music/shared";
import { MusicTrack } from "@/types/music";
import type { PodcastFeed } from "@/types/podcast";
import { useDetailPage } from "@/hooks/useDetailPage";

interface PodcastDetailPageProps {
  id: string | null;
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

interface PodcastDetailData {
  name: string;
  coverImgUrl: string;
  description?: string;
  creator?: string;
  trackCount: number;
  rssUrl: string;
}

/**
 * 将 RSS 单集转换为播放列表曲目
 * @param feed 解析后的 RSS feed
 * @param coverUrl 已归一化的封面地址
 */
function toTracks(feed: PodcastFeed, coverUrl: string): MusicTrack[] {
  return feed.episodes.map((ep) => ({
    id: ep.audioUrl || ep.id,
    name: ep.title,
    artist: [feed.name],
    album: ep.pubDate ? formatDateZN(ep.pubDate) : "",
    pic_id: coverUrl,
    url_id: forceHttps(ep.audioUrl) || "",
    lyric_id: "_podcast",
    source: "podcast" as const,
  }));
}

export function PodcastDetailPage({
  id,
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: PodcastDetailPageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { loading, error, detail, tracks, retry } =
    useDetailPage<PodcastDetailData>(
      async (signal) => {
        if (!id) throw new Error("No id");

        const sources = usePodcastStore.getState().rssSources;
        const source = sources.find(
          (item) => item.id === id && !item.is_deleted
        );
        if (!source) throw new Error("Podcast not found");

        // 一次性完整解析全部单集，渲染层交给虚拟列表
        const feed = await parsePodcastRss(source.rssUrl, signal);
        const coverUrl = forceHttps(feed.coverUrl || source.coverUrl || "");

        return {
          detail: {
            name: feed.name,
            coverImgUrl: coverUrl,
            description: feed.description || source.description,
            trackCount: feed.episodes.length,
            creator: source.author,
            rssUrl: source.rssUrl,
          },
          tracks: toTracks(feed, coverUrl),
        };
      },
      [id]
    );

  const handleShare = async () => {
    if (!detail) return;
    const { name, rssUrl } = detail;

    const ok = await writeClipboardText(`Podcast: ${name}\n${rssUrl}`);
    if (ok) {
      toast.success("链接已复制");
    } else {
      toast.error("复制失败");
    }
  };

  // 全部单集直接交给虚拟列表，不做渲染层分页
  const filteredTracks = useMemo(
    () => filterTracks(tracks, searchQuery),
    [tracks, searchQuery]
  );

  const genericDetail: GenericDetailData | undefined = detail
    ? {
        title: detail.name,
        coverUrl: detail.coverImgUrl,
        description: detail.description,
        creator: detail.creator,
        countDesc: `共 ${detail.trackCount} 集`,
        fallbackIcon: <Podcast className="h-8 w-8 text-muted-foreground/50" />,
      }
    : undefined;

  return (
    <GenericDetailPage
      loading={loading}
      error={error}
      title="Podcast"
      onBack={onBack}
      onRetry={retry}
      detail={genericDetail}
      scrollRef={scrollRef}
      tracks={tracks}
      onPlayTrack={(track) => onPlay(track, tracks)}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      action={
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleShare}
        >
          <SquareArrowOutUpRight className="w-4 h-4 mr-2" />
        </Button>
      }
    >
      <MusicTrackList
        tracks={filteredTracks}
        scrollContainerRef={scrollRef}
        onPlay={(track) => onPlay(track, tracks)}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        emptyMessage="No episodes"
      />
    </GenericDetailPage>
  );
}
