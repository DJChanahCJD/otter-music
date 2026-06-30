import {
  useMusicStore,
  type FullScreenBackgroundMode,
} from "@/store/music-store";
import { cleanTrack } from "@/lib/utils/music";
import { withMeta } from "@/store/music-store/shared";
import type {
  MusicTrack,
  Playlist,
  MusicSource,
  SourceConfig,
} from "@/types/music";

/** 备份数据版本号 */
const CURRENT_VERSION = 1;

/** 备份 JSON 顶层结构 */
interface BackupEnvelope {
  version: number;
  type: "otter-music-backup";
  exportedAt: number;
  data: BackupPayload;
}

/** 备份负载 —— 与 partialize 字段对齐 */
interface BackupPayload {
  favorites: MusicTrack[];
  playlists: Playlist[];
  volume: number;
  isRepeat: boolean;
  isShuffle: boolean;
  quality: string;
  searchSource: MusicSource;
  sourceConfigs: SourceConfig[];
  lastPlaylistCategory: string;
  lastMineTab: "recommend" | "created" | "subscribed" | "albums";
  lastFeaturedTab: string;
  enableAutoMatch: boolean;
  autoMatchFavorites: boolean;
  autoMatchPlaylists: boolean;
  bilibiliKeepOriginalMeta: boolean;
  bilibiliAutoMatchSuffix: string;
  fullScreenBackgroundMode: FullScreenBackgroundMode;
  showSourceBadge: boolean;
  downloadQuality: string;
  embedCover: boolean;
  embedLyric: boolean;
  downloadDirectory: string;
  sleepTimerDuration: number;
  playbackSpeed: number;
}

/** 校验成功结果 */
export interface ValidBackupResult {
  valid: true;
  data: BackupPayload;
  summary: { favoritesCount: number; playlistsCount: number };
}

/** 校验失败结果 */
export interface InvalidBackupResult {
  valid: false;
  error: string;
}

export type BackupValidationResult = ValidBackupResult | InvalidBackupResult;

/**
 * 过滤软删除项，清洗 track 数据
 */
function filterActive(tracks: MusicTrack[]): MusicTrack[] {
  return tracks.filter((t) => !t.is_deleted).map(cleanTrack);
}

/**
 * 从当前 Store 序列化全部持久化数据为 JSON 字符串
 */
export function serializeStoreData(): string {
  const state = useMusicStore.getState();

  const payload: BackupPayload = {
    favorites: filterActive(state.favorites),
    playlists: state.playlists
      .filter((p) => !p.is_deleted)
      .map((p) => ({
        ...p,
        tracks: filterActive(p.tracks),
      })),
    volume: state.volume,
    isRepeat: state.isRepeat,
    isShuffle: state.isShuffle,
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
  };

  const envelope: BackupEnvelope = {
    version: CURRENT_VERSION,
    type: "otter-music-backup",
    exportedAt: Date.now(),
    data: payload,
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * 校验 MusicTrack 基本结构
 */
function isValidTrack(t: unknown): t is MusicTrack {
  if (typeof t !== "object" || t === null) return false;
  const track = t as Record<string, unknown>;
  return (
    typeof track.id === "string" &&
    typeof track.name === "string" &&
    typeof track.source === "string"
  );
}

/**
 * 校验 Playlist 基本结构
 */
function isValidPlaylist(p: unknown): p is Playlist {
  if (typeof p !== "object" || p === null) return false;
  const pl = p as Record<string, unknown>;
  return (
    typeof pl.id === "string" &&
    typeof pl.name === "string" &&
    Array.isArray(pl.tracks)
  );
}

/**
 * 校验并解析备份 JSON 字符串
 * 成功时返回解析后的数据及预览摘要
 */
export function validateBackupData(raw: string): BackupValidationResult {
  if (!raw || !raw.trim()) {
    return { valid: false, error: "输入内容为空" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, error: "JSON 格式无效，请检查是否包含非法字符" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { valid: false, error: "数据格式不正确，应为 JSON 对象" };
  }

  const envelope = parsed as Record<string, unknown>;

  // 校验 version
  if (typeof envelope.version !== "number") {
    return { valid: false, error: "缺少或无效的版本号 (version)" };
  }
  if (envelope.version !== CURRENT_VERSION) {
    return {
      valid: false,
      error: `不支持的备份版本 ${envelope.version}，当前仅支持 v${CURRENT_VERSION}`,
    };
  }

  // 校验 type（可选但建议）
  if (envelope.type !== "otter-music-backup") {
    return { valid: false, error: "数据格式不匹配，缺少正确的 type 标识" };
  }

  // 校验 data
  const data = envelope.data;
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "缺少数据内容 (data)" };
  }

  const payload = data as Record<string, unknown>;

  // 校验 favorites
  const favorites = payload.favorites;
  if (favorites !== undefined && !Array.isArray(favorites)) {
    return { valid: false, error: "收藏数据 (favorites) 格式错误" };
  }

  // 校验 playlists
  const playlists = payload.playlists;
  if (playlists === undefined || !Array.isArray(playlists)) {
    return { valid: false, error: "歌单数据 (playlists) 缺失或格式错误" };
  }
  for (let i = 0; i < playlists.length; i++) {
    if (!isValidPlaylist(playlists[i])) {
      return {
        valid: false,
        error: `第 ${i + 1} 个歌单数据格式不正确`,
      };
    }
  }

  // 过滤无效 track
  const validFavorites = Array.isArray(favorites)
    ? favorites.filter(isValidTrack)
    : [];
  const validPlaylists = (playlists as unknown[]).map((p) => ({
    ...(p as Playlist),
    tracks: ((p as Playlist).tracks || []).filter(isValidTrack),
  }));

  return {
    valid: true,
    data: {
      ...(payload as unknown as BackupPayload),
      favorites: validFavorites,
      playlists: validPlaylists,
    },
    summary: {
      favoritesCount: validFavorites.length,
      playlistsCount: validPlaylists.length,
    },
  };
}

/**
 * 将备份数据写入 Store（全量替换）
 * 播放列表逐条创建以兼容 createPlaylist 逻辑
 */
export function importStoreData(payload: BackupPayload): void {
  const store = useMusicStore.getState();

  // 先清空现有歌单（软删除），再逐条创建新歌单
  for (const pl of store.playlists) {
    if (!pl.is_deleted) {
      store.deletePlaylist(pl.id);
    }
  }

  // 写入简单字段
  store.setFavorites(
    payload.favorites.map((t) => ({ ...withMeta(t), is_deleted: false }))
  );

  // 歌单：逐条创建并写入 tracks
  for (const pl of payload.playlists) {
    const newId = store.createPlaylist(pl.name, pl.coverUrl);
    store.setPlaylistTracks(
      newId,
      pl.tracks.map((t) => ({ ...withMeta(t), is_deleted: false }))
    );
  }

  // 播放设置
  useMusicStore.setState({
    volume: payload.volume ?? 1.0,
    isRepeat: payload.isRepeat ?? false,
    isShuffle: payload.isShuffle ?? false,
  });

  // UI 设置
  useMusicStore.setState({
    quality: payload.quality ?? "192",
    searchSource: payload.searchSource ?? "all",
    sourceConfigs: payload.sourceConfigs ?? [],
    lastPlaylistCategory: payload.lastPlaylistCategory ?? "全部",
    lastMineTab: payload.lastMineTab ?? "recommend",
    lastFeaturedTab: payload.lastFeaturedTab ?? "",
    enableAutoMatch: payload.enableAutoMatch ?? true,
    autoMatchFavorites: payload.autoMatchFavorites ?? false,
    autoMatchPlaylists: payload.autoMatchPlaylists ?? true,
    bilibiliKeepOriginalMeta: payload.bilibiliKeepOriginalMeta ?? false,
    bilibiliAutoMatchSuffix: payload.bilibiliAutoMatchSuffix ?? "高音质 原曲",
    fullScreenBackgroundMode: payload.fullScreenBackgroundMode ?? "theme",
    showSourceBadge: payload.showSourceBadge ?? true,
    playbackSpeed: payload.playbackSpeed ?? 1.0,
    downloadQuality: payload.downloadQuality ?? "320",
    embedCover: payload.embedCover ?? true,
    embedLyric: payload.embedLyric ?? true,
    downloadDirectory: payload.downloadDirectory ?? "",
    sleepTimerDuration: payload.sleepTimerDuration ?? 30,
  });
}
