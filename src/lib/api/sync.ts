import { API_URL, fetchWithTimeout, unwrap } from "./config";

const SYNC_API_URL = `${API_URL}/sync/v2`;

export type SyncCheckResponse = { lastSyncTime: number };
// POST 和 GET 现在返回一致的结构；POST Level 1 短路时 data 为 null
export type SyncDataResponse<T> = { data: T | null; lastSyncTime: number };

const getHeaders = (syncKey: string): HeadersInit => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${syncKey}`,
});

export const syncCheck = (syncKey: string) =>
  unwrap<SyncCheckResponse>(fetchWithTimeout(`${SYNC_API_URL}/check`, { headers: getHeaders(syncKey) }));

/**
 * 拉取同步数据 (GET /sync/pull)
 */
export const syncPull = <T = unknown>(syncKey: string) =>
  unwrap<SyncDataResponse<T>>(fetchWithTimeout(`${SYNC_API_URL}/pull`, { headers: getHeaders(syncKey) }));

/**
 * 核心同步接口 (POST /sync)
 * 推送本地数据并直接获取服务端合并后的权威全量数据
 * clientVersion 为本地 lastSyncTime，服务端用于两级短路判断
 */
export const syncPushAndPull = <T = unknown>(syncKey: string, data: T, clientVersion?: number) =>
  unwrap<SyncDataResponse<T>>(
    fetchWithTimeout(`${SYNC_API_URL}`, {
      method: "POST",
      headers: getHeaders(syncKey),
      body: JSON.stringify({ data, ...(clientVersion !== undefined && { clientVersion }) }),
    })
  );