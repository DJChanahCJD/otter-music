import { registerPlugin } from '@capacitor/core';

export interface LocalMusicFile {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  localPath: string;
  fileSize: number;
}

export interface ScanResult {
  success: boolean;
  files: LocalMusicFile[];
  error?: string;
}

export interface LocalFileUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface LocalMusicPlugin {
  scanLocalMusic(): Promise<ScanResult>;
  getLocalFileUrl(options: { localPath: string }): Promise<LocalFileUrlResult>;
}

const LocalMusicPlugin = registerPlugin<LocalMusicPlugin>('LocalMusicPlugin');

export { LocalMusicPlugin };
