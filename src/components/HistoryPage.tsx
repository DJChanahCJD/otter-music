"use client";

import { Trash2 } from "lucide-react";
import { MusicPlaylistView } from "./MusicPlaylistView";
import { MusicTrack } from "@/types/music";
import { Button } from "./ui/button";
import { PageLayout } from "./PageLayout";

interface HistoryPageProps {
  history: MusicTrack[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlay: (track: MusicTrack | null, index?: number) => void;
  onRemove: (track: MusicTrack) => void;
  onClear: () => void;
  onBack?: () => void;
}

export function HistoryPage({
  history,
  currentTrackId,
  isPlaying,
  onPlay,
  onRemove,
  onClear,
  onBack,
}: HistoryPageProps) {
  const clearAction = history.length > 0 && (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
      onClick={() => {
        if (confirm("确定清空播放历史吗？")) {
          onClear();
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  return (
    <PageLayout title="播放历史" onBack={onBack} action={clearAction}>
      <MusicPlaylistView
        title="播放历史"
        tracks={history}
        onPlay={onPlay}
        onRemove={onRemove}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
      />
    </PageLayout>
  );
}
