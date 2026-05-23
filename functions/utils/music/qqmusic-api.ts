// --- QQ音乐 API 响应类型 (服务端自包含，不依赖 src/) ---

interface QqPlaylistResponse {
  code: number;
  cdlist: QqCdItem[];
}

interface QqCdItem {
  dissid: string;
  dissname: string;
  logo: string;
  songnum: number;
  songlist: QqSongRaw[];
}

interface QqSongRaw {
  songid: string;
  songmid: string;
  songname: string;
  singer: { name: string }[];
  albumname: string;
  albummid: string;
  interval: number;
}

export interface QqPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: QqSongRaw[];
}

// --- API 调用 ---

const API_URL = 'https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function stripJsonp(text: string): string {
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  if (start !== -1 && end !== -1) return text.slice(start + 1, end);
  return text;
}

/**
 * 根据歌单 ID 获取 QQ 音乐歌单详情。
 * 在 Cloudflare Worker 环境中运行，绕过浏览器 CORS 限制。
 */
export async function fetchQqPlaylistDetail(id: string): Promise<QqPlaylistDetail> {
  const url = `${API_URL}?format=json&type=1&utf8=1&categoryID=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: {
      'Referer': 'https://y.qq.com',
      'User-Agent': USER_AGENT,
    },
  });

  if (!res.ok) throw new Error(`QQ Music API error: ${res.status}`);

  const rawText = await res.text();
  const jsonText = stripJsonp(rawText);
  const data = JSON.parse(jsonText) as QqPlaylistResponse;

  if (data.code !== 0) throw new Error(`QQ Music API returned code ${data.code}`);
  if (!data.cdlist?.length) throw new Error('歌单不存在或已被删除');

  const cd = data.cdlist[0];

  return {
    name: cd.dissname,
    coverUrl: cd.logo,
    trackCount: cd.songnum,
    songs: cd.songlist || [],
  };
}
