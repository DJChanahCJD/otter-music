import { IMusicProvider } from "../interface";
import {
  getMiguLyric,
  getMiguSongUrl,
  searchMiguSongs,
} from "@/lib/migu/migu-api";
import {
  MusicTrack,
  SearchIntent,
  SearchPageResult,
  SongLyric,
} from "@/types/music";

export class MiguApiProvider implements IMusicProvider {
  source = "migu" as const;

  async search(
    query: string,
    page: number,
    count: number,
    _signal?: AbortSignal,
    _intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    const result = await searchMiguSongs(query, page, count);
    return { items: result.items, hasMore: result.hasMore };
  }

  /**
   * 通过导入时编码进曲目 ID 的 copyrightId/contentId 获取播放地址。
   */
  async getUrl(track: MusicTrack, br?: number): Promise<string | null> {
    return getMiguSongUrl(track.url_id || track.id, br);
  }

  /**
   * 返回导入时已保存的封面地址。
   */
  async getPic(track: MusicTrack, _size?: number): Promise<string | null> {
    return track.pic_id || null;
  }

  /**
   * 通过导入时保存的 LRC URL 获取歌词。
   */
  async getLyric(track: MusicTrack): Promise<SongLyric | null> {
    return getMiguLyric(track.lyric_id);
  }

  /**
   * 搜索歌手（内部调用 search，使歌手跳转走咪咕音源自身搜索而非聚合搜索）
   */
  async searchArtist(
    query: string,
    page: number,
    count: number,
  ): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }

  /**
   * 搜索专辑（内部调用 search，使专辑跳转走咪咕音源自身搜索而非聚合搜索）
   */
  async searchAlbum(
    query: string,
    page: number,
    count: number,
  ): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }
}
