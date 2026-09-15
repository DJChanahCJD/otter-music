import { useRef, useCallback, useEffect } from "react";
import { useMusicStore } from "@/store/music-store";
import { getCanonicalShareUrl } from "@/lib/share-url";
import { writeClipboardText } from "@/lib/clipboard";
import { toastUtils } from "@/lib/utils/toast";
import type { MusicTrack } from "@/types/music";
import toast from "react-hot-toast";

/** 触摸结束后浏览器补发模拟鼠标事件的时间窗口（ms） */
const EMULATED_MOUSE_WINDOW = 700;
/** 长按触发后拦截紧随 click 的时间窗口（ms）：超时自动失效，避免残留状态吞掉后续点击 */
const LONG_PRESS_CLICK_WINDOW = 700;

export function usePlayerActions(
  currentTrack: MusicTrack | null,
  currentAudioUrl: string | null,
  onCoverLongPress?: () => void
) {
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const coverPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  /** 长按触发时间戳（0 = 无待拦截的 click），用于拦截长按后紧随的那次 click */
  const coverLongPressAtRef = useRef(0);
  /** 最近一次 touchend 时间，用于忽略浏览器补发的模拟鼠标事件 */
  const coverTouchEndAtRef = useRef(0);

  const favorites = useMusicStore((s) => s.favorites);
  const isFavorite = useMusicStore((s) => s.isFavorite);
  const addToFavorites = useMusicStore((s) => s.addToFavorites);
  const removeFromFavorites = useMusicStore((s) => s.removeFromFavorites);

  const isCurrentTrackFavorite = currentTrack
    ? favorites.some((t) => t.id === currentTrack.id && !t.is_deleted)
    : false;

  const handleShare = useCallback(async () => {
    if (!currentTrack) return toast.error("暂无歌曲信息");

    const shareUrl = getCanonicalShareUrl(currentTrack) || currentAudioUrl;
    if (!shareUrl) return toast.error("该音源暂不支持分享");

    const ok = await writeClipboardText(
      `【OtterMusic】${currentTrack.name} - ${currentTrack.artist.join(", ")}\n${shareUrl}`
    );
    if (ok) {
      toast.success("已复制到剪贴板");
    } else {
      toast.error("复制失败，请重试");
    }
  }, [currentTrack, currentAudioUrl]);

  const handleToggleLike = useCallback(() => {
    if (!currentTrack) return;
    if (isFavorite(currentTrack.id)) {
      removeFromFavorites(currentTrack.id);
      toast.success("已取消喜欢");
    } else {
      const error = addToFavorites(currentTrack);
      if (error) {
        toastUtils.info(error);
      } else {
        toast.success("已喜欢");
      }
    }
  }, [currentTrack, isFavorite, addToFavorites, removeFromFavorites]);

  const handleTrackInfoPressStart = useCallback(() => {
    if (!currentTrack) return;

    pressTimerRef.current = setTimeout(async () => {
      const text = `${currentTrack.name} - ${currentTrack.artist.join(", ")}`;
      const ok = await writeClipboardText(text);
      if (ok) {
        toast.success("已复制歌曲信息");
      } else {
        toast.error("复制失败，请重试");
      }
    }, 500);
  }, [currentTrack]);

  const handleTrackInfoPressEnd = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  // 卸载时清理所有长按定时器
  useEffect(
    () => () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      if (coverPressTimerRef.current) clearTimeout(coverPressTimerRef.current);
    },
    []
  );

  const clearCoverPress = useCallback(() => {
    if (coverPressTimerRef.current) {
      clearTimeout(coverPressTimerRef.current);
      coverPressTimerRef.current = null;
    }
  }, []);

  /** 封面长按触发外部回调（例如预览大图） */
  const handleCoverPressStart = useCallback(() => {
    clearCoverPress();
    // 新手势开始即解除上一次长按的 click 拦截，避免残留状态吞掉本次点击
    coverLongPressAtRef.current = 0;
    coverPressTimerRef.current = setTimeout(() => {
      coverLongPressAtRef.current = Date.now();
      onCoverLongPress?.();
    }, 500);
  }, [clearCoverPress, onCoverLongPress]);

  const handleCoverPressEnd = useCallback(() => {
    clearCoverPress();
  }, [clearCoverPress]);

  /** 触摸结束：记录时间，供模拟鼠标事件过滤使用 */
  const handleCoverTouchEnd = useCallback(() => {
    coverTouchEndAtRef.current = Date.now();
    clearCoverPress();
  }, [clearCoverPress]);

  /** 鼠标按下：跳过触摸后补发的模拟事件，避免重置长按状态 */
  const handleCoverMouseDown = useCallback(() => {
    if (Date.now() - coverTouchEndAtRef.current < EMULATED_MOUSE_WINDOW) return;
    handleCoverPressStart();
  }, [handleCoverPressStart]);

  /**
   * 长按事件若浏览器未补发 click（如 WebView 原生长按菜单接管手势），
   * 时间窗口失效即自动放行，保证后续点击仍能切换歌词
   */
  const handleCoverClick = useCallback((e: React.MouseEvent) => {
    if (Date.now() - coverLongPressAtRef.current < LONG_PRESS_CLICK_WINDOW) {
      e.stopPropagation();
    }
  }, []);

  return {
    handleShare,
    handleToggleLike,
    isCurrentTrackFavorite,
    trackInfoPressHandlers: {
      onMouseDown: handleTrackInfoPressStart,
      onMouseUp: handleTrackInfoPressEnd,
      onMouseLeave: handleTrackInfoPressEnd,
      onTouchStart: handleTrackInfoPressStart,
      onTouchEnd: handleTrackInfoPressEnd,
    },
    coverPressHandlers: {
      onMouseDown: handleCoverMouseDown,
      onMouseUp: handleCoverPressEnd,
      onMouseLeave: handleCoverPressEnd,
      onTouchStart: handleCoverPressStart,
      onTouchEnd: handleCoverTouchEnd,
      onTouchCancel: handleCoverTouchEnd,
      onClick: handleCoverClick,
    },
  };
}
