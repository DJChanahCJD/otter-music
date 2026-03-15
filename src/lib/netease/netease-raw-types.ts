interface BaseEntity {
  id: number | string;
  name: string;
}

export interface RawNeteaseResponse<T = unknown> {
  code: number;
  data?: T;
  result?: T;
  message?: string;
}

export interface RawQrKeyData {
  code: number;
  unikey: string;
}

export type RawQrCheckResponse =
  | {
      code: number;
      message: string;
      cookie?: string;
    }
  | {
      message?: string;
      cookie?: string;
      data?: {
        code: number;
        message: string;
      };
    };

export interface SongArtist extends BaseEntity {
  tns?: string[];
  alias?: string[];
}

export interface SongAlbum extends BaseEntity {
  picUrl: string;
  tns?: string[];
}

export interface SongDetail extends BaseEntity {
  ar: SongArtist[];
  al: SongAlbum;
  dt: number;
  fee: number;
  privilege?: NeteasePrivilege;
  publishTime?: number;
  st: number;
}

export interface NeteasePrivilege {
  id: number;
  fee: number;
  payed: number;
  st: number;
  pl: number;
  maxbr: number;
  plLevel: string;
  freeTrialPrivilege: {
    remainTime?: number;
  };
}

export interface AlbumDynamicDetail {
  onSale: boolean;
  commentCount: number;
  likedCount: number;
  shareCount: number;
  isSub: boolean;
  subTime: number;
  subCount: number;
}

export interface PlaylistDynamicDetail {
  bookedCount: number;
  subscribed: boolean;
  shareCount: number;
  commentCount: number;
  playCount: number;
}

export interface NeteasePlayerUrlItem {
  id: number;
  url: string | null;
  br: number;
  size: number;
  type: string;
  level: string;
  freeTrialInfo: unknown | null;
}

export interface PlaylistDetail extends BaseEntity {
  coverImgUrl: string;
  description: string;
  trackCount: number;
  playCount: number;
  tracks: SongDetail[];
  trackIds: Array<{ id: number }>;
  creator?: UserProfile;
  subscribed?: boolean;
}

export interface UserPlaylist extends BaseEntity {
  coverImgUrl: string;
  coverUrl?: string;
  picUrl?: string;
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
  tlyric?: LyricDetail;
  romalrc?: LyricDetail;
}

export interface RecommendPlaylist extends BaseEntity {
  picUrl?: string;
  coverImgUrl?: string;
  coverUrl?: string;
  playCount: number;
  trackCount: number;
  copywriter?: string;
}

export interface Toplist extends BaseEntity {
  coverImgUrl: string;
  coverUrl?: string;
  picUrl?: string;
  updateFrequency: string;
  trackCount: number;
  playCount: number;
  ToplistType?: string;
}

export interface AlbumDetail {
  album: SongAlbum & {
    description: string;
    artist: SongArtist;
    size: number;
    publishTime: number;
    company?: string;
    subType?: string;
  };
  songs: SongDetail[];
}

export interface ArtistDetail {
  artist: SongArtist & {
    picUrl: string;
    briefDesc: string;
    musicSize: number;
    albumSize: number;
    mvSize: number;
    followed: boolean;  //  传入 cookie 时才会返回
  };
  hotSongs: SongDetail[];
}

export interface ArtistItem extends BaseEntity {
  picUrl: string;
  albumSize: number;
}

export interface ArtistAlbum extends BaseEntity {
  picUrl: string;
  publishTime: number;
  size: number;
  type?: string;
  artist?: ArtistItem;
}

export type NeteaseSearchResult = {
  songs?: SongDetail[];
  playlists?: UserPlaylist[];
  songCount?: number;
  hasMore?: boolean;
};

export interface ResolveUrlResult {
  type: "playlist" | "artist" | "album" | "song";
  id: string;
}

export interface CookieItem {
  url: string;
  name: string;
  value: string;
  expirationDate?: number;
}

export interface SearchSuggestResult {
  songs?: Array<{ id: number; name: string; artists: Array<{ id: number; name: string; picUrl?: string }>; album: { id: number; name: string; status: number; copyrightId: number } }>;
  artists?: Array<{ id: number; name: string; picUrl: string; alias: string[] }>;
  albums?: Array<{ id: number; name: string; artist: { name: string; picUrl: string }; status: number; copyrightId: number }>;
  playlists?: Array<{ id: number; name: string; coverImgUrl: string; creator: { nickname: string }; trackCount: number; playCount: number; bookCount: number }>;
  order?: string[];
}

export interface NeteaseCommentUser {
  userId: number;
  nickname: string;
  avatarUrl: string;
}

export interface NeteaseComment {
  user: NeteaseCommentUser;
  commentId: number;
  content: string;
  time: number;
  likedCount: number;
}

export interface NeteaseCommentResult {
  isMusician: boolean;
  cnum: number;
  userId: number;
  topComments: NeteaseComment[];
  moreHot: boolean;
  hotComments: NeteaseComment[];
  commentBanner?: unknown;
  code: number;
  comments: NeteaseComment[];
  total: number;
  more: boolean;
}

export interface NeteaseNewCommentResult {
  code: number;
  data: {
    comments: NeteaseComment[];
    currentComment: unknown;
    totalCount: number;
    hasMore: boolean;
    cursor: string;
    sortType: number;
    sortTypeList: Array<{
      sortType: number;
      sortTypeName: string;
      isDefault: boolean;
    }>;
  };
}
