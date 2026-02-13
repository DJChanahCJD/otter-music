"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface PlayerControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  onPlayToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  size?: "sm" | "md" | "lg";
  showPrevNext?: boolean;
}

export function PlayerControls({
  isPlaying,
  isLoading,
  onPlayToggle,
  onPrev,
  onNext,
  size = "md",
  showPrevNext = true,
}: PlayerControlsProps) {
  const sizeClasses = {
    sm: {
      play: "h-8 w-8",
      nav: "h-6 w-6",
      iconPlay: "h-4 w-4",
      iconNav: "h-4 w-4",
    },
    md: {
      play: "h-10 w-10",
      nav: "h-8 w-8",
      iconPlay: "h-5 w-5",
      iconNav: "h-5 w-5",
    },
    lg: {
      play: "h-12 w-12",
      nav: "h-10 w-10",
      iconPlay: "h-6 w-6",
      iconNav: "h-5 w-5",
    },
  };

  const classes = sizeClasses[size];

  return (
    <div className="flex items-center gap-3">
      {showPrevNext && (
        <Button
          variant="ghost"
          size="icon"
          className={`${classes.nav} text-muted-foreground hover:bg-muted/40 hover:text-foreground`}
          onClick={onPrev}
          title="上一首"
        >
          <SkipBack className={`${classes.iconNav} fill-current`} />
        </Button>
      )}

      <Button
        size="icon"
        className={`${classes.play} rounded-full bg-primary text-primary-foreground hover:bg-primary/90`}
        onClick={onPlayToggle}
        disabled={isLoading}
        title={isPlaying ? "暂停" : "播放"}
      >
        {isLoading ? (
          <Spinner className={classes.iconPlay} />
        ) : isPlaying ? (
          <Pause className={`${classes.iconPlay} fill-current`} />
        ) : (
          <Play className={`${classes.iconPlay} fill-current`} />
        )}
      </Button>

      {showPrevNext && (
        <Button
          variant="ghost"
          size="icon"
          className={`${classes.nav} text-muted-foreground hover:bg-muted/40 hover:text-foreground`}
          onClick={onNext}
          title="下一首"
        >
          <SkipForward className={`${classes.iconNav} fill-current`} />
        </Button>
      )}
    </div>
  );
}
