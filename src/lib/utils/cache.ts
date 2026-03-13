import { mutate } from 'swr';

const CACHE_NAME = 'otter-cache-v1';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000;
const STORAGE_PRESSURE_RATIO = 0.8;

const now = () => Date.now();
const req = (key: string) =>
  new Request(`https://cache.local/${encodeURIComponent(key)}`);

/** 写入磁盘缓存 */
async function saveToDisk<T>(key: string, data: T, ttl: number) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const ts = now();

    const res = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'x-expiry': String(ts + ttl),
        'x-created-at': String(ts)
      }
    });

    await cache.put(req(key), res);
  } catch (e) {
    console.warn('[Cache] Save failed', e);
  }
}

/** 从磁盘读取（含读时清理） */
async function getFromDisk<T>(key: string): Promise<T | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const request = req(key);
    const res = await cache.match(request);

    if (!res) return null;

    const isExpired = Number(res.headers.get('x-expiry') || 0) <= now();
    if (isExpired) {
      void cache.delete(request);
      return null;
    }

    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function isUnderStoragePressure() {
  try {
    if (!navigator.storage?.estimate) return false;
    const { usage, quota } = await navigator.storage.estimate();
    return !!usage && !!quota && usage / quota >= STORAGE_PRESSURE_RATIO;
  } catch {
    return false;
  }
}

/** 核心清理：始终删过期；只有在存储压力大时才删旧 */
export async function cleanupCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    const nowTime = now();

    const items: { request: Request; createdAt: number }[] = [];
    const expiredDeletes: Promise<boolean>[] = [];

    for (const request of requests) {
      const res = await cache.match(request);
      if (!res) continue;

      if (Number(res.headers.get('x-expiry') || 0) <= nowTime) {
        expiredDeletes.push(cache.delete(request));
        continue;
      }

      items.push({
        request,
        createdAt: Number(res.headers.get('x-created-at') || 0)
      });
    }

    if (expiredDeletes.length) {
      await Promise.all(expiredDeletes);
    }

    // 平时不做人为容量限制；只有在接近配额时才删一部分老数据
    if (await isUnderStoragePressure()) {
      items.sort((a, b) => a.createdAt - b.createdAt);
      const deleteCount = Math.ceil(items.length * 0.3); // 删最旧的 30%
      const toDelete = items.slice(0, deleteCount);
      await Promise.all(toDelete.map(item => cache.delete(item.request)));
    }
  } catch (e) {
    console.warn('[Cache] Prune failed', e);
  }
}

/** 核心请求函数 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T | null>,
  ttl: number = DEFAULT_TTL
): Promise<T | null> {
  const disk = await getFromDisk<T>(key);
  if (disk !== null) return disk;

  const result = await mutate(
    key,
    async () => {
      const fresh = await fetcher();
      if (fresh !== null) {
        await saveToDisk(key, fresh, ttl);
      }
      return fresh;
    },
    { revalidate: false }
  );

  return result ?? null;
}
