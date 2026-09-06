import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./assets/global.css"; // Ensure styles are imported
import { useEffect, useRef } from "react";
import { useAppStore, useDownloadStore } from "./store";
import { useSyncStore } from "@/store/sync-store";
import { checkAndSync } from "@/lib/sync";
import { cleanupCache } from "@/lib/utils/cache";
import { revokeAll } from "@/lib/utils/blob-registry";
import { stopBilibiliProxyServer } from "@/lib/bilibili/bilibili-native-player";
import { App as CapacitorApp } from "@capacitor/app";
import { IS_NATIVE } from "@/lib/api/config";
import { handleShareDeepLink } from "@/lib/share-service";
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
    // 启动时静默检查更新（用户关闭更新提醒后跳过）
    if (useAppStore.getState().enableUpdateNotify) {
      useAppStore.getState().checkUpdate(true);
    }
    // 初始化下载记录
    useDownloadStore.getState().init();

    // 延迟执行缓存清理，避免阻塞首屏
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(() => cleanupCache());
    } else {
      setTimeout(() => cleanupCache(), 5000);
    }

    const handleBeforeUnload = () => revokeAll();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      revokeAll();
    };
  }, []);

  // Bilibili代理服务器生命周期管理
  useEffect(() => {
    if (!IS_NATIVE) return;

    // 应用状态变化监听
    const handleAppStateChange = ({ isActive }: { isActive: boolean }) => {
      if (!isActive) {
        // 应用进入后台，停止代理服务器节省资源
        stopBilibiliProxyServer();
      }
    };

    // 应用暂停监听
    const handlePause = () => {
      // 应用暂停时停止代理服务器
      stopBilibiliProxyServer();
    };

    // 应用恢复监听
    const handleResume = async () => {
      // 应用恢复时，代理服务器会在下次播放时自动启动
    };

    // 分享深链：ottermusic://share?... 插入并播放分享歌曲
    CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      if (url) handleShareDeepLink(url);
    });

    CapacitorApp.addListener("appStateChange", handleAppStateChange);
    CapacitorApp.addListener("pause", handlePause);
    CapacitorApp.addListener("resume", handleResume);

    return () => {
      CapacitorApp.removeAllListeners();
      stopBilibiliProxyServer();
    };
  }, []);

  return <RouterProvider router={router} />;
}
