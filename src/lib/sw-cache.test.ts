import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  AUDIO_STREAM_CACHE_NAME,
  hasCacheEntry,
  deleteCacheEntry,
  hasCacheEntryAfterDelay,
} from "./sw-cache";

describe("sw-cache", () => {
  let cacheStorageMock: Storage | null;
  const cacheMaps = new Map<string, Map<string, Response>>();

  const getCacheMap = (name: string) => {
    if (!cacheMaps.has(name)) {
      cacheMaps.set(name, new Map<string, Response>());
    }
    return cacheMaps.get(name)!;
  };

  const createCacheMock = (name: string) => {
    const cacheMap = getCacheMap(name);
    return {
      match: vi.fn(async (url: string) => cacheMap.get(url) || null),
      delete: vi.fn(async (url: string) => {
        const existed = cacheMap.has(url);
        cacheMap.delete(url);
        return existed;
      }),
      put: vi.fn(async (url: string, response: Response) => {
        cacheMap.set(url, response);
      }),
    };
  };

  beforeEach(() => {
    cacheMaps.clear();
    cacheStorageMock = {
      open: vi.fn(async (name: string) => createCacheMock(name)),
    } as unknown as Storage;

    Object.defineProperty(globalThis, "caches", {
      value: cacheStorageMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AUDIO_STREAM_CACHE_NAME matches sw.ts usage", () => {
    expect(AUDIO_STREAM_CACHE_NAME).toBe("audio-stream-cache");
  });

  it("hasCacheEntry returns true when cache contains the URL", async () => {
    const cache = await caches.open(AUDIO_STREAM_CACHE_NAME);
    await cache.put("https://example.com/song.mp3", new Response("audio"));

    await expect(
      hasCacheEntry(AUDIO_STREAM_CACHE_NAME, "https://example.com/song.mp3")
    ).resolves.toBe(true);
  });

  it("hasCacheEntry returns false when cache does not contain the URL", async () => {
    await expect(
      hasCacheEntry(AUDIO_STREAM_CACHE_NAME, "https://example.com/missing.mp3")
    ).resolves.toBe(false);
  });

  it("hasCacheEntry returns false when caches is undefined", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).caches = undefined;

    await expect(
      hasCacheEntry(AUDIO_STREAM_CACHE_NAME, "https://example.com/song.mp3")
    ).resolves.toBe(false);
  });

  it("hasCacheEntry returns false when caches.open throws", async () => {
    vi.mocked(cacheStorageMock!.open).mockRejectedValue(
      new Error("Storage access denied")
    );

    await expect(
      hasCacheEntry(AUDIO_STREAM_CACHE_NAME, "https://example.com/song.mp3")
    ).resolves.toBe(false);
  });

  it("deleteCacheEntry removes the cache entry", async () => {
    const cache = await caches.open(AUDIO_STREAM_CACHE_NAME);
    await cache.put("https://example.com/song.mp3", new Response("audio"));

    await expect(
      deleteCacheEntry(AUDIO_STREAM_CACHE_NAME, "https://example.com/song.mp3")
    ).resolves.toBe(true);

    await expect(
      hasCacheEntry(AUDIO_STREAM_CACHE_NAME, "https://example.com/song.mp3")
    ).resolves.toBe(false);
  });

  it("deleteCacheEntry returns false when caches is undefined", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).caches = undefined;

    await expect(
      deleteCacheEntry(AUDIO_STREAM_CACHE_NAME, "https://example.com/song.mp3")
    ).resolves.toBe(false);
  });

  it("deleteCacheEntry returns false when caches.open throws", async () => {
    vi.mocked(cacheStorageMock!.open).mockRejectedValue(
      new Error("Storage access denied")
    );

    await expect(
      deleteCacheEntry(AUDIO_STREAM_CACHE_NAME, "https://example.com/song.mp3")
    ).resolves.toBe(false);
  });

  it("hasCacheEntryAfterDelay retries after default delay", async () => {
    vi.useFakeTimers();
    const cache = await caches.open(AUDIO_STREAM_CACHE_NAME);

    // 第一次检查无缓存，延迟后写入缓存
    const promise = hasCacheEntryAfterDelay(
      AUDIO_STREAM_CACHE_NAME,
      "https://example.com/song.mp3"
    );

    await vi.advanceTimersByTimeAsync(250);
    await cache.put("https://example.com/song.mp3", new Response("audio"));
    await vi.advanceTimersByTimeAsync(300);

    await expect(promise).resolves.toBe(true);
    vi.useRealTimers();
  });

  it("hasCacheEntryAfterDelay returns false when cache stays empty", async () => {
    vi.useFakeTimers();

    const promise = hasCacheEntryAfterDelay(
      AUDIO_STREAM_CACHE_NAME,
      "https://example.com/song.mp3"
    );
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBe(false);
    vi.useRealTimers();
  });

  it("handles empty URL gracefully", async () => {
    await expect(hasCacheEntry(AUDIO_STREAM_CACHE_NAME, "")).resolves.toBe(
      false
    );
    await expect(deleteCacheEntry(AUDIO_STREAM_CACHE_NAME, "")).resolves.toBe(
      false
    );
  });
});
