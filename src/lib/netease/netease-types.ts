export interface Track {
  id: string;
  title: string;
  artist: string;
  artist_id: string;
  album: string;
  album_id: string;
  source: 'netease';
  source_url: string;
  img_url: string;
  url?: string;
  fee?: number;
}

export interface PlaylistInfo {
  id: string;
  cover_img_url: string;
  title: string;
  source_url: string;
  author?: string;
  count?: number;
}

export interface SearchResult {
  result: Track[] | PlaylistInfo[];
  total: number;
  type: string;
}

export interface CookieItem {
  url: string;
  name: string;
  value?: string;
  expirationDate?: number;
  sameSite?: string;
}

export interface LyricDetail {
  lyric: string;
}

export interface NeteaseLyric {
  lrc: LyricDetail;
  tlyric?: LyricDetail;
}

export interface NeteaseAlbumDetail {
  id: string;             // 资源唯一标识 (UUID)
  name: string;           // 专辑或歌单名称
  language: string;       // 语种
  coverImgUrl: string;    // 封面图片链接
  company: string | null; // 发行公司
  transName: string | null;
  aliaName: string | null;
  genre: string | null;
  artists: Array<{
    id: string;
    name: string;
  }>;
}

export interface NeteaseChargeInfo {
  rate: number;          // 比特率，如 320000
  chargeType: number;    // 付费类型：0 为免费，1 为付费/VIP
  chargeUrl: string | null;
  chargeMessage: string | null;
}
// https://music.163.com/weapi/song/enhance/privilege
export interface NeteasePrivilege {
  id: number;            // 歌曲 ID
  fee: number;           // 资费类型：0-免费, 1-付费专辑, 4-购买数字专辑, 8-非VIP无法听低音质以外音质
  payed: number;         // 是否已付费
  st: number;            // 歌曲状态：-1 无版权, 0 正常
  pl: number;            // 默认播放音质
  maxbr: number;         // 最高比特率
  maxBrLevel: string;    // 最高音质等级，如 'hires', 'lossless', 'exhigh'
  plLevel: string;       // 播放音质等级
  dlLevel: string;       // 下载音质等级
  flLevel: string;       // 封面/无损音质等级
  freeTrialPrivilege: {
    resConsumable: boolean;
    userConsumable: boolean;
    remainTime?: number;
  };
  chargeInfoList: NeteaseChargeInfo[];
}

export interface PrivilegeResponse {
  data: NeteasePrivilege[];
  code: number;
}

export interface NeteasePlayerUrlItem {
  id: number;          // 歌曲 ID
  url: string | null;  // 播放链接（为空表示无版权或无权播放）
  br: number;          // 比特率 (bitrate)，例如 96020
  size: number;        // 文件大小 (bytes)
  md5: string;         // 文件校验值
  type: string;        // 格式，如 "m4a", "mp3"
  level: string;       // 音质等级，如 "standard", "higher", "exhigh", "lossless", "hires"
  encodeType: string;  // 编码类型，如 "aac", "mp3", "flac"
  time: number;        // 歌曲总时长 (ms)
  expi: number;        // 链接有效期（秒），通常为 1200s (20分钟)
  fee: number;         // 资费类型
  code: number;        // 状态码，200 为成功
  freeTrialInfo: string | null; // 试听信息（非完整播放时存在）
}



// ========
export interface NeteaseResponse<T = any> {
  code: number;
  data?: T;
  result?: T;
  [key: string]: any;
}

export interface SongArtist {
  id: number;
  name: string;
  tns?: string[];
  alias?: string[];
}

export interface SongAlbum {
  id: number;
  name: string;
  picUrl: string;
  tns?: string[];
  pic_url?: string;
  pic?: number;
}

export interface SongDetail {
  id: number;
  name: string;
  pst: number;
  t: number;
  ar: SongArtist[];
  al: SongAlbum;
  dt: number; // Duration
  pop: number;
  st: number;
  rt: string;
  fee: number;
  v: number;
  cf?: string;
  cp?: number;
  mv?: number;
  publishTime?: number;
  // Fields for search results (sometimes different from detail)
  artists?: SongArtist[];
  album?: SongAlbum;
  privilege?: NeteasePrivilege;
}

export interface SearchResult {
  songs?: SongDetail[];
  songCount?: number;
  hasMore?: boolean;
}

export interface PlaylistTrackId {
  id: number;
  v: number;
  t: number;
  at: number;
  uid: number;
  rcmdReason: string;
}

export interface PlaylistDetail {
  id: number;
  name: string;
  coverImgUrl: string;
  description: string;
  tags: string[];
  trackCount: number;
  playCount: number;
  userId: number;
  createTime: number;
  updateTime: number;
  subscribedCount: number;
  shareCount: number;
  commentCount: number;
  tracks: SongDetail[];
  trackIds: PlaylistTrackId[];
  creator?: {
    userId: number;
    nickname: string;
    avatarUrl: string;
  };
}

export interface UserPlaylist {
  id: number;
  name: string;
  coverImgUrl: string;
  creator: {
    userId: number;
    nickname: string;
  };
  trackCount: number;
  playCount: number;
  subscribed: boolean;
}

export interface RecommendPlaylist {
  id: number;
  name: string;
  picUrl: string;
  playCount: number;
  trackCount: number;
  copywriter?: string;
}

export interface Toplist {
  id: number;
  name: string;
  coverImgUrl: string;
  updateFrequency: string;
  ToplistType?: string;
  trackCount: number;
  playCount: number;
}

export interface ArtistDetail {
  artist: {
    id: number;
    name: string;
    picUrl: string;
    briefDesc: string;
    musicSize: number;
    albumSize: number;
    mvSize: number;
  };
  hotSongs: SongDetail[];
}

export interface AlbumDetail {
  album: {
    id: number;
    name: string;
    picUrl: string;
    description: string;
    artist: SongArtist;
    size: number;
    publishTime: number;
    company?: string;
    subType?: string;
  };
  songs: SongDetail[];
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

export interface UserProfile {
  userId: number;
  nickname: string;
  avatarUrl: string;
  backgroundUrl: string;
  signature: string;
  vipType: number;
  userType: number;
  follows: number;
  followeds: number;
  eventCount: number;
  playlistCount: number;
  playlistBeSubscribedCount: number;
}

export interface ResolveUrlResult {
  type: 'playlist' | 'artist' | 'album' | 'song';
  id: string;
}
