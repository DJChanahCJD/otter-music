import { type ApiResponse } from "@/types/index";

export const API_URL = "https://otter-music-web.pages.dev";

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

// 音乐 API 配置
export const DEFAULT_MUSIC_API_URL = "https://music-api.gdstudio.xyz/api.php";
export const MY_PROXY_MUSIC_API_URL = `${API_URL}/music-api`;
const STORAGE_KEY_MUSIC_URLS = "otter_music_api_urls";

export function getMusicApiUrls(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MUSIC_URLS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to parse music API URLs", e);
  }
  return [DEFAULT_MUSIC_API_URL, MY_PROXY_MUSIC_API_URL];
}

export function setMusicApiUrls(urls: string[]) {
  localStorage.setItem(STORAGE_KEY_MUSIC_URLS, JSON.stringify(urls));
}

export function getMusicApiUrl(): string {
  const urls = getMusicApiUrls();
  if (urls.length === 0) return DEFAULT_MUSIC_API_URL;
  return urls[Math.floor(Math.random() * urls.length)];
}