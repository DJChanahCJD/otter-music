import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storeKey } from "./store-keys";
import { type UpdateInfo, checkUpdate as apiCheckUpdate } from "@/lib/api/update";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { toast } from "react-hot-toast";

interface AppState {
  currentVersion: string;
  lastCheckTime: number;
  latestVersionInfo: UpdateInfo | null;
  hasNewVersion: boolean;
  isChecking: boolean;
}

interface AppActions {
  checkUpdate: (silent?: boolean) => Promise<void>;
  resetCheckTime: () => void;
}

const initialState: AppState = {
  currentVersion: "0.0.0",
  lastCheckTime: 0,
  latestVersionInfo: null,
  hasNewVersion: false,
  isChecking: false,
};

/**
 * 判断是否同一天
 */
const isSameDay = (t1: number, t2: number) =>
  new Date(t1).toDateString() === new Date(t2).toDateString();

/**
 * 获取当前版本号
 */
const getCurrentVersion = async (): Promise<string> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const info = await App.getInfo();
      return info.version;
    }
  } catch (e) {
    console.error("Failed to get app info", e);
  }
  return "0.0.0"; // Web fallback
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      checkUpdate: async (silent = false) => {
        const now = Date.now();
        const state = get();

        if (state.isChecking) return;
        set({ isChecking: true });

        try {
          // 1️⃣ 获取当前版本
          const currentVersion = await getCurrentVersion();
          set({ currentVersion });

          // 2️⃣ 静默 + 当天已检查 -> 直接使用缓存
          if (
            silent &&
            state.lastCheckTime &&
            isSameDay(state.lastCheckTime, now)
          ) {
            if (state.hasNewVersion && state.latestVersionInfo) {
              toast(`发现新版本 ${state.latestVersionInfo.latestVersion}，请前往设置更新`, {
                icon: "✨",
                duration: 3000,
              });
            }
            return;
          }

          // 3️⃣ 请求更新接口
          const info = await apiCheckUpdate(currentVersion);

          set({
            latestVersionInfo: info,
            hasNewVersion: info.hasUpdate,
            lastCheckTime: now,
          });

          // 4️⃣ 统一 toast 逻辑
          if (info.hasUpdate) {
            if (silent) {
              toast(`发现新版本 ${info.latestVersion}，请前往设置更新`, {
                icon: "✨",
                duration: 3000,
              });
            }
          } else if (!silent) {
            toast.success(`当前已是最新版本 (${currentVersion})`);
          }

        } catch (error) {
          console.error("Update check failed:", error);
          if (!silent) {
            toast.error("检查更新失败，请稍后重试");
          }
        } finally {
          set({ isChecking: false });
        }
      },

      resetCheckTime: () => set({ lastCheckTime: 0 }),
    }),
    {
      name: storeKey.AppStore,
      partialize: (state) => ({
        currentVersion: state.currentVersion,
        lastCheckTime: state.lastCheckTime,
        latestVersionInfo: state.latestVersionInfo,
        hasNewVersion: state.hasNewVersion,
      }),
    }
  )
);