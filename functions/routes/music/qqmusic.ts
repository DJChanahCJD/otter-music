import { Hono } from 'hono';
import type { Env } from '../../types/hono';
import { fetchQqPlaylistDetail } from '../../utils/music/qqmusic-api';

export const qqmusicRoutes = new Hono<{ Bindings: Env }>();

/**
 * 获取 QQ 音乐歌单详情
 * @method POST
 * @path /playlist
 * @body {string} playlistId - QQ 音乐歌单 ID
 */
qqmusicRoutes.post('/playlist', async (c) => {
  const { playlistId } = await c.req.json<{ playlistId: string }>();
  if (!playlistId) return c.json({ error: 'playlistId required' }, 400);

  try {
    const detail = await fetchQqPlaylistDetail(playlistId);
    return c.json(detail);
  } catch (e: any) {
    console.error('QQ Music API error:', e);
    return c.json({ error: e.message || 'Internal error' }, 500);
  }
});
