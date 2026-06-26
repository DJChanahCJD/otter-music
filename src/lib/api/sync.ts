import { getApiUrl, fetchWithTimeout, unwrap } from "./config";

const syncUrl = () => `${getApiUrl()}/sync/v2`;

export type SyncCheckResponse = { lastSyncTime: number; version: number };
export type SyncDataResponse<T> = {
  data: T;
  lastSyncTime: number;
  version: number;
};

const getHeaders = (syncKey: string): HeadersInit => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${syncKey}`,
});

export const syncCheck = (syncKey: string) =>
  unwrap<SyncCheckResponse>(
    fetchWithTimeout(`${syncUrl()}/check`, { headers: getHeaders(syncKey) })
  );

/**
 * 拉取同步数据 (GET /sync/pull)
 */
export const syncPull = <T = unknown>(syncKey: string) =>
  unwrap<SyncDataResponse<T>>(
    fetchWithTimeout(`${syncUrl()}/pull`, { headers: getHeaders(syncKey) })
  );

/**
 * 核心同步接口 (POST /sync)
 * 推送本地数据并直接获取服务端合并后的权威全量数据
 * @param clientVersion 本地缓存的云端版本号，用于乐观锁校验
 */
export const syncPushAndPull = <T = unknown>(
  syncKey: string,
  data: T,
  clientVersion?: number
) =>
  unwrap<SyncDataResponse<T>>(
    fetchWithTimeout(`${syncUrl()}`, {
      method: "POST",
      headers: getHeaders(syncKey),
      body: JSON.stringify({ data, clientVersion }),
    })
  );
