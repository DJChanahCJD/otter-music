import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storeKey } from "../store-keys";
import { idbStorage } from "@/lib/storage-adapter";
import { cleanTrack } from "@/lib/utils/music";
import { cleanPlaylist } from "./shared";
import { DEFAULT_SOURCE_CONFIGS } from "@/types/music";

import { createFavoritesSlice } from "./favorites-slice";
import { createPlaylistSlice } from "./playlist-slice";
import { createPlaybackSlice } from "./playback-slice";
import { createSearchSlice } from "./search-slice";
import { createUiSlice } from "./ui-slice";
import { createDownloadSettingsSlice } from "./download-settings-slice";
import { createSleepTimerSlice } from "./sleep-timer-slice";

import type { MusicState } from "./types";

export type { MusicState } from "./types";
export type { FullScreenBackgroundMode } from "./ui-slice";

export const useMusicStore = create<MusicState>()(
  persist(
    (...a) => ({
      ...createFavoritesSlice(...a),
      ...createPlaylistSlice(...a),
      ...createPlaybackSlice(...a),
      ...createSearchSlice(...a),
      ...createUiSlice(...a),
      ...createDownloadSettingsSlice(...a),
      ...createSleepTimerSlice(...a),
    }),
    {
      name: storeKey.MusicStore,
      storage: createJSONStorage(() => idbStorage),
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<MusicState>) };
        // 合并 sourceConfigs：过滤已移除的音源，追加新增音源
        const validSources = new Set(
          DEFAULT_SOURCE_CONFIGS.map((c) => c.source)
        );
        state.sourceConfigs = state.sourceConfigs.filter((c) =>
          validSources.has(c.source)
        );
        const existingSources = new Set(
          state.sourceConfigs.map((c) => c.source)
        );
        const newConfigs = DEFAULT_SOURCE_CONFIGS.filter(
          (c) => !existingSources.has(c.source)
        );
        if (newConfigs.length > 0) {
          state.sourceConfigs = [...state.sourceConfigs, ...newConfigs];
        }
        return state;
      },
      partialize: (state) => ({
        favorites: state.favorites.map(cleanTrack),
        playlists: state.playlists.map(cleanPlaylist),
        queue: state.queue.map(cleanTrack),
        currentIndex: state.currentIndex,
        volume: state.volume,
        isRepeat: state.isRepeat,
        isShuffle: state.isShuffle,
        currentAudioTime: state.currentAudioTime,
        duration: state.duration,
        quality: state.quality,
        searchSource: state.searchSource,
        sourceConfigs: state.sourceConfigs,
        lastPlaylistCategory: state.lastPlaylistCategory,
        lastMineTab: state.lastMineTab,
        lastFeaturedTab: state.lastFeaturedTab,
        enableAutoMatch: state.enableAutoMatch,
        autoMatchFavorites: state.autoMatchFavorites,
        autoMatchPlaylists: state.autoMatchPlaylists,
        bilibiliKeepOriginalMeta: state.bilibiliKeepOriginalMeta,
        bilibiliAutoMatchSuffix: state.bilibiliAutoMatchSuffix,
        fullScreenBackgroundMode: state.fullScreenBackgroundMode,
        showSourceBadge: state.showSourceBadge,
        downloadQuality: state.downloadQuality,
        embedCover: state.embedCover,
        embedLyric: state.embedLyric,
        downloadDirectory: state.downloadDirectory,
        sleepTimerDuration: state.sleepTimerDuration,
        playbackSpeed: state.playbackSpeed,
      }),
    }
  )
);
