import { IMusicProvider } from "./interface";
import { MusicTrack, SearchPageResult, SongLyric, SearchIntent, MusicSource } from "@/types/music";
import { normalizeTrack, requestMusicApiJSON } from "./utils";
import { retry } from "../utils";
import { RawApiTrack } from "./types";

// 所有基于 GD Studio's API 的音源基类
export abstract class BaseMusicProvider implements IMusicProvider {
  abstract source: MusicSource;

  async search(query: string, page: number, count: number, signal?: AbortSignal, _intent?: SearchIntent | null): Promise<SearchPageResult<MusicTrack>> {
    const json = await retry(
      () => requestMusicApiJSON<RawApiTrack[]>({ types: 'search', name: query, count, pages: page }, this.source, signal),
      2,
      800
    );

    const items = json.map(t => normalizeTrack(t, this.source));
    return { items, hasMore: items.length === count };
  }

  async getUrl(track: MusicTrack, br: number = 192): Promise<string | null> {
    const json = await requestMusicApiJSON<{ url?: string }>({ types: 'url', id: track.url_id, br }, this.source);
    return json.url || null;
  }

  async getPic(track: MusicTrack, size: number = 800): Promise<string | null> {
    const json = await requestMusicApiJSON<{ url?: string }>({ types: 'pic', id: track.pic_id , size }, this.source);
    return json.url || null;
  }

  async getLyric(track: MusicTrack): Promise<SongLyric | null> {
    const json = await requestMusicApiJSON<{ lyric?: string; tlyric?: string }>({ types: 'lyric', id: track.lyric_id }, this.source);
    return { lyric: json.lyric ?? '', tlyric: json.tlyric ?? '' };
  }

  async searchArtist(query: string, page: number, count: number): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }

  async searchAlbum(query: string, page: number, count: number): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }
}
