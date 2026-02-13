import { mutate } from 'swr';

/* -------------------------------------------------- */
/* CacheStorage + SWR Persistence Utility */
/* -------------------------------------------------- */

const CACHE_NAME = 'otter-cache-v1';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000;

const now = () => Date.now();

/** 构造稳定 Request */
const req = (key: string) =>
  new Request(`https://cache.local/${encodeURIComponent(key)}`);

/** 写入磁盘缓存 */
async function saveToDisk<T>(key: string, data: T, ttl: number) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'x-expiry': String(now() + ttl)
      }
    });
    await cache.put(req(key), res);
  } catch (e) {
    console.warn('[Cache] Save failed', e);
  }
}

/** 从磁盘读取 */
async function getFromDisk<T>(key: string): Promise<{ data: T; expired: boolean } | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(req(key));
    if (!res) return null;

    const expiry = Number(res.headers.get('x-expiry') || 0);
    const data = await res.json() as T;
    return { data, expired: expiry < now() };
  } catch {
    return null;
  }
}

/**
 * 核心缓存函数 (基于 SWR 优化)
 * - 利用 SWR 的 mutate 实现请求去重 (Deduping)
 * - 利用 CacheStorage 实现持久化 (Persistence)
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T | null>,
  ttl: number = DEFAULT_TTL
): Promise<T | null> {
  // 1. 优先读磁盘
  const disk = await getFromDisk<T>(key);

  // 2. 如果命中且未过期，直接返回 (SWR 会在后台处理逻辑，这里保持简单)
  if (disk && !disk.expired) {
    return disk.data;
  }

  // 3. 未命中或已过期：利用 SWR 的 mutate 保证并发调用时 fetcher 只执行一次
  // revalidate: false 表示我们手动控制数据的写入
  const result = await mutate(key, async () => {
    const fresh = await fetcher();
    if (fresh !== null) {
      await saveToDisk(key, fresh, ttl);
    }
    return fresh;
  }, { revalidate: false });

  return result ?? null;
}
