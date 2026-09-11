/**
 * LRC 解析与当前行定位。
 *
 * 被 `LyricsPanel`（界面滚动）与 `useCarLyric`（蓝牙车载歌词）共用，
 * 两处必须用同一套时间轴口径，否则车机与屏幕会显示不同的行。
 */

export interface LyricLine {
  time: number;
  text: string;
  ttext?: string;
}

const TIME_EXP = /\[(\d{2}):(\d{2})\.(\d{2,3})]/g;
const MATCH_TOLERANCE = 0.5;

export function parseSimpleLrc(lrc: string): { time: number; text: string }[] {
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

/** 解析歌词，并把译文按时间戳就近匹配到原文行上 */
export function parseLrc(lrc: string, tLrc?: string): LyricLine[] {
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

/**
 * 当前播放时间对应的歌词行下标。
 * 早于第一行（前奏）时返回 -1，交由调用方决定显示什么（界面用第 0 行占位，
 * 车机则回退显示歌名）。
 */
export function findActiveLyricIndex(
  lines: LyricLine[],
  currentTime: number,
  offset = 0
): number {
  if (lines.length === 0) return -1;

  return lines.findLastIndex((line) => currentTime >= line.time + offset);
}
