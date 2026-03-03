import { TTL_LONG, TTL_MEDIUM, TTL_SHORT, cachedFetch } from "@/lib/utils/cache";
import { MUSIC_API_URL } from "./config";
import type { MusicTrack } from "@/types/music";
import { QrKeyResponse, QrCheckResponse, NeteaseUser, NeteasePlaylist, AlbumDetail, ArtistDetail } from "@/types/netease";

const BASE_URL = `${MUSIC_API_URL}/netease`;

/* -------------------------------------------------- */
/* Helpers */
/* -------------------------------------------------- */

async function request<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: object,
  signal?: AbortSignal
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    signal,
  };

  if (body && method === 'POST') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

const get = <T>(path: string) => request<T>(path, 'GET');
const post = <T>(path: string, body: object, signal?: AbortSignal) => request<T>(path, 'POST', body, signal);

/* -------------------------------------------------- */
/* API */
/* -------------------------------------------------- */

export const neteaseApi = {

  /* ---------------- User ---------------- */

  /** 获取登录二维码 Key */
  getQrKey: async () => {
    return get<QrKeyResponse>('/login/qr/key');
  },

  /** 检查二维码状态 */
  checkQrStatus: async (key: string) => {
    return get<QrCheckResponse>(`/login/qr/check?key=${key}`);
  },

  /** 获取个人信息 */
  getMyInfo: async (cookie: string) => {
    const key = `netease:my-info`;

    return cachedFetch(
      key,
      () => post<{ data: { profile: NeteaseUser } }>('/my-info', { cookie }),
      TTL_SHORT
    );
  },

  /** 获取用户歌单 */
  getUserPlaylists: async (userId: string, cookie: string) => {
    const key = `netease:user-playlists:${userId}`;

    return cachedFetch(
      key,
      () => post<{ playlist: NeteasePlaylist[] }>('/user-playlists', { userId, cookie }),
      TTL_MEDIUM
    );
  },

  /* ---------------- Playlist ---------------- */

  /** 获取歌单详情 */
  getPlaylistDetail: async (playlistId: string, cookie: string = "") => {
    const key = `netease:playlist:${playlistId}`;

    return cachedFetch(
      key,
      () => post<{ 
        id: string; 
        name: string; 
        coverImgUrl: string; 
        description: string; 
        playCount: number; 
        trackCount: number;
        creator: { nickname: string; avatarUrl: string };
        tracks: MusicTrack[];
      }>('/playlist', { playlistId, cookie }),
      TTL_LONG
    );
  },

  /** 获取每日推荐歌单 (需登录) */
  getRecommendPlaylists: async (cookie: string) => {
    const key = `netease:recommend`;

    return cachedFetch(
      key,
      () => post<{ data: { result: NeteasePlaylist[] } }>('/recommend', { cookie }),
      TTL_SHORT
    );
  },

  /** 获取分类歌单 */
  getPlaylists: async (
    cat: string,
    order: string | undefined,
    limit: number,
    offset: number,
    cookie: string = ""
  ) => {
    const normalizedCat = cat || '全部';
    const normalizedOrder = order || 'hot';
    const key = `netease:playlists:${normalizedCat}:${normalizedOrder}:${limit}:${offset}`;

    return cachedFetch(
      key,
      () => post<{ data: { playlists: NeteasePlaylist[] } }>('/playlists', {
        cat: normalizedCat,
        order: normalizedOrder,
        limit,
        offset,
        cookie
      }),
      TTL_SHORT
    );
  },

  /** 获取排行榜 */
  getToplist: async (cookie: string = "") => {
    const key = `netease:toplist`;

    return cachedFetch(
      key,
      () => post<{ data: { list: NeteasePlaylist[] } }>('/toplist', { cookie }),
      TTL_LONG
    );
  },

  /* ---------------- Meta ---------------- */

  /** 获取专辑详情 */
  getAlbum: async (id: string, cookie: string = "") => {
    const key = `netease:album:${id}`;

    return cachedFetch(
      key,
      () => post<{ album: AlbumDetail['album']; songs: MusicTrack[] }>('/album', { id, cookie }),
      TTL_LONG
    );
  },

  /** 获取歌手详情 */
  getArtist: async (id: string, cookie: string = "") => {
    const key = `netease:artist:${id}`;

    return cachedFetch(
      key,
      () => post<{ artist: ArtistDetail['artist']; hotSongs: MusicTrack[] }>('/artist', { id, cookie }),
      TTL_LONG
    );
  },

  /* ---------------- Tools ---------------- */

  /** 搜索歌曲 */
  searchTracks: async (
    keyword: string,
    page: number,
    limit: number,
    cookie: string = "",
    signal?: AbortSignal
  ) => {
    // 搜索通常不缓存，或者由上层处理分页缓存
    return post<{ items: MusicTrack[]; hasMore: boolean }>(
      '/search',
      { keyword, page, limit, cookie },
      signal
    );
  },

  /** 解析分享链接 */
  resolveUrl: async (url: string) => {
    return post<{ type: string; id: string }>('/resolve', { url });
  },
};
