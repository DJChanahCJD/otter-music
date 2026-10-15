import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { IS_NATIVE } from "@/lib/api/config";
import { useMusicStore } from "@/store/music-store";
import { musicApi } from "@/lib/music-api";
import { findActiveLyricIndex, parseLrc, type LyricLine } from "@/lib/lyrics";
import { logger } from "@/lib/logger";
import { DesktopLyric } from "@/plugins/desktop-lyric";

/**
 * 桌面歌词（Android 悬浮窗）。
 *
 * 与 useCarLyric 共用同一套时间轴口径：订阅 `currentAudioTime`
 * （由 audio 的 timeupdate 节流约 1s 驱动，熄屏/后台仍派发），
 * 按行把歌词推给原生悬浮窗（DesktopLyricPlugin）。
 *
 * 与车载歌词的差异：
 * - 前奏/无歌词时回退显示"歌名 - 歌手"而非清空（悬浮窗没有原生歌名兜底）；
 * - 需要管理悬浮窗自身的 show/hide 生命周期与字号/字色；
 * - 本应用前台时原生自动隐藏、切后台恢复；用户双击药丸时原生拉起本应用，
 *   这里在挂载/回前台时消费 pending 请求并跳转到桌面歌词设置项。
 */

/**
 * 原生方法是否存在。
 *
 * 插件代理按原生上报的方法表转发，未同步原生改动或跑在 Web 端时
 * 方法是 `undefined`，直接调用会**同步抛 TypeError**，必须先探测。
 */
function isDesktopLyricSupported(): boolean {
  if (!IS_NATIVE) return false;

  const probe = DesktopLyric as Partial<typeof DesktopLyric>;
  return typeof probe.setLyric === "function";
}

export function useDesktopLyric() {
  const enabled = useMusicStore((s) => s.desktopLyricEnabled);
  const navigate = useNavigate();
  const track = useMusicStore((s) => s.queue[s.currentIndex]);
  const currentTime = useMusicStore((s) => s.currentAudioTime);
  const lyricOffset = useMusicStore((s) => s.lyricOffset);
  const fontSize = useMusicStore((s) => s.desktopLyricFontSize);
  const fontColor = useMusicStore((s) => s.desktopLyricColor);

  const linesRef = useRef<LyricLine[]>([]);
  const pushedRef = useRef<string | null>(null);

  /** 前奏/无歌词时的兜底文案：歌名 - 歌手 */
  const fallbackText = track ? `${track.name} - ${track.artist.join("/")}` : "";

  /** 推送一行文本到悬浮窗，同一行去重避免无意义地刷桥 */
  const pushText = useCallback((text: string | null) => {
    if (!isDesktopLyricSupported()) return;

    const next = text ?? "";
    if (pushedRef.current === next) return;
    pushedRef.current = next;

    try {
      void DesktopLyric.setLyric({ text: next }).catch((e: unknown) =>
        logger.error("DesktopLyric", "setLyric failed", e)
      );
    } catch (e) {
      logger.error("DesktopLyric", "setLyric threw", e);
    }
  }, []);

  /** 把某一组歌词行按给定时间定位后推给悬浮窗；前奏回退歌名 */
  const pushAt = useCallback(
    (lines: LyricLine[], time: number, offset: number, fallback: string) => {
      if (lines.length === 0) {
        pushText(fallback);
        return;
      }

      const index = findActiveLyricIndex(lines, time, offset);
      pushText(index >= 0 ? lines[index].text : fallback);
    },
    [pushText]
  );

  /** 消费原生"双击歌词打开设置"请求；存在则导航到设置页并带上展开标记 */
  const consumeOpenSettings = useCallback(async () => {
    if (!isDesktopLyricSupported()) return;

    // 旧 APK 原生方法表里没有 consumeOpenSettings，直接调用会同步抛 TypeError
    const probe = DesktopLyric as Partial<typeof DesktopLyric>;
    if (typeof probe.consumeOpenSettings !== "function") return;

    try {
      const { pending } = await DesktopLyric.consumeOpenSettings();
      if (pending) {
        navigate("/settings", { state: { expandDesktopLyric: true } });
      }
    } catch (e) {
      logger.error("DesktopLyric", "consumeOpenSettings failed", e);
    }
  }, [navigate]);

  // 双击悬浮歌词 → 原生拉起本应用 → 消费请求并跳转设置页（展开桌面歌词项）。
  // 挂载时消费一次（冷启动场景）；应用回前台时再消费（热启动场景）。
  useEffect(() => {
    if (!isDesktopLyricSupported()) return;

    void consumeOpenSettings();

    let removed = false;
    let handle: Awaited<ReturnType<typeof App.addListener>> | null = null;

    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void consumeOpenSettings();
    })
      .then((h) => {
        if (removed) {
          void h.remove();
          return;
        }
        handle = h;
      })
      .catch((e: unknown) =>
        logger.error("DesktopLyric", "appStateChange addListener failed", e)
      );

    return () => {
      removed = true;
      void handle?.remove();
    };
  }, [consumeOpenSettings]);

  // 开关 / 字号 / 字色变化时同步悬浮窗。悬浮窗生命周期独立于歌词内容。
  useEffect(() => {
    if (!isDesktopLyricSupported()) return;

    if (enabled) {
      // 未授予悬浮窗权限时 show 会 reject，由设置组件负责引导授权
      DesktopLyric.show()
        .then(() => {
          // 旧 APK 原生方法表里没有 setSize/setColor，直接调用会同步抛 TypeError
          const probe = DesktopLyric as Partial<typeof DesktopLyric>;
          if (typeof probe.setSize === "function") {
            void DesktopLyric.setSize({ size: fontSize }).catch((e: unknown) =>
              logger.error("DesktopLyric", "setSize failed", e)
            );
          }
          if (typeof probe.setColor === "function") {
            void DesktopLyric.setColor({ color: fontColor }).catch(
              (e: unknown) => logger.error("DesktopLyric", "setColor failed", e)
            );
          }
        })
        .catch((e: unknown) => logger.error("DesktopLyric", "show failed", e));
    } else {
      DesktopLyric.hide().catch((e: unknown) =>
        logger.error("DesktopLyric", "hide failed", e)
      );
    }
  }, [enabled, fontSize, fontColor]);

  // 切歌 / 开关变化时重新取歌词。musicApi.getLyric 带缓存，
  // LyricsPanel / useCarLyric 已经拉过同一首时不会产生第二次请求。
  const lyricId = track?.lyric_id ?? null;
  const source = track?.source ?? null;

  useEffect(() => {
    linesRef.current = [];

    if (!enabled) {
      pushText(null); // 关闭时重置去重记录，窗口已隐藏，推送内容无副作用
      return;
    }

    pushText(fallbackText); // 切歌后先推兜底文案占位，等歌词到达再覆盖

    if (!lyricId || !source) return;

    let cancelled = false;

    musicApi
      .getLyric(lyricId, source)
      .then((res) => {
        if (cancelled) return;

        const lines = res ? parseLrc(res.lyric, res.tlyric) : [];
        linesRef.current = lines;

        // 歌词可能比第一次 timeupdate 更晚到，这里立刻补推一次
        const state = useMusicStore.getState();
        pushAt(lines, state.currentAudioTime, state.lyricOffset, fallbackText);
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        logger.error("DesktopLyric", "getLyric failed", e);
        linesRef.current = [];
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, lyricId, source, pushText, pushAt, fallbackText]);

  // 跟随播放进度换行
  useEffect(() => {
    if (!enabled) return;

    pushAt(linesRef.current, currentTime, lyricOffset, fallbackText);
  }, [enabled, currentTime, lyricOffset, pushAt, fallbackText]);
}
