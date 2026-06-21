/**
 * Service Worker 缓存工具模块
 * 封装 `caches.open` 的查询与删除操作，所有方法失败时返回 false，避免业务逻辑崩溃。
 */

export const AUDIO_STREAM_CACHE_NAME = "audio-stream-cache";

const CACHE_CHECK_DELAY_MS = 500;

function isCacheStorageAvailable(): boolean {
  return typeof caches !== "undefined" && caches !== null;
}

/**
 * 判断指定缓存中是否包含某个 URL 对应的条目
 * @param cacheName 缓存名称
 * @param url 请求 URL（缓存 key）
 * @returns 存在有效响应时返回 true，否则 false
 */
export async function hasCacheEntry(
  cacheName: string,
  url: string
): Promise<boolean> {
  if (!isCacheStorageAvailable() || !url) return false;

  try {
    const cache = await caches.open(cacheName);
    const response = await cache.match(url);
    return response !== null;
  } catch {
    return false;
  }
}

/**
 * 删除指定缓存中的某个 URL 条目
 * @param cacheName 缓存名称
 * @param url 请求 URL（缓存 key）
 * @returns 删除成功或条目不存在时返回 true，异常时 false
 */
export async function deleteCacheEntry(
  cacheName: string,
  url: string
): Promise<boolean> {
  if (!isCacheStorageAvailable() || !url) return false;

  try {
    const cache = await caches.open(cacheName);
    await cache.delete(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 延迟一段时间后重新检查缓存条目
 * 用于 `canplaythrough` 触发时 SW 可能尚未完成缓存写入的场景
 * @param cacheName 缓存名称
 * @param url 请求 URL（缓存 key）
 * @param delayMs 延迟毫秒数，默认 500ms
 * @returns 重试后存在有效响应时返回 true，否则 false
 */
export async function hasCacheEntryAfterDelay(
  cacheName: string,
  url: string,
  delayMs = CACHE_CHECK_DELAY_MS
): Promise<boolean> {
  if (!isCacheStorageAvailable() || !url) return false;

  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return hasCacheEntry(cacheName, url);
}
