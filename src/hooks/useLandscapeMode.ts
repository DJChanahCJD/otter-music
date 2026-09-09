import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { StatusBar } from "@capacitor/status-bar";
import { useExitLayer } from "@/hooks/useExitLayer";
import { logger } from "@/lib/logger";

/** 隐藏状态栏；不支持的设备忽略失败 */
async function hideStatusBar() {
  try {
    await StatusBar.hide();
  } catch (error) {
    logger.warn("LandscapeMode", "隐藏状态栏失败", error as Error);
  }
}

/** 锁定横屏并隐藏状态栏；不支持的设备忽略失败，用户仍可手动旋转 */
async function enterImmersiveOrientation() {
  try {
    await ScreenOrientation.lock({ orientation: "landscape" });
  } catch (error) {
    logger.warn("LandscapeMode", "锁定横屏失败", error as Error);
  }

  await hideStatusBar();
}

/** 解锁方向并恢复状态栏 */
async function exitImmersiveOrientation() {
  try {
    await ScreenOrientation.unlock();
  } catch (error) {
    logger.warn("LandscapeMode", "解锁屏幕方向失败", error as Error);
  }

  try {
    await StatusBar.show();
  } catch (error) {
    logger.warn("LandscapeMode", "恢复状态栏失败", error as Error);
  }
}

/**
 * 横屏沉浸播放模式：手动进入后锁定横屏、隐藏状态栏，退出（手动 / 返回键 / 关闭播放器）时恢复。
 * @param active 播放器是否处于打开状态，关闭时自动退出以避免横屏被遗留
 */
export function useLandscapeMode(active: boolean) {
  const [isLandscapeMode, setIsLandscapeMode] = useState(false);
  const immersiveRef = useRef(false);
  const { push, pop } = useExitLayer();

  // 播放器关闭时立即失效（渲染期调整状态），避免横屏被遗留
  if (!active && isLandscapeMode) {
    setIsLandscapeMode(false);
  }

  const enter = useCallback(() => {
    immersiveRef.current = true;
    void enterImmersiveOrientation();
    setIsLandscapeMode(true);
  }, []);

  const exit = useCallback(() => setIsLandscapeMode(false), []);

  // 下拉通知栏或切到后台再回来时，系统可能残留状态栏，重新隐藏
  useEffect(() => {
    if (!isLandscapeMode) return;

    const listener = App.addListener("resume", () => void hideStatusBar());

    return () => {
      void listener.then((l) => l.remove());
    };
  }, [isLandscapeMode]);

  // 返回键优先退出横屏模式，而不是关闭整个播放器
  useEffect(() => {
    if (!isLandscapeMode) return;

    const id = push({ close: exit });

    return () => pop(id);
  }, [isLandscapeMode, push, pop, exit]);

  // 退出后恢复系统状态（含播放器关闭导致的失效）
  useEffect(() => {
    if (isLandscapeMode || !immersiveRef.current) return;

    immersiveRef.current = false;
    void exitImmersiveOrientation();
  }, [isLandscapeMode]);

  return { isLandscapeMode, enter, exit };
}
