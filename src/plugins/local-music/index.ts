import { registerPlugin } from '@capacitor/core';

export interface LocalMusicFile {
  id: string;
  name: string | null;
  artist: string | null;
  album: string | null;
  duration: number;
  localPath: string;
  fileSize: number;
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

export interface HasPermissionResult {
  hasPermission: boolean;
}

export interface LocalMusicPlugin {
  scanLocalMusic(): Promise<ScanResult>;
  scanAllStorage(): Promise<ScanResult>;
  getLocalFileUrl(options: { localPath: string }): Promise<LocalFileUrlResult>;
  openManageStorageSettings(): Promise<void>;
  hasAllStoragePermission(): Promise<HasPermissionResult>;
}

const LocalMusicPlugin = registerPlugin<LocalMusicPlugin>('LocalMusicPlugin');

export { LocalMusicPlugin };
