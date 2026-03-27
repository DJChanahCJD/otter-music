import { MusicSource, MusicTrack } from "@/types/music";
import { getOrderedMusicApiUrls, markMusicApiUrlFailure, markMusicApiUrlSuccess } from "../api/config";
import { RawApiTrack } from "./types";
import { logger } from "@/lib/logger";

const REQUEST_TIMEOUT_MS = 10000;

export const forceHttps = (url: string | undefined | null) => {
  if (!url) return '';
  return url.replace(/^http:\/\//i, 'https://');
};

export const normalizeTrack = (t: RawApiTrack, source: MusicSource): MusicTrack => ({
  id: String(t.id),
  name: t.name,
  artist: Array.isArray(t.artist) ? t.artist : [t.artist],
  album: t.album,
  pic_id: forceHttps(t.pic_id),
  url_id: forceHttps(t.url_id),
  lyric_id: forceHttps(t.lyric_id),
  source,
  artist_ids: t.artist_ids,
  album_id: t.album_id,
});

export const cookieOf = (source: string) => localStorage.getItem(`cookie:${source.replace('_album', '')}`);

export const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';

export const buildUrl = (
  apiBase: string,
  params: Record<string, string | number | undefined>,
  source?: MusicSource
) => {
  const search = new URLSearchParams();

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) search.set(k, String(v));
  }

  if (source) {
    search.set('source', source);
    const cookie = cookieOf(source);
    if (cookie) search.set('cookie', cookie);
  }

  return `${apiBase}?${search.toString()}`;
};

export async function requestJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (e) {
    if (isAbort(e)) throw e;
    logger.error("music-provider", `Request failed: ${url}`, e);
    throw e;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function requestMusicApiJSON<T>(
  params: Record<string, string | number | undefined>,
  source: MusicSource,
  signal?: AbortSignal
): Promise<T> {
  const apiBases = getOrderedMusicApiUrls();
  let lastError: unknown;

  for (const apiBase of apiBases) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    const url = buildUrl(apiBase, params, source);
    try {
      const result = await requestJSON<T>(url, signal);
      markMusicApiUrlSuccess(apiBase);
      return result;
    } catch (e) {
      if (isAbort(e)) throw e;
      markMusicApiUrlFailure(apiBase);
      lastError = e;
    }
  }

  throw lastError ?? new Error('No available music API endpoint');
}
