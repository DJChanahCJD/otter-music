// functions/utils/cache.ts

/**
 * 缓存配置常量
 */
export const CACHE_CONFIG = {
  file: {
    maxAge: 86400 * 7,     // 7 天
  },
  thumb: {
    maxAge: 86400 * 1,     // 1 天
  },
  api: {
    maxAge: 3600,          // 1 小时
  },
};

const cacheName = 'otter-music-cache';


export function createCacheKey(request: Request): Request {
  const url = new URL(request.url);
  // 只缓存 GET
  return new Request(url.toString(), {
    method: "GET",
  });
}

export async function getFromCache(
  request: Request
): Promise<Response | null> {
  const cache = await caches.open(cacheName);
  const key = createCacheKey(request);
  return cache.match(key);
}

export async function putToCache(
  request: Request,
  response: Response,
  type: keyof typeof CACHE_CONFIG
) {
  if (!response.ok) return;

  const cache = await caches.open(cacheName);
  const key = createCacheKey(request);

  const maxAge = CACHE_CONFIG[type].maxAge;

  // Recreate response to ensure headers are mutable
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Cache-Control", `public, max-age=${maxAge}`);

  const cachedResp = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });

  await cache.put(key, cachedResp);
}

export async function deleteCache(request: Request) {
  const cache = await caches.open(cacheName);
  const key = createCacheKey(request);
  await cache.delete(key);
}