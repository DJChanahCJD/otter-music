"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import { MusicTrackList } from "./MusicTrackList";
import { MusicTrack } from "@/types/music";
import { Button } from "./ui/button";
import { useBackButton } from "@/hooks/use-back-button";

interface QueuePageProps {
  queue: MusicTrack[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlay: (track: MusicTrack | null, index?: number) => void;
  onRemove: (track: MusicTrack) => void;
  onClear: () => void;
  onBack: () => void;
}

export function QueuePage({
  queue,
  currentTrackId,
  isPlaying,
  onPlay,
  onRemove,
  onClear,
  onBack,
}: QueuePageProps) {
  useBackButton(onBack);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pb-3 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
            aria-label="返回"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-foreground truncate">播放列表</h1>
            <p className="text-sm text-muted-foreground/80 mt-0.5">{queue.length} 首歌曲</p>
          </div>
          {queue.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                if (confirm("确定清空播放列表吗？")) {
                  onClear();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-1.5">清空</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-background/30">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Trash2 className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground font-medium">播放列表为空</p>
            <p className="text-sm text-muted-foreground/60 mt-2">去发现页面添加歌曲吧</p>
          </div>
        ) : (
          <MusicTrackList
            tracks={queue}
            onPlay={(track) => onPlay(track, queue.findIndex((t) => t.id === track.id))}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            onRemove={onRemove}
          />
        )}
      </div>
    </div>
  );
}
