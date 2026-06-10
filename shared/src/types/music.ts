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

export type AudioFormat = "mp3" | "m4a" | "m4s" | "flv";

export interface SearchPageResult<T = MusicTrack> {
  items: T[];
  hasMore: boolean;
}

export const searchOptions: Record<string, string> = {
  all: "聚合搜索",
  joox: "Joox",
  netease: "网易云音乐",
  _netease: "Netease",
  kuwo: "酷我音乐",
  migu: "Migu",
  bilibili: "B站",
  qq: "QQ音乐",
};

export const sourceLabels: Record<string, string> = {
  joox: "Joox",
  netease: "网易",
  _netease: "Netease",
  kuwo: "酷我",
  migu: "Migu",
  bilibili: "B站",
  qq: "QQ",
};

export const aggregatedSourceOptions: {
  value: MusicSource;
  label: string;
  description: string;
}[] = [
  {
    value: "joox",
    label: "Joox",
    description: "QQ音乐海外版",
  },
  {
    value: "netease",
    label: "网易云音乐",
    description: "音源稳定，小众资源多",
  },
  { value: "_netease", label: "Netease", description: "网易云官方，稳定高速" },
  { value: "kuwo", label: "酷我音乐", description: "版权丰富，但稳定性一般" },
  {
    value: "bilibili",
    label: "B站",
    description: "Bilibili官方, 用户上传资源丰富",
  },
  { value: "migu", label: "Migu", description: "咪咕音乐官方" },
  {
    value: "qq",
    label: "QQ音乐",
    description: "来自洛雪音乐的小秋音源",
  },
];

export const sourceBadgeStyles: Record<string, string> = {
  netease: "text-red-500/70 border-red-500/20 bg-red-500/5 hover:bg-red-500/10",
  _netease:
    "text-red-500/70 border-red-500/20 bg-red-500/5 hover:bg-red-500/10",
  kuwo: "text-amber-500/70 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10",
  joox: "text-green-500/70 border-green-500/20 bg-green-500/5 hover:bg-green-500/10",

  qq: "text-yellow-500/70 border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10",
  kugou: "text-sky-500/70 border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10",
  migu: "text-pink-500 border-pink-500/30 bg-pink-500/5 hover:bg-pink-500/10",
  bilibili:
    "text-pink-500/70 border-pink-500/20 bg-pink-500/5 hover:bg-pink-500/10",
  lx_netease:
    "text-red-500/70 border-red-500/20 bg-red-500/10 hover:bg-red-500/15",
  lx_qq:
    "text-yellow-500/70 border-yellow-500/20 bg-yellow-500/10 hover:bg-yellow-500/15",
  lx_migu:
    "text-pink-500 border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/15",
  lx_kuwo:
    "text-amber-500/70 border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/15",
  lx_kugou:
    "text-sky-500/70 border-sky-500/20 bg-sky-500/10 hover:bg-sky-500/15",
  default:
    "text-muted-foreground/70 border-border bg-muted/30 hover:bg-muted/50",
};

export interface SourceConfig {
  source: MusicSource;
  enabled: boolean;
  visible: boolean;
}

export const DEFAULT_SOURCE_CONFIGS: SourceConfig[] = [
  { source: "netease", enabled: true, visible: true },
  { source: "qq", enabled: true, visible: true },
  { source: "bilibili", enabled: true, visible: true },
  { source: "_netease", enabled: false, visible: true },
  { source: "joox", enabled: false, visible: true },
  { source: "kuwo", enabled: false, visible: true },
  { source: "migu", enabled: false, visible: true },
];

export type SourceCategory = "gd" | "official" | "lx";

export const SOURCE_CATEGORY_LABELS: Record<SourceCategory, string> = {
  official: "官方音源",
  gd: "GD音源",
  lx: "洛雪音源",
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
  | "lx_netease"
  | "lx_qq"
  | "lx_migu"
  | "lx_kuwo"
  | "lx_kugou"
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
  audioFormat?: AudioFormat;
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
