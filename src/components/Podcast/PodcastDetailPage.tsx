import { useEffect, useRef, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { MusicTrackList } from "@/components/MusicTrackList";
import { MusicCover } from "@/components/MusicCover";
import { Button } from "@/components/ui/button";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";
import { Podcast, SquareArrowOutUpRight } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateZN } from "@/lib/utils";
import { parsePodcastRss } from "@/lib/api/podcast";
import { usePodcastStore } from "@/store/podcast-store";
import { MusicTrack } from "@/types/music";

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

function PodcastDetailHeader({ detail }: { detail: PodcastDetailData }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full shrink-0">
      <div className="p-5 flex gap-4 items-center">
        <MusicCover
          src={detail.coverImgUrl}
          alt={detail.name}
          className="shrink-0 w-24 h-24 rounded-xl object-cover shadow-md ring-1 ring-white/10"
          fallbackIcon={<Podcast className="h-8 w-8 text-muted-foreground/50" />}
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
            <span className="shrink-0">{detail.trackCount.toLocaleString()} 集</span>
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

export function PodcastDetailPage({
  id,
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: PodcastDetailPageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [{ loading, error, detail, tracks }, setState] = useState<{
    loading: boolean;
    error: boolean;
    detail: PodcastDetailData | null;
    tracks: MusicTrack[];
  }>({
    loading: true,
    error: false,
    detail: null,
    tracks: [],
  });

  const handleShare = async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(
        `【播客】${detail.name} \n${detail.rssUrl}`
      );
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  useEffect(() => {
    if (!id) {
      setState({ loading: false, error: true, detail: null, tracks: [] });
      return;
    }

    let active = true;
    setState({ loading: true, error: false, detail: null, tracks: [] });

    const loadData = async () => {
      try {
        const sources = usePodcastStore.getState().rssSources;
        const source = sources.find((item) => item.id === id && !item.is_deleted);
        if (!source) throw new Error("Podcast not found");

        const feed = await parsePodcastRss(source.rssUrl);
        const podcastTracks = feed.episodes.map((ep) => ({
          id: ep.id,
          name: ep.title,
          artist: [feed.name],
          album: ep.pubDate ? formatDateZN(ep.pubDate) : "",
          pic_id: feed.coverUrl || source.coverUrl || "",
          url_id: ep.audioUrl || "",
          lyric_id: "",
          source: "podcast" as const,
        }));

        if (!active) return;

        setState({
          loading: false,
          error: false,
          detail: {
            name: feed.name,
            coverImgUrl: feed.coverUrl || source.coverUrl || "",
            description: feed.description || source.description,
            trackCount: feed.episodes.length,
            creator: source.author,
            rssUrl: source.rssUrl,
          },
          tracks: podcastTracks,
        });
      } catch {
        if (active) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [id]);

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
      title={detail?.name || "播客详情"}
      onBack={onBack}
      action={
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={handleShare}>
           <SquareArrowOutUpRight className="w-4 h-4 mr-2" />
        </Button>
      }
    >
      <div
        ref={scrollRef}
        className="flex flex-col flex-1 min-h-0 h-full overflow-y-auto"
      >
        {detail && <PodcastDetailHeader detail={detail} />}
        <div className="flex-1 min-h-0">
          <MusicTrackList
            tracks={tracks}
            onPlay={(track) => onPlay(track, tracks)}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            emptyMessage="列表为空"
            showSourceBadge={false}
          />
        </div>
      </div>
    </PageLayout>
  );
}
