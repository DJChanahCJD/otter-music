import { ID3Writer } from "browser-id3-writer";

/** ImageType.CoverFront = 3，因 isolatedModules 禁用 const enum，直接用数值 */
const APIC_TYPE_COVER_FRONT = 3;
import { musicApi } from "@/lib/music-api";
import { logger } from "@/lib/logger";
import type { MusicTrack } from "@/types/music";

export const MAX_EMBED_SIZE = 50 * 1024 * 1024; // 50MB

interface EmbedResult {
  blob: Blob;
  arrayBuffer: ArrayBuffer;
  coverEmbedded: boolean;
  lyricEmbedded: boolean;
}

/**
 * 在 MP3 blob 中内嵌封面图和歌词。跳过超过 50MB 的文件。
 */
export async function embedMetadata(
  mp3Blob: Blob,
  track: MusicTrack,
  options: { embedCover: boolean; embedLyric: boolean }
): Promise<EmbedResult> {
  const { embedCover, embedLyric } = options;

  if (!embedCover && !embedLyric) {
    return {
      blob: mp3Blob,
      arrayBuffer: await mp3Blob.arrayBuffer(),
      coverEmbedded: false,
      lyricEmbedded: false,
    };
  }

  if (mp3Blob.size > MAX_EMBED_SIZE) {
    logger.warn("id3-embed", `文件过大 (${(mp3Blob.size / 1024 / 1024).toFixed(1)}MB)，跳过元数据嵌入`);
    return {
      blob: mp3Blob,
      arrayBuffer: await mp3Blob.arrayBuffer(),
      coverEmbedded: false,
      lyricEmbedded: false,
    };
  }

  const buffer = await mp3Blob.arrayBuffer();
  const writer = new ID3Writer(buffer);

  let coverEmbedded = false;
  let lyricEmbedded = false;

  // 写入基本标签
  writer.setFrame("TIT2", track.name);
  writer.setFrame("TPE1", track.artist ?? []);
  if (track.album) writer.setFrame("TALB", track.album);

  if (embedCover) {
    const coverData = await fetchCoverData(track);
    if (coverData) {
      writer.setFrame("APIC", {
        type: APIC_TYPE_COVER_FRONT,
        data: coverData.buffer,
        description: "Cover",
      });
      coverEmbedded = true;
    }
  }

  if (embedLyric) {
    const lyricText = await fetchLyricText(track);
    if (lyricText) {
      writer.setFrame("USLT", {
        description: "Lyrics",
        language: "zho",
        lyrics: lyricText,
      });
      lyricEmbedded = true;
    }
  }

  writer.addTag();

  return {
    blob: writer.getBlob(),
    arrayBuffer: writer.getBlob().size ? await writer.getBlob().arrayBuffer() : new ArrayBuffer(0),
    coverEmbedded,
    lyricEmbedded,
  };
}

async function fetchCoverData(track: MusicTrack): Promise<Uint8Array | null> {
  try {
    const picUrl = await musicApi.getPic(track.pic_id || track.id, track.source);
    if (!picUrl) return null;
    const res = await fetch(picUrl);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    logger.warn("id3-embed", "获取封面失败", e);
    return null;
  }
}

async function fetchLyricText(track: MusicTrack): Promise<string | null> {
  try {
    const result = await musicApi.getLyric(track.lyric_id || track.id, track.source);
    if (!result) return null;
    const lines = [result.lyric, result.tlyric].filter(Boolean);
    return lines.join("\n\n");
  } catch (e) {
    logger.warn("id3-embed", "获取歌词失败", e);
    return null;
  }
}
