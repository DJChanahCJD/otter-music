import { weapi, eapi } from './netease-crypto';
import type {
    AlbumDetail,
    AlbumDynamicDetail,
    ArtistDetail,
    ArtistAlbum,
    ArtistItem,
    NeteasePrivilege,
    PlaylistDetail,
    PlaylistDynamicDetail,
    RawNeteaseResponse,
    RawQrCheckResponse,
    RawQrKeyData,
    RecommendPlaylist,
    ResolveUrlResult,
    SongDetail,
    Toplist,
    UserPlaylist,
    UserProfile,
    SearchSuggestResult,
    NeteaseCommentResult,
    NeteaseNewCommentResult,
} from './netease-raw-types';
import type { MarketPlaylist, NeteaseSong, QrStatusResult } from "./netease-models";
import {
    normalizeQrStatus,
    toMarketPlaylistFromRecommend,
    toMarketPlaylistFromToplist,
    toMarketPlaylistFromUserPlaylist,
    unwrapMyInfoProfile,
    unwrapQrKey,
    unwrapRecommendResult,
} from "./netease-normalize";
import { MusicTrack } from '@/types/music';
import { cachedFetch } from "@/lib/utils/cache";
import { API_URL } from "@/lib/api/config";
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { useNeteaseStore } from '@/store/netease-store';

const TTL_SHORT = 60 * 60 * 1000;           // 1 hour
const TTL_MEDIUM = 24 * 60 * 60 * 1000;     // 1 day
const TTL_LONG = 7 * 24 * 60 * 60 * 1000;   // 7 days

// 确保移动端（即便是开发环境连着手机测）也能指向绝对路径，避免报错
const IS_NATIVE = Capacitor.isNativePlatform();
const BASE_URL = (import.meta.env.DEV && !IS_NATIVE) ? '/api/netease' : 'https://music.163.com';
const EAPI_BASE_URL = (import.meta.env.DEV && !IS_NATIVE) ? '/api/netease' : 'https://interface3.music.163.com';

const PC_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.27';
const NETWORK_TIMEOUT_MS = 12000;


/* =========================================================
* 核心伪装工具集 (Cookie & IP)
* ========================================================= */

export const getStoredCookie = () => useNeteaseStore.getState().cookie || "";

const getRandomDomesticIp = () => `113.108.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
const getIpForRequest = (cookie: string) => cookie.includes('MUSIC_U') ? '' : getRandomDomesticIp();
const createSecretKey = (size: number) => Array.from({ length: size }, () => '012345679abcdef'[Math.floor(Math.random() * 15)]).join('');

const buildVisitorCookie = () => {
    const nuid = createSecretKey(32);
    return `_ntes_nuid=${nuid}; _ntes_nnid3=${nuid},${Date.now()}; NMTID=0;`;
};

function cleanCookie(cookieStr: string | null): string {
    if (!cookieStr) return '';
    const ignoredKeys = new Set(['expires', 'max-age', 'domain', 'path', 'httponly', 'secure', 'samesite', 'priority']);
    return cookieStr.split(/[,;]\s*/)
        .map(part => part.match(/^([^=]+)=(.*)$/))
        .filter((m): m is RegExpMatchArray => !!m && !ignoredKeys.has(m[1].trim().toLowerCase()))
        .map(m => `${m[1].trim()}=${m[2].trim()}`)
        .join('; ');
}

function buildCookie(rawCookie: string = ''): string {
    let finalCookie = (rawCookie || getStoredCookie()).trim();
    if (!finalCookie) finalCookie = buildVisitorCookie();
    else if (!finalCookie.includes('=')) finalCookie = `MUSIC_U=${finalCookie}`;
    else finalCookie = cleanCookie(finalCookie);
    
    return `os=pc; appver=2.9.7; mode=31; ${finalCookie}`;
}

// 移动端允许写入真实 Cookie 和 UA，不再需要 X-Real- 伪装
function buildHeaders(cookie: string, ua: string, forceIp?: string): Record<string, string> {
    const ip = forceIp || getIpForRequest(cookie);
    const cookieStr = buildCookie(cookie);

    if (IS_NATIVE) {
        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookieStr,
            'User-Agent': ua,
            'Referer': 'https://music.163.com',
            ...(ip ? { 'X-Real-IP': ip, 'X-Forwarded-For': ip } : {})
        };
    }

    return {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Real-Cookie': cookieStr,
        'X-Real-UA': ua,
        ...(ip ? { 'X-Real-IP': ip, 'X-Forwarded-For': ip } : {})
    };
}

/* =========================================================
 * 底层跨端请求函数 (核心逻辑)
 * ========================================================= */

// ✅ 修复 3: 将底层 fetch 抽离，智能判断运行平台
async function crossFetch(url: string, options: { method: string; headers: Record<string, string>; body: string }) {
    const withTimeout = <T>(promise: Promise<T>, timeout = NETWORK_TIMEOUT_MS) =>
        new Promise<T>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error(`Request timeout: ${timeout}ms`)), timeout);
            promise.then(
                (value) => {
                    window.clearTimeout(timer);
                    resolve(value);
                },
                (error) => {
                    window.clearTimeout(timer);
                    reject(error);
                }
            );
        });

    const parseNativeJson = (payload: unknown) => {
        if (typeof payload !== 'string') return payload;
        try {
            return JSON.parse(payload);
        } catch {
            throw new Error('Invalid JSON response from NetEase API');
        }
    };

    if (IS_NATIVE) {
        const res = await withTimeout(CapacitorHttp.request({
            method: options.method,
            url,
            headers: options.headers,
            data: options.body,
        }));
        
        if (res.status >= 400) throw new Error(`Native API Error: ${res.status}`);
        
        const rawCookie = res.headers['Set-Cookie'] || res.headers['set-cookie'] || '';
        const cookieStr = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie;

        return {
            data: parseNativeJson(res.data),
            setCookie: cleanCookie(cookieStr)
        };
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    const response = await fetch(url, { ...options, signal: controller.signal }).finally(() => window.clearTimeout(timer));
    if (!response.ok) throw new Error(`Web API Error: ${response.status}`);
    
    return {
        data: await response.json(),
        setCookie: cleanCookie(response.headers.get('set-cookie'))
    };
}

async function requestWeapi<T = unknown>(url: string, data: Record<string, unknown>, cookie: string = '') {
    const finalCookie = cookie || getStoredCookie();
    const headers = buildHeaders(finalCookie, PC_USER_AGENT);
    const params = new URLSearchParams(weapi(data) as Record<string, string>).toString();

    const { data: resData, setCookie } = await crossFetch(url, { method: 'POST', headers, body: params });
    return { data: resData as T, cookie: setCookie };
}

async function requestEapi<T = unknown>(url: string, path: string, data: Record<string, unknown>, cookie: string = '') {
    const finalCookie = cookie || getStoredCookie();
    const headers = buildHeaders(finalCookie, MOBILE_USER_AGENT);
    const params = new URLSearchParams(eapi(path, data) as Record<string, string>).toString();

    const { data: resData } = await crossFetch(url, { method: 'POST', headers, body: params });
    return { data: resData as T };
}

async function fetchLocalApi<T>(endpoint: string, body?: Record<string, unknown>): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        body: body ? JSON.stringify(body) : undefined,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        credentials: 'include',
        signal: controller.signal,
    }).finally(() => window.clearTimeout(timer));
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Local API Error: ${res.status}`);
    }
    return res.json();
}

/* =========================================================
 * 业务 API
 * ========================================================= */

export async function getSongUrl(id: string, br: number = 999000, cookie: string = '') {
    const realId = id.replace(/^(netrack_|ne_track_)/, '');
    try {
        const eapiRes = await requestEapi<{ data: { url: string, br: number, size: number, freeTrialInfo?: unknown }[] }>(
            `${EAPI_BASE_URL}/eapi/song/enhance/player/url`,
            '/api/song/enhance/player/url',
            { ids: `[${realId}]`, br, header: { os: 'pc', appver: '2.9.7' } },
            cookie
        );
        const trackData = eapiRes.data?.data?.[0];
        if (trackData?.url && !trackData.freeTrialInfo) return eapiRes;
    } catch {
        console.warn(`[NetEase] EAPI failed for ${realId}, falling back to WEAPI...`);
    }

    return requestWeapi<{ data: { url: string, br: number, size: number }[] }>(
        `${BASE_URL}/weapi/song/enhance/player/url/v1`,
        { ids: `[${realId}]`, level: br >= 320000 ? 'exhigh' : 'standard', encodeType: 'mp3', csrf_token: '' },
        cookie
    );
}

export const getQrKey = async (): Promise<string> => {
    const res = await fetchLocalApi<RawNeteaseResponse<RawQrKeyData>>(`/music-api/netease/login/qr/key?timestamp=${Date.now()}`);
    return unwrapQrKey(res);
};

export const checkQrStatus = async (key: string): Promise<QrStatusResult> => {
    const res = await fetchLocalApi<RawQrCheckResponse>(`/music-api/netease/login/qr/check?key=${key}&timestamp=${Date.now()}`);
    return normalizeQrStatus(res);
};
/* 3. 游客登录
说明 : 直接调用此接口, 可获取游客cookie,如果遇到其他接口未登录状态报400状态码需要验证的错误,可使用此接口获取游客cookie避免报错

接口地址 : /register/anonimous */

export const getMyInfo = async (cookie: string = ''): Promise<UserProfile | null> => {
    const res = await cachedFetch<UserProfile | null>(
        `netease:v2:my-info:${cookie.slice(-16)}`,
        async () => unwrapMyInfoProfile(await fetchLocalApi('/music-api/netease/my-info', { cookie })),
        TTL_SHORT
    );
    return res ?? null;
};

export const getUserPlaylists = async (userId: string, cookie: string = ''): Promise<MarketPlaylist[]> => {
    const res = await cachedFetch<MarketPlaylist[]>(
        `netease:v2:user-playlists:${userId}`,
        async () => {
            const r = await fetchLocalApi<{ playlist: UserPlaylist[]; code: number }>('/music-api/netease/user-playlists', { userId, cookie });
            if (r.code !== 200) throw new Error(`NetEase user playlists error: ${r.code}`);
            return r.playlist.map(toMarketPlaylistFromUserPlaylist);
        },
        TTL_SHORT
    );
    return res ?? [];
};

export const getRecommendPlaylists = async (cookie: string = ''): Promise<MarketPlaylist[]> => {
    const res = await cachedFetch<MarketPlaylist[]>(
        `netease:v2:recommend:${cookie.slice(-16)}`,
        async () => {
            const r = await fetchLocalApi<{ result?: RecommendPlaylist[]; data?: { result?: RecommendPlaylist[] } }>('/music-api/netease/recommend', { cookie });
            return unwrapRecommendResult(r).map(toMarketPlaylistFromRecommend);
        },
        TTL_SHORT
    );
    return res ?? [];
};

export const getPlaylistDetail = (playlistId: string, cookie: string = '') => 
    cachedFetch<PlaylistDetail>( 
        `netease:playlist:${playlistId}:${cookie.slice(-16)}`, 
        async () => { 
            const res = await requestWeapi<{ playlist: PlaylistDetail & { trackIds: { id: number }[] } }>( 
                `${BASE_URL}/weapi/v3/playlist/detail`, 
                { id: playlistId, offset: 0, total: true, limit: 1000, n: 1000, csrf_token: '' }, 
                cookie 
            ); 
            const tracks = await getTracksDetail(res.data.playlist.trackIds.map((t: { id: number }) => t.id), cookie); 
            return { ...res.data.playlist, tracks } as PlaylistDetail; 
        }, 
        TTL_SHORT
    );

export const getPlaylistDynamicDetail = async (id: string, cookie: string = '') => {
    try {
        const res = await requestWeapi<PlaylistDynamicDetail>(
            `${BASE_URL}/weapi/playlist/detail/dynamic`,
            { id: id.replace(/^(neplaylist_|ne_playlist_)/, '') },
            cookie
        );
        return res.data;
    } catch (e) {
        console.warn('[API] getPlaylistDynamicDetail failed', e);
        return null;
    }
};

async function getTracksDetail(trackIds: number[], cookie: string = '') {
    const result: SongDetail[] = [];
    for (let i = 0; i < trackIds.length; i += 500) {
        const batch = trackIds.slice(i, i + 500);
        const res = await requestWeapi<{ songs: SongDetail[], privileges: NeteasePrivilege[] }>(
            `${BASE_URL}/weapi/v3/song/detail`, 
            { c: `[${batch.map(id => `{"id":${id}}`).join(',')}]`, ids: `[${batch.join(',')}]` }, 
            cookie
        );
        
        if (res.data.songs) {
            const privMap = new Map(res.data.privileges?.map(p => [p.id, p]));
            result.push(...res.data.songs.map(song => ({ ...song, privilege: privMap.get(Number(song.id)) })));
        }
    }
    return result;
}

export async function search(keyword: string, type: number = 1, page: number = 1, limit: number = 20, cookie: string = '') {
    const finalCookie = cookie || getStoredCookie();
    const headers = buildHeaders(finalCookie, PC_USER_AGENT, getRandomDomesticIp());
    const params = new URLSearchParams({ s: keyword, type: String(type), offset: String((page - 1) * limit), limit: String(limit) });
    
    const { data } = await crossFetch(`${BASE_URL}/api/search/pc`, { method: 'POST', headers, body: params.toString() });
    return { data: data as { result: { songs?: NeteaseSong[]; songCount?: number; hasMore?: boolean }, code: number } };
}

export const getLyric = (id: string, cookie: string = '') => 
    cachedFetch( 
        `netease:lyric:${id.replace(/^(netrack_|ne_track_)/, '')}`, 
        () => requestWeapi<{ lrc: { lyric: string }, tlyric: { lyric: string } }>( 
            `${BASE_URL}/weapi/song/lyric`, 
            { id: id.replace(/^(netrack_|ne_track_)/, ''), lv: -1, tv: -1 }, 
            cookie 
        ), 
        TTL_LONG // 歌词极少变动，使用长缓存 
    ); 

export const getSongDetail = (id: string, cookie: string = '') => 
    cachedFetch( 
        `netease:song:${id.replace(/^(netrack_|ne_track_)/, '')}:${cookie.slice(-16)}`, 
        async () => (await getTracksDetail([parseInt(id.replace(/^(netrack_|ne_track_)/, ''))], cookie))[0], 
        TTL_LONG // 歌曲基础信息固定，但携带 VIP 鉴权，因此 key 加上 cookie 尾缀 
    ); 

export const getToplist = async (cookie: string = ''): Promise<MarketPlaylist[]> => {
    const res = await cachedFetch<MarketPlaylist[]>(
        `netease:v2:toplist`,
        async () => {
            const r = await requestWeapi<{ list: Toplist[] }>(`${BASE_URL}/weapi/toplist/detail`, {}, cookie);
            return r.data.list.map(toMarketPlaylistFromToplist);
        },
        TTL_SHORT
    );
    return res ?? [];
};

export const getAlbum = (id: string, cookie: string = '') => 
    cachedFetch( 
        `netease:album:${id.replace(/^(nealbum_|ne_album_)/, '')}`, 
        async () => { 
            const res = await requestWeapi<AlbumDetail>(`${BASE_URL}/weapi/v1/album/${id.replace(/^(nealbum_|ne_album_)/, '')}`, {}, cookie); 
            return res.data; 
        }, 
        TTL_LONG // 专辑发布后信息基本固定 
    ); 

export const getAlbumDynamicDetail = async (id: string, cookie: string = '') => {
    try {
        const res = await requestWeapi<AlbumDynamicDetail>(
            `${BASE_URL}/weapi/album/detail/dynamic`,
            { id: id.replace(/^(nealbum_|ne_album_)/, '') },
            cookie
        );
        return res.data;
    } catch (e) {
        console.warn('[API] getAlbumDynamicDetail failed', e);
        return null;
    }
}; 

export const getArtist = (id: string, cookie: string = '') => 
    cachedFetch( 
        `netease:artist:${id.replace(/^(neartist_|ne_artist_)/, '')}`, 
        async () => { 
            const res = await requestWeapi<ArtistDetail>(`${BASE_URL}/weapi/v1/artist/${id.replace(/^(neartist_|ne_artist_)/, '')}`, {}, cookie); 
            return res.data; 
        }, 
        TTL_LONG // 歌手基础信息低频变动 
    ); 

export const getArtistDynamicDetail = async (id: string, cookie: string = '') => {
    try {
        const res = await requestWeapi<any>(
            `${BASE_URL}/weapi/artist/detail/dynamic`,
            { id: id.replace(/^(neartist_|ne_artist_)/, '') },
            cookie
        );
        return res.data;
    } catch (e) {
        console.warn('[API] getArtistDynamicDetail failed', e);
        return null;
    }
};

export const getArtistSongs = (id: string, limit: number = 50, offset: number = 0, order: string = 'hot', cookie: string = '') =>
    cachedFetch(
        `netease:artist-songs:${id.replace(/^(neartist_|ne_artist_)/, '')}:${limit}:${offset}:${order}`,
        async () => {
            const res = await requestWeapi<{ songs: SongDetail[], total: number, more: boolean }>(
                `${BASE_URL}/weapi/v1/artist/songs`,
                { id: id.replace(/^(neartist_|ne_artist_)/, ''), limit, offset, order, total: true },
                cookie
            );
            return res.data;
        },
        TTL_MEDIUM
    );

export const getArtistAlbums = (id: string, limit: number = 30, offset: number = 0, cookie: string = '') =>
    cachedFetch(
        `netease:artist-albums:${id.replace(/^(neartist_|ne_artist_)/, '')}:${limit}:${offset}`,
        async () => {
            const res = await requestWeapi<{ hotAlbums: ArtistAlbum[], more: boolean }>(
                `${BASE_URL}/weapi/artist/albums/${id.replace(/^(neartist_|ne_artist_)/, '')}`,
                { limit, offset, total: true },
                cookie
            );
            return res.data;
        },
        TTL_MEDIUM
    ); 

export const getSubscribedAlbums = async (
  limit: number = 25,
  offset: number = 0,
  cookie: string = ''
): Promise<ArtistAlbum[]> => {
  try {
    const r = await requestWeapi<{ data: ArtistAlbum[]; count: number }>(
      `${BASE_URL}/weapi/album/sublist`,
      { limit, offset, total: true },
      cookie
    );

    return r.data.data ?? [];
  } catch (e) {
    console.warn('[API] getSubscribedAlbums failed', e);
    return [];
  }
};

export const getSubscribedArtists = async (
  limit: number = 25,
  offset: number = 0,
  cookie: string = ''
): Promise<ArtistItem[]> => {
  try {
    const r = await requestWeapi<{ data: ArtistItem[]; count: number }>(
      `${BASE_URL}/weapi/artist/sublist`,
      { limit, offset, total: true },
      cookie
    );

    return r.data.data ?? [];
  } catch (e) {
    console.warn('[API] getSubscribedArtists failed', e);
    return [];
  }
};

export const toggleSubArtist = async (id: string, shouldSub: boolean, cookie: string = '') => {
    const realId = id.replace(/^(neartist_|ne_artist_)/, '');
    const action = shouldSub ? 'sub' : 'unsub';
    return requestWeapi<{ code: number, message?: string }>(
        `${BASE_URL}/weapi/artist/${action}`,
        { artistId: realId, artistIds: [realId] }, // !  TODO:当前收藏歌手会报 250 系统错误, 暂时无法使用
        cookie
    );
};

export const toggleSubAlbum = async (id: string, shouldSub: boolean, cookie: string = '') => {
    const realId = id.replace(/^(nealbum_|ne_album_)/, '');
    const action = shouldSub ? 'sub' : 'unsub';
    return requestWeapi<{ code: number, message?: string }>(
        `${BASE_URL}/weapi/album/${action}`,
        { id: realId, t: shouldSub ? 1 : 0 },
        cookie
    );
};

export const toggleSubPlaylist = async (id: string, shouldSub: boolean, cookie: string = '') => {
    const realId = id.replace(/^(neplaylist_|ne_playlist_)/, '');
    return requestWeapi<{ code: number, message?: string }>(
        `${BASE_URL}/weapi/playlist/subscribe`,
        { id: realId, t: shouldSub ? 1 : 2 },
        cookie
    );
};

export const getPlaylists = (cat: string = '全部', order: string = 'hot', limit: number = 30, offset: number = 0, cookie: string = '') => 
    cachedFetch( 
        `netease:playlists:${cat}:${order}:${limit}:${offset}`, 
        async () => {
            const res = await requestWeapi<{ playlists: UserPlaylist[] }>(
                `${BASE_URL}/weapi/playlist/list`,
                { cat, order, limit, offset, total: true },
                cookie
            );
            return res.data.playlists.map(toMarketPlaylistFromUserPlaylist);
        },
        TTL_SHORT // 广场分类歌单变动较快 
    );

export const searchSuggest = (keyword: string, cookie: string = '') =>
    cachedFetch<SearchSuggestResult>(
        `netease:suggest:${keyword}`,
        async () => {
            const res = await requestWeapi<{ result: SearchSuggestResult }>(
                `${BASE_URL}/weapi/search/suggest/web`,
                { s: keyword },
                cookie
            );
            return res.data?.result || {};
        },
        TTL_SHORT
    );

export const getHotComments = (id: string, limit: number = 20, offset: number = 0, cookie: string = '') =>
    cachedFetch<NeteaseCommentResult>(
        `netease:comments:hot:${id.replace(/^(netrack_|ne_track_)/, '')}:${limit}:${offset}`,
        async () => {
            const realId = id.replace(/^(netrack_|ne_track_)/, '');
            const rid = `R_SO_4_${realId}`;
            const res = await requestWeapi<NeteaseCommentResult>(
                `${BASE_URL}/weapi/v1/resource/hotcomments/${rid}`,
                { rid, limit, offset, beforeTime: 0 },
                cookie
            );
            return res.data;
        },
        TTL_SHORT
    );

export const getNewComments = (
    id: string,
    pageNo: number = 1,
    pageSize: number = 20,
    sortType: number = 2, // 1:推荐 2:热度 3:时间
    cursor: string | number = 0,
    cookie: string = ''
) =>
    cachedFetch<NeteaseNewCommentResult['data']>(
        `netease:comments:new:${id.replace(/^(netrack_|ne_track_)/, '')}:${sortType}:${pageNo}:${cursor}`,
        async () => {
            const realId = id.replace(/^(netrack_|ne_track_)/, '');
            const res = await requestWeapi<NeteaseNewCommentResult>(
                `${BASE_URL}/weapi/comment/new`,
                {
                    type: 0, // 0: 歌曲
                    id: realId,
                    sortType,
                    cursor,
                    pageSize,
                    pageNo,
                },
                cookie
            );
            return res.data?.data;
        },
        TTL_SHORT
    );

export const getMusicComments = (id: string, limit: number = 20, offset: number = 0, cookie: string = '') => {
    // 优先使用热门评论接口
    return getHotComments(id, limit, offset, cookie);
};

export function resolveUrl(urlStr: string): ResolveUrlResult | null {
    try {
        const normalized = urlStr.replace(/music\.163\.com\/(#\/)?(discover\/toplist\?|my\/m\/music\/|m\/|)/g, 'music.163.com/');
        const url = new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`);
        const id = url.searchParams.get('id') || url.pathname.split('/').pop();
        
        if (!id) return null;
        if (url.pathname.includes('/playlist')) return { type: 'playlist', id: `neplaylist_${id}` };
        if (url.pathname.includes('/artist')) return { type: 'artist', id: `neartist_${id}` };
        if (url.pathname.includes('/album')) return { type: 'album', id: `nealbum_${id}` };
        if (url.pathname.includes('/song')) return { type: 'song', id: `netrack_${id}` };
    } catch { /* ignore parsing errors */ }
    return null;
}

export const convertSongToMusicTrack = (song: NeteaseSong): MusicTrack => {
    // 兼容搜索接口返回的 artists 和 album
    const artists = song.ar || song.artists || [];
    const album = song.al || song.album || {};
    const songId = String(song.id);

    // 构造 privilege 对象（如果搜索结果缺失）
    let privilege = song.privilege;
    if (!privilege && song.fee !== undefined) {
        privilege = {
            id: Number(song.id),
            fee: song.fee,
            payed: 0,
            st: song.st ?? song.status ?? 0,
            pl: (song.fee === 1 || song.fee === 4) ? 0 : 128000, // VIP/付费歌曲默认视为不可播放，触发 Badge 显示
            maxbr: 999000,
            plLevel: 'standard',
            freeTrialPrivilege: { remainTime: 0 }
        };
    }
    return {
        id: songId,
        name: song.name || '',
        artist: artists.map((a: { name: string }) => a.name),
        album: album.name || '',
        pic_id: album.picUrl || songId,
        url_id: songId,
        lyric_id: songId,
        source: '_netease',
        privilege,
        artist_ids: artists.map((a: { id?: string | number }) => String(a.id || '')),
        album_id: String(album.id || ''),
    };
};
