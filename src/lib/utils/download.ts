import { Filesystem, Encoding } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { MusicProviderFactory } from "@/lib/music-provider";
import {
  AUDIO_MIME,
  AppPaths,
  DOWNLOAD_RECORDS_FILE,
  STORAGE_CONFIG,
  buildFileName,
} from "@/lib/storage-manager";
import { MusicSource, MusicTrack } from "@/types/music";
import type { AudioFormat } from "@otter-music/shared";
import toast from "react-hot-toast";
import { base64ToBlob } from "@/lib/utils/base64";
import { LocalMusicFile } from "@/plugins/local-music";
import { useDownloadStore } from "@/store/download-store";
import { useMusicStore } from "@/store/music-store";

import { toastUtils } from "./toast";
import { getProxyUrl, isProxyUrl, IS_NATIVE } from "@/lib/api/config";
import { logger } from "@/lib/logger";
import { processBatchIO } from "@/lib/utils";
import { embedMetadata } from "./id3-embed";
import { getCachedBilibiliAudioFormat } from "@/lib/bilibili/bilibili-cache";

/**
 * 获取当前正在播放的曲目 URL（如果匹配）
 * @param track 要下载的曲目
 * @param downloadQuality 下载音质
 * @returns 匹配且音质相同时返回 URL，否则返回 null
 */
function getCurrentPlayingUrl(
  track: MusicTrack,
  downloadQuality: number
): string | null {
  const state = useMusicStore.getState();
  const currentTrack = state.queue[state.currentIndex];

  if (!currentTrack || !state.currentAudioUrl) return null;

  const isSameTrack =
    currentTrack.source === track.source && currentTrack.id === track.id;
  if (!isSameTrack) return null;

  const currentPlayQuality = parseInt(state.quality) || 192;
  if (currentPlayQuality !== downloadQuality) return null;

  return state.currentAudioUrl;
}

/**
 * 获取曲目的音频格式（用于确定下载文件名扩展名）。
 *
 * B 站音源：getUrl() 会将真实 format（DASH=m4s / durl=m4a）写入 audioFormatCache，
 * 因此必须在 getUrl() 之后调用，否则读到的是旧缓存或 undefined。
 * 极端防御：若缓存仍为空（不应发生），fallback 到 m4a（标准单文件 fMP4 音频）。
 */
function resolveAudioFormat(track: MusicTrack): AudioFormat | undefined {
  if (track.source === "bilibili") {
    return getCachedBilibiliAudioFormat(track) ?? "m4a";
  }
  return track.audioFormat;
}

/* ================= 主入口 ================= */

export function buildDownloadKey(source: MusicSource, id: string) {
  return `${source}:${id}`;
}

interface PerformDownloadOpts {
  skipMetadata?: boolean;
}

/**
 * 单首曲目下载核心逻辑
 * @param toastId 传入则展示详细进度（单曲模式）；不传则彻底静默（批量模式）
 */
async function performDownloadOne(
  track: MusicTrack,
  _br: number,
  toastId?: string,
  opts?: PerformDownloadOpts
): Promise<void> {
  const isNative = IS_NATIVE;
  const br = parseInt(useMusicStore.getState().downloadQuality) || 320;

  if (isNative) {
    const key = buildDownloadKey(track.source, track.id);
    if (useDownloadStore.getState().hasRecord(key)) return;
  }

  // 尝试复用当前播放 URL
  let url = getCurrentPlayingUrl(track, br);
  const isReusedUrl = !!url;

  if (!url) {
    url = await MusicProviderFactory.getProvider(track.source).getUrl(
      track,
      br
    );
  }
  // 音质降级重试：高音质无 URL 时逐级降级
  if (!url) {
    const fallbackQualities = [192, 128];
    for (const fallbackBr of fallbackQualities) {
      if (fallbackBr >= br) continue;
      url = await MusicProviderFactory.getProvider(track.source).getUrl(
        track,
        fallbackBr
      );
      if (url) break;
    }
  }

  if (!url) throw new Error("无法获取下载链接");

  // B 站 getUrl() 已将真实 format 写入 audioFormatCache，此时查询得到准确值
  const format = resolveAudioFormat(track);
  const trackWithFormat: MusicTrack = format
    ? { ...track, audioFormat: format }
    : track;
  const fileName = buildFileName(trackWithFormat);

  const doDownload = async (downloadUrl: string) => {
    await (isNative
      ? downloadNative(downloadUrl, fileName, trackWithFormat, toastId, opts)
      : downloadWeb(downloadUrl, fileName, trackWithFormat, toastId, opts));
  };

  try {
    await doDownload(url);
  } catch (err) {
    // 如果是复用的 URL 失败，回退到重新获取
    if (isReusedUrl) {
      logger.warn("Reused URL download failed, falling back to getUrl...", err);
      const freshUrl = await MusicProviderFactory.getProvider(
        track.source
      ).getUrl(track, br);
      if (!freshUrl) throw new Error("无法获取下载链接");
      await doDownload(freshUrl);
      return;
    }

    if (isProxyUrl(url)) throw err;
    logger.warn("Direct download failed, retrying with proxy...", err);
    if (toastId) {
      toast.loading("已切换备用下载线路", { id: toastId, icon: "🌐" });
    }
    await doDownload(getProxyUrl(url));
  }
}

export async function downloadMusicTrack(track: MusicTrack, br = 192) {
  if (track.source === "local") {
    return toastUtils.info("本地音乐，无需下载");
  }

  const toastId = toast.loading(`准备下载: ${track.name}`);

  try {
    await performDownloadOne(track, br, toastId);
  } catch (err: unknown) {
    logger.error("downloadMusicTrack", "Download failed", err, {
      trackId: track.id,
      source: track.source,
    });
    const message = err instanceof Error ? err.message : String(err);
    toast.error(`下载失败: ${message}`, { id: toastId });
  }
}

/**
 * 批量下载
 */
export async function downloadMusicTrackBatch(tracks: MusicTrack[], br = 192) {
  const validTracks = tracks.filter((t) => t.source !== "local");
  const total = validTracks.length;

  if (!total) {
    return toastUtils.info("所选曲目无需下载");
  }

  let done = 0;
  let failCount = 0;
  const toastId = toast.loading(`准备下载 0/${total}`);

  // 节流 UI 更新，保证高并发下主线程顺畅，且最后一次必定刷新
  let lastProgressUpdate = 0;
  const updateProgress = (current: number, isLast = false) => {
    const now = Date.now();
    if (isLast || now - lastProgressUpdate >= 150) {
      lastProgressUpdate = now;
      toast.loading(`下载中 ${current}/${total}`, { id: toastId });
    }
  };

  await processBatchIO(
    validTracks,
    async (track) => {
      try {
        await performDownloadOne(track, br);
      } catch (err) {
        failCount++;
        logger.error(
          "downloadMusicTrackBatch",
          `Failed: ${track.name || track.id}`,
          err
        );
      } finally {
        done++;
        updateProgress(done, done === total);
      }
    },
    undefined,
    3 // 保持并发数为 3
  );

  // 下载结果提示
  const successCount = total - failCount;

  const failMsg = `下载完成（成功 ${successCount} / 失败 ${failCount}）`;
  const successMsg = `已成功下载全部 ${successCount} 首`;

  failCount > 0
    ? toastUtils.warning(failMsg, { id: toastId, duration: 5000 })
    : toast.success(successMsg, { id: toastId, duration: 3000 });
}

/* ================= Native 下载 ================= */

async function downloadNative(
  url: string,
  fileName: string,
  track: MusicTrack,
  toastId?: string,
  opts?: PerformDownloadOpts
) {
  await ensurePermission();
  const store = useMusicStore.getState();
  const musicPath = store.downloadDirectory || AppPaths.Music;
  await ensureDir(musicPath);

  // 目标文件已存在（如下载记录丢失后的残留文件）时自动追加序号，
  // 避免覆盖冲突导致 FileTransfer 写入失败 (OS-PLUG-FLTR-0007)
  const filePath = await resolveAvailableFilePath(musicPath, fileName);
  if (filePath !== `${musicPath}/${fileName}`) {
    logger.info("download", "downloadNative: renamed to avoid overwrite", {
      fileName,
      filePath,
    });
  }
  const fileUri = await Filesystem.getUri({
    directory: STORAGE_CONFIG.BASE_DIR,
    path: filePath,
  });

  logger.info("download", "downloadNative: resolved file path", {
    musicPath,
    fileName,
    filePath,
    fileUri: fileUri.uri,
  });

  const listener = await FileTransfer.addListener(
    "progress",
    ({ bytes, contentLength }) => {
      if (!contentLength || !toastId) return;
      const percent = Math.round((bytes / contentLength) * 100);
      toast.loading(`下载 ${percent}%`, { id: toastId });
    }
  );

  try {
    await FileTransfer.downloadFile({
      url,
      path: fileUri.uri,
    });

    // 元数据嵌入
    if (!opts?.skipMetadata && (store.embedCover || store.embedLyric)) {
      await embedMetadataNative(filePath, track, toastId);
    }

    const key = buildDownloadKey(track.source, track.id);
    await useDownloadStore.getState().addRecord(key, {
      uri: fileUri.uri,
      cachedAt: Date.now(),
      name: track.name,
      artist: track.artist,
      album: track.album,
      trackSource: track.source,
      url_id: track.url_id,
      pic_id: track.pic_id,
      lyric_id: track.lyric_id,
    });

    if (toastId) toast.success("下载完成", { id: toastId });
  } catch (err) {
    logger.error("download", "downloadNative: FileTransfer failed", {
      url,
      filePath,
      fileUri: fileUri.uri,
      errorCode: (err as any)?.code,
      errorMessage: (err as any)?.message,
      source: (err as any)?.data?.source,
      target: (err as any)?.data?.target,
    });
    throw err;
  } finally {
    await listener.remove();
  }
}

/** 原生端内嵌时整个音频会以 base64 往返 Capacitor 桥，Java 与 WebView 各持有多份副本，
 *  内存放大数倍。超过该大小直接跳过，避免 OutOfMemoryError（无损 FLAC 常见 30~50MB）。 */
const NATIVE_EMBED_MAX_BYTES = 10 * 1024 * 1024;

/**
 * 读取文件头判断是否为真正的 MP3（ID3v2 头或 MPEG 帧同步）。
 * 无损音质（如网易云 999）可能返回 FLAC，但 track.audioFormat 未标记，
 * 若按 mp3 处理会读取整文件并在 JS 侧写入 ID3，既 OOM 又会写坏文件。
 */
async function isMp3File(filePath: string): Promise<boolean> {
  const head = await Filesystem.readFile({
    path: filePath,
    directory: STORAGE_CONFIG.BASE_DIR,
    offset: 0,
    length: 12,
  });

  const binary = atob((head.data as string).replace(/\s+/g, ""));

  // "ID3"（ID3v2 标签头）
  if (
    binary.length >= 3 &&
    binary.charCodeAt(0) === 0x49 &&
    binary.charCodeAt(1) === 0x44 &&
    binary.charCodeAt(2) === 0x33
  ) {
    return true;
  }

  // MPEG 帧同步：0xFF 后跟 111xxxxx
  if (binary.length >= 2) {
    return (
      binary.charCodeAt(0) === 0xff && (binary.charCodeAt(1) & 0xe0) === 0xe0
    );
  }

  return false;
}

async function embedMetadataNative(
  filePath: string,
  track: MusicTrack,
  toastId?: string
) {
  const format: AudioFormat = track.audioFormat ?? "mp3";

  if (format !== "mp3") {
    logger.warn(
      "download",
      `Skip native metadata embed for non-mp3 format: ${format}`
    );
    return;
  }

  try {
    // 先做体积与真实格式探测，避免把大文件读进 JS 后才触发 50MB 的旧阈值
    const stat = await Filesystem.stat({
      path: filePath,
      directory: STORAGE_CONFIG.BASE_DIR,
    });
    if (stat.size > NATIVE_EMBED_MAX_BYTES) {
      logger.warn(
        "download",
        `文件过大 (${(stat.size / 1024 / 1024).toFixed(1)}MB)，跳过元数据嵌入`
      );
      return;
    }
    if (!(await isMp3File(filePath))) {
      logger.warn("download", "非 MP3 文件，跳过元数据嵌入", { filePath });
      return;
    }

    if (toastId) toast.loading("正在写入元数据...", { id: toastId });

    const readResult = await Filesystem.readFile({
      path: filePath,
      directory: STORAGE_CONFIG.BASE_DIR,
    });

    const mime = AUDIO_MIME[format] ?? "audio/mpeg";
    const blob = base64ToBlob(readResult.data as string, mime);

    const store = useMusicStore.getState();
    const result = await embedMetadata(blob, track, {
      embedCover: store.embedCover,
      embedLyric: store.embedLyric,
    });

    const newBase64 = await blobToBase64(result.blob);

    await Filesystem.writeFile({
      path: filePath,
      data: newBase64,
      directory: STORAGE_CONFIG.BASE_DIR,
    });
  } catch (e) {
    logger.warn("download", "Native 元数据嵌入失败", e);
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/* ================= Web 下载 ================= */

async function downloadWeb(
  url: string,
  fileName: string,
  track: MusicTrack,
  toastId?: string,
  opts?: PerformDownloadOpts
) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const format: AudioFormat = track.audioFormat ?? "mp3";
  const mime = AUDIO_MIME[format] ?? "audio/mpeg";

  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body?.getReader();

  if (!reader) {
    const rawBlob = await res.blob();
    const blob = await applyMetadata(rawBlob, track, toastId, opts);
    return triggerBlobDownload(blob, fileName, toastId);
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    received += value.length;

    if (total && toastId) {
      const percent = Math.round((received / total) * 100);
      toast.loading(`下载 ${percent}%`, { id: toastId });
    }
  }

  const rawBlob = new Blob(chunks as BlobPart[], { type: mime });
  const blob = await applyMetadata(rawBlob, track, toastId, opts);
  triggerBlobDownload(blob, fileName, toastId);
}

async function applyMetadata(
  blob: Blob,
  track: MusicTrack,
  toastId?: string,
  opts?: PerformDownloadOpts
): Promise<Blob> {
  if (opts?.skipMetadata) return blob;

  const store = useMusicStore.getState();
  if (!store.embedCover && !store.embedLyric) return blob;

  if (toastId) toast.loading("正在写入元数据...", { id: toastId });

  try {
    const result = await embedMetadata(blob, track, {
      embedCover: store.embedCover,
      embedLyric: store.embedLyric,
    });
    return result.blob;
  } catch (e) {
    logger.warn("download", "元数据嵌入失败", e);
    return blob;
  }
}

/* ================= 工具函数 ================= */

export async function ensurePermission() {
  const { publicStorage } = await Filesystem.checkPermissions();

  if (publicStorage === "granted") return;

  const req = await Filesystem.requestPermissions();
  if (req.publicStorage !== "granted") {
    throw new Error("需要存储权限才能下载音乐");
  }
}

/**
 * 解析一个当前不存在的目标文件路径：若同名文件已存在，
 * 自动追加序号重命名（如 "歌名 (1).mp3"）。
 */
async function resolveAvailableFilePath(
  musicPath: string,
  fileName: string
): Promise<string> {
  const dotIdx = fileName.lastIndexOf(".");
  const stem = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
  const ext = dotIdx > 0 ? fileName.slice(dotIdx) : "";

  let candidate = fileName;
  for (let i = 1; i < 1000; i++) {
    try {
      await Filesystem.stat({
        directory: STORAGE_CONFIG.BASE_DIR,
        path: `${musicPath}/${candidate}`,
      });
      candidate = `${stem} (${i})${ext}`;
    } catch {
      // stat 失败说明文件不存在，可用
      return `${musicPath}/${candidate}`;
    }
  }
  return `${musicPath}/${candidate}`;
}

async function ensureDir(path: string) {
  try {
    await Filesystem.stat({
      directory: STORAGE_CONFIG.BASE_DIR,
      path,
    });
  } catch (statErr) {
    logger.warn("download", "ensureDir: stat failed, trying mkdir", {
      path,
      error: statErr instanceof Error ? statErr.message : String(statErr),
    });
    try {
      await Filesystem.mkdir({
        directory: STORAGE_CONFIG.BASE_DIR,
        path,
        recursive: true,
      });
    } catch (mkdirErr) {
      logger.error("download", "ensureDir: mkdir failed", {
        path,
        error: mkdirErr instanceof Error ? mkdirErr.message : String(mkdirErr),
      });
      throw mkdirErr;
    }
  }
}

export function triggerBlobDownload(
  blob: Blob,
  filename: string,
  toastId?: string
) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);

  if (toastId) toast.success("下载完成", { id: toastId });
}

/* ================= 下载记录持久化 ================= */
export async function saveDownloadRecordsToDisk(
  records: Record<string, unknown>
) {
  if (!IS_NATIVE) return;

  try {
    await ensureDir(AppPaths.Data);

    await Filesystem.writeFile({
      path: AppPaths.join(AppPaths.Data, DOWNLOAD_RECORDS_FILE),
      data: JSON.stringify(records),
      directory: STORAGE_CONFIG.BASE_DIR,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  } catch (e) {
    logger.error("download", "保存下载记录失败", e);
  }
}

export async function loadDownloadRecordsFromDisk(): Promise<Record<
  string,
  unknown
> | null> {
  if (!IS_NATIVE) return null;

  try {
    const result = await Filesystem.readFile({
      path: AppPaths.join(AppPaths.Data, DOWNLOAD_RECORDS_FILE),
      directory: STORAGE_CONFIG.BASE_DIR,
      encoding: Encoding.UTF8,
    });

    const content =
      typeof result.data === "string"
        ? result.data
        : JSON.stringify(result.data);

    return JSON.parse(content);
  } catch (e) {
    logger.warn("download", "读取下载记录失败:", e);
    return null;
  }
}

const LOCAL_ARTIST_SPLIT_RE = /[/、,，&＆;；|]/;
const LOCAL_ARTIST_DOUBLE_SPACE_RE = /\s{2,}/;

function isOtterMusicDownloadPath(localPath?: string | null) {
  return !!localPath && localPath.includes(STORAGE_CONFIG.ROOT);
}

function getBasename(path: string) {
  const normalized = path.replace(/^file:\/\//, "");
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function getArtistFromLocalPath(localPath?: string | null) {
  if (!localPath) return null;
  const basename = getBasename(localPath);
  if (!basename) return null;
  const withoutExt = basename.replace(/\.[^/.]+$/, "");
  const sepIndex = withoutExt.lastIndexOf(" - ");
  if (sepIndex <= 0 || sepIndex >= withoutExt.length - 3) return null;
  const artistPart = withoutExt.slice(sepIndex + 3).trim();
  return artistPart || null;
}

/**
 * 本地文件转 MusicTrack
 */
export const convertToMusicTrack = (file: LocalMusicFile): MusicTrack => {
  let album = file.album;

  if (album === STORAGE_CONFIG.BASE_NAME) {
    album = "";
  }

  const localPathArtist = getArtistFromLocalPath(file.localPath);
  const otterPath = isOtterMusicDownloadPath(file.localPath);
  let artistStr = (file.artist || "").trim();

  if (!artistStr && localPathArtist) {
    artistStr = localPathArtist;
  } else if (
    otterPath &&
    localPathArtist &&
    !LOCAL_ARTIST_SPLIT_RE.test(artistStr) &&
    (LOCAL_ARTIST_SPLIT_RE.test(localPathArtist) ||
      LOCAL_ARTIST_DOUBLE_SPACE_RE.test(localPathArtist))
  ) {
    artistStr = localPathArtist;
  }

  let artistList: string[] = [];
  if (artistStr) {
    if (LOCAL_ARTIST_SPLIT_RE.test(artistStr)) {
      artistList = artistStr.split(LOCAL_ARTIST_SPLIT_RE);
    } else if (otterPath && LOCAL_ARTIST_DOUBLE_SPACE_RE.test(artistStr)) {
      artistList = artistStr.split(LOCAL_ARTIST_DOUBLE_SPACE_RE);
    } else {
      artistList = [artistStr];
    }
  }

  artistList = artistList.map((item) => item.trim()).filter(Boolean);
  if (artistList.length === 0) {
    artistList = ["未知艺术家"];
  }

  return {
    id: `local-${file.id}`,
    name: file.name || "未知歌曲",
    artist: artistList,
    album: album || "",
    pic_id: file.localPath,
    url_id: file.localPath,
    lyric_id: file.localPath,
    source: "local" as MusicSource,
  };
};
