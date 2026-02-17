import { type ApiResponse } from "@/types/index";

export const MY_API_URL = "https://otterhub.411130.xyz";

export const DEFAULT_API_URL = "https://music-api.gdstudio.xyz/api.php";
export const MY_PROXY_API_URL = `${MY_API_URL}/music-api`;
const STORAGE_KEY_URLS = "otter_api_urls";

export function getApiUrls(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_URLS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to parse API URLs", e);
  }
  return [DEFAULT_API_URL, MY_PROXY_API_URL];
}

export function setApiUrls(urls: string[]) {
  localStorage.setItem(STORAGE_KEY_URLS, JSON.stringify(urls));
}

export function getApiUrl(): string {
  const urls = getApiUrls();
  if (urls.length === 0) return DEFAULT_API_URL;
  return urls[Math.floor(Math.random() * urls.length)];
}

/**
 * 统一处理后端 ok / fail 响应
 * 支持传入 Response 对象或 Promise<Response>
 */
export async function unwrap<T>(resOrPromise: Response | Promise<Response>): Promise<T> {
  const res = await resOrPromise;
  
  if (!res.ok) {
    throw new Error(await res.text());
  }

  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new Error(body.message || '请求失败');
  }

  return body.data as T;
}