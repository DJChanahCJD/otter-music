import { weapi, eapi } from './netease-crypto';
import { UserProfile, UserPlaylist, PlaylistDetail, SongDetail, SearchResult, RecommendPlaylist, Toplist, AlbumDetail, ArtistDetail, ResolveUrlResult, NeteasePrivilege } from './netease-types';
import { MusicTrack } from '@/types/music';
import { cachedFetch } from "@/lib/utils/cache";
import { API_URL } from "@/lib/api/config";
import { Capacitor, CapacitorHttp } from '@capacitor/core';

const TTL_SHORT = 60 * 60 * 1000;
const TTL_MEDIUM = 24 * 60 * 60 * 1000;

// 确保移动端（即便是开发环境连着手机测）也能指向绝对路径，避免报错
const IS_NATIVE = Capacitor.isNativePlatform();
const BASE_URL = (import.meta.env.DEV && !IS_NATIVE) ? '/api/netease' : 'https://music.163.com';
const EAPI_BASE_URL = (import.meta.env.DEV && !IS_NATIVE) ? '/api/netease' : 'https://interface3.music.163.com';

const PC_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.27';

export const NETEASE_COOKIE_KEY = "cookie:_netease";

/* =========================================================
 * 核心伪装工具集 (Cookie & IP)
 * ========================================================= */

export const getStoredCookie = () => localStorage.getItem(NETEASE_COOKIE_KEY) || "";

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
    if (IS_NATIVE) {
        // 走 Capacitor 的 Native HTTP，彻底绕开 CORS
        const res = await CapacitorHttp.request({
            method: options.method,
            url,
            headers: options.headers,
            data: options.body,
        });
        
        if (res.status >= 400) throw new Error(`Native API Error: ${res.status}`);
        
        const rawCookie = res.headers['Set-Cookie'] || res.headers['set-cookie'] || '';
        const cookieStr = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie;

        return {
            data: typeof res.data === 'string' ? JSON.parse(res.data) : res.data,
            setCookie: cleanCookie(cookieStr)
        };
    }

    // Web / PC 端走正常 fetch (经由 Vite 代理)
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Web API Error: ${response.status}`);
    
    return {
        data: await response.json(),
        setCookie: cleanCookie(response.headers.get('set-cookie'))
    };
}

async function requestWeapi<T = any>(url: string, data: any, cookie: string = '') {
    const finalCookie = cookie || getStoredCookie();
    const headers = buildHeaders(finalCookie, PC_USER_AGENT);
    const params = new URLSearchParams(weapi(data) as any).toString();

    const { data: resData, setCookie } = await crossFetch(url, { method: 'POST', headers, body: params });
    return { data: resData as T, cookie: setCookie };
}

async function requestEapi<T = any>(url: string, path: string, data: any, cookie: string = '') {
    const finalCookie = cookie || getStoredCookie();
    const headers = buildHeaders(finalCookie, MOBILE_USER_AGENT);
    const params = new URLSearchParams(eapi(path, data) as any).toString();

    const { data: resData } = await crossFetch(url, { method: 'POST', headers, body: params });
    return { data: resData as T };
}

async function fetchLocalApi<T>(endpoint: string, body?: any): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    // 如果你在手机端遇到本地后端也跨域的问题，可以直接用 CapacitorHttp 替换这里的 fetch
    const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        body: body ? JSON.stringify(body) : undefined,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        credentials: 'include',
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Local API Error: ${res.status}`);
    }
    return res.json();
}

/* =========================================================
 * 业务 API (无变更，复用底层的跨端重构)
 * ========================================================= */

export async function getSongUrl(id: string, br: number = 999000, cookie: string = '') {
    const realId = id.replace(/^(netrack_|ne_track_)/, '');
    try {
        const eapiRes = await requestEapi<{ data: { url: string, br: number, size: number, freeTrialInfo?: any }[] }>(
            `${EAPI_BASE_URL}/eapi/song/enhance/player/url`,
            '/api/song/enhance/player/url',
            { ids: `[${realId}]`, br, header: { os: 'pc', appver: '2.9.7' } },
            cookie
        );
        const trackData = eapiRes.data?.data?.[0];
        if (trackData?.url && !trackData.freeTrialInfo) return eapiRes;
    } catch (e) {
        console.warn(`[NetEase] EAPI failed for ${realId}, falling back to WEAPI...`);
    }

    return requestWeapi<{ data: { url: string, br: number, size: number }[] }>(
        `${BASE_URL}/weapi/song/enhance/player/url/v1`,
        { ids: `[${realId}]`, level: br >= 320000 ? 'exhigh' : 'standard', encodeType: 'mp3', csrf_token: '' },
        cookie
    );
}

export const getQrKey = () => fetchLocalApi<any>(`/music-api/netease/login/qr/key?timestamp=${Date.now()}`);
export const checkQrStatus = (key: string) => fetchLocalApi<any>(`/music-api/netease/login/qr/check?key=${key}&timestamp=${Date.now()}`);

export const getMyInfo = (cookie: string = '') => 
    cachedFetch<{ data?: { profile: UserProfile }; profile?: UserProfile }>(
        `netease:my-info:${cookie.slice(-16)}`, 
        () => fetchLocalApi('/music-api/netease/my-info', { cookie }), 
        TTL_SHORT
    );

export const getUserPlaylists = (userId: string, cookie: string = '') => 
    cachedFetch<{ playlist: UserPlaylist[], code: number }>(
        `netease:user-playlists:${userId}`, 
        () => fetchLocalApi('/music-api/netease/user-playlists', { userId, cookie }), 
        TTL_MEDIUM
    );

export const getRecommendPlaylists = (cookie: string = '') => 
    cachedFetch<{ result: RecommendPlaylist[] }>(
        `netease:recommend:${cookie.slice(-16)}`, 
        () => fetchLocalApi('/music-api/netease/recommend', { cookie }), 
        TTL_SHORT
    );

export async function getPlaylistDetail(playlistId: string, cookie: string = ''): Promise<PlaylistDetail> {
    const res = await requestWeapi<{ playlist: any }>(
        `${BASE_URL}/weapi/v3/playlist/detail`, 
        { id: playlistId, offset: 0, total: true, limit: 1000, n: 1000, csrf_token: '' }, 
        cookie
    );
    const tracks = await getTracksDetail(res.data.playlist.trackIds.map((t: any) => t.id), cookie);
    return { ...res.data.playlist, tracks } as PlaylistDetail;
}

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
    
    // 直接复用我们万能的跨端 fetch
    const { data } = await crossFetch(`${BASE_URL}/api/search/pc`, { method: 'POST', headers, body: params.toString() });
    return { data: data as { result: SearchResult, code: number } };
}

export const getLyric = (id: string, cookie: string = '') => 
    requestWeapi<{ lrc: { lyric: string }, tlyric: { lyric: string } }>(`${BASE_URL}/weapi/song/lyric`, { id: id.replace(/^(netrack_|ne_track_)/, ''), lv: -1, tv: -1 }, cookie);

export const getSongDetail = async (id: string, cookie: string = '') => 
    (await getTracksDetail([parseInt(id.replace(/^(netrack_|ne_track_)/, ''))], cookie))[0];

export const getToplist = (cookie: string = '') => requestWeapi<{ list: Toplist[] }>(`${BASE_URL}/weapi/toplist/detail`, {}, cookie);

export const getAlbum = async (id: string, cookie: string = '') => {
    const res = await requestWeapi<AlbumDetail>(`${BASE_URL}/weapi/v1/album/${id.replace(/^(nealbum_|ne_album_)/, '')}`, {}, cookie);
    return res.data;
};

export const getArtist = async (id: string, cookie: string = '') => {
    const res = await requestWeapi<ArtistDetail>(`${BASE_URL}/weapi/v1/artist/${id.replace(/^(neartist_|ne_artist_)/, '')}`, {}, cookie);
    return res.data;
};

export const getPlaylists = (cat: string = '全部', order: string = 'hot', limit: number = 35, offset: number = 0, cookie: string = '') => 
    requestWeapi<{ playlists: UserPlaylist[] }>(`${BASE_URL}/weapi/playlist/list`, { cat, order, limit, offset, total: true }, cookie);

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

export const convertSongToMusicTrack = (song: SongDetail | any): MusicTrack => {
    // 兼容搜索接口返回的 artists 和 album
    const artists = song.ar || song.artists || [];
    const album = song.al || song.album || {};

    return {
        id: String(song.id),
        name: song.name,
        artist: artists.map((a: any) => a.name),
        album: album.name,
        pic_id: album.picUrl, 
        url_id: String(song.id),
        lyric_id: String(song.id),
        source: '_netease',
        privilege: song.privilege,
        artist_ids: artists.map((a: any) => String(a.id || '')),
        album_id: String(album.id || ''),
    };
};