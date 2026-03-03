import { type ApiResponse } from "@/types/index";

// 统一 API 根路径
export const API_URL = "https://otter-music-web.pages.dev";
// 所有的音乐请求都走这个统一代理接口，不再从前端随机分流
export const MUSIC_API_URL = `${API_URL}/music-api`;

/**
 * 统一处理响应流：
 * 验证 HTTP 状态码 -> 验证业务 success 状态 -> 返回数据
 */
export async function unwrap<T>(resOrPromise: Response | Promise<Response>): Promise<T> {
  const res = await resOrPromise;
  
  if (!res.ok) {
    throw new Error(await res.text() || `HTTP Error: ${res.status}`);
  }

  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new Error(body.message || '请求失败');
  }

  return body.data as T;
}

/**
 * 获取当前的音乐 API 地址
 * 简化后直接返回统一代理地址，为后续 CF 端的逻辑分流做准备
 */
export function getMusicApiUrl(): string {
  return MUSIC_API_URL;
}