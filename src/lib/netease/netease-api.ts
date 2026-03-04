import { weapi, eapi } from './netease-crypto';
import { UserProfile, UserPlaylist, PlaylistDetail, SongDetail, SearchResult, RecommendPlaylist, Toplist, AlbumDetail, ArtistDetail, ResolveUrlResult, NeteasePrivilege } from './netease-types';
import { MusicTrack } from '@/types/music';
import { cachedFetch } from "@/lib/utils/cache";
import { API_URL } from "@/lib/api/config";

const TTL_SHORT = 60 * 60 * 1000; // 1 hour
const TTL_MEDIUM = 24 * 60 * 60 * 1000; // 1 day

const BASE_URL = import.meta.env.DEV ? '/api/netease' : 'https://music.163.com';
const EAPI_BASE_URL = import.meta.env.DEV ? '/api/netease' : 'https://interface3.music.163.com';

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

function buildHeaders(cookie: string, ua: string, forceIp?: string): Record<string, string> {
    const ip = forceIp || getIpForRequest(cookie);
    return {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Real-Cookie': buildCookie(cookie),
        'X-Real-UA': ua,
        ...(ip ? { 'X-Real-IP': ip, 'X-Forwarded-For': ip } : {})
    };
}

/* =========================================================
 * 底层请求函数
 * ========================================================= */

async function requestWeapi<T = any>(url: string, data: any, cookie: string = '') {
    const finalCookie = cookie || getStoredCookie();
    const headers = buildHeaders(finalCookie, PC_USER_AGENT);
    const params = new URLSearchParams(weapi(data) as any).toString();

    const response = await fetch(url, { method: 'POST', headers, body: params });
    if (!response.ok) throw new Error(`NetEase WEAPI Error: ${response.status}`);
    
    return { 
        data: await response.json() as T, 
        cookie: cleanCookie(response.headers.get('set-cookie')) 
    };
}

async function requestEapi<T = any>(url: string, path: string, data: any, cookie: string = '') {
    const finalCookie = cookie || getStoredCookie();
    const headers = buildHeaders(finalCookie, MOBILE_USER_AGENT);
    const params = new URLSearchParams(eapi(path, data) as any).toString();

    const response = await fetch(url, { method: 'POST', headers, body: params });
    if (!response.ok) throw new Error(`NetEase EAPI Error: ${response.status}`);

    return { data: await response.json() as T };
}

// 内部代理 API 通用封装，极大减少 fetch 样板代码
async function fetchLocalApi<T>(endpoint: string, body?: any): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
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
 * 业务 API
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

export const getQrKey = () => fetchLocalApi<any>('/music-api/netease/login/qr/key');

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
        `netease:recommend`, 
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
    
    const response = await fetch(`${BASE_URL}/api/search/pc`, { method: 'POST', headers, body: params.toString() });
    if (!response.ok) throw new Error(`NetEase Search API Error: ${response.status}`);
    
    const json = await response.json();
    return { data: json as { result: SearchResult, code: number } };
}

export const getLyric = (id: string, cookie: string = '') => 
    requestWeapi<{ lrc: { lyric: string }, tlyric: { lyric: string } }>(`${BASE_URL}/weapi/song/lyric`, { id: id.replace(/^(netrack_|ne_track_)/, ''), lv: -1, tv: -1 }, cookie);

export const getSongDetail = async (id: string, cookie: string = '') => 
    (await getTracksDetail([parseInt(id.replace(/^(netrack_|ne_track_)/, ''))], cookie))[0];

export const getToplist = (cookie: string = '') => requestWeapi<{ list: Toplist[] }>(`${BASE_URL}/weapi/toplist/detail`, {}, cookie);

export const getAlbum = (id: string, cookie: string = '') => requestWeapi<AlbumDetail>(`${BASE_URL}/weapi/v1/album/${id.replace(/^(nealbum_|ne_album_)/, '')}`, {}, cookie);

export const getArtist = (id: string, cookie: string = '') => requestWeapi<ArtistDetail>(`${BASE_URL}/weapi/v1/artist/${id.replace(/^(neartist_|ne_artist_)/, '')}`, {}, cookie);

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

export const convertSongToMusicTrack = (song: SongDetail): MusicTrack => ({
    id: String(song.id),
    name: song.name,
    artist: song.ar.map(a => a.name),
    album: song.al.name,
    pic_id: song.al.picUrl, 
    url_id: String(song.id),
    lyric_id: String(song.id),
    source: '_netease',
    privilege: song.privilege,
});