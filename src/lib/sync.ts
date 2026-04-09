import toast from "react-hot-toast";
import { ApiError } from "@/lib/api/config";
import { useSyncStore } from "@/store/sync-store";
import { useMusicStore } from "@/store";
import { syncPull, syncPushAndPull } from "@/lib/api/sync";
import { MusicTrack, Playlist } from "@/types/music";
import { cleanTrack } from "@/lib/utils/music";
import { logger } from "./logger";

/** --- 类型定义 --- */
type SyncSnapshot = { favorites: MusicTrack[]; playlists: Playlist[] };
export type SyncResult = { success: boolean; error?: string; skipped?: boolean };

const SYNC_INTERVAL = 60 * 60 * 1000; // 1小时节流

/** --- 原子快照操作 --- */
const getSnapshot = (): SyncSnapshot => {
  const { favorites, playlists } = useMusicStore.getState();
  return {
    favorites: favorites.map(cleanTrack),
    playlists: playlists.map(p => ({ ...p, tracks: p.tracks.map(cleanTrack) })),
  };
};

const applySnapshot = (data: SyncSnapshot) => {
  useMusicStore.setState({
    favorites: data.favorites ?? [],
    playlists: data.playlists ?? [],
  });
};

/**
 * 数据同步 (V2: 一趟式同步)
 * - 本地节流：非强制同步且 1 小时内已同步，直接跳过
 * - POST 失败时 syncPull 兜底
 */
export async function checkAndSync(force = false): Promise<SyncResult> {
  const { syncKey, lastSyncTime, setLastSyncTime, clearSyncConfig } = useSyncStore.getState();
  if (!syncKey) return { success: false, error: "未配置同步密钥" };

  // 本地节流：非强制同步且本地最近刚同步过（1小时内），直接跳过，无需网络请求
  if (!force && lastSyncTime > 0 && Date.now() - lastSyncTime < SYNC_INTERVAL) {
    return { success: true, skipped: true };
  }

  try {
    // 一趟式 Push & Pull，后端执行 LWW 合并后返回权威全量数据
    const response = await syncPushAndPull<SyncSnapshot>(syncKey, getSnapshot());

    // 无条件信任服务端合并后的权威结果
    applySnapshot(response.data);
    setLastSyncTime(response.lastSyncTime);

    toast.success(response.lastSyncTime > lastSyncTime ? "已同步云端新数据" : "同步成功");
    return { success: true };

  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      clearSyncConfig();
      toast.error("同步密钥不存在或已失效");
      return { success: false, error: "密钥失效" };
    }

    // 兜底逻辑：POST 失败时尝试全量拉取一次
    logger.error("Sync", "Sync failed", err);
    try {
      const pullRes = await syncPull<SyncSnapshot>(syncKey);
      if (pullRes.data) {
        applySnapshot(pullRes.data);
        setLastSyncTime(pullRes.lastSyncTime);
        toast.success("已从云端恢复数据");
        return { success: true };
      }
    } catch {
      const msg = err instanceof Error ? err.message : "同步失败";
      toast.error(msg);
      return { success: false, error: msg };
    }
    return { success: false, error: "未知同步错误" };
  }
}