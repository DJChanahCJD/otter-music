import type { StateCreator } from "zustand";
import type { MusicState } from "./types";
import {
  DEFAULT_SOURCE_CONFIGS,
  type MusicSource,
  type SourceConfig,
} from "@/types/music";

export type FullScreenBackgroundMode = "theme" | "cover" | "texture";
export type LyricAlign = "center" | "left" | "right";

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
  lastBillboardGroup: "songs" | "albums" | "artists";
  /** 歌单广场常驻分类的自定义顺序；null 表示未自定义（使用默认序列） */
  playlistCategoryOrder: string[] | null;
  enableAutoMatch: boolean;
  autoMatchFavorites: boolean;
  autoMatchPlaylists: boolean;
  autoMatchContext: AutoMatchContext | null;
  enableProxyFallback: boolean;
  bilibiliKeepOriginalMeta: boolean;
  bilibiliAutoMatchSuffix: string;
  fullScreenBackgroundMode: FullScreenBackgroundMode;
  coverSize: number;
  coverRadius: number;
  showSourceBadge: boolean;
  lyricAlign: LyricAlign;
  lyricFontSize: number;
  lyricOffset: number;
  /** 蓝牙车载歌词：把当前歌词行覆写到 AVRCP 的 TITLE 上供车机显示 */
  carLyricEnabled: boolean;
  /** 桌面歌词：悬浮在其他应用上方的歌词条（Android 悬浮窗） */
  desktopLyricEnabled: boolean;
  /** 桌面歌词字号（单位 sp），默认与原生初始字号一致 */
  desktopLyricFontSize: number;
  /** 桌面歌词字色（hex，如 "#FFFFFF"），默认与原生初始颜色一致 */
  desktopLyricColor: string;
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
  setLastBillboardGroup: (group: "songs" | "albums" | "artists") => void;
  setPlaylistCategoryOrder: (order: string[]) => void;
  setEnableAutoMatch: (enable: boolean) => void;
  setAutoMatchFavorites: (enable: boolean) => void;
  setAutoMatchPlaylists: (enable: boolean) => void;
  setAutoMatchContext: (ctx: AutoMatchContext | null) => void;
  setEnableProxyFallback: (enable: boolean) => void;
  setBilibiliKeepOriginalMeta: (enable: boolean) => void;
  setBilibiliAutoMatchSuffix: (suffix: string) => void;
  setFullScreenBackgroundMode: (mode: FullScreenBackgroundMode) => void;
  setCoverSize: (size: number) => void;
  setCoverRadius: (radius: number) => void;
  setShowSourceBadge: (show: boolean) => void;
  setLyricAlign: (align: LyricAlign) => void;
  setLyricFontSize: (size: number) => void;
  setLyricOffset: (offset: number) => void;
  setCarLyricEnabled: (enable: boolean) => void;
  setDesktopLyricEnabled: (enable: boolean) => void;
  setDesktopLyricFontSize: (size: number) => void;
  setDesktopLyricColor: (color: string) => void;
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
  lastBillboardGroup: "songs",
  playlistCategoryOrder: null,
  enableAutoMatch: true,
  autoMatchFavorites: false,
  autoMatchPlaylists: true,
  autoMatchContext: null,
  enableProxyFallback: true,
  bilibiliKeepOriginalMeta: false,
  bilibiliAutoMatchSuffix: "高音质 原曲",
  fullScreenBackgroundMode: "theme",
  coverSize: 328,
  coverRadius: 24,
  showSourceBadge: true,
  lyricAlign: "left",
  lyricFontSize: 18,
  lyricOffset: -0.5,
  carLyricEnabled: false,
  desktopLyricEnabled: false,
  desktopLyricFontSize: 15,
  desktopLyricColor: "#FFFFFF",
  playbackSpeed: 1.0,
  isFullScreenPlayer: false,
  setQuality: (quality) => set({ quality }),
  setSearchSource: (searchSource) => set({ searchSource }),
  setSourceConfigs: (sourceConfigs) => set({ sourceConfigs }),
  setLastPlaylistCategory: (lastPlaylistCategory) =>
    set({ lastPlaylistCategory }),
  setLastMineTab: (lastMineTab) => set({ lastMineTab }),
  setLastFeaturedTab: (lastFeaturedTab) => set({ lastFeaturedTab }),
  setLastBillboardGroup: (lastBillboardGroup) => set({ lastBillboardGroup }),
  setPlaylistCategoryOrder: (playlistCategoryOrder) =>
    set({ playlistCategoryOrder }),
  setEnableAutoMatch: (enableAutoMatch) => set({ enableAutoMatch }),
  setAutoMatchFavorites: (autoMatchFavorites) => set({ autoMatchFavorites }),
  setAutoMatchPlaylists: (autoMatchPlaylists) => set({ autoMatchPlaylists }),
  setAutoMatchContext: (autoMatchContext) => set({ autoMatchContext }),
  setEnableProxyFallback: (enableProxyFallback) => set({ enableProxyFallback }),
  setBilibiliKeepOriginalMeta: (bilibiliKeepOriginalMeta) =>
    set({ bilibiliKeepOriginalMeta }),
  setBilibiliAutoMatchSuffix: (bilibiliAutoMatchSuffix) =>
    set({ bilibiliAutoMatchSuffix }),
  setFullScreenBackgroundMode: (fullScreenBackgroundMode) =>
    set({ fullScreenBackgroundMode }),
  setCoverSize: (coverSize) => set({ coverSize }),
  setCoverRadius: (coverRadius) => set({ coverRadius }),
  setShowSourceBadge: (showSourceBadge) => set({ showSourceBadge }),
  setLyricAlign: (lyricAlign) => set({ lyricAlign }),
  setLyricFontSize: (lyricFontSize) => set({ lyricFontSize }),
  setLyricOffset: (lyricOffset) => set({ lyricOffset }),
  setCarLyricEnabled: (carLyricEnabled) => set({ carLyricEnabled }),
  setDesktopLyricEnabled: (desktopLyricEnabled) => set({ desktopLyricEnabled }),
  setDesktopLyricFontSize: (desktopLyricFontSize) =>
    set({ desktopLyricFontSize }),
  setDesktopLyricColor: (desktopLyricColor) => set({ desktopLyricColor }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setIsFullScreenPlayer: (isFullScreenPlayer) => set({ isFullScreenPlayer }),
});
