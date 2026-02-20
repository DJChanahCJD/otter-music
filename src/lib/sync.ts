import { useSyncStore } from "@/store/sync-store";
import { useMusicStore } from "@/store/music-store";
import { syncCheck, syncPull, syncPush } from "@/lib/api/sync";
import toast from "react-hot-toast";

type SyncData = {
  favorites: ReturnType<typeof useMusicStore.getState>["favorites"];
  playlists: ReturnType<typeof useMusicStore.getState>["playlists"];
  queue: ReturnType<typeof useMusicStore.getState>["queue"];
  currentIndex: ReturnType<typeof useMusicStore.getState>["currentIndex"];
  volume: ReturnType<typeof useMusicStore.getState>["volume"];
  isRepeat: ReturnType<typeof useMusicStore.getState>["isRepeat"];
  isShuffle: ReturnType<typeof useMusicStore.getState>["isShuffle"];
  currentAudioTime: ReturnType<typeof useMusicStore.getState>["currentAudioTime"];
  quality: ReturnType<typeof useMusicStore.getState>["quality"];
  searchSource: ReturnType<typeof useMusicStore.getState>["searchSource"];
};

function getSyncData(): SyncData {
  const state = useMusicStore.getState();
  return {
    favorites: state.favorites,
    playlists: state.playlists,
    queue: state.queue,
    currentIndex: state.currentIndex,
    volume: state.volume,
    isRepeat: state.isRepeat,
    isShuffle: state.isShuffle,
    currentAudioTime: state.currentAudioTime,
    quality: state.quality,
    searchSource: state.searchSource,
  };
}

function applySyncData(data: SyncData): void {
  useMusicStore.setState({
    favorites: data.favorites,
    playlists: data.playlists,
    queue: data.queue,
    currentIndex: data.currentIndex,
    volume: data.volume,
    isRepeat: data.isRepeat,
    isShuffle: data.isShuffle,
    currentAudioTime: data.currentAudioTime,
    quality: data.quality,
    searchSource: data.searchSource,
  });
}

type SyncResult = { success: boolean; error?: string; skipped?: boolean };

const SYNC_DIFF_MS = 60 * 60 * 1000;

/**
 * 执行同步检查并同步数据
 * - 服务器更新时间 > 本地：拉取并覆盖本地
 * - 服务器更新时间 <= 本地：推送本地数据到服务器
 * - 时间相同且未超过1小时：跳过同步
 */
export async function checkAndSync(): Promise<SyncResult> {
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
      applySyncData(pullResult.data as SyncData);
      useSyncStore.getState().setLastSyncTime(pullResult.lastSyncTime);
      return { success: true };
    }

    try {
      const syncData = getSyncData();
      const pushResult = await syncPush(syncKey, syncData, localLastSyncTime);
      useSyncStore.getState().setLastSyncTime(pushResult.lastSyncTime);
      toast.success("数据已自动同步");
      return { success: true };
    } catch (pushError) {
      if (pushError instanceof Error && pushError.message.includes("409")) {
        const pullResult = await syncPull(syncKey);
        applySyncData(pullResult.data as SyncData);
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
