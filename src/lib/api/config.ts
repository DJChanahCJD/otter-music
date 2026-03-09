import { type ApiResponse } from "@/types/index";

export const API_URL = "https://otter-music-web.pages.dev";
export const API_TIMEOUT_MS = 10000;
export const MUSIC_API_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

export const DEFAULT_MUSIC_API_URL = "https://music-api.gdstudio.xyz/api.php";
export const MY_PROXY_MUSIC_API_URL = `${API_URL}/music-api`;

const STORAGE_KEY_MUSIC_URLS = "otter_music_api_urls";
const STORAGE_KEY_MUSIC_URL_FAILURES = "otter_music_api_url_failures";

/**
 * 统一处理后端响应
 */
export async function unwrap<T>(resOrPromise: Response | Promise<Response>): Promise<T> {
  const res = await resOrPromise;
  if (!res.ok) throw new Error(await res.text());

  const { success, message, data } = (await res.json()) as ApiResponse<T>;
  if (!success) throw new Error(message || '请求失败');

  return data as T;
}

/**
 * 通用 Storage 读写封装
 */
const getStorage = <T>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};
const setStorage = (key: string, val: unknown) => localStorage.setItem(key, JSON.stringify(val));

/**
 * API 地址管理
 */
export const getMusicApiUrls = () => 
  getStorage<string[]>(STORAGE_KEY_MUSIC_URLS, [MY_PROXY_MUSIC_API_URL, DEFAULT_MUSIC_API_URL]);

export const setMusicApiUrls = (urls: string[]) => setStorage(STORAGE_KEY_MUSIC_URLS, urls);

/**
 * 失效节点管理
 */
const getActiveFailures = (now = Date.now()) => {
  const map = getStorage<Record<string, number>>(STORAGE_KEY_MUSIC_URL_FAILURES, {});
  // 清理已过期的记录
  Object.keys(map).forEach(url => map[url] <= now && delete map[url]);
  return map;
};

export function getOrderedMusicApiUrls(now = Date.now()): string[] {
  const urls = getMusicApiUrls();
  const fails = getActiveFailures(now);
  setStorage(STORAGE_KEY_MUSIC_URL_FAILURES, fails); // 同步清理后的状态

  return [
    ...urls.filter(url => !fails[url]), // 正常的优先
    ...urls.filter(url => fails[url])   // 冷却中的垫底
  ];
}

export const getMusicApiUrl = () => getOrderedMusicApiUrls()[0] || DEFAULT_MUSIC_API_URL;

export const markMusicApiUrlFailure = (url: string, now = Date.now()) => 
  setStorage(STORAGE_KEY_MUSIC_URL_FAILURES, { 
    ...getActiveFailures(now), 
    [url]: now + MUSIC_API_FAILURE_COOLDOWN_MS 
  });

export const markMusicApiUrlSuccess = (url: string, now = Date.now()) => {
  const fails = getActiveFailures(now);
  if (fails[url]) {
    delete fails[url];
    setStorage(STORAGE_KEY_MUSIC_URL_FAILURES, fails);
  }
};

/**
 * 带超时的 Fetch
 */
export function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeout = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  return fetch(input, { ...init, signal: controller.signal })
    .finally(() => window.clearTimeout(timer));
}

export function getProxyUrl(url: string) {
  return `${API_URL}/proxy?url=${encodeURIComponent(url)}`;
}

/**
 * 判断当前 URL 是否已经是代理 URL，防止死循环
 */
export function isProxyUrl(url: string): boolean {
  return url.includes(`${API_URL}/proxy?url=`);
}