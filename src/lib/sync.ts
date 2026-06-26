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
export type SyncResult = {
  success: boolean;
  error?: string;
  skipped?: boolean;
};

const SYNC_INTERVAL = 60 * 60 * 1000; // 1小时节流

/** --- 原子快照操作 --- */
const getSnapshot = (): SyncSnapshot => {
  const { favorites, playlists } = useMusicStore.getState();
  return {
    favorites: favorites.map(cleanTrack),
    playlists: playlists.map((p) => ({
      ...p,
      tracks: p.tracks.map(cleanTrack),
    })),
  };
};

const applySnapshot = (data: SyncSnapshot) => {
  useMusicStore.setState({
    favorites: data.favorites ?? [],
    playlists: data.playlists ?? [],
  });
};

/** LWW 合并：相同 id 保留 update_time 更大的版本，新增条目排在前 */
function mergeTracks<T extends { id: string; update_time?: number }>(
  server: T[],
  client: T[]
): T[] {
  const map = new Map<string, T>(server.map((item) => [item.id, item]));
  for (const c of client) {
    const s = map.get(c.id);
    if (!s || (c.update_time ?? 0) >= (s.update_time ?? 0)) map.set(c.id, c);
  }
  const serverIds = new Set(server.map((i) => i.id));
  return [
    ...client.filter((c) => !serverIds.has(c.id)).map((c) => map.get(c.id)!),
    ...server.map((s) => map.get(s.id)!),
  ];
}

/** 合并两个全量快照（服务端为 base，本地变更合入） */
function mergeSnapshots(
  server: SyncSnapshot,
  local: SyncSnapshot
): SyncSnapshot {
  return {
    favorites: mergeTracks(server.favorites, local.favorites),
    playlists: server.playlists.map((sp) => {
      const lp = local.playlists.find((p) => p.id === sp.id);
      if (!lp || (sp.update_time ?? 0) >= (lp.update_time ?? 0)) return sp;
      return { ...lp, tracks: mergeTracks(sp.tracks, lp.tracks) };
    }),
  };
}

/**
 * 数据同步 (V3: 乐观锁)
 * - 本地节流：非强制同步且 1 小时内已同步，直接跳过
 * - POST 推拉一体 + 乐观锁（version），失败不覆盖本地数据
 * - 409 冲突时先 pull 再合并重试
 */
export async function checkAndSync(force = false): Promise<SyncResult> {
  const {
    syncKey,
    lastSyncTime,
    version,
    setLastSyncTime,
    setVersion,
    clearSyncConfig,
  } = useSyncStore.getState();
  if (!syncKey) return { success: false, error: "未配置同步密钥" };

  // 本地节流：非强制同步且本地最近刚同步过（1小时内），直接跳过，无需网络请求
  if (!force && lastSyncTime > 0 && Date.now() - lastSyncTime < SYNC_INTERVAL) {
    return { success: true, skipped: true };
  }

  try {
    // 一趟式 Push & Pull，后端执行 LWW 合并后返回权威全量数据
    const response = await syncPushAndPull<SyncSnapshot>(
      syncKey,
      getSnapshot(),
      version
    );

    // 无条件信任服务端合并后的权威结果
    applySnapshot(response.data);
    setLastSyncTime(response.lastSyncTime);
    setVersion(response.version);

    toast.success(
      response.lastSyncTime > lastSyncTime ? "已同步云端新数据" : "同步成功"
    );
    return { success: true };
  } catch (err) {
    // 404：syncKey 不存在或已删除
    if (err instanceof ApiError && err.status === 404) {
      clearSyncConfig();
      toast.error("同步密钥不存在或已失效");
      return { success: false, error: "密钥失效" };
    }

    // 409：乐观锁冲突，云端有更新版本 → pull + 合并 + 重试
    if (err instanceof ApiError && err.status === 409) {
      try {
        const pullRes = await syncPull<SyncSnapshot>(syncKey);
        if (pullRes.data) {
          const merged = mergeSnapshots(pullRes.data, getSnapshot());
          const retryRes = await syncPushAndPull<SyncSnapshot>(
            syncKey,
            merged,
            pullRes.version
          );
          applySnapshot(retryRes.data);
          setLastSyncTime(retryRes.lastSyncTime);
          setVersion(retryRes.version);
          toast.success("同步成功");
          return { success: true };
        }
      } catch {
        // pull 或重试失败，保持本地数据不变
      }
    }

    // POST 失败 → 服务端状态未知，不覆盖本地数据
    logger.error("Sync", "Sync failed", err);
    toast.error("网络超时，请稍后重试");
    return { success: false, error: "网络超时" };
  }
}
