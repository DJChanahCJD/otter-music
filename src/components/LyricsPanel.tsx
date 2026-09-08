"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { MusicTrack } from "@/types/music";
import { Play } from "lucide-react";
import { useMusicStore, type LyricAlign } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";

interface LyricsPanelProps {
  track: MusicTrack | null;
  active?: boolean;
}

interface LyricLine {
  time: number;
  text: string;
  ttext?: string;
}

const TIME_EXP = /\[(\d{2}):(\d{2})\.(\d{2,3})]/g;
const MATCH_TOLERANCE = 0.5;
const AUTO_SCROLL_DELAY = 2000;
const PADDING_LINES = 2;

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function parseSimpleLrc(lrc: string): { time: number; text: string }[] {
  const lines: { time: number; text: string }[] = [];

  for (const line of lrc.split("\n")) {
    const timeMatches = [...line.matchAll(TIME_EXP)];

    if (timeMatches.length > 0) {
      const text = line.replace(TIME_EXP, "").trim();

      if (text) {
        for (const m of timeMatches) {
          const time =
            Number(m[1]) * 60 +
            Number(m[2]) +
            Number(m[3].padEnd(3, "0")) / 1000;

          lines.push({ time, text });
        }
      }
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

function parseLrc(lrc: string, tLrc?: string): LyricLine[] {
  const lLines = parseSimpleLrc(lrc);

  if (!tLrc) {
    return lLines;
  }

  const tLines = parseSimpleLrc(tLrc);
  const result: LyricLine[] = [];
  let tIdx = 0;

  for (const line of lLines) {
    let ttext: string | undefined;

    while (
      tIdx < tLines.length &&
      tLines[tIdx].time < line.time - MATCH_TOLERANCE
    ) {
      tIdx++;
    }

    let bestMatchIdx = -1;
    let minDiff = MATCH_TOLERANCE;

    for (let i = tIdx; i < tLines.length; i++) {
      const diff = Math.abs(tLines[i].time - line.time);

      if (tLines[i].time > line.time + MATCH_TOLERANCE) {
        break;
      }

      if (diff <= MATCH_TOLERANCE && diff < minDiff) {
        minDiff = diff;
        bestMatchIdx = i;
      }
    }

    if (bestMatchIdx !== -1) {
      ttext = tLines[bestMatchIdx].text;
    }

    result.push({ ...line, ttext });
  }

  return result;
}

const LyricLineView = memo(function LyricLineView({
  line,
  isActive,
  align,
  fontSize,
}: {
  line: LyricLine;
  isActive: boolean;
  align: LyricAlign;
  fontSize: number;
}) {
  const translationSize = Math.max(12, Math.round(fontSize * (15 / 18)));

  return (
    <div
      className={cn(
        "w-full max-w-3xl px-6 sm:px-8",
        "select-none",
        "transition-all duration-300 ease-out",
        "origin-center",
        align === "center" && "text-center",
        align === "left" && "text-left",
        align === "right" && "text-right",
        isActive
          ? "text-white opacity-100"
          : "text-white/40 opacity-100 hover:text-white/60"
      )}
    >
      <p
        className="font-medium leading-relaxed tracking-wide break-words"
        style={{
          fontSize: `${fontSize}px`,
        }}
      >
        {line.text}
      </p>

      {line.ttext && (
        <p
          className={cn(
            "mt-1 font-medium leading-relaxed break-words",
            "transition-colors duration-300",
            isActive ? "text-white/70" : "text-white/25"
          )}
          style={{
            fontSize: `${translationSize}px`,
          }}
        >
          {line.ttext}
        </p>
      )}
    </div>
  );
});

export function LyricsPanel({ track, active = true }: LyricsPanelProps) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [centerLineIndex, setCenterLineIndex] = useState(-1);

  const {
    currentTime,
    seek,
    seekTimestamp,
    lyricAlign,
    lyricFontSize,
    lyricOffset,
  } = useMusicStore(
    useShallow((state) => ({
      currentTime: state.currentAudioTime,
      seek: state.seek,
      seekTimestamp: state.seekTimestamp,
      lyricAlign: state.lyricAlign,
      lyricFontSize: state.lyricFontSize,
      lyricOffset: state.lyricOffset,
    }))
  );

  const trackId = track?.id ?? null;
  const lyricId = track?.lyric_id ?? null;
  const source = track?.source ?? null;

  const activeIndex =
    lyrics.length > 0
      ? Math.max(
          0,
          lyrics.findLastIndex((line) => currentTime >= line.time + lyricOffset)
        )
      : 0;

  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoScrollingRef = useRef(false);

  const handleSeek = useCallback(
    (time: number) => {
      seek(time);

      setIsUserScrolling(false);
      setCenterLineIndex(-1);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    },
    [seek]
  );

  const handleScroll = useCallback(() => {
    if (isAutoScrollingRef.current) return;

    setIsUserScrolling(true);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      setCenterLineIndex(-1);
    }, AUTO_SCROLL_DELAY);

    const container = viewportRef.current;

    if (!container || lyrics.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;

    let closestIdx = 0;
    let closestDist = Infinity;

    lineRefs.current.forEach((el, i) => {
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const dist = Math.abs(elCenter - containerCenter);

      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    setCenterLineIndex(closestIdx);
  }, [lyrics.length]);

  useEffect(() => {
    const container = viewportRef.current;

    if (!container) return;

    container.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    if (!trackId || !source || !active) return;

    if (!lyricId) {
      queueMicrotask(() => {
        setLoading(false);
        setError("暂无歌词");
        setLyrics([]);
      });

      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      setLoading(true);
      setError("");
    });

    musicApi
      .getLyric(lyricId, source)
      .then((res) => {
        if (cancelled) return;

        if (!res) {
          setError("暂无歌词");
          setLyrics([]);
          return;
        }

        setLyrics(parseLrc(res.lyric, res.tlyric));
      })
      .catch(() => {
        if (cancelled) return;

        setError("歌词加载失败");
        setLyrics([]);
      })
      .finally(() => {
        if (cancelled) return;

        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trackId, lyricId, source, active]);

  useEffect(() => {
    if (isUserScrolling) return;

    const container = viewportRef.current;
    const el = lineRefs.current[activeIndex];

    if (!container || !el) return;

    const offset =
      el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;

    isAutoScrollingRef.current = true;

    container.scrollTo({
      top: offset,
      behavior: "smooth",
    });

    const onScrollEnd = () => {
      isAutoScrollingRef.current = false;
    };

    container.addEventListener("scrollend", onScrollEnd, {
      once: true,
    });

    return () => {
      isAutoScrollingRef.current = false;
      container.removeEventListener("scrollend", onScrollEnd);
    };
  }, [activeIndex, isUserScrolling]);

  useEffect(() => {
    flushSync(() => {
      setIsUserScrolling(false);
      setCenterLineIndex(-1);
    });

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, [seekTimestamp]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  if (!track) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-white/40">
        选择歌曲查看歌词
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-white/40">
        加载歌词中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-white/40">
        {error}
      </div>
    );
  }

  if (lyrics.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-white/40">
        暂无歌词
      </div>
    );
  }

  const LyricsList = (
    <div
      className={cn(
        "w-full flex flex-col",
        "py-[45%]",
        "gap-5",
        lyricAlign === "center" && "items-center",
        lyricAlign === "left" && "items-start",
        lyricAlign === "right" && "items-end"
      )}
    >
      {Array.from({ length: PADDING_LINES }).map((_, i) => (
        <div key={`pad-top-${i}`} className="h-6 shrink-0" />
      ))}

      {lyrics.map((line, i) => (
        <div
          key={`${line.time}-${i}`}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
          className={cn(
            "w-full flex",
            lyricAlign === "center" && "justify-center",
            lyricAlign === "left" && "justify-start",
            lyricAlign === "right" && "justify-end"
          )}
        >
          <LyricLineView
            line={line}
            isActive={i === activeIndex}
            align={lyricAlign}
            fontSize={lyricFontSize}
          />
        </div>
      ))}

      {Array.from({ length: PADDING_LINES }).map((_, i) => (
        <div key={`pad-bottom-${i}`} className="h-6 shrink-0" />
      ))}
    </div>
  );

  const centerLine = centerLineIndex >= 0 ? lyrics[centerLineIndex] : null;

  // 基准线时间标签：居左模式下右对齐，使数字紧贴播放按钮形成控件组
  const baselineTime = centerLine ? (
    <span
      className={cn(
        "min-w-9 text-xs tabular-nums text-white/60",
        lyricAlign === "left" && "text-right"
      )}
    >
      {formatTime(centerLine.time)}
    </span>
  ) : null;

  const baselinePlay = centerLine ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleSeek(centerLine.time);
      }}
      className={cn(
        "pointer-events-auto",
        "flex h-8 w-8 items-center justify-center",
        "rounded-full",
        "bg-white/10 backdrop-blur-sm",
        "text-white",
        "transition-all",
        "hover:bg-white/20",
        "active:scale-95"
      )}
      aria-label="播放此处歌词"
    >
      <Play size={14} className="ml-0.5 fill-current" />
    </button>
  ) : null;

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <ScrollArea
        className={cn(
          "h-full w-full",
          "**:data-[slot=scroll-area-scrollbar]:w-1.5",
          "**:data-[slot=scroll-area-thumb]:bg-white/10",
          "**:data-[slot=scroll-area-thumb]:hover:bg-white/30"
        )}
        viewportRef={viewportRef}
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      >
        {LyricsList}
      </ScrollArea>

      {isUserScrolling && centerLine && (
        <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-4 pointer-events-none">
          <div className="flex items-center gap-3">
            {lyricAlign === "right" && (
              <>
                {baselinePlay}
                {baselineTime}
              </>
            )}

            {lyricAlign === "center" && baselineTime}

            <div className="h-px flex-1 bg-white/20" />

            {lyricAlign === "center" && baselinePlay}

            {lyricAlign === "left" && (
              <>
                {baselineTime}
                {baselinePlay}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
