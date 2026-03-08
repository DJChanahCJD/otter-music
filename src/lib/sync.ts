import toast from "react-hot-toast";
import { useSyncStore } from "@/store/sync-store";
import { useMusicStore, usePodcastStore } from "@/store";
import { syncCheck, syncPull, syncPush } from "@/lib/api/sync";
import { MusicTrack, Playlist } from "@/types/music";
import { PodcastRssSource } from "@/types/podcast";

/** --- 类型定义 --- */
type SyncSnapshot = { favorites: MusicTrack[]; playlists: Playlist[]; podcasts: PodcastRssSource[] };
export type SyncResult = { success: boolean; error?: string; skipped?: boolean };

const SYNC_INTERVAL = 60 * 60 * 1000; // 1小时节流

/** --- 原子快照操作 --- */
const getSnapshot = (): SyncSnapshot => {
  const { favorites, playlists } = useMusicStore.getState();
  const { rssSources } = usePodcastStore.getState();
  return { favorites, playlists, podcasts: rssSources };
};

const applySnapshot = (data: SyncSnapshot) => {
  useMusicStore.setState({
    favorites: data.favorites ?? [],
    playlists: data.playlists ?? [],
  });
  if (Array.isArray(data.podcasts)) {
    usePodcastStore.setState({ rssSources: data.podcasts });
  }
};

/**
 * 数据同步 (Thin Client 模式)
 * 极简逻辑：获取云端版本 -> 盲推本地快照(服务端合并) -> 拉取权威结果覆盖本地
 */
export async function checkAndSync(force = false): Promise<SyncResult> {
  const { syncKey, lastSyncTime, setLastSyncTime } = useSyncStore.getState();
  if (!syncKey) return { success: false, error: "未配置同步密钥" };

  try {
    // 1. 获取云端最新版本号
    const { lastSyncTime: serverTime } = await syncCheck(syncKey);

    // 2. 节流：非强制同步，且云端没有新数据，且本地最近刚同步过，则跳过
    if (!force && serverTime === lastSyncTime && lastSyncTime > 0) {
      if (Date.now() - serverTime < SYNC_INTERVAL) return { success: true, skipped: true };
    }

    // 3. 盲推：把本地数据发给服务端，服务端会基于 update_time 进行 LWW 智能合并
    // (由于后端不再做版本拦截，这里传过去的版本号仅作记录或可省略)
    await syncPush(syncKey, getSnapshot(), lastSyncTime);

    // 4. 拉取：获取服务端完美合并及 GC 清理后的权威数据
    const { data, lastSyncTime: newTime } = await syncPull<SyncSnapshot>(syncKey);
    
    // 5. 覆盖：无条件信任服务端
    if (data) {
      applySnapshot(data);
      setLastSyncTime(newTime);
    }

    toast.success(serverTime > lastSyncTime ? "已同步云端新数据" : "同步成功");
    return { success: true };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "同步失败";
    toast.error(msg);
    return { success: false, error: msg };
  }
}