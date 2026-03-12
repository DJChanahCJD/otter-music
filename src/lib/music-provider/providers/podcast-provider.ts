import { IMusicProvider } from "../interface";
import { MusicTrack, SearchPageResult, SongLyric, SearchIntent } from "@/types/music";
import { normalizeTrack, requestMusicApiJSON } from "../utils";
import { retry } from "../../utils";
import { RawApiTrack } from "../types";

export class PodcastProvider implements IMusicProvider {
  private source = 'podcast' as const;

  async search(query: string, page: number, count: number, signal?: AbortSignal, _intent?: SearchIntent): Promise<SearchPageResult<MusicTrack>> {
    const json = await retry(
      () => requestMusicApiJSON<RawApiTrack[]>({ types: 'search', name: query, count, pages: page }, this.source, signal),
      2,
      500
    );

    const items = json.map(t => normalizeTrack(t, this.source));
    return { items, hasMore: items.length === count };
  }

  async getUrl(track: MusicTrack, _br: number = 192): Promise<string | null> {
    return track.url_id || null;
  }

  async getPic(track: MusicTrack, _size: number = 800): Promise<string | null> {
    return track.pic_id || track.id || null;
  }

  async getLyric(_track: MusicTrack): Promise<SongLyric | null> {
    return null;
  }
}
