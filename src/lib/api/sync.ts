import { API_URL, unwrap } from "./config";

const SYNC_API_URL = `${API_URL}/sync`;

export type SyncCheckResponse = { lastSyncTime: number };
export type SyncPullResponse<T> = { data: T; lastSyncTime: number };
export type SyncPushResponse = { lastSyncTime: number };

const getHeaders = (syncKey: string): HeadersInit => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${syncKey}`,
});

export const syncCheck = (syncKey: string) =>
  unwrap<SyncCheckResponse>(fetch(`${SYNC_API_URL}/check`, { headers: getHeaders(syncKey) }));

// 引入泛型 <T>，调用时可传入具体类型
export const syncPull = <T = unknown>(syncKey: string) =>
  unwrap<SyncPullResponse<T>>(fetch(SYNC_API_URL, { headers: getHeaders(syncKey) }));

export const syncPush = <T = unknown>(syncKey: string, data: T, lastSyncTime: number) =>
  unwrap<SyncPushResponse>(
    fetch(SYNC_API_URL, {
      method: "POST",
      headers: getHeaders(syncKey),
      body: JSON.stringify({ data, lastSyncTime }),
    })
  );