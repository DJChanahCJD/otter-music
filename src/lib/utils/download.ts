import { Capacitor } from "@capacitor/core";
import { Filesystem, Encoding } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { musicApi } from "@/lib/music-api";
import { AppPaths, STORAGE_CONFIG } from "@/lib/storage-path";
import { MusicSource, MusicTrack } from "@/types/music";
import toast from "react-hot-toast";
import { LocalMusicFile } from "@/plugins/local-music";
import { useDownloadStore } from "@/store/download-store";
import { toastUtils } from "./toast";

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

    const url = await musicApi.getUrl(track.id, track.source, br);
    if (!url) throw new Error("无法获取下载链接");

    await (isNative
      ? downloadNative(url, fileName, track, toastId)
      : downloadWeb(url, fileName, toastId));

  } catch (err: any) {
    console.error(err);
    toast.error(`下载失败: ${err.message || err}`, { id: toastId });
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

  const blob = new Blob(chunks, { type: "audio/mpeg" });
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

function buildFileName(track: MusicTrack) {
  return sanitize(
    `${track.name} - ${track.artist?.join(" / ") || "Unknown"}.mp3`
  );
}

function sanitize(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "").trim();
}

/* ================= 下载记录持久化 ================= */
const DOWNLOAD_RECORDS_FILE = "downloads.json";

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

/**
 * 本地文件转 MusicTrack
 */
export const convertToMusicTrack = (file: LocalMusicFile): MusicTrack => {
  let album = file.album;

  if (album === STORAGE_CONFIG.BASE_NAME) {
    album = "";
  }

  // 处理艺术家：分割、去空格、去空值，直接返回数组
  const artistList = file.artist
    ? file.artist
      .split(/[/、,，&＆]/)       // 分隔多艺术家
      .map(item => item.trim())  // 去空格
      .filter(Boolean)           // 去掉空字符串
    : ["未知艺术家"];             // 无艺术家时默认值

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