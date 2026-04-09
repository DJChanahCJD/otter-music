import type { NeteasePrivilege } from "./netease";

export interface SearchResult {
  code: number;
  data: MusicTrack[];
  error?: string;
}

export interface SongUrl {
  url: string;
  br: number;
  size: number;
}

export interface SongPic {
  url: string;
}

export interface SongLyric {
  lyric: string;
  tlyric?: string;
}

export type MergedMusicTrack = MusicTrack & {
  variants?: MusicTrack[];
};

export interface SearchPageResult<T = MusicTrack> {
  items: T[];
  hasMore: boolean;
}

export const searchOptions: Record<string, string> = {
  all: "聚合搜索",
  joox: "Joox",
  netease: "网易云音乐",
  kuwo: "酷我音乐",
  _netease: "Netease",
};

export const sourceLabels: Record<string, string> = {
  joox: "Joox",
  netease: "网易",
  kuwo: "酷我",
  _netease: "Netease",
};

export const aggregatedSourceOptions: {
  value: MusicSource;
  label: string;
  description: string;
}[] = [
  { value: "joox", label: "Joox", description: "QQ音乐海外版，专注东南亚及港台流行资源" },
  { value: "netease", label: "网易云音乐", description: "音源稳定，小众资源多" },
  { value: "_netease", label: "Netease", description: "网易云官方，稳定高速" },
  { value: "kuwo", label: "酷我音乐", description: "版权丰富，但稳定性一般" },
];

export const sourceBadgeStyles: Record<string, string> = {
  netease: "text-red-500/70 border-red-500/20 bg-red-500/5 hover:bg-red-500/10",
  _netease: "text-red-500/70 border-red-500/20 bg-red-500/5 hover:bg-red-500/10",
  kuwo: "text-amber-500/70 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10",
  joox: "text-green-500/70 border-green-500/20 bg-green-500/5 hover:bg-green-500/10",
  default: "text-muted-foreground/70 border-border bg-muted/30 hover:bg-muted/50",
};

export type MusicSource =
  | "netease"
  | "_netease"
  | "joox"
  | "tencent"
  | "kugou"
  | "kuwo"
  | "bilibili"
  | "migu"
  | "qq"
  | "fivesing"
  | "tk"
  | "wy"
  | "kg"
  | "kw"
  | "mg"
  | "qi"
  | "lizhi"
  | "qingting"
  | "ximalaya"
  | "xiaoyuzhou"
  | "podcast"
  | "tidal"
  | "spotify"
  | "ytmusic"
  | "qobuz"
  | "deezer"
  | "apple"
  | "all"
  | "local";

export interface SearchIntent {
  type: "artist" | "album" | "playlist" | "";
  id?: string;
  name?: string;
  artist?: string;
}

export interface SearchSuggestionItem {
  id?: string;
  text: string;
  type: "song" | "artist" | "album" | "playlist";
  source?: MusicSource;
}

export interface MusicTrack {
  id: string;
  name: string;
  artist: string[];
  album: string;
  pic_id: string;
  url_id: string;
  lyric_id: string;
  source: MusicSource;
  update_time?: number;
  is_deleted?: boolean;
  privilege?: NeteasePrivilege;
  artist_ids?: string[];
  album_id?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: MusicTrack[];
  createdAt: number;
  update_time?: number;
  is_deleted?: boolean;
  coverUrl?: string;
  description?: string;
}

export interface LocalMusicTrack extends MusicTrack {
  localPath: string;
  fileSize?: number;
  lastModified?: number;
}

export interface MusicStoreData {
  favorites: MusicTrack[];
  playlists: Playlist[];
  queue: MusicTrack[];
  originalQueue?: MusicTrack[];
  currentIndex: number;
  volume: number;
  isRepeat: boolean;
  isShuffle: boolean;
  quality: string;
  searchSource: MusicSource;
  updatedAt?: number;
}
