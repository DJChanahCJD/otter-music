import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storeKey } from "./store-keys";
import type { UserProfile } from "@/lib/netease/netease-types";

interface NeteaseState {
  cookie: string;
  user: UserProfile | null;
}

interface NeteaseActions {
  setLogin: (cookie: string, user: UserProfile) => void;
  logout: () => void;
}

export const useNeteaseStore = create<NeteaseState & NeteaseActions>()(
  persist(
    (set) => ({
      cookie: "",
      user: null,
      setLogin: (cookie, user) => set({ cookie, user }),
      logout: () => set({ cookie: "", user: null }),
    }),
    {
      name: storeKey.NeteaseStore,
    }
  )
);
