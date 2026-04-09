export const SYNC_KEY_PREFIX = "otter-music:user:";

export interface SyncKeyMetadata {
  lastSyncTime: number;
}

export interface SyncKeyItem {
  key: string;
  lastSyncTime: number;
}
