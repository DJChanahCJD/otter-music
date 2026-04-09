// functions/utils/proxy/index.ts
import { safeFetch } from "./fetch";

export * from "./headers";

/**
 * 统一代理 GET 请求入口
 * @param targetUrl 目标 URL
 * @param extraHeaders 额外的自定义请求头
 */
export async function proxyGet(
  targetUrl: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const url = new URL(targetUrl);

  const response = await safeFetch(targetUrl, {
    ...extraHeaders,
  });

  return response;
}

/**
 * 获取通用代理 URL
 */
export function getProxyUrl(origin: string, targetUrl: string) {
  return `${origin}/proxy?url=${encodeURIComponent(targetUrl)}`;
}