"use client";

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
  active?: boolean;
}

interface LyricLine {
  time: number;
  text: string;
  ttext?: string;
}

const TIME_EXP = /\[(\d{2}):(\d{2})\.(\d{2,3})]/g;
const LYRIC_OFFSET = -0.5;
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
  const timeRegex = TIME_EXP; 

  for (const line of lrc.split("\n")) {
    const timeMatches = [...line.matchAll(timeRegex)];
    
    if (timeMatches.length > 0) {
      const text = line.replace(timeRegex, "").trim();
      
      if (text) {
        for (const m of timeMatches) {
          const time = Number(m[1]) * 60 + Number(m[2]) + Number(m[3].padEnd(3, "0")) / 1000;
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
}: {
  line: LyricLine;
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        "px-6 w-full max-w-xl transition-all duration-500 ease-out text-center cursor-pointer",
        isActive
          ? "text-white text-[22px] font-bold scale-100 drop-shadow-md"
          : "text-white/40 text-[18px] scale-95 hover:text-white/60",
      )}
    >
      <p className="leading-relaxed tracking-wide wrap-break-word">{line.text}</p>
      {line.ttext && (
        <p className={cn(
          "mt-1.5 font-medium text-[15px] wrap-break-word transition-colors duration-500",
          isActive ? "text-white/80" : "text-white/30"
        )}>
          {line.ttext}
        </p>
      )}
    </div>
  );
});

export function LyricsPanel({ track, currentTime, active = true }: LyricsPanelProps) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (!active) return;

    let cancelled = false;

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
      <div className="h-full flex items-center justify-center text-sm text-white/40 tracking-widest">
        选择歌曲查看歌词
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-white/40 tracking-widest">
        加载歌词中...
      </div>
    );
  }

  const LyricsList = (
    <div className="py-[45%] space-y-6 flex flex-col items-center w-full">
      {lyrics.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-white/50 text-center tracking-widest">暂无歌词</p>
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
              className="w-full flex justify-center"
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
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* 使用 CSS Mask 实现上下渐隐效果，让边缘更柔和 */}
      <ScrollArea 
        className="h-full w-full **:data-[slot=scroll-area-scrollbar]:w-1.5 **:data-[slot=scroll-area-thumb]:bg-white/10 **:data-[slot=scroll-area-thumb]:hover:bg-white/30 **:ata-slot=scroll-area-thumb]]:transition-colors" 
        viewportRef={viewportRef}
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 90%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 90%, transparent 100%)"
        }}
      >
        {LyricsList}
      </ScrollArea>

      {/* 调整时间轴 UI 的通透感 */}
      {isUserScrolling && centerLine && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center px-6 pointer-events-none z-10">
          <span className="text-xs text-white/70 font-medium min-w-[40px] drop-shadow-md">
            {formatTime(centerLine.time)}
          </span>
          <div className="flex-1 h-px bg-white/30 mx-3 shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(centerLine.time);
            }}
            className="pointer-events-auto w-8 h-8 flex bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full items-center justify-center transition-all active:scale-95 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
          </button>
        </div>
      )}
    </div>
  );
}