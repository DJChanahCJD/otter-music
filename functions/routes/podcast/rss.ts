import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../types/hono';
import { fetchWithTimeout, RSS_FETCH_TIMEOUT_MS } from '../../utils/rss/fetcher';
import { streamParseRss } from '../../utils/rss/parser';
import { getFromCache, putToCache } from '../../utils/cache';

export const rssRoutes = new Hono<{ Bindings: Env }>();

const querySchema = z.object({
  url: z.string().trim().url().optional(),
  rssUrl: z.string().trim().url().optional(),
});

rssRoutes.get('/', async (c) => {
  const cached = await getFromCache(c.req.raw);
  if (cached) return cached;

  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ success: false, error: 'Invalid url parameter' }, 400);

  const rssUrl = (parsed.data.url || parsed.data.rssUrl || '').trim();
  if (!rssUrl) return c.json({ success: false, error: 'Missing query parameter: url' }, 400);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rssUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
  } catch {
    return c.json({ success: false, error: 'Invalid or unsupported RSS URL' }, 400);
  }

  try {
    const response = await fetchWithTimeout(parsedUrl.toString(), RSS_FETCH_TIMEOUT_MS);
    if (!response.ok || !response.body) {
      return c.json({ success: false, error: `Failed to fetch RSS: HTTP ${response.status}` }, 502);
    }

    // 直接流式灌入解析器，摒弃全量文本读取和文件大小校验
    const data = await streamParseRss(response.body, parsedUrl.toString());

    const resp = c.json({ success: true, data });
    if (c.executionCtx) {
      c.executionCtx.waitUntil(putToCache(c.req.raw, resp, 'api'));
    } else {
      await putToCache(c.req.raw, resp, 'api');
    }
    return resp;
  } catch (error) {
    console.error('RSS Error:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'RSS parse failed' }, 500);
  }
});