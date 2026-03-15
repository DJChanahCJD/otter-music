import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MarketPlaylist, ArtistAlbum } from "@/lib/netease/netease-types";

// 抽离初始状态，便于 clearSession 复用
const INITIAL_MINE_DATA: MineDataState = {
  recommend: null,
  created: null,
  subscribed: null,
  albums: null,
  hasMoreAlbums: true,
};

export interface MineDataState {
  recommend: MarketPlaylist[] | null;
  created: MarketPlaylist[] | null;
  subscribed: MarketPlaylist[] | null;
  albums: ArtistAlbum[] | null;
  hasMoreAlbums: boolean;
}

export interface ListSnapshot {
  items: MarketPlaylist[];
  offset: number;
  hasMore: boolean;
}

interface MarketSessionState {
  mineData: MineDataState;
  listSnapshots: Record<string, ListSnapshot>;
  setMineData: (data: Partial<MineDataState> | ((prev: MineDataState) => MineDataState)) => void;
  saveListSnapshot: (key: string, snapshot: ListSnapshot) => void;
  toggleAlbumInSession: (album: { id: string | number; name: string; picUrl: string; artistName?: string }, isSub: boolean) => void;
  clearSession: () => void;
}

export const useMarketSession = create<MarketSessionState>()(
  persist(
    (set) => ({
      mineData: INITIAL_MINE_DATA,
      listSnapshots: {},

      setMineData: (data) =>
        set((state) => ({
          mineData: typeof data === "function" 
            ? data(state.mineData) 
            : { ...state.mineData, ...data },
        })),

      saveListSnapshot: (key, snapshot) =>
        set((state) => ({
          listSnapshots: { ...state.listSnapshots, [key]: snapshot },
        })),

      toggleAlbumInSession: (album, isSub) =>
        set((state) => {
          const { albums } = state.mineData;
          if (!albums) return state;

          const newAlbums = isSub
            ? [
                {
                  id: Number(album.id),
                  name: album.name,
                  picUrl: album.picUrl,
                  artist: { name: album.artistName || "" },
                } as ArtistAlbum,
                ...albums,
              ]
            : albums.filter((a) => String(a.id) !== String(album.id));

          return {
            mineData: { ...state.mineData, albums: newAlbums },
          };
        }),

      clearSession: () => set({ mineData: INITIAL_MINE_DATA, listSnapshots: {} }),
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