import type { MusicTrack } from '@/types/music';
import type { QqPlaylistDetail, QqSongRaw } from './qqmusic-types';
import { QQ_BASE_URL } from './qqmusic-types';
import { IS_NATIVE, IS_WEB_PROD, getApiUrl } from '@/lib/api/config';

const QQ_PROXY_PREFIX = '/music-api/qqmusic';
const NETWORK_TIMEOUT = 12000;

/**
 * 从 QQ 音乐分享链接中提取歌单数字 ID。
 * 支持格式:
 *   https://y.qq.com/n/yqq/playlist/{id}.html
 *   https://i.y.qq.com/n2/m/share/details/taoge.html?id={id}
 */
export function parseQqMusicUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);

    // 尝试从路径中提取: /n/yqq/playlist/7177076625.html
    const playlistMatch = url.pathname.match(/playlist\/(\d+)/);
    if (playlistMatch) return playlistMatch[1];

    // 尝试从 query 参数中提取: ?id=7177076625
    const idParam = url.searchParams.get('id');
    if (idParam && /^\d+$/.test(idParam)) return idParam;

    return null;
  } catch {
    return null;
  }
}

/**
 * 将 QQ 音乐歌曲对象转换为应用内部的 MusicTrack 格式。
 */
export function convertQqSongToMusicTrack(song: QqSongRaw): MusicTrack {
  const picUrl = song.albummid
    ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.albummid}.jpg`
    : '';

  return {
    id: `qq_${song.songmid}`,
    name: song.songname,
    artist: song.singer.map((s) => s.name),
    album: song.albumname,
    pic_id: picUrl,
    url_id: song.songmid,
    lyric_id: song.songmid,
    source: 'qq',
  };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeout = NETWORK_TIMEOUT) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * 获取 QQ 音乐歌单详情。
 * - 开发环境 (Web): 通过 Vite 代理 /api/qqmusic → i.y.qq.com
 * - 生产环境 (Web): 通过 Cloudflare Worker /music-api/qqmusic/playlist
 * - 原生环境 (Capacitor): 直接调用 i.y.qq.com (原生无 CORS 限制)
 */
export async function getQqPlaylistDetail(playlistId: string): Promise<QqPlaylistDetail> {
  if (IS_WEB_PROD) {
    // 生产环境走 Worker 代理
    const apiUrl = getApiUrl();
    const res = await fetchWithTimeout(`${apiUrl}${QQ_PROXY_PREFIX}/playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
    }
    return res.json();
  }

  if (IS_NATIVE) {
    // 原生环境直接请求
    const url = `${QQ_BASE_URL}/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?format=json&type=1&utf8=1&categoryID=${encodeURIComponent(playlistId)}`;
    const { CapacitorHttp } = await import('@capacitor/core');
    const res = await CapacitorHttp.request({
      method: 'GET',
      url,
      headers: { 'Referer': 'https://y.qq.com' },
    });
    if (res.status >= 400) throw new Error(`QQ Music API error: ${res.status}`);
    const rawText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const jsonText = stripJsonp(rawText);
    const data = JSON.parse(jsonText);
    if (!data.cdlist?.length) throw new Error('歌单不存在或已被删除');
    return {
      name: data.cdlist[0].dissname,
      coverUrl: data.cdlist[0].logo,
      trackCount: data.cdlist[0].songnum,
      songs: data.cdlist[0].songlist || [],
    };
  }

  // 开发环境 (Web): 通过 Vite 代理
  const url = `/api/qqmusic/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?format=json&type=1&utf8=1&categoryID=${encodeURIComponent(playlistId)}`;
  const res = await fetchWithTimeout(url, {
    headers: { 'Referer': 'https://y.qq.com' },
  });
  if (!res.ok) throw new Error(`QQ Music API error: ${res.status}`);

  const rawText = await res.text();
  const jsonText = stripJsonp(rawText);
  const data = JSON.parse(jsonText);

  if (!data.cdlist?.length) throw new Error('歌单不存在或已被删除');

  return {
    name: data.cdlist[0].dissname,
    coverUrl: data.cdlist[0].logo,
    trackCount: data.cdlist[0].songnum,
    songs: data.cdlist[0].songlist || [],
  };
}

/** 去除 QQ 音乐 JSONP 包装: jsonCallback({...}) → {...} */
function stripJsonp(text: string): string {
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  if (start !== -1 && end !== -1) return text.slice(start + 1, end);
  return text;
}
