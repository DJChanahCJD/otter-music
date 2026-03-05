import toast from "react-hot-toast";
import { useSyncStore } from "@/store/sync-store";
import { useMusicStore } from "@/store";
import { syncCheck, syncPull, syncPush } from "@/lib/api/sync";
import { MusicTrack, Playlist } from "@/types/music";

/** --- 类型定义 --- */
type SyncSnapshot = { favorites: MusicTrack[]; playlists: Playlist[] };
export type SyncResult = { success: boolean; error?: string; skipped?: boolean };

const SYNC_INTERVAL = 60 * 60 * 1000; // 1小时节流

/** --- 原子快照操作 --- */
const getSnapshot = (): SyncSnapshot => {
  const { favorites, playlists } = useMusicStore.getState();
  return { favorites, playlists };
};

const applySnapshot = (data: SyncSnapshot) => useMusicStore.setState(data);

/**
 * 数据同步 (Thin Client 模式)
 * 逻辑：盲推本地快照 -> 服务端 LWW 合并 -> 拉取权威结果覆盖本地
 */
export async function checkAndSync(force = false): Promise<SyncResult> {
  const { syncKey, lastSyncTime: localTime, setLastSyncTime } = useSyncStore.getState();

  if (!syncKey) return { success: false, error: "未配置同步密钥" };

  try {
    const { lastSyncTime: serverTime } = await syncCheck(syncKey);

    // 1. 节流：非强制同步下，时间戳一致且在 1 小时内则跳过
    if (!force && serverTime === localTime && localTime > 0) {
      if (Date.now() - serverTime < SYNC_INTERVAL) return { success: true, skipped: true };
    }

    // 2. 推送本地快照 (服务端负责 LWW 合并)
    await syncPush(syncKey, getSnapshot(), localTime);

    // 3. 拉取并覆盖 (服务端合并后的权威数据)
    const { data, lastSyncTime: newTime } = await syncPull<SyncSnapshot>(syncKey);
    
    if (data) {
      applySnapshot(data);
      setLastSyncTime(newTime);
    }

    toast.success(serverTime > localTime ? "云端数据已更新" : "同步成功");
    return { success: true };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "同步失败";
    toast.error(msg);
    return { success: false, error: msg };
  }
}