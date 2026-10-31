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
    logger.warn(
      "id3-embed",
      `文件过大 (${(mp3Blob.size / 1024 / 1024).toFixed(1)}MB)，跳过元数据嵌入`
    );
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
    arrayBuffer: writer.getBlob().size
      ? await writer.getBlob().arrayBuffer()
      : new ArrayBuffer(0),
    coverEmbedded,
    lyricEmbedded,
  };
}

async function fetchCoverData(track: MusicTrack): Promise<Uint8Array | null> {
  try {
    const picUrl = await musicApi.getPic(
      track.pic_id || track.id,
      track.source
    );
    if (!picUrl) return null;
    const res = await fetch(picUrl);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    logger.warn("id3-embed", "获取封面失败", e);
    return null;
  }
}

/** 原文与译文的分隔标记，提取时据此拆分还原。 */
const TLYRIC_DELIMITER = "\n[TLYRIC]\n";

/** 获取用于内嵌的歌词（原文 + 可选译文），无歌词返回 null。 */
export async function fetchEmbedLyric(
  track: MusicTrack
): Promise<{ lyric: string; tlyric?: string } | null> {
  try {
    const result = await musicApi.getLyric(
      track.lyric_id || track.id,
      track.source
    );
    if (!result?.lyric) return null;
    return result.tlyric
      ? { lyric: result.lyric, tlyric: result.tlyric }
      : { lyric: result.lyric };
  } catch (e) {
    logger.warn("id3-embed", "获取歌词失败", e);
    return null;
  }
}

/** 获取嵌入用的歌词文本，原文和译文用分隔符标记边界。 */
async function fetchLyricText(track: MusicTrack): Promise<string | null> {
  const result = await fetchEmbedLyric(track);
  if (!result) return null;
  return result.tlyric
    ? result.lyric + TLYRIC_DELIMITER + result.tlyric
    : result.lyric;
}
