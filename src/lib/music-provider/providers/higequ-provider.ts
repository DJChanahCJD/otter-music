import {
  getHigequSongDetail,
  parseHigequRid,
  searchHigequSongs,
} from "@/lib/higequ/higequ-api";
import type {
  MusicSource,
  MusicTrack,
  SearchIntent,
  SearchPageResult,
  SongLyric,
} from "@/types/music";
import { IMusicProvider } from "../interface";

/**
 * Hi歌曲音乐网音源。上层 `musicApi` 只会传入 `higequ_{rid}` 形式的 ID，
 * 音频直链、封面、歌词都需要解析播放页，因此统一走 `getHigequSongDetail`
 * （内部有播放页缓存，一次播放只发一次请求）。
 */
export class HigequProvider implements IMusicProvider {
  source: MusicSource = "higequ";

  async search(
    query: string,
    page: number,
    _count: number,
    signal?: AbortSignal,
    _intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    return searchHigequSongs(query, page, signal);
  }

  /** 站点只有单一 MP3 直链，`br` 参数不生效 */
  async getUrl(track: MusicTrack, _br?: number): Promise<string | null> {
    const rid = parseHigequRid(track.url_id || track.id);
    if (!rid) return null;
    return (await getHigequSongDetail(rid))?.audioUrl || null;
  }

  async getPic(track: MusicTrack, _size?: number): Promise<string | null> {
    const rid = parseHigequRid(track.pic_id || track.id);
    if (!rid) return null;
    return (await getHigequSongDetail(rid))?.coverUrl || null;
  }

  async getLyric(track: MusicTrack): Promise<SongLyric | null> {
    const rid = parseHigequRid(track.lyric_id || track.id);
    if (!rid) return null;
    const detail = await getHigequSongDetail(rid);
    if (!detail?.lyric) return null;
    return { lyric: detail.lyric, tlyric: "" };
  }

  /** 站点无独立的歌手/专辑搜索，直接复用歌曲搜索 */
  async searchArtist(
    query: string,
    page: number,
    count: number
  ): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }

  /** 站点无独立的歌手/专辑搜索，直接复用歌曲搜索 */
  async searchAlbum(
    query: string,
    page: number,
    count: number
  ): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }
}
