import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./assets/global.css"; // Ensure styles are imported
import { useEffect, useRef } from "react";
import { useAppStore, useDownloadStore } from "./store";
import { useSyncStore } from "@/store/sync-store";
import { checkAndSync } from "@/lib/sync";
import { cleanupCache } from "@/lib/utils/cache";
import { getAnonymousCookie, isAnonymousCookieStale } from "@/lib/netease/netease-api";
import { logger } from "@/lib/logger";

/**
 * 静默初始化游客 cookie（未登录时自动获取真实 MUSIC_A）
 * 仅在 cookie 不存在或已过期（>28天）时才调用网易云接口
 */
async function initAnonymousCookie() {
  if (!isAnonymousCookieStale()) return;
  try {
    await getAnonymousCookie();
  } catch (e) {
    logger.warn('[App]', 'initAnonymousCookie failed, fallback to local visitor cookie', e instanceof Error ? e : undefined);
  }
}

export default function App() {
  // Sync Logic
  const { syncKey } = useSyncStore();
  const syncInProgress = useRef(false);
  useEffect(() => {
    if (syncKey && !syncInProgress.current) {
      syncInProgress.current = true;
      checkAndSync().finally(() => {
        syncInProgress.current = false;
      });
    }
  }, [syncKey]);

  useEffect(() => {
    // 启动时静默检查更新
    useAppStore.getState().checkUpdate(true);
    // 初始化下载记录
    useDownloadStore.getState().init()

    // 延迟执行缓存清理，避免阻塞首屏
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => cleanupCache());
    } else {
      setTimeout(() => cleanupCache(), 5000);
    }

    // 静默获取游客 cookie，避免未登录时部分接口 400
    initAnonymousCookie();
  }, []);

  return <RouterProvider router={router} />;
}
