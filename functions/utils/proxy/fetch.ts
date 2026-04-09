import { filterRequestHeaders } from "./headers";

/**
 * 安全的 fetch 实现，包含超时控制和 SSRF 检查
 */
export async function safeFetch(
  url: string,
  headers: Record<string, string>,
  timeout = 60000,
): Promise<Response> {
  if (!isValidUrl(url)) {
    throw new Error("Invalid or blocked URL. Private and local addresses are not allowed.");
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions: RequestInit = {
      method: "GET",
      headers: filterRequestHeaders(new Headers(headers)),
      redirect: "follow",
      signal: controller.signal,
    };

    return await fetch(url, fetchOptions);
  } finally {
    clearTimeout(id);
  }
}

/**
 * 验证 URL 是否合法
 * 防止 SSRF 攻击，阻止访问内网地址和非法协议
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // 只允许 http 和 https 协议
    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // 阻止访问 localhost 和回环地址
    const isLocalhost = [
      "localhost",
      "127.0.0.1",
      "[::1]",
      "0.0.0.0",
      "::",
    ].includes(hostname);

    // 阻止访问内网地址（私有 IP 范围）
    const isPrivateNetwork = [
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^127\./, // 127.0.0.0/8
      /^169\.254\./, // 169.254.0.0/16 (link-local)
    ].some((regex) => regex.test(hostname));

    // 阻止访问本地域名
    const isLocalDomain =
      hostname.endsWith(".local") ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".internal");

    if (isLocalhost || isPrivateNetwork || isLocalDomain) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}