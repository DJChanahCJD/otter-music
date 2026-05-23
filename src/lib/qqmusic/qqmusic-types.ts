/** QQ音乐 API 返回的歌单响应 (JSONP 包装去除后) */
export interface QqPlaylistResponse {
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

/** QQ音乐 API 中的原始歌曲对象 */
export interface QqSongRaw {
  songid: string;
  songmid: string;
  songname: string;
  singer: QqSingerRaw[];
  albumname: string;
  albummid: string;
  interval: number;
}

interface QqSingerRaw {
  name: string;
}

/** 清理后的歌单详情 (与 MusicTrack 转换前) */
export interface QqPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: QqSongRaw[];
}

/** QQ音乐 API 常量 */
export const QQ_BASE_URL = 'https://i.y.qq.com';
