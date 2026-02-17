import { MY_API_URL, unwrap } from "./config";

const SYNC_API_URL = MY_API_URL;

export type SyncCheckResponse = {
  lastSyncTime: number;
};

export type SyncPullResponse = {
  data: unknown;
  lastSyncTime: number;
};

export type SyncPushResponse = {
  lastSyncTime: number;
};

function getAuthHeaders(syncKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${syncKey}`,
  };
}

/**
 * 检查同步状态
 */
export async function syncCheck(syncKey: string): Promise<SyncCheckResponse> {
  return unwrap<SyncCheckResponse>(
    fetch(`${SYNC_API_URL}/sync/check`, {
      method: "GET",
      headers: getAuthHeaders(syncKey),
    })
  );
}

/**
 * 拉取同步数据
 */
export async function syncPull(syncKey: string): Promise<SyncPullResponse> {
  return unwrap<SyncPullResponse>(
    fetch(`${SYNC_API_URL}/sync`, {
      method: "GET",
      headers: getAuthHeaders(syncKey),
    })
  );
}

/**
 * 推送同步数据
 */
export async function syncPush(
  syncKey: string,
  data: unknown,
  lastSyncTime: number
): Promise<SyncPushResponse> {
  return unwrap<SyncPushResponse>(
    fetch(`${SYNC_API_URL}/sync`, {
      method: "POST",
      headers: getAuthHeaders(syncKey),
      body: JSON.stringify({ data, lastSyncTime }),
    })
  );
}
