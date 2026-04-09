import { Hono } from 'hono';
import type { Env } from '../../types/hono';
import {
  getUserPlaylists,
  getPlaylistDetail,
  getPlaylistDynamicDetail,
  getQrKey,
  checkQrStatus,
  getMyInfo,
  getRecommendPlaylists,
  search,
  getToplist,
  getAlbum,
  getAlbumDynamicDetail,
  getArtist,
  getArtistDynamicDetail,
  getArtistSongs,
  getArtistAlbums,
  getSubscribedAlbums,
  getSubscribedArtists,
  getPlaylists,
  searchSuggest,
  getHotComments,
  getNewComments,
  getMusicComments,
  resolveUrl,
  toggleSubArtist,
  toggleSubAlbum,
  toggleSubPlaylist,
} from '../../utils/music/netease-api';
import { SongDetail } from '@utils/music/netease-types';

export const neteaseRoutes = new Hono<{ Bindings: Env }>();

/**
 * 获取二维码登录所需的 key
 * @method GET
 * @path /login/qr/key
 * @returns {Promise<QrKeyResponse>}
 */
neteaseRoutes.get('/login/qr/key', async (c) => {
  try {
    const res = await getQrKey();
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 检查二维码登录状态
 * @method GET
 * @path /login/qr/check
 * @param {string} key - Query parameter, QR code key
 * @returns {Promise<QrCheckResponse>}
 */
neteaseRoutes.get('/login/qr/check', async (c) => {
  const key = c.req.query('key');
  if (!key) return c.json({ error: 'Key required' }, 400);

  try {
    const res = await checkQrStatus(key);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 获取我的用户信息
 * @method POST
 * @path /my-info
 * @body {string} cookie - User cookie
 * @returns {Promise<{ profile: UserProfile }>}
 */
neteaseRoutes.post('/my-info', async (c) => {
  const { cookie } = await c.req.json<{ cookie: string }>();
  try {
    const res = await getMyInfo(cookie);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 获取用户歌单
 * @method POST
 * @path /user-playlists
 * @body {string} userId - User ID
 * @body {string} cookie - User cookie
 * @returns {Promise<{ playlist: UserPlaylist[], code: number }>}
 */
neteaseRoutes.post('/user-playlists', async (c) => {
  const { userId, cookie } = await c.req.json<{ userId: string, cookie: string }>();
  try {
    const res = await getUserPlaylists(userId, cookie);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 获取歌单详情
 * @method POST
 * @path /playlist
 * @body {string} playlistId - Playlist ID
 * @body {string} cookie - User cookie
 * @returns {Promise<PlaylistDetail>}
 */
neteaseRoutes.post('/playlist', async (c) => {
  const { playlistId, cookie } = await c.req.json<{ playlistId: string, cookie: string }>();
  try {
    const res = await getPlaylistDetail(playlistId, cookie);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

neteaseRoutes.post('/playlist/dynamic', async (c) => {
  const { id, cookie } = await c.req.json<{ id: string, cookie: string }>();
  if (!id) return c.json({ error: 'ID required' }, 400);

  try {
    const res = await getPlaylistDynamicDetail(id, cookie || '');
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 获取每日推荐歌单
 * @method POST
 * @path /recommend
 * @body {string} cookie - User cookie
 * @returns {Promise<{ result: RecommendPlaylist[] }>}
 */
neteaseRoutes.post('/recommend', async (c) => {
  const { cookie } = await c.req.json<{ cookie: string }>();
  try {
    const res = await getRecommendPlaylists(cookie);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 获取排行榜
 * @method POST
 * @path /toplist
 * @body {string} cookie - User cookie
 * @returns {Promise<{ list: Toplist[] }>}
 */
neteaseRoutes.post('/toplist', async (c) => {
  const { cookie } = await c.req.json<{ cookie: string }>();
  try {
    const res = await getToplist(cookie);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 获取专辑详情
 * @method POST
 * @path /album
 * @body {string} id - Album ID
 * @body {string} cookie - User cookie
 * @returns {Promise<AlbumDetail>}
 */
neteaseRoutes.post('/album', async (c) => {
  const { id, cookie } = await c.req.json<{ id: string, cookie: string }>();
  try {
    const res = await getAlbum(id, cookie);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

neteaseRoutes.post('/album/dynamic', async (c) => {
  const { id, cookie } = await c.req.json<{ id: string, cookie: string }>();
  if (!id) return c.json({ error: 'ID required' }, 400);

  try {
    const res = await getAlbumDynamicDetail(id, cookie || '');
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 获取艺人详情
 * @method POST
 * @path /artist
 * @body {string} id - Artist ID
 * @body {string} cookie - User cookie
 * @returns {Promise<ArtistDetail>}
 */
neteaseRoutes.post('/artist', async (c) => {
  const { id, cookie } = await c.req.json<{ id: string, cookie: string }>();
  try {
    const res = await getArtist(id, cookie);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

neteaseRoutes.post('/artist/dynamic', async (c) => {
  const { id, cookie } = await c.req.json<{ id: string, cookie: string }>();
  if (!id) return c.json({ error: 'ID required' }, 400);

  try {
    const res = await getArtistDynamicDetail(id, cookie || '');
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

neteaseRoutes.post('/artist/songs', async (c) => {
  const { id, limit, offset, order, cookie } = await c.req.json<{ id: string, limit?: number, offset?: number, order?: string, cookie?: string }>();
  if (!id) return c.json({ error: 'ID required' }, 400);

  try {
    const res = await getArtistSongs(id, limit ?? 50, offset ?? 0, order || 'hot', cookie || '');
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

neteaseRoutes.post('/artist/albums', async (c) => {
  const { id, limit, offset, cookie } = await c.req.json<{ id: string, limit?: number, offset?: number, cookie?: string }>();
  if (!id) return c.json({ error: 'ID required' }, 400);

  try {
    const res = await getArtistAlbums(id, limit ?? 30, offset ?? 0, cookie || '');
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 获取分类歌单
 * @method POST
 * @path /playlists
 * @body {string} cat - Category
 * @body {string} order - Order (hot/new)
 * @body {number} limit - Limit
 * @body {number} offset - Offset
 * @body {string} cookie - User cookie
 * @returns {Promise<{ playlists: UserPlaylist[] }>}
 */
neteaseRoutes.post('/playlists', async (c) => {
  const { cat, order, limit, offset, cookie } = await c.req.json<{ cat: string, order: string, limit: number, offset: number, cookie: string }>();
  try {
    const res = await getPlaylists(cat, order, limit, offset, cookie);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

neteaseRoutes.post('/album/sublist', async (c) => {
  const { limit, offset, cookie } = await c.req.json<{ limit?: number, offset?: number, cookie?: string }>();
  try {
    const res = await getSubscribedAlbums(limit ?? 25, offset ?? 0, cookie || '');
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

neteaseRoutes.post('/artist/sublist', async (c) => {
  const { limit, offset, cookie } = await c.req.json<{ limit?: number, offset?: number, cookie?: string }>();
  try {
    const res = await getSubscribedArtists(limit ?? 25, offset ?? 0, cookie || '');
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 解析 URL
 * @method POST
 * @path /resolve
 * @body {string} url - NetEase Cloud Music URL
 * @returns {Promise<ResolveUrlResult>}
 */
neteaseRoutes.post('/resolve', async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  try {
    const res = resolveUrl(url);
    if (!res) return c.json({ error: 'Invalid URL' }, 400);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 搜索歌曲
 * @method POST
 * @path /search
 * @body {string} keyword - Search keyword
 * @body {number} page - Page number (default: 1)
 * @body {number} limit - Page size (default: 20)
 * @body {string} cookie - User cookie
 * @returns {Promise<{ items: Array, hasMore: boolean }>}
 */
neteaseRoutes.post('/search', async (c) => {
  const { keyword, page, limit, cookie } = await c.req.json<{ keyword: string, page: number, limit: number, cookie: string }>();

  const name = String(keyword || '').trim();
  if (!name) return c.json({ error: 'Keyword required' }, 400);

  const currentPage = Math.max(1, parseInt(String(page || '1'), 10) || 1);
  const currentLimit = Math.max(1, Math.min(50, parseInt(String(limit || '20'), 10) || 20));

  try {
    const res = await search(name, 1, currentPage, currentLimit, cookie || '');

    const songs = res.data?.result?.songs || [];
    const songCount = res.data?.result?.songCount || 0;

    const items = songs.map((s: SongDetail) => ({
      id: `ne_track_${s.id}`,
      name: s.name,
      artist: (s.artists || s.ar || []).map((a: any) => a.name),
      album: s.album?.name || s.al?.name || '',
      pic_id: s.album?.picUrl || s.al?.picUrl || '',
      url_id: String(s.id),
      lyric_id: String(s.id),
      source: '_netease',
    }));

    const hasMore = currentPage * currentLimit < songCount;
    return c.json({ items, hasMore });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

neteaseRoutes.post('/search/suggest', async (c) => {
  const { keyword, cookie } = await c.req.json<{ keyword: string, cookie?: string }>();
  const term = String(keyword || '').trim();
  if (!term) return c.json({ error: 'Keyword required' }, 400);

  try {
    const res = await searchSuggest(term, cookie || '');
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

neteaseRoutes.post('/comments/hot', async (c) => {
  const { id, limit, offset, cookie } = await c.req.json<{ id: string, limit?: number, offset?: number, cookie?: string }>();
  if (!id) return c.json({ error: 'ID required' }, 400);

  try {
    const res = await getHotComments(id, limit ?? 20, offset ?? 0, cookie || '');
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

neteaseRoutes.post('/comments/new', async (c) => {
  const { id, pageNo, pageSize, sortType, cursor, cookie } = await c.req.json<{
    id: string,
    pageNo?: number,
    pageSize?: number,
    sortType?: number,
    cursor?: string | number,
    cookie?: string
  }>();
  if (!id) return c.json({ error: 'ID required' }, 400);

  try {
    const res = await getNewComments(
      id,
      pageNo ?? 1,
      pageSize ?? 20,
      sortType ?? 2,
      cursor ?? 0,
      cookie || ''
    );
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

neteaseRoutes.post('/comments', async (c) => {
  const { id, limit, offset, cookie } = await c.req.json<{ id: string, limit?: number, offset?: number, cookie?: string }>();
  if (!id) return c.json({ error: 'ID required' }, 400);

  try {
    const res = await getMusicComments(id, limit ?? 20, offset ?? 0, cookie || '');
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 收藏/取消收藏歌手
 * @method POST
 * @path /artist/sub
 * @body {string} id - Artist ID
 * @body {boolean} shouldSub - true to subscribe, false to unsubscribe
 * @body {string} cookie - User cookie
 * @returns {Promise<{ code: number, message?: string }>}
 */
neteaseRoutes.post('/artist/sub', async (c) => {
  const { id, shouldSub, cookie } = await c.req.json<{ id: string, shouldSub: boolean, cookie: string }>();
  try {
    const res = await toggleSubArtist(id, shouldSub, cookie);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 收藏/取消收藏专辑
 * @method POST
 * @path /album/sub
 * @body {string} id - Album ID
 * @body {boolean} shouldSub - true to subscribe, false to unsubscribe
 * @body {string} cookie - User cookie
 * @returns {Promise<{ code: number, message?: string }>}
 */
neteaseRoutes.post('/album/sub', async (c) => {
  const { id, shouldSub, cookie } = await c.req.json<{ id: string, shouldSub: boolean, cookie: string }>();
  try {
    const res = await toggleSubAlbum(id, shouldSub, cookie);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

/**
 * 收藏/取消收藏歌单
 * @method POST
 * @path /playlist/sub
 * @body {string} id - Playlist ID
 * @body {boolean} shouldSub - true to subscribe, false to unsubscribe
 * @body {string} cookie - User cookie
 * @returns {Promise<{ code: number, message?: string }>}
 */
neteaseRoutes.post('/playlist/sub', async (c) => {
  const { id, shouldSub, cookie } = await c.req.json<{ id: string, shouldSub: boolean, cookie: string }>();
  try {
    const res = await toggleSubPlaylist(id, shouldSub, cookie);
    return c.json(res);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
