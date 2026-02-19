import { memo, useEffect, useRef, useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { MusicTrack } from "@/types/music";
import { Play } from "lucide-react";
import { useMusicStore } from "@/store/music-store";

interface LyricsPanelProps {
  track: MusicTrack | null;
  currentTime: number;
}

interface LyricLine {
  time: number;
  text: string;
  ttext?: string;
}

const TIME_EXP = /\[(\d{2}):(\d{2})\.(\d{2,3})]/;
const LYRIC_OFFSET = -0.5;
const MATCH_TOLERANCE = 0.5;
const AUTO_SCROLL_DELAY = 3000;
const PADDING_LINES = 2;

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function parseTime(timeStr: string): number | null {
  const m = TIME_EXP.exec(timeStr);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]) + Number(m[3].padEnd(3, "0")) / 1000;
}

function parseSimpleLrc(lrc: string): { time: number; text: string }[] {
  const lines: { time: number; text: string }[] = [];
  for (const line of lrc.split("\n")) {
    const time = parseTime(line);
    if (time !== null) {
      const text = line.replace(TIME_EXP, "").trim();
      if (text) lines.push({ time, text });
    }
  }
  return lines;
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
}: {
  line: LyricLine;
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        "px-4 transition-all duration-300 ease-out",
        isActive
          ? "text-white text-lg font-semibold scale-105"
          : "text-muted-foreground/60 scale-100 blur-[0.5px]",
      )}
    >
      <p className="leading-relaxed text-lg">{line.text}</p>
      {line.ttext && (
        <p className="mt-1 font-medium text-sm text-muted-foreground/90">
          {line.ttext}
        </p>
      )}
    </div>
  );
});

export function LyricsPanel({ track, currentTime }: LyricsPanelProps) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [centerLineIndex, setCenterLineIndex] = useState(-1);

  const trackId = track?.id ?? null;
  const lyricId = track?.lyric_id ?? null;
  const source = track?.source ?? null;

  const activeIndex =
    lyrics.length > 0
      ? Math.max(
          0,
          lyrics.findLastIndex(
            (line: LyricLine) => currentTime >= line.time + LYRIC_OFFSET,
          ),
        )
      : 0;

  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoScrollingRef = useRef(false);
  const seek = useMusicStore((s) => s.seek);

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
    [seek],
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

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    if (!trackId || !lyricId || !source) return;

    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setLyrics([]);
    });

    musicApi
      .getLyric(lyricId, source)
      .then((res) => {
        if (cancelled) return;
        if (!res) {
          setLyrics([{ time: 0, text: "暂无歌词" }]);
          return;
        }
        setLyrics(parseLrc(res.lyric, res.tlyric));
      })
      .catch(() => {
        if (cancelled) return;
        setLyrics([{ time: 0, text: "歌词加载失败" }]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trackId, lyricId, source]);

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

    const timer = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 300);

    return () => clearTimeout(timer);
  }, [activeIndex, isUserScrolling]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  if (!track) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground/40">
        选择歌曲查看歌词
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground/40">
        加载歌词中...
      </div>
    );
  }

  const LyricsList = (
    <div className="py-[45%] space-y-4 text-center">
      {lyrics.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground text-center">暂无歌词</p>
        </div>
      ) : (
        <>
          {Array.from({ length: PADDING_LINES }).map((_, i) => (
            <div key={`pad-top-${i}`} className="h-6" />
          ))}
          {lyrics.map((line, i) => (
            <div
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
            >
              <LyricLineView line={line} isActive={i === activeIndex} />
            </div>
          ))}
          {Array.from({ length: PADDING_LINES }).map((_, i) => (
            <div key={`pad-bottom-${i}`} className="h-6" />
          ))}
        </>
      )}
    </div>
  );

  const centerLine = centerLineIndex >= 0 ? lyrics[centerLineIndex] : null;

  return (
    <div className="h-full flex flex-col relative">
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        {LyricsList}
      </ScrollArea>

      {isUserScrolling && centerLine && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center px-4 pointer-events-none">
          <span className="text-xs text-white/70 font-medium min-w-[40px]">
            {formatTime(centerLine.time)}
          </span>
          <div className="flex-1 h-px bg-white/20 mx-2" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(centerLine.time);
            }}
            className="pointer-events-auto w-6 h-6 flex bg-transparent items-center justify-center"
          >
            <Play className="w-3 h-3 text-white/80 fill-white/80" />
          </button>
        </div>
      )}
    </div>
  );
}
