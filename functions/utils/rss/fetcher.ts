export const RSS_FETCH_TIMEOUT_MS = 8000;
const RSS_CACHE_TTL_SECONDS = 60 * 10;

export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml;q=0.9, */*;q=0.8',
        'user-agent': 'OtterMusic/2.0',
      },
      cf: { cacheTtl: RSS_CACHE_TTL_SECONDS, cacheEverything: true },
    } as any);
  } finally {
    clearTimeout(timer);
  }
}
