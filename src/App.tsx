import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./assets/global.css"; // Ensure styles are imported
import { useEffect, useRef } from "react";
import { useAppStore, useDownloadStore } from "./store";
import { useSyncStore } from "@/store/sync-store";
import { checkAndSync } from "@/lib/sync";
import { cleanupCache } from "@/lib/utils/cache";

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
  }, []);

  return <RouterProvider router={router} />;
}
