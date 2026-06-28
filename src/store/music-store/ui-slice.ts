import type { StateCreator } from "zustand";
import type { MusicState } from "./types";
import {
  DEFAULT_SOURCE_CONFIGS,
  type MusicSource,
  type SourceConfig,
} from "@/types/music";

export type FullScreenBackgroundMode = "theme" | "cover" | "texture";

export interface AutoMatchContext {
  index: number;
  tried: Set<MusicSource>;
}

export interface UiSlice {
  quality: string;
  searchSource: MusicSource;
  sourceConfigs: SourceConfig[];
  lastPlaylistCategory: string;
  lastMineTab: "recommend" | "created" | "subscribed" | "albums";
  lastFeaturedTab: string;
  enableAutoMatch: boolean;
  autoMatchFavorites: boolean;
  autoMatchPlaylists: boolean;
  autoMatchContext: AutoMatchContext | null;
  bilibiliKeepOriginalMeta: boolean;
  bilibiliAutoMatchSuffix: string;
  fullScreenBackgroundMode: FullScreenBackgroundMode;
  showSourceBadge: boolean;
  playbackSpeed: number;
  isFullScreenPlayer: boolean;
  setQuality: (quality: string) => void;
  setSearchSource: (source: MusicSource) => void;
  setSourceConfigs: (configs: SourceConfig[]) => void;
  setLastPlaylistCategory: (category: string) => void;
  setLastMineTab: (
    tab: "recommend" | "created" | "subscribed" | "albums"
  ) => void;
  setLastFeaturedTab: (tab: string) => void;
  setEnableAutoMatch: (enable: boolean) => void;
  setAutoMatchFavorites: (enable: boolean) => void;
  setAutoMatchPlaylists: (enable: boolean) => void;
  setAutoMatchContext: (ctx: AutoMatchContext | null) => void;
  setBilibiliKeepOriginalMeta: (enable: boolean) => void;
  setBilibiliAutoMatchSuffix: (suffix: string) => void;
  setFullScreenBackgroundMode: (mode: FullScreenBackgroundMode) => void;
  setShowSourceBadge: (show: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsFullScreenPlayer: (isFullScreen: boolean) => void;
}

export const createUiSlice: StateCreator<MusicState, [], [], UiSlice> = (
  set
) => ({
  quality: "192",
  searchSource: "all",
  sourceConfigs: DEFAULT_SOURCE_CONFIGS,
  lastPlaylistCategory: "全部",
  lastMineTab: "recommend",
  lastFeaturedTab: "",
  enableAutoMatch: true,
  autoMatchFavorites: false,
  autoMatchPlaylists: true,
  autoMatchContext: null,
  bilibiliKeepOriginalMeta: false,
  bilibiliAutoMatchSuffix: "高音质 原曲",
  fullScreenBackgroundMode: "theme",
  showSourceBadge: true,
  playbackSpeed: 1.0,
  isFullScreenPlayer: false,
  setQuality: (quality) => set({ quality }),
  setSearchSource: (searchSource) => set({ searchSource }),
  setSourceConfigs: (sourceConfigs) => set({ sourceConfigs }),
  setLastPlaylistCategory: (lastPlaylistCategory) =>
    set({ lastPlaylistCategory }),
  setLastMineTab: (lastMineTab) => set({ lastMineTab }),
  setLastFeaturedTab: (lastFeaturedTab) => set({ lastFeaturedTab }),
  setEnableAutoMatch: (enableAutoMatch) => set({ enableAutoMatch }),
  setAutoMatchFavorites: (autoMatchFavorites) => set({ autoMatchFavorites }),
  setAutoMatchPlaylists: (autoMatchPlaylists) => set({ autoMatchPlaylists }),
  setAutoMatchContext: (autoMatchContext) => set({ autoMatchContext }),
  setBilibiliKeepOriginalMeta: (bilibiliKeepOriginalMeta) =>
    set({ bilibiliKeepOriginalMeta }),
  setBilibiliAutoMatchSuffix: (bilibiliAutoMatchSuffix) =>
    set({ bilibiliAutoMatchSuffix }),
  setFullScreenBackgroundMode: (fullScreenBackgroundMode) =>
    set({ fullScreenBackgroundMode }),
  setShowSourceBadge: (showSourceBadge) => set({ showSourceBadge }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setIsFullScreenPlayer: (isFullScreenPlayer) => set({ isFullScreenPlayer }),
});
