import { useCallback, useEffect, useRef } from "react";
import { MediaSession } from "@jofr/capacitor-media-session";
import { IS_NATIVE } from "@/lib/api/config";
import { useMusicStore } from "@/store/music-store";
import { musicApi } from "@/lib/music-api";
import { findActiveLyricIndex, parseLrc, type LyricLine } from "@/lib/lyrics";
import { logger } from "@/lib/logger";

/**
 * 蓝牙车载歌词。
 *
 * AVRCP 协议里没有歌词字段，业界通行做法是把**当前歌词行写进 TITLE 字段**
 * （开车载歌词时 TITLE 装歌词，关掉时装歌名），由车机固件自行展示。
 *
 * 因此这里只覆写蓝牙端读取的 MediaMetadata，通知栏与锁屏依旧显示歌名
 * （见 MediaSessionService#setCarLyric）。Web 端没有对应实现，全链路做平台守卫。
 *
 * 刷新触发点是 `currentAudioTime`（由 audio 的 timeupdate 节流约 1s 驱动），
 * 不自己起定时器：熄屏/后台时媒体事件仍会派发，而定时器可能被 WebView 挂起。
 */

/**
 * 原生方法是否存在。
 *
 * Capacitor 的插件代理按原生上报的方法表（`cap.PluginHeaders`）转发：
 * 方法不在表里时会回落到 web 实现，而 web 实现没有 setCarLyric，于是拿到
 * `undefined`——直接调用会**同步抛 TypeError**，`.catch` 接不住。
 * 所以未同步原生改动、或跑在 Web 端时必须先探测。
 */
function isCarLyricSupported(): boolean {
  if (!IS_NATIVE) return false;

  const probe = MediaSession as Partial<typeof MediaSession>;
  return typeof probe.setCarLyric === "function";
}

export function useCarLyric() {
  const enabled = useMusicStore((s) => s.carLyricEnabled);
  const track = useMusicStore((s) => s.queue[s.currentIndex]);
  const currentTime = useMusicStore((s) => s.currentAudioTime);
  const lyricOffset = useMusicStore((s) => s.lyricOffset);

  const linesRef = useRef<LyricLine[]>([]);
  const pushedRef = useRef<string | null>(null);

  const pushLyric = useCallback((text: string | null) => {
    if (!isCarLyricSupported()) return;
    // 同一行不重复过桥：歌词按行刷新，避免无意义地刷蓝牙 metadata
    if (pushedRef.current === text) return;
    pushedRef.current = text;

    try {
      void MediaSession.setCarLyric({ text }).catch((e: unknown) =>
        logger.error("CarLyric", "setCarLyric failed", e)
      );
    } catch (e) {
      logger.error("CarLyric", "setCarLyric threw", e);
    }
  }, []);

  const lyricId = track?.lyric_id ?? null;
  const source = track?.source ?? null;

  /** 把某一组歌词行按给定时间定位后推给车机 */
  const pushAt = useCallback(
    (lines: LyricLine[], time: number, offset: number) => {
      if (lines.length === 0) return;

      const index = findActiveLyricIndex(lines, time, offset);
      // 前奏（早于第一行）回退歌名，避免车机提前显示第一句
      pushLyric(index >= 0 ? lines[index].text : null);
    },
    [pushLyric]
  );

  // 切歌 / 开关变化时重新取歌词。musicApi.getLyric 带缓存，
  // LyricsPanel 已经拉过同一首时不会产生第二次请求。
  useEffect(() => {
    linesRef.current = [];
    pushLyric(null); // 关闭或切歌时都先把覆写清掉，车机回退歌名

    if (!enabled || !lyricId || !source) return;

    let cancelled = false;

    musicApi
      .getLyric(lyricId, source)
      .then((res) => {
        if (cancelled) return;

        const lines = res ? parseLrc(res.lyric, res.tlyric) : [];
        linesRef.current = lines;

        // 歌词可能比第一次 timeupdate 更晚到，这里立刻补推一次
        const state = useMusicStore.getState();
        pushAt(lines, state.currentAudioTime, state.lyricOffset);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        logger.error("CarLyric", "getLyric failed", e);
        linesRef.current = [];
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, lyricId, source, pushLyric, pushAt]);

  // 跟随播放进度换行
  useEffect(() => {
    if (!enabled) return;

    pushAt(linesRef.current, currentTime, lyricOffset);
  }, [enabled, currentTime, lyricOffset, pushAt]);
}
