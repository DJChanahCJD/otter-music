import { weapi, eapi } from './netease-crypto';
import type {
    NeteaseResponse,
    QrKeyResponse,
    QrCheckResponse,
    UserProfile,
    UserPlaylist,
    PlaylistDetail,
    SongDetail,
    SearchResult,
    RecommendPlaylist,
    Toplist,
    AlbumDetail,
    ArtistDetail,
    ResolveUrlResult
} from './netease-types';

const BASE_URL = 'https://music.163.com';
const EAPI_BASE_URL = 'https://interface3.music.163.com';

// 区分 PC 端和移动端 UA，EAPI 用移动端存活率更高
const PC_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.27';

/* =========================================================
 * 核心伪装工具集 (Cookie & IP)
 * ========================================================= */

// 生成随机国内民用 IP (如广东电信) 用于穿透 Cloudflare 机房限制
function getRandomDomesticIp(): string {
    return `113.108.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// 随机生成 16 进制秘钥
function createSecretKey(size: number): string {
    const choice = '012345679abcdef'.split('');
    let result = '';
    for (let i = 0; i < size; i++) {
        result += choice[Math.floor(Math.random() * choice.length)];
    }
    return result;
}

// 构造网易云游客 Cookie (参考 Listen1 源码，这对防 403 极其重要)
function buildVisitorCookie(): string {
    const nuid = createSecretKey(32);
    const nnid = `${nuid},${Date.now()}`;
    return `_ntes_nuid=${nuid}; _ntes_nnid3=${nnid}; NMTID=0;`;
}

function cleanCookie(cookieStr: string | null): string {
    if (!cookieStr) return '';
    const parts = cookieStr.split(/[,;]\s*/);
    const cookieMap = new Map<string, string>();
    const ignoredKeys = new Set(['expires', 'max-age', 'domain', 'path', 'httponly', 'secure', 'samesite', 'priority']);

    for (const part of parts) {
        const match = part.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (key && !ignoredKeys.has(key.toLowerCase())) cookieMap.set(key, value);
        }
    }
    return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

// 构建最终请求 Cookie
function buildCookie(rawCookie: string = ''): string {
    let finalCookie = rawCookie.trim();
    
    // 如果没有用户 Cookie，强制注入游客 Cookie 伪装身份
    if (!finalCookie) {
        finalCookie = buildVisitorCookie();
    } else if (!finalCookie.includes('=')) {
        finalCookie = `MUSIC_U=${finalCookie}`;
    } else {
        finalCookie = cleanCookie(finalCookie);
    }
    
    return `os=pc; appver=2.9.7; mode=31; ${finalCookie}`;
}


/* =========================================================
 * 底层请求函数 (双轨制)
 * ========================================================= */

/**
 * 1. 标准 WEAPI 请求函数 (Web 端专用，兼容性极高)
 */
async function requestWeapi<T = any>(url: string, data: any, cookie: string = '') {
    const encData = weapi(data);
    const params = new URLSearchParams(encData as any).toString();
    const fakeIp = getRandomDomesticIp();

    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': PC_USER_AGENT,
        'Referer': BASE_URL,
        'Origin': BASE_URL,
        'X-Real-IP': fakeIp,
        'X-Forwarded-For': fakeIp,
        'Cookie': buildCookie(cookie)
    };

    const response = await fetch(url, { method: 'POST', headers, body: params });

    if (!response.ok) {
        throw new Error(`NetEase WEAPI Error: ${response.status}`);
    }
    
    const setCookie = response.headers.get('set-cookie');
    const cleanedCookie = cleanCookie(setCookie);
    const json = await response.json();
    return { data: json as T, cookie: cleanedCookie };
}

/**
 * 2. 增强型 EAPI 请求函数 (移动端专用，带 IP 穿透和防缓存)
 */
async function requestEapi<T = any>(url: string, path: string, data: any, cookie: string = '') {
    const encData = eapi(path, data);
    const params = new URLSearchParams(encData as any).toString();
    const fakeIp = getRandomDomesticIp();

    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': MOBILE_USER_AGENT,
        'Referer': BASE_URL,
        'Origin': BASE_URL,
        'X-Real-IP': fakeIp,
        'X-Forwarded-For': fakeIp,
        'Cookie': buildCookie(cookie)
    };

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: params,
        cf: { cacheTtl: 0, cacheEverything: false } // 禁用 CF 缓存以保证 IP 伪装有效
    } as any);

    if (!response.ok) {
        throw new Error(`NetEase EAPI Error: ${response.status}`);
    }

    const json = await response.json();
    return { data: json as T };
}


/* =========================================================
 * 业务 API
 * ========================================================= */

/**
 * 获取歌曲播放 URL (核心：EAPI/WEAPI 双轨降级)
 */
export async function getSongUrl(id: string, br: number = 999000, cookie: string = '') {
    const realId = id.replace(/^(netrack_|ne_track_)/, '');
    
    // 方案 1: 尝试 EAPI (获取无损/高解析度音频)
    try {
        const eapiRes = await requestEapi<{ data: { url: string, br: number, size: number }[] }>(
            `${EAPI_BASE_URL}/eapi/song/enhance/player/url`,
            '/api/song/enhance/player/url',
            { ids: `[${realId}]`, br, header: { os: 'pc', appver: '2.9.7' } },
            cookie
        );
        
        if (eapiRes.data?.data?.[0]?.url) return eapiRes;
        console.warn(`[NetEase] EAPI empty URL for ${realId}, falling back to WEAPI...`);
    } catch (e) {
        console.warn(`[NetEase] EAPI failed for ${realId}:`, e);
    }

    // 方案 2: 降级 WEAPI (Web 端接口风控极松，确保能播)
    const weapiData = {
        ids: `[${realId}]`,
        level: br >= 320000 ? 'higher' : 'standard',
        encodeType: 'mp3',
        csrf_token: ''
    };
    
    return requestWeapi<{ data: { url: string, br: number, size: number }[] }>(
        `${BASE_URL}/weapi/song/enhance/player/url/v1`,
        weapiData,
        cookie
    );
}

// ---------- 下方全线使用 requestWeapi 替代原本脆弱的 request ----------

export async function getQrKey() {
    return requestWeapi<QrKeyResponse>(`${BASE_URL}/weapi/login/qrcode/unikey`, { type: 1 });
}

export async function checkQrStatus(key: string) {
    return requestWeapi<QrCheckResponse>(`${BASE_URL}/weapi/login/qrcode/client/login`, { key, type: 1 });
}

export async function getMyInfo(cookie: string) {
    return requestWeapi<{ profile: UserProfile }>(`${BASE_URL}/api/nuser/account/get`, {}, cookie);
}

export async function getUserPlaylists(userId: string, cookie: string) {
    const url = `${BASE_URL}/api/user/playlist`;
    const params = new URLSearchParams({ uid: userId, limit: '1000', offset: '0', includeVideo: 'true' });
    const fakeIp = getRandomDomesticIp();

    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': PC_USER_AGENT,
        'Referer': BASE_URL,
        'Origin': BASE_URL,
        'X-Real-IP': fakeIp,
        'X-Forwarded-For': fakeIp,
        'Cookie': buildCookie(cookie)
    };
    
    const response = await fetch(url, { method: 'POST', headers, body: params.toString() });
    const json = await response.json();
    return json as { playlist: UserPlaylist[], code: number };
}

export async function getPlaylistDetail(playlistId: string, cookie: string): Promise<PlaylistDetail> {
    const data = { id: playlistId, offset: 0, total: true, limit: 1000, n: 1000, csrf_token: '' };
    const res = await requestWeapi<{ playlist: any }>(`${BASE_URL}/weapi/v3/playlist/detail`, data, cookie);
    
    const playlist = res.data.playlist;
    const trackIds = playlist.trackIds.map((t: any) => t.id);
    const tracks = await getTracksDetail(trackIds, cookie);
    
    return { ...playlist, tracks } as PlaylistDetail;
}

async function getTracksDetail(trackIds: number[], cookie: string) {
    const url = `${BASE_URL}/weapi/v3/song/detail`;
    const BATCH_SIZE = 500;
    const result: SongDetail[] = [];
    
    for (let i = 0; i < trackIds.length; i += BATCH_SIZE) {
        const batch = trackIds.slice(i, i + BATCH_SIZE);
        const c = '[' + batch.map(id => `{"id":${id}}`).join(',') + ']';
        const ids = '[' + batch.join(',') + ']';
        
        const res = await requestWeapi<{ songs: SongDetail[] }>(url, { c, ids }, cookie);
        if (res.data.songs) result.push(...res.data.songs);
    }
    return result;
}

export async function search(keyword: string, type: number = 1, page: number = 1, limit: number = 20, cookie: string = '') {
    const offset = (page - 1) * limit;
    const fakeIp = getRandomDomesticIp();
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': PC_USER_AGENT,
        'Referer': BASE_URL,
        'Origin': BASE_URL,
        'X-Real-IP': fakeIp,
        'X-Forwarded-For': fakeIp,
        'Cookie': buildCookie(cookie)
    };

    const params = new URLSearchParams({ s: keyword, type: String(type), offset: String(offset), limit: String(limit) });
    const response = await fetch(`${BASE_URL}/api/search/pc`, { method: 'POST', headers, body: params.toString() });

    if (!response.ok) throw new Error(`NetEase Search API Error: ${response.status}`);
    const json = await response.json();
    return { data: json as { result: SearchResult, code: number } };
}

export async function getLyric(id: string, cookie: string = '') {
    const realId = id.replace(/^(netrack_|ne_track_)/, '');
    return requestWeapi<{ lrc: { lyric: string }, tlyric: { lyric: string } }>(
        `${BASE_URL}/weapi/song/lyric`, 
        { id: realId, lv: -1, tv: -1 }, 
        cookie
    );
}

export async function getSongDetail(id: string, cookie: string = '') {
    const realId = id.replace(/^(netrack_|ne_track_)/, '');
    const tracks = await getTracksDetail([parseInt(realId)], cookie);
    return tracks[0];
}

export async function getRecommendPlaylists(cookie: string) {
    return requestWeapi<{ result: RecommendPlaylist[] }>(
        `${BASE_URL}/weapi/personalized/playlist`, 
        { limit: 20, total: true, n: 1000 }, 
        cookie
    );
}

export async function getToplist(cookie: string = '') {
    return requestWeapi<{ list: Toplist[] }>(`${BASE_URL}/weapi/toplist/detail`, {}, cookie);
}

export async function getAlbum(id: string, cookie: string = '') {
    const realId = id.replace(/^(nealbum_|ne_album_)/, '');
    return requestWeapi<AlbumDetail>(`${BASE_URL}/weapi/v1/album/${realId}`, {}, cookie);
}

export async function getArtist(id: string, cookie: string = '') {
    const realId = id.replace(/^(neartist_|ne_artist_)/, '');
    return requestWeapi<ArtistDetail>(`${BASE_URL}/weapi/v1/artist/${realId}`, {}, cookie);
}

export async function getPlaylists(cat: string = '全部', order: string = 'hot', limit: number = 35, offset: number = 0, cookie: string = '') {
    return requestWeapi<{ playlists: UserPlaylist[] }>(
        `${BASE_URL}/weapi/playlist/list`, 
        { cat, order, limit, offset, total: true }, 
        cookie
    );
}

export async function getPlaylistDynamicDetail(id: string, cookie: string = '') {
    const realId = id.replace(/^(neplaylist_|ne_playlist_)/, '');
    return requestWeapi(
        `${BASE_URL}/weapi/playlist/detail/dynamic`,
        { id: realId },
        cookie
    );
}

export async function getAlbumDynamicDetail(id: string, cookie: string = '') {
    const realId = id.replace(/^(nealbum_|ne_album_)/, '');
    return requestWeapi(
        `${BASE_URL}/weapi/album/detail/dynamic`,
        { id: realId },
        cookie
    );
}

export async function getArtistDynamicDetail(id: string, cookie: string = '') {
    const realId = id.replace(/^(neartist_|ne_artist_)/, '');
    return requestWeapi(
        `${BASE_URL}/weapi/artist/detail/dynamic`,
        { id: realId },
        cookie
    );
}

export async function getArtistSongs(
    id: string,
    limit: number = 50,
    offset: number = 0,
    order: string = 'hot',
    cookie: string = ''
) {
    const realId = id.replace(/^(neartist_|ne_artist_)/, '');
    return requestWeapi<{ songs: SongDetail[]; total: number; more: boolean }>(
        `${BASE_URL}/weapi/v1/artist/songs`,
        { id: realId, limit, offset, order, total: true },
        cookie
    );
}

export async function getArtistAlbums(
    id: string,
    limit: number = 30,
    offset: number = 0,
    cookie: string = ''
) {
    const realId = id.replace(/^(neartist_|ne_artist_)/, '');
    return requestWeapi(
        `${BASE_URL}/weapi/artist/albums/${realId}`,
        { limit, offset, total: true },
        cookie
    );
}

export async function getSubscribedAlbums(
    limit: number = 25,
    offset: number = 0,
    cookie: string = ''
) {
    return requestWeapi(
        `${BASE_URL}/weapi/album/sublist`,
        { limit, offset, total: true },
        cookie
    );
}

export async function getSubscribedArtists(
    limit: number = 25,
    offset: number = 0,
    cookie: string = ''
) {
    return requestWeapi(
        `${BASE_URL}/weapi/artist/sublist`,
        { limit, offset, total: true },
        cookie
    );
}

export async function searchSuggest(keyword: string, cookie: string = '') {
    return requestWeapi(
        `${BASE_URL}/weapi/search/suggest/web`,
        { s: keyword },
        cookie
    );
}

export async function getHotComments(id: string, limit: number = 20, offset: number = 0, cookie: string = '') {
    const realId = id.replace(/^(netrack_|ne_track_)/, '');
    const rid = `R_SO_4_${realId}`;

    return requestWeapi(
        `${BASE_URL}/weapi/v1/resource/hotcomments/${rid}`,
        { rid, limit, offset, beforeTime: 0 },
        cookie
    );
}

export async function getNewComments(
    id: string,
    pageNo: number = 1,
    pageSize: number = 20,
    sortType: number = 2,
    cursor: string | number = 0,
    cookie: string = ''
) {
    const realId = id.replace(/^(netrack_|ne_track_)/, '');

    return requestWeapi(
        `${BASE_URL}/weapi/comment/new`,
        {
            type: 0,
            id: realId,
            sortType,
            cursor,
            pageSize,
            pageNo,
        },
        cookie
    );
}

export async function getMusicComments(id: string, limit: number = 20, offset: number = 0, cookie: string = '') {
    return getHotComments(id, limit, offset, cookie);
}

export function resolveUrl(url: string): ResolveUrlResult | null {
    let result: ResolveUrlResult | null = null;
    let id = '';
    
    url = url.replace('music.163.com/#/discover/toplist?', 'music.163.com/#/playlist?');
    url = url.replace('music.163.com/#/my/m/music/', 'music.163.com/');
    url = url.replace('music.163.com/#/m/', 'music.163.com/');
    url = url.replace('music.163.com/#/', 'music.163.com/');

    const getParameterByName = (name: string, url: string) => {
        if (!url) url = '';
        name = name.replace(/[\[\]]/g, '\\$&');
        const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
        const results = regex.exec(url);
        if (!results || !results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    };

    if (url.search('//music.163.com/playlist') !== -1) {
        const match = /\/\/music.163.com\/playlist\/([0-9]+)/.exec(url);
        id = match ? match[1] : getParameterByName('id', url);
        if (id) result = { type: 'playlist', id: `neplaylist_${id}` };
    } else if (url.search('//music.163.com/artist') !== -1) {
        const match = /\/\/music.163.com\/artist\?id=([0-9]+)/.exec(url);
        id = match ? match[1] : getParameterByName('id', url);
        if (id) result = { type: 'artist', id: `neartist_${id}` };
    } else if (url.search('//music.163.com/album') !== -1) {
        const match = /\/\/music.163.com\/album\/([0-9]+)/.exec(url);
        id = match ? match[1] : getParameterByName('id', url);
        if (id) result = { type: 'album', id: `nealbum_${id}` };
    } else if (url.search('//music.163.com/song') !== -1) {
        const match = /\/\/music.163.com\/song\/([0-9]+)/.exec(url);
        id = match ? match[1] : getParameterByName('id', url);
        if (id) result = { type: 'song', id: `netrack_${id}` };
    }
    
    return result;
}

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

export const convertSongToMusicTrack = (song: any) => {
    const artists = song.ar || song.artists || [];
    const album = song.al || song.album || {};
    const songId = String(song.id || '');

    return {
        id: songId,
        name: song.name || '',
        artist: artists.map((a: { name: string }) => a.name),
        album: album.name || '',
        pic_id: album.picUrl || songId,
        url_id: songId,
        lyric_id: songId,
        source: '_netease' as const,
    };
};
