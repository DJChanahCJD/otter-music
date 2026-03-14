import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MarketPlaylist, ArtistAlbum } from "@/lib/netease/netease-types";

export interface MineDataState {
  recommend: MarketPlaylist[] | null;
  created: MarketPlaylist[] | null;
  subscribed: MarketPlaylist[] | null;
  albums: ArtistAlbum[] | null;
}

export interface ListSnapshot {
  items: MarketPlaylist[];
  offset: number;
  hasMore: boolean;
}

interface MarketSessionState {
  mineData: MineDataState;
  listSnapshots: Record<string, ListSnapshot>;

  setMineData: (data: MineDataState | ((prev: MineDataState) => MineDataState)) => void;
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
        albums: null,
      },
      listSnapshots: {},

      setMineData: (data) =>
        set((state) => ({
          mineData: typeof data === "function" ? data(state.mineData) : data,
        })),

      saveListSnapshot: (key, snapshot) =>
        set((state) => ({
          listSnapshots: {
            ...state.listSnapshots,
            [key]: snapshot,
          },
        })),

      clearSession: () =>
        set({
          mineData: { recommend: null, created: null, subscribed: null, albums: null },
          listSnapshots: {},
        }),
    }),
    {
      name: "market-session-storage",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        mineData: state.mineData,
        listSnapshots: state.listSnapshots,
      }),
    }
  )
);
