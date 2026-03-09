import { Capacitor } from "@capacitor/core";
import { Filesystem, Encoding } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { musicApi } from "@/lib/music-api";
import { AppPaths, DOWNLOAD_RECORDS_FILE, STORAGE_CONFIG, buildFileName } from "@/lib/storage-manager";
import { MusicSource, MusicTrack } from "@/types/music";
import toast from "react-hot-toast";
import { LocalMusicFile } from "@/plugins/local-music";
import { useDownloadStore } from "@/store/download-store";
import { toastUtils } from "./toast";
import { getProxyUrl, isProxyUrl } from "@/lib/api/config";

/* ================= 主入口 ================= */

export function buildDownloadKey(source: MusicSource, id: string) {
  return `${source}:${id}`;
}

export async function downloadMusicTrack(track: MusicTrack, br = 192) {
  if (track.source === "local") {
    return toastUtils.info("本地音乐，无需下载");
  }

  const toastId = toast.loading(`准备下载: ${track.name}`);

  try {
    const fileName = buildFileName(track);
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      const key = buildDownloadKey(track.source, track.id);
      if (useDownloadStore.getState().hasRecord(key)) {
        return toastUtils.info("文件已存在", { id: toastId });
      }
    }

    const url = await musicApi.getUrl(track.url_id || track.id, track.source, br);
    if (!url) throw new Error("无法获取下载链接");

    const performDownload = async (downloadUrl: string) => {
      await (isNative
        ? downloadNative(downloadUrl, fileName, track, toastId)
        : downloadWeb(downloadUrl, fileName, toastId));
    };

    try {
      await performDownload(url);
    } catch (err) {
      if (isProxyUrl(url)) throw err;

      console.warn("Direct download failed, retrying with proxy...", err);
      toast.loading("已切换备用下载线路", { id: toastId });
      
      const proxyUrl = getProxyUrl(url);
      await performDownload(proxyUrl);
    }

  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    toast.error(`下载失败: ${message}`, { id: toastId });
  }
}

/* ================= Native 下载 ================= */

async function downloadNative(
  url: string,
  fileName: string,
  track: MusicTrack,
  toastId: string
) {
  await ensurePermission();
  await ensureDir(AppPaths.Music);

  const fileUri = await Filesystem.getUri({
    directory: STORAGE_CONFIG.BASE_DIR,
    path: `${AppPaths.Music}/${fileName}`,
  });

  const listener = await FileTransfer.addListener("progress", ({ bytes, contentLength }) => {
    if (!contentLength) return;
    const percent = Math.round((bytes / contentLength) * 100);
    toast.loading(`下载 ${percent}%`, { id: toastId });
  });

  try {
    await FileTransfer.downloadFile({
      url,
      path: fileUri.uri,
    });

    const key = buildDownloadKey(track.source, track.id);
    await useDownloadStore.getState().addRecord(key, fileUri.uri);

    toast.success("下载完成", { id: toastId });

  } finally {
    await listener.remove();
  }
}

/* ================= Web 下载 ================= */

async function downloadWeb(
  url: string,
  fileName: string,
  toastId: string
) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body?.getReader();

  if (!reader) {
    return triggerBlobDownload(await res.blob(), fileName, toastId);
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    received += value.length;

    if (total) {
      const percent = Math.round((received / total) * 100);
      toast.loading(`下载 ${percent}%`, { id: toastId });
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
  triggerBlobDownload(blob, fileName, toastId);
}

/* ================= 工具函数 ================= */

async function ensurePermission() {
  const { publicStorage } = await Filesystem.checkPermissions();

  if (publicStorage === "granted") return;

  const req = await Filesystem.requestPermissions();
  if (req.publicStorage !== "granted") {
    throw new Error("需要存储权限才能下载音乐");
  }
}

async function ensureDir(path: string) {
  try {
    await Filesystem.stat({
      directory: STORAGE_CONFIG.BASE_DIR,
      path,
    });
  } catch {
    await Filesystem.mkdir({
      directory: STORAGE_CONFIG.BASE_DIR,
      path,
      recursive: true,
    });
  }
}

function triggerBlobDownload(blob: Blob, filename: string, toastId?: string) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);

  toast.success("下载完成", { id: toastId });
}

/* ================= 下载记录持久化 ================= */
export async function saveDownloadRecordsToDisk(
  records: Record<string, string>
) {
  if (!Capacitor.isNativePlatform()) return;

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
    console.error("保存下载记录失败:", e);
  }
}

export async function loadDownloadRecordsFromDisk(): Promise<Record<string, string> | null> {
  if (!Capacitor.isNativePlatform()) return null;

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
    console.warn("读取下载记录失败:", e);
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
    (LOCAL_ARTIST_SPLIT_RE.test(localPathArtist) || LOCAL_ARTIST_DOUBLE_SPACE_RE.test(localPathArtist))
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
    pic_id: "",
    url_id: file.localPath,
    lyric_id: "",
    source: "local" as MusicSource,
  };
};
