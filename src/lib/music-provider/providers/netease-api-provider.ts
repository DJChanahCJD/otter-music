import { IMusicProvider } from "../interface";
import { MusicTrack, SearchPageResult, SongLyric, SearchIntent } from "@/types/music";
import { 
  getSongUrl, 
  getLyric, 
  getSongDetail, 
  search as neteaseSearch, 
  convertSongToMusicTrack,
  getArtist,
  getAlbum,
  getMusicComments
} from "@/lib/netease/netease-api";
import { forceHttps } from "../utils";

export class NeteaseApiProvider implements IMusicProvider {
  source = '_netease';
  isLocal = false;
  canUnlock = true;

  async search(query: string, page: number, count: number, _signal?: AbortSignal, _intent?: SearchIntent): Promise<SearchPageResult<MusicTrack>> {
    // Note: signal is not currently supported by netease-api search, but that's fine
    const res = await neteaseSearch(query, 1, page, count);
    const songs = res.data.result.songs || [];
    const items = songs.map(convertSongToMusicTrack);
    return {
      items,
      hasMore: res.data.result.hasMore ?? ((res.data.result.songCount || 0) > page * count)
    };
  }

  async getUrl(track: MusicTrack, br: number = 192): Promise<string | null> {
    try {
      const res = await getSongUrl(track.id, br * 1000);
      return forceHttps(res.data?.data?.[0]?.url) || null;
    } catch (e) {
      console.error('NeteaseProvider getUrl failed:', e);
      return null;
    }
  }

  async getPic(track: MusicTrack, size: number = 800): Promise<string | null> {
    // TODO: 当前 MusicCover 里已经确保forceHttps， 这里是否还需要forceHttps？    
    try {
      const song = await getSongDetail(track.id);
      const url = song?.al?.picUrl;
      return url ? `${url}?param=${size}y${size}` : null;
    } catch (e) {
      console.error('NeteaseProvider getPic failed:', e);
      return null;
    }
  }

  async getLyric(track: MusicTrack): Promise<SongLyric | null> {
    try {
      const res = await getLyric(track.id);
      if (!res || !res.data) return { lyric: '', tlyric: '' };
      return {
        lyric: res.data.lrc?.lyric || '',
        tlyric: res.data.tlyric?.lyric || ''
      };
    } catch (e) {
      console.error('NeteaseProvider getLyric failed:', e);
      return null;
    }
  }

  // --- Extended Capabilities ---

  async getArtistDetail(id: string) {
    return getArtist(id);
  }

  async getAlbumDetail(id: string) {
    return getAlbum(id);
  }

  async getSongDetail(id: string) {
    return getSongDetail(id);
  }

  async getComments(id: string) {
    return getMusicComments(id);
  }

  async searchArtist(query: string, page: number, count: number): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }

  async searchAlbum(query: string, page: number, count: number): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }
}
