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
  bilibili: "B站",
  kuwo: "酷我音乐",
};

export const sourceLabels: Record<string, string> = {
  joox: "Joox",
  netease: "网易",
  bilibili: "B站",
  kuwo: "酷我",
};

export const aggregatedSourceOptions: { value: MusicSource; label: string }[] = [
  { value: 'joox', label: 'Joox' },
  { value: 'netease', label: '网易云音乐' },
  { value: 'bilibili', label: 'B站' },
  { value: 'kuwo', label: '酷我音乐' },
];

export const sourceBadgeStyles: Record<string, string> = {
  netease: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100",
  bilibili: "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100",
  kuwo: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100",
  joox: "bg-green-50 text-green-600 border-green-200 hover:bg-green-100",
  default: "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
};

// === Music Store Types ===

// 音乐轨道信息
export type MusicSource =
  | 'netease' //  🌟
  | 'tencent'
  | 'kugou'
  | 'kuwo' //  🌟
  | 'bilibili' //  🌟
  | 'migu'
  | 'qq'
  | 'fivesing'
  | 'tk'
  | 'wy'
  | 'kg'
  | 'kw'
  | 'mg'
  | 'qi'
  | 'lizhi'
  | 'qingting'
  | 'ximalaya'
  // Common sources mentioned in doc: netease, tencent, tidal, spotify, ytmusic, qobuz, joox, deezer, migu, kugou, kuwo, ximalaya, apple
  | 'tidal' | 'spotify' | 'ytmusic' | 'qobuz' | 'joox' | 'deezer' | 'apple' | 'all' | 'local';

export interface MusicTrack {
  id: string;
  name: string;
  artist: string[];
  album: string;
  pic_id: string;
  url_id: string;
  lyric_id: string;
  source: MusicSource;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: MusicTrack[];
  createdAt: number;
}

// 本地音乐轨道信息
export interface LocalMusicTrack extends MusicTrack {
  localPath: string;     // 本地文件路径
  fileSize?: number;     // 文件大小
  lastModified?: number; // 最后修改时间
}

// 需要持久化存储的音乐数据结构
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
