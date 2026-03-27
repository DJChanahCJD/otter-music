import { IMusicProvider } from "../interface";
import { MusicTrack, SearchPageResult, SongLyric, SearchIntent } from "@/types/music";
import { Capacitor } from "@capacitor/core";
import { LocalMusicPlugin } from "@/plugins/local-music";
import { logger } from "@/lib/logger";

export class LocalProvider implements IMusicProvider {
  isLocal = true;

  async search(_query: string, _page: number, _count: number, _signal?: AbortSignal, _intent?: SearchIntent): Promise<SearchPageResult<MusicTrack>> {
    return { items: [], hasMore: false };
  }

  async getUrl(track: MusicTrack, _br?: number): Promise<string | null> {
    const path = track.url_id;

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LocalMusicPlugin.getLocalFileUrl({ localPath: path });
        if (result.success && result.url) {
          return Capacitor.convertFileSrc(result.url);
        }
        logger.error("local-provider", "getLocalFileUrl failed", result.error);
        return null;
      } catch (e) {
        logger.error("local-provider", "getLocalFileUrl error", e);
        return null;
      }
    }
    return Capacitor.convertFileSrc(path);
  }

  async getPic(track: MusicTrack, _size?: number): Promise<string | null> {
     return track.pic_id || null;
  }

  async getLyric(_track: MusicTrack): Promise<SongLyric | null> {
    return null;
  }
}
