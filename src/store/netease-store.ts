import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storeKey } from "./store-keys";
import type { UserProfile } from "@/lib/netease/netease-types";

interface NeteaseState {
  cookie: string;
  user: UserProfile | null;
  /** 游客 cookie（MUSIC_A），未登录时使用 */
  anonymousCookie: string;
  /** 游客 cookie 获取时间戳（ms），用于判断是否过期 */
  anonymousCookieSetAt: number;
}

interface NeteaseActions {
  setLogin: (cookie: string, user: UserProfile) => void;
  logout: () => void;
  setAnonymousCookie: (cookie: string) => void;
}

export const useNeteaseStore = create<NeteaseState & NeteaseActions>()(
  persist(
    (set) => ({
      cookie: "",
      user: null,
      anonymousCookie: "",
      anonymousCookieSetAt: 0,
      setLogin: (cookie, user) => set({ cookie, user }),
      logout: () => set({ cookie: "", user: null }),
      setAnonymousCookie: (cookie) => set({ anonymousCookie: cookie, anonymousCookieSetAt: Date.now() }),
    }),
    {
      name: storeKey.NeteaseStore,
    }
  )
);

