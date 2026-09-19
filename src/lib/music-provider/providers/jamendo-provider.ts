import {
  buildJamendoStreamUrl,
  parseJamendoTrackId,
  searchJamendoSongs,
} from "@/lib/jamendo/jamendo-api";
import type {
  MusicSource,
  MusicTrack,
  SearchPageResult,
  SongLyric,
} from "@/types/music";
import { IMusicProvider } from "../interface";

/**
 * Jamendo 音源（独立音乐人 CC 授权曲库，站点网页接口，无需注册与鉴权）。
 * 只有 mp32 一档音频流，`br` 参数不生效；接口不提供歌词。
 * 直链按 ID 模板拼出、封面在搜索结果里已是直链，故播放与封面均零额外请求。
 */
export class JamendoProvider implements IMusicProvider {
  source: MusicSource = "jamendo";

  async search(
    query: string,
    page: number,
    count: number,
    signal?: AbortSignal
  ): Promise<SearchPageResult<MusicTrack>> {
    return searchJamendoSongs(query, page, count, signal);
  }

  /** 音频直链为确定性模板（`?trackid={id}&format=mp32`），无需请求接口 */
  async getUrl(track: MusicTrack): Promise<string | null> {
    const trackId = parseJamendoTrackId(track.url_id || track.id);
    return trackId ? buildJamendoStreamUrl(trackId) : null;
  }

  /** 封面在搜索结果中已是 http 直链，无需回源 */
  async getPic(track: MusicTrack): Promise<string | null> {
    return track.pic_id?.startsWith("http") ? track.pic_id : null;
  }

  /** 站点接口不提供歌词 */
  async getLyric(_track: MusicTrack): Promise<SongLyric | null> {
    return null;
  }

  /** 无独立的歌手/专辑搜索入口，直接复用歌曲搜索 */
  async searchArtist(
    query: string,
    page: number,
    count: number
  ): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }

  /** 无独立的歌手/专辑搜索入口，直接复用歌曲搜索 */
  async searchAlbum(
    query: string,
    page: number,
    count: number
  ): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }
}
