import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface LocalMusicFile {
  id: string;
  name: string | null;
  artist: string | null;
  album: string | null;
  duration: number;
  localPath: string;
  fileSize: number;
  modifiedTime?: number;
}

export interface ScanResult {
  success: boolean;
  files: LocalMusicFile[];
  error?: string;
  needManageStorage?: boolean;
}

export interface LocalFileUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface EmbeddedCoverResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export interface EmbeddedLyricsResult {
  success: boolean;
  lyric?: string;
  tlyric?: string;
  error?: string;
}

export interface WriteEmbeddedLyricsResult {
  success: boolean;
  error?: string;
}

export interface HasPermissionResult {
  hasPermission: boolean;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export interface PickDirectoryResult {
  success: boolean;
  path?: string;
  uri?: string;
  error?: string;
}

export interface SystemDarkModeResult {
  isDarkMode: boolean;
}

export interface DarkModeChangeEvent {
  isDarkMode: boolean;
}

export interface ExcludedFoldersResult {
  success: boolean;
  folders: string[];
}

export interface ExcludedFolderMutationResult {
  success: boolean;
  folder?: string;
  error?: string;
}

export interface LocalMusicPlugin {
  scanLocalMusic(): Promise<ScanResult>;
  scanAllStorage(): Promise<ScanResult>;
  getLocalFileUrl(options: { localPath: string }): Promise<LocalFileUrlResult>;
  getEmbeddedCover(options: {
    localPath: string;
  }): Promise<EmbeddedCoverResult>;
  getEmbeddedLyrics(options: {
    localPath: string;
  }): Promise<EmbeddedLyricsResult>;
  /** FLAC 专用：原生流式重写 VORBIS_COMMENT 写入歌词，原文/译文用 [TLYRIC] 分隔 */
  writeEmbeddedLyrics(options: {
    localPath: string;
    lyric: string;
    tlyric?: string;
  }): Promise<WriteEmbeddedLyricsResult>;
  openManageStorageSettings(): Promise<void>;
  hasAllStoragePermission(): Promise<HasPermissionResult>;
  deleteLocalMusic(options: { localPath: string }): Promise<DeleteResult>;
  pickDownloadDirectory(): Promise<PickDirectoryResult>;
  getSystemDarkMode(): Promise<SystemDarkModeResult>;
  getExcludedFolders(): Promise<ExcludedFoldersResult>;
  addExcludedFolder(options: {
    folder: string;
  }): Promise<ExcludedFolderMutationResult>;
  removeExcludedFolder(options: {
    folder: string;
  }): Promise<ExcludedFolderMutationResult>;
  pickExcludedDirectory(): Promise<PickDirectoryResult>;
  addListener(
    eventName: "darkModeChange",
    listenerFunc: (event: DarkModeChangeEvent) => void
  ): Promise<PluginListenerHandle>;
}

const LocalMusicPlugin = registerPlugin<LocalMusicPlugin>("LocalMusicPlugin");

export { LocalMusicPlugin };
