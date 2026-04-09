import { API_URL, fetchWithTimeout, unwrap } from "./config";

const ADMIN_AUTH_URL = `${API_URL}/auth`;
const ADMIN_SYNC_URL = `${API_URL}/sync/v2`;

/** 带 credentials: include 的 fetch，用于管理端 Cookie 认证 */
const adminFetch = (input: RequestInfo | URL, init: RequestInit = {}) =>
  fetchWithTimeout(input, { ...init, credentials: "include" });

export interface SyncKeyItem {
  key: string;
  lastSyncTime: number;
}

/** 登录，成功后后端 Set-Cookie */
export const adminLogin = (password: string) =>
  unwrap<{ token: string }>(
    adminFetch(`${ADMIN_AUTH_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }),
  );

/** 登出，后端清除 Cookie */
export const adminLogout = () =>
  unwrap<null>(
    adminFetch(`${ADMIN_AUTH_URL}/logout`, { method: "POST" }),
  );

/** 列出所有 Sync Key */
export const adminListKeys = () =>
  unwrap<{ keys: SyncKeyItem[] }>(adminFetch(`${ADMIN_SYNC_URL}/keys`));

/** 创建新 Sync Key，prefix 可选 */
export const adminCreateKey = (prefix?: string) =>
  unwrap<{ syncKey: string }>(
    adminFetch(`${ADMIN_SYNC_URL}/create-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: prefix || undefined }),
    }),
  );

/** 删除指定 Sync Key */
export const adminDeleteKey = (key: string) =>
  unwrap<null>(
    adminFetch(`${ADMIN_SYNC_URL}/keys/${encodeURIComponent(key)}`, {
      method: "DELETE",
    }),
  );
