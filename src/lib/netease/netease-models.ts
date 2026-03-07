import { NeteasePrivilege } from "./netease-raw-types";

export interface QrStatusResult {
  code: number;
  message: string;
  cookie?: string;
}

export interface MarketPlaylist {
  id: string;
  name: string;
  coverUrl: string;
  playCount: number;
  userId?: string;
}

export type NeteaseSongArtistLike = {
  id?: string | number;
  name: string;
};

export type NeteaseSongAlbumLike = {
  id?: string | number;
  name?: string;
  picUrl?: string;
};

export type NeteaseSongLike = {
  id: string | number;
  name?: string;
  ar?: NeteaseSongArtistLike[];
  artists?: NeteaseSongArtistLike[];
  al?: NeteaseSongAlbumLike;
  album?: NeteaseSongAlbumLike;
  fee?: number;
  st?: number;
  status?: number;
  privilege?: NeteasePrivilege;
};

export type { NeteasePrivilege };

