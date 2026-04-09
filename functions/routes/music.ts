import { Hono } from 'hono';
import type { Env } from '../types/hono';
import { handleNeteaseRequest } from '@utils/music/netease-handler';
import { neteaseRoutes } from './music/netease';
import { getFromCache, putToCache } from '@utils/cache';

export const musicRoutes = new Hono<{ Bindings: Env }>();

const API_BASE = 'https://music-api.gdstudio.xyz/api.php';
/**
 * 音乐主路由，支持网易云适配器拦截和上游代理
 */
musicRoutes.get('/', async (c) => {
  const query = c.req.query();

  // 1. Backend Adapter: Intercept NetEase requests (Not cached here as it has its own logic)
  if (query.source === '_netease') {
    return handleNeteaseRequest(c, query);
  }

  // 2. Try Cache
  const cachedResponse = await getFromCache(c.req.raw);
  if (cachedResponse) {
    // Return a new response from the cached one to ensure headers are fresh
    return new Response(cachedResponse.body, cachedResponse);
  }

  // 3. Fallback to Upstream Proxy
  const searchParams = new URLSearchParams(query);
  const targetUrl = `${API_BASE}?${searchParams.toString()}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      return c.json(
        { error: 'Upstream request failed', status: res.status },
        res.status as any
      );
    }

    const data = await res.json();
    const response = c.json(data);

    // 4. Save to Cache (Async)
    c.executionCtx.waitUntil(putToCache(c.req.raw, response.clone(), 'api'));

    return response;
  } catch (e: any) {
    console.error('Music proxy error:', e);
    return c.json({ error: e.message }, 500);
  }
});

musicRoutes.route('/netease', neteaseRoutes);
