import { getArtist, getAlbum, getSongDetail, getMusicComments } from "@/lib/netease/netease-api";
import { SearchPageResult, MusicTrack } from "@/types/music";
import { BaseMusicProvider } from "../base-provider";

export class NeteaseProvider extends BaseMusicProvider {
  source = 'netease' as const;

  // --- Extended Capabilities ---
  // 下面的拓展能力和 NeteaseApiProvider一致

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
