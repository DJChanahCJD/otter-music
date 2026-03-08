"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { parsePodcastRss } from "@/lib/api";
import { usePodcastStore } from "@/store/podcast-store";
import { useMusicStore } from "@/store/music-store";
import { usePlayHelper } from "@/hooks/usePlayHelper";
import type { PodcastFeed, PodcastEpisode } from "@/types/podcast";
import type { MusicTrack } from "@/types/music";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Pause, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const convertEpisodeToTrack = (episode: PodcastEpisode, feed: PodcastFeed): MusicTrack => ({
  id: episode.id,
  name: episode.title,
  artist: [feed.name],
  album: feed.name,
  pic_id: episode.coverUrl || feed.coverUrl || "",
  url_id: episode.audioUrl || "",
  lyric_id: "",
  source: "podcast",
});

export function PodcastDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [feed, setFeed] = useState<PodcastFeed | null>(null);

  const { handlePlay } = usePlayHelper();
  const currentTrackId = useMusicStore((state) => state.queue[state.currentIndex]?.id);
  const isPlaying = useMusicStore((state) => state.isPlaying);

  const source = usePodcastStore((state) =>
    state.rssSources.find((item) => item.id === id && !item.is_deleted)
  );

  const pageTitle = useMemo(() => source?.name || "播客详情", [source?.name]);

  const tracks = useMemo(() => {
    if (!feed) return [];
    return feed.episodes
      .filter((ep) => ep.audioUrl)
      .map((ep) => convertEpisodeToTrack(ep, feed));
  }, [feed]);

  useEffect(() => {
    if (!source?.rssUrl) {
      setIsError(true);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setIsError(false);

    const loadFeed = async () => {
      try {
        const res = await parsePodcastRss(source.rssUrl);
        if (!active) return;
        setFeed(res);
      } catch {
        if (!active) return;
        setIsError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadFeed();
    return () => {
      active = false;
    };
  }, [source?.rssUrl]);

  if (isLoading) {
    return (
      <PageLayout title={pageTitle} onBack={() => navigate(-1)}>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm">正在获取节目单...</span>
        </div>
      </PageLayout>
    );
  }

  if (isError || !feed) {
    return (
      <PageLayout title={pageTitle} onBack={() => navigate(-1)}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <div className="p-4 bg-muted/50 rounded-full">
            <Clock className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-sm">播客详情加载失败，请检查网络或源地址</p>
          <Button variant="default" size="sm" onClick={() => navigate(-1)}>
            返回上一页
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={feed.name || pageTitle} onBack={() => navigate(-1)}>
      <div className="flex-1 p-4 pb-28 overflow-y-auto space-y-6">
        {/* 播客主信息卡片 */}
        <section className="flex flex-col sm:flex-row gap-5">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl shadow-md bg-muted overflow-hidden shrink-0 border">
            {feed.coverUrl && (
              <img src={feed.coverUrl} alt={feed.name} className="w-full h-full object-cover transition-transform hover:scale-105" />
            )}
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <h2 className="text-xl font-bold line-clamp-2 tracking-tight">{feed.name}</h2>
            <p className="text-sm text-primary font-medium mt-1.5 bg-primary/10 w-fit px-2 py-0.5 rounded-md">
              共 {feed.episodes.length} 期节目
            </p>
            {feed.description && (
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-3">
                {feed.description}
              </p>
            )}
          </div>
        </section>

        {/* 节目列表 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b">
            <h3 className="text-base font-semibold">所有节目</h3>
          </div>

          {feed.episodes.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              暂无节目更新
            </div>
          )}

          <div className="space-y-2">
            {feed.episodes.slice(0, 30).map((episode) => {
              const isCurrent = currentTrackId === episode.id;
              const isPlayingCurrent = isCurrent && isPlaying;

              return (
                <div
                  key={episode.id}
                  className={cn(
                    "group flex gap-4 p-3 rounded-xl border bg-card cursor-pointer transition-all duration-200 hover:shadow-sm hover:border-primary/30",
                    isCurrent && "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                  )}
                  onClick={() => {
                    const track = tracks.find((t) => t.id === episode.id);
                    if (track) handlePlay(track, tracks, `podcast-${source?.id}`);
                  }}
                >
                  <div
                    className={cn(
                      "mt-1 w-8 h-8 flex items-center justify-center rounded-full shrink-0 transition-colors",
                      isCurrent
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    )}
                  >
                    {isPlayingCurrent ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-1" />
                    )}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-semibold line-clamp-2 leading-snug",
                        isCurrent ? "text-primary" : "text-foreground"
                      )}
                    >
                      {episode.title}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {episode.pubDate || "未知时间"}
                      </span>
                      {!episode.audioUrl && (
                        <span className="text-destructive font-medium px-1.5 py-0.5 bg-destructive/10 rounded">
                          暂无音频
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}