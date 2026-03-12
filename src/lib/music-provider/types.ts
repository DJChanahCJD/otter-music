export interface RawApiTrack {
  id: string | number;
  name: string;
  artist: string | string[];
  album: string;
  pic_id: string;
  url_id: string;
  lyric_id: string;
  artist_ids?: string[];
  album_id?: string;
}
