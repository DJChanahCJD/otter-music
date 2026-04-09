// 不应该转发的请求头（敏感信息）
export const BLOCKED_HEADERS = [
  "host",
  "cookie",
  "authorization",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "te",
  "trailer",
  "upgrade",
  "proxy-authorization",
  "proxy-authenticate",
];

// 只允许转发的响应头
export const ALLOWED_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "content-encoding",
  "cache-control",
  "etag",
  "last-modified",
  "accept-ranges",
  "content-range",
  "expires",
  "pragma",
  "location",
  "access-control-allow-origin",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-expose-headers",
  "access-control-allow-credentials",
  "access-control-max-age",
  "vary",
];

/**
 * 过滤请求头，移除敏感信息
 */
export function filterRequestHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!BLOCKED_HEADERS.includes(key.toLowerCase())) {
      result[key] = value;
    }
  });
  return result;
}

/**
 * 过滤响应头，只转发安全的头
 */
export function filterResponseHeaders(headers: Headers): Headers {
  const newHeaders = new Headers();
  headers.forEach((value, key) => {
    if (ALLOWED_RESPONSE_HEADERS.includes(key.toLowerCase())) {
      newHeaders.set(key, value);
    }
  });
  return newHeaders;
}
