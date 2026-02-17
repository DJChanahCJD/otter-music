import { memo, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { musicApi } from "@/services/music-api";
import { MusicTrack } from "@/types/music";

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

function parseTime(timeStr: string): number | null {
  const m = TIME_EXP.exec(timeStr);
  if (!m) return null;
  return (
    Number(m[1]) * 60 +
    Number(m[2]) +
    Number(m[3].padEnd(3, "0")) / 1000
  );
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

    while (tIdx < tLines.length && tLines[tIdx].time < line.time - 0.5) {
      tIdx++;
    }

    let bestMatchIdx = -1;
    let minDiff = 0.5;

    for (let i = tIdx; i < tLines.length; i++) {
      const diff = Math.abs(tLines[i].time - line.time);
      
      if (tLines[i].time > line.time + 0.5) {
        break;
      }

      if (diff <= 0.5 && diff < minDiff) {
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
          : "text-muted-foreground/60 scale-100 blur-[0.5px]"
      )}
    >
      <p className="leading-relaxed text-lg">
        {line.text}
      </p>
      {line.ttext && (
        <p className="mt-1 font-medium text-sm text-muted-foreground/90">
          {line.ttext}
        </p>
      )}
    </div>
  );
});

export function LyricsPanel({
  track,
  currentTime,
}: LyricsPanelProps) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(false);
  const trackId = track?.id ?? null;
  const lyricId = track?.lyric_id ?? null;
  const source = track?.source ?? null;

  const activeIndex = lyrics.length > 0 
    ? Math.max(0, lyrics.findLastIndex((line: LyricLine) => currentTime >= line.time))
    : 0;

  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);

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
    const container = viewportRef.current;
    const el = lineRefs.current[activeIndex];
    
    if (!container || !el) return;

    const offset = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;

    container.scrollTo({
      top: offset,
      behavior: "smooth",
    });
  }, [activeIndex]);

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
      {lyrics.map((line, i) => (
        <div
          key={i}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
        >
          <LyricLineView 
            line={line} 
            isActive={i === activeIndex} 
          />
        </div>
      ))}

      {lyrics.length === 0 && (
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground text-center">
            纯音乐，请欣赏
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        {LyricsList}
      </ScrollArea>
    </div>
  );
}
