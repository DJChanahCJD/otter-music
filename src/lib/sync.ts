import { useSyncStore } from "@/store/sync-store";
import { useMusicStore } from "@/store/music-store";
import { syncCheck, syncPull, syncPush } from "@/lib/api/sync";
import type { MusicTrack, Playlist } from "@/types/music";
import toast from "react-hot-toast";

type SyncData = {
  favorites: MusicTrack[];
  playlists: Playlist[];
};

function getSyncData(): SyncData {
  const state = useMusicStore.getState();
  return {
    favorites: state.favorites,
    playlists: state.playlists,
  };
}

function applySyncData(data: SyncData): void {
  useMusicStore.setState({
    favorites: data.favorites,
    playlists: data.playlists,
  });
}

type SyncResult = { success: boolean; error?: string; skipped?: boolean };

const SYNC_DIFF_MS = 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeTrack(input: unknown): MusicTrack | null {
  if (!isRecord(input)) return null;

  const id = input.id;
  const name = input.name;
  const artist = input.artist;
  const album = input.album;
  const pic_id = input.pic_id;
  const url_id = input.url_id;
  const lyric_id = input.lyric_id;
  const source = input.source;

  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof album !== "string" ||
    typeof pic_id !== "string" ||
    typeof url_id !== "string" ||
    typeof lyric_id !== "string" ||
    typeof source !== "string"
  ) {
    return null;
  }

  const artists = Array.isArray(artist)
    ? artist.filter((a): a is string => typeof a === "string")
    : [];

  return {
    id,
    name,
    artist: artists,
    album,
    pic_id,
    url_id,
    lyric_id,
    source: source as MusicTrack["source"],
  };
}

function sanitizePlaylist(input: unknown): Playlist | null {
  if (!isRecord(input)) return null;

  const id = input.id;
  const name = input.name;
  const createdAt = input.createdAt;
  const tracks = input.tracks;

  if (typeof id !== "string" || typeof name !== "string") return null;

  const safeTracks = Array.isArray(tracks)
    ? tracks.map(sanitizeTrack).filter((t): t is MusicTrack => Boolean(t))
    : [];

  return {
    id,
    name,
    tracks: safeTracks,
    createdAt: typeof createdAt === "number" && Number.isFinite(createdAt) ? createdAt : 0,
  };
}

function sanitizeSyncData(input: unknown): SyncData {
  if (!isRecord(input)) {
    return { favorites: [], playlists: [] };
  }

  const favorites = input.favorites;
  const playlists = input.playlists;

  const safeFavorites = Array.isArray(favorites)
    ? favorites.map(sanitizeTrack).filter((t): t is MusicTrack => Boolean(t))
    : [];

  const safePlaylists = Array.isArray(playlists)
    ? playlists.map(sanitizePlaylist).filter((p): p is Playlist => Boolean(p))
    : [];

  return { favorites: safeFavorites, playlists: safePlaylists };
}

/**
 * 执行同步检查并同步数据
 * - 服务器更新时间 > 本地：拉取并覆盖本地
 * - 服务器更新时间 <= 本地：推送本地数据到服务器
 * - 时间相同且未超过1小时：跳过同步
 */
export async function checkAndSync(): Promise<SyncResult> {
  const cleanedLocalData = sanitizeSyncData(getSyncData());
  applySyncData(cleanedLocalData);

  const { syncKey, lastSyncTime: localLastSyncTime } = useSyncStore.getState();

  if (!syncKey) {
    return { success: false, error: "未配置同步密钥" };
  }

  try {
    const checkResult = await syncCheck(syncKey);
    const serverLastSyncTime = checkResult.lastSyncTime;

    // 如果服务器和本地时间相同，且距离现在不到60分钟，跳过同步
    if (serverLastSyncTime === localLastSyncTime && localLastSyncTime > 0) {
      const timeSinceSync = Date.now() - serverLastSyncTime;
      if (timeSinceSync < SYNC_DIFF_MS) {
        return { success: true, skipped: true };
      }
    }

    if (serverLastSyncTime > localLastSyncTime) {
      const pullResult = await syncPull(syncKey);
      applySyncData(sanitizeSyncData(pullResult.data));
      useSyncStore.getState().setLastSyncTime(pullResult.lastSyncTime);
      toast.success("检测到新数据，已自动同步");
      return { success: true };
    }

    try {
      const pushResult = await syncPush(syncKey, cleanedLocalData, localLastSyncTime);
      useSyncStore.getState().setLastSyncTime(pushResult.lastSyncTime);
      toast.success("数据已自动同步");
      return { success: true };
    } catch (pushError) {
      if (pushError instanceof Error && pushError.message.includes("409")) {
        const pullResult = await syncPull(syncKey);
        applySyncData(sanitizeSyncData(pullResult.data));
        useSyncStore.getState().setLastSyncTime(pullResult.lastSyncTime);
        return { success: true };
      }
      throw pushError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "数据同步失败";
    return { success: false, error: errorMessage };
  }
}
