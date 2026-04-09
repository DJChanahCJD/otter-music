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
  pic_str?: string;
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
