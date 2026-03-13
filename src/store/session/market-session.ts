import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MarketPlaylist } from "@/lib/netease/netease-types";

export interface MineDataState {
  recommend: MarketPlaylist[] | null;
  created: MarketPlaylist[] | null;
  subscribed: MarketPlaylist[] | null;
}

export interface ListSnapshot {
  items: MarketPlaylist[];
  offset: number;
  hasMore: boolean;
}

interface MarketSessionState {
  mineData: MineDataState;
  currentUserId: number | null;
  listSnapshots: Record<string, ListSnapshot>;

  setMineData: (data: MineDataState | ((prev: MineDataState) => MineDataState)) => void;
  setCurrentUserId: (id: number | null) => void;
  saveListSnapshot: (key: string, snapshot: ListSnapshot) => void;
  clearSession: () => void;
}

export const useMarketSession = create<MarketSessionState>()(
  persist(
    (set) => ({
      mineData: {
        recommend: null,
        created: null,
        subscribed: null,
      },
      currentUserId: null,
      listSnapshots: {},

      setMineData: (data) =>
        set((state) => ({
          mineData: typeof data === "function" ? data(state.mineData) : data,
        })),

      setCurrentUserId: (id) => set({ currentUserId: id }),

      saveListSnapshot: (key, snapshot) =>
        set((state) => ({
          listSnapshots: {
            ...state.listSnapshots,
            [key]: snapshot,
          },
        })),

      clearSession: () =>
        set({
          mineData: { recommend: null, created: null, subscribed: null },
          currentUserId: null,
          listSnapshots: {},
        }),
    }),
    {
      name: "market-session-storage",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        mineData: state.mineData,
        currentUserId: state.currentUserId,
        listSnapshots: state.listSnapshots,
      }),
    }
  )
);
