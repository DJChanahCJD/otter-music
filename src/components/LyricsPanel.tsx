import { memo, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { musicApi } from "@/services/music-api";
import { MusicTrack } from "@/types/music";
import { Button } from "./ui/button";

interface LyricsPanelProps {
  track: MusicTrack | null;
  currentTime: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

interface LyricLine {
  time: number;
  text: string;
  ttext?: string;
}

const TIME_EXP = /\[(\d{2}):(\d{2})\.(\d{2,3})]/;

/** 解析单行歌词时间 */
function parseTime(timeStr: string): number | null {
  const m = TIME_EXP.exec(timeStr);
  if (!m) return null;
  return (
    Number(m[1]) * 60 +
    Number(m[2]) +
    Number(m[3].padEnd(3, "0")) / 1000
  );
}

/** 简单的歌词解析（不处理合并） */
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

/** 解析 LRC（主歌词 + 翻译歌词 - 线性归并优化） */
function parseLrc(lrc: string, tLrc?: string): LyricLine[] {
  const lLines = parseSimpleLrc(lrc);
  if (!tLrc) {
    return lLines;
  }

  const tLines = parseSimpleLrc(tLrc);
  const result: LyricLine[] = [];
  let tIdx = 0;

  // 双指针线性归并：O(N)
  for (const line of lLines) {
    let ttext: string | undefined;

    // 1. 快速跳过过早的翻译
    while (tIdx < tLines.length && tLines[tIdx].time < line.time - 0.5) {
      tIdx++;
    }

    // 2. 尝试匹配当前窗口内的翻译（允许 0.5s 误差）
    // 由于 tIdx 已经 >= line.time - 0.5，只需要检查是否 <= line.time + 0.5
    // 且取最近的一个
    let bestMatchIdx = -1;
    let minDiff = 0.5;

    // 向后查看少量几行即可，因为时间是单调的
    for (let i = tIdx; i < tLines.length; i++) {
      const diff = Math.abs(tLines[i].time - line.time);
      
      // 如果超过误差范围且时间更晚，说明后续都不可能匹配了（单调性）
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

/** 歌词行组件 - 避免整列表重渲染 */
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
  isFavorite,
  onToggleFavorite,
}: LyricsPanelProps) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(false);
  const trackId = track?.id ?? null;
  const lyricId = track?.lyric_id ?? null;
  const source = track?.source ?? null;

  // 1. 派生状态：当前激活的歌词索引
  // 直接在渲染期间计算，避免 useEffect + setState 导致的二次渲染
  const activeIndex = lyrics.length > 0 
    ? Math.max(0, lyrics.findLastIndex((line: LyricLine) => currentTime >= line.time))
    : 0;

  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);

  /** 加载歌词 */
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

  /** 高性能滚动优化 */
  useEffect(() => {
    const container = viewportRef.current;
    const el = lineRefs.current[activeIndex];
    
    if (!container || !el) return;

    // 手动计算偏移量，避免 scrollIntoView 的 layout/animation 开销
    const offset = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;

    container.scrollTo({
      top: offset,
      behavior: "smooth", // 即使是 smooth，scrollTo 也比 scrollIntoView 性能好，且 UI 体验更佳
    });
  }, [activeIndex]);

  /* ---------- 状态兜底 ---------- */

  if (!track) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground/40">
        选择歌曲查看歌词
      </div>
    );
  }

  /* ---------- 正式 UI ---------- */

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

  // 移动端 UI
  return (
    <div className="h-full flex flex-col p-4 gap-4">
      {/* 歌曲信息区域 */}
      <div
        className={cn(
          "flex flex-col gap-2",
          "pb-4 border-b border-border/40",
        )}
      >
        <h3
          className={cn(
            "font-bold tracking-tight text-foreground/90 text-center",
            "text-xl",
          )}
        >
          {track.name}
        </h3>
        <p className={cn("text-muted-foreground/80 text-center", "text-sm")}>
          {track.artist.join(" / ")}
        </p>

        <div className="flex justify-center mt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={onToggleFavorite}
            title="喜欢"
          >
            <Heart
              className={cn(
                "h-5 w-5",
                isFavorite && "fill-primary text-primary",
              )}
            />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground/40">
          加载歌词中...
        </div>
      ) : (
        /* 歌词显示区域 */
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full" viewportRef={viewportRef}>
            {LyricsList}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
