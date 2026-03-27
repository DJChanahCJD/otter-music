import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storeKey } from "./store-keys";
import { idbStorage } from "@/lib/storage-adapter";
import { type UpdateInfo, checkUpdate as apiCheckUpdate } from "@/lib/api/update";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { toast } from "react-hot-toast";
import { logger } from "@/lib/logger";

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
          logger.error("app-store", "Update check failed", error, {
            silent,
          });
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
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        lastCheckTime: state.lastCheckTime,
        latestVersionInfo: state.latestVersionInfo,
      }),
    }
  )
);
