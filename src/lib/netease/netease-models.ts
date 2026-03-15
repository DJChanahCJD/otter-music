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

export type NeteaseSongArtist = {
  id?: string | number;
  name: string;
};

export type NeteaseSongAlbum = {
  id?: string | number;
  name?: string;
  picUrl?: string;
};

export type NeteaseSong = {
  id: string | number;
  name?: string;
  ar?: NeteaseSongArtist[];
  artists?: NeteaseSongArtist[];
  al?: NeteaseSongAlbum;
  album?: NeteaseSongAlbum;
  fee?: number;
  st?: number;
  status?: number;
  privilege?: NeteasePrivilege;
};

export type { NeteasePrivilege };

