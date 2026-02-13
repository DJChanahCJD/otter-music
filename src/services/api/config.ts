import { type ApiResponse } from "@/types/index";

export const API_URL = localStorage.getItem('API_URL') || "https://otterhub.411130.xyz";

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