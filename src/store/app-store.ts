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
  isChecking: false,
};

/* =========================
   工具函数
========================= */

const isSameDay = (t1: number, t2: number) =>
  new Date(t1).toDateString() === new Date(t2).toDateString();

const getCurrentVersion = async (): Promise<string> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const info = await App.getInfo();
      return info.version;
    }
  } catch (e) {
    console.error("Failed to get app info", e);
  }
  return "0.0.0";
};

const normalizeVersion = (version: string): string => {
  const trimmed = version.trim().replace(/^v/i, "");
  const match = trimmed.match(/\d+(?:\.\d+)*/);
  return match?.[0] ?? "0.0.0";
};

const compareVersions = (a: string, b: string): number => {
  const va = normalizeVersion(a).split(".").map(Number);
  const vb = normalizeVersion(b).split(".").map(Number);

  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i++) {
    const na = va[i] ?? 0;
    const nb = vb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
};

/* =========================
   Store
========================= */

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
          const currentVersion = await getCurrentVersion();
          set({ currentVersion });

          // 当天已检查 + 静默 -> 不重复请求
          if (
            silent &&
            state.lastCheckTime &&
            isSameDay(state.lastCheckTime, now)
          ) {
            return;
          }

          const info = await apiCheckUpdate();

          const hasUpdate =
            compareVersions(currentVersion, info.latestVersion) < 0;

          set({
            latestVersionInfo: hasUpdate ? info : null,
            lastCheckTime: now,
          });

          if (hasUpdate) {
            toast(`发现新版本 ${info.latestVersion}`, {
              icon: "✨",
              duration: 3000,
            });
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
        lastCheckTime: state.lastCheckTime,
        latestVersionInfo: state.latestVersionInfo,
      }),
    }
  )
);