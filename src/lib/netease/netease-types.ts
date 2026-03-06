/**
 * 基础实体，统一 ID 类型
 */
interface BaseEntity {
  id: number | string;
  name: string;
}

/* =========================================================
 * 1. 核心通用类型 (用于前端展示)
 * ========================================================= */

export interface Track extends BaseEntity {
  title: string;        // 映射自 name
  artist: string;
  artist_id: string;
  album: string;
  album_id: string;
  source: 'netease';
  source_url: string;
  img_url: string;
  url?: string;
  fee?: number;
  privilege?: NeteasePrivilege;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  cover_img_url: string;
  source_url: string;
  author?: string;
  count?: number;
}

export interface SearchResult {
  songs?: SongDetail[];
  playlists?: UserPlaylist[]; // 支持多类型搜索
  songCount?: number;
  hasMore?: boolean;
}

/* =========================================================
 * 2. 网易云原生数据结构 (用于 API 响应)
 * ========================================================= */

export interface NeteaseResponse<T = unknown> {
  code: number;
  data?: T;
  result?: T;
  message?: string;
}

export interface QrKeyResponse {
  code: number;
  unikey: string;
}

export interface QrCheckResponse {
  code: number;
  message: string;
  cookie?: string;
}

export interface SongArtist extends BaseEntity {
  name: string;
  tns?: string[];
  alias?: string[];
}

export interface SongAlbum extends BaseEntity {
  picUrl: string;
  tns?: string[];
}

export interface SongDetail extends BaseEntity {
  name: string;        // 歌曲名称
  ar: SongArtist[];
  al: SongAlbum;
  dt: number;       //  时长
  fee: number;      // 付费类型（0-免费, 1-VIP, 4-数专, 8-非VIP低音质)
  privilege?: NeteasePrivilege;
  publishTime?: number;
  st: number;           // 状态
}

/* =========================================================
 * 3. 权限、资费与播放信息
 * ========================================================= */

export interface NeteasePrivilege {
  id: number;
  fee: number;          // 0-免费, 1-VIP, 4-数专, 8-非VIP低音质
  payed: number;        // 0-未付, 1-已付
  st: number;           // -1-无版权, 0-正常
  pl: number;           // 播放级别
  maxbr: number;        // 最大比特率
  plLevel: string;      // 播放音质级别 (hires, lossless...)
  freeTrialPrivilege: {
    remainTime?: number;
  };
}

export interface NeteasePlayerUrlItem {
  id: number;
  url: string | null;
  br: number;           // Bitrate
  size: number;
  type: string;         // mp3, flac...
  level: string;
  freeTrialInfo: unknown | null;
}

/* =========================================================
 * 4. 业务逻辑与账户相关
 * ========================================================= */

export interface PlaylistDetail extends BaseEntity {
  coverImgUrl: string;
  description: string;
  trackCount: number;
  playCount: number;
  tracks: SongDetail[];
  trackIds: Array<{ id: number }>;
  creator?: UserProfile;
}

export interface UserPlaylist extends BaseEntity {
  coverImgUrl: string;
  trackCount: number;
  playCount: number;
  subscribed: boolean;
  creator: { nickname: string; userId: number };
}

export interface UserProfile {
  userId: number;
  nickname: string;
  avatarUrl: string;
  backgroundUrl?: string;
  signature?: string;
  vipType?: number;
}

export interface LyricDetail {
  lyric: string;
}

export interface NeteaseLyric {
  lrc: LyricDetail;
  tlyric?: LyricDetail; // 翻译歌词
  romalrc?: LyricDetail; // 罗马音歌词
}

/**
 * 推荐歌单 (首页/每日推荐)
 */
export interface RecommendPlaylist extends BaseEntity {
  picUrl: string;
  playCount: number;
  trackCount: number;
  copywriter?: string;    // 推荐语
}

/**
 * 排行榜 (排行榜列表页)
 */
export interface Toplist extends BaseEntity {
  coverImgUrl: string;
  updateFrequency: string; // 更新频率，如 "每周四更新"
  trackCount: number;
  playCount: number;
  ToplistType?: string;    // 云音乐特色榜、全球榜等标识
}

/**
 * 专辑详情 (包含专辑信息与歌曲列表)
 */
export interface AlbumDetail {
  album: SongAlbum & {    // 扩展基础 Album 信息
    description: string;
    artist: SongArtist;
    size: number;
    publishTime: number;
    company?: string;
    subType?: string;      // 专辑、EP、Single 等
  };
  songs: SongDetail[];
}

/**
 * 歌手详情 (包含歌手信息与热门歌曲)
 */
export interface ArtistDetail {
  artist: SongArtist & {  // 扩展基础 Artist 信息
    picUrl: string;
    briefDesc: string;
    musicSize: number;
    albumSize: number;
    mvSize: number;
  };
  hotSongs: SongDetail[];
}

/**
 * 歌手简略信息 (用于列表展示)
 */
export interface ArtistItem extends BaseEntity {
  picUrl: string;
  albumSize: number;
  musicSize: number;
  alias?: string[];
}

/* =========================================================
 * 5. 辅助与响应结果
 * ========================================================= */

export interface ResolveUrlResult {
  type: 'playlist' | 'artist' | 'album' | 'song';
  id: string;
}

export interface QrCheckResponse {
  message: string;
  cookie?: string;
  data?: {
    code: number;
    message: string;
  };
}
export interface CookieItem {
  url: string;
  name: string;
  value: string;
  expirationDate?: number;
}