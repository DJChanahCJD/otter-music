import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { musicApi } from "@/lib/music-api";
import { MusicSource, MusicTrack } from "@/types/music";
import toast from "react-hot-toast";
import { LocalMusicFile } from "@/plugins/local-music";
import { useDownloadStore } from "@/store/download-store";
import { toastUtils } from "./toast";

const DOWNLOAD_DIR = "OtterMusic";
export const DownloadPath = `Download/${DOWNLOAD_DIR}`;

export function buildDownloadKey(trackSource: MusicSource, trackId: string) {
  return `${trackSource}:${trackId}`
}

export async function downloadMusicTrack(track: MusicTrack, br = 192) {
  if (track.source === "local") {
    toastUtils.info("本地音乐，无需下载");
    return;
  }

  const toastId = toast.loading(`准备下载: ${track.name}`, { duration: 10 * 1000 });

  try {
    const fileName = sanitize(
      `${track.name} - ${track.artist?.join(" / ") || "Unknown"}.mp3`,
    );

    if (Capacitor.isNativePlatform()) {
      const downloadKey = buildDownloadKey(track.source, track.id);
      if (useDownloadStore.getState().hasRecord(downloadKey)) {
        toastUtils.info("文件已存在", { id: toastId });
        return;
      }
    }

    const url = await musicApi.getUrl(track.id, track.source, br);
    if (!url) throw new Error("无法获取下载链接");

    if (Capacitor.isNativePlatform()) {
      await downloadNative(url, fileName, track.source, track.id, toastId);
    } else {
      await downloadWeb(url, fileName, toastId);
    }
  } catch (err) {
    console.error(err);
    toast.error(`下载失败: ${err}`, { id: toastId });
  }
}

async function downloadNative(
  url: string,
  fileName: string,
  source: MusicSource,
  id: string,
  toastId: string
) {
  try {
    const permStatus = await Filesystem.checkPermissions();
    if (permStatus.publicStorage !== "granted") {
      const requestStatus = await Filesystem.requestPermissions();
      if (requestStatus.publicStorage !== "granted") {
        toast.error("需要存储权限才能下载音乐", { id: toastId });
        return;
      }
    }
  } catch (e) {
    console.error("权限检查失败", e);
  }

  await ensureDownloadDir(DOWNLOAD_DIR);

  const fileUri = await Filesystem.getUri({
    directory: Directory.ExternalStorage,
    path: `${DownloadPath}/${fileName}`,
  });

  const listener = await FileTransfer.addListener("progress", (p) => {
    if (!p.contentLength) return;

    const percent = Math.round((p.bytes / p.contentLength) * 100);
    toast.loading(`下载 ${percent}%`, { id: toastId, duration: Infinity });
  });

  await FileTransfer.downloadFile({
    url,
    path: fileUri.uri,
  });

  await listener.remove();

  const downloadKey = buildDownloadKey(source, id);
  useDownloadStore.getState().addRecord(downloadKey, fileUri.uri);

  toast.success("下载完成", { id: toastId });
}

async function downloadWeb(
  url: string,
  fileName: string,
  toastId: string
) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  const reader = response.body?.getReader();

  if (!reader) {
    const blob = await response.blob();
    triggerBlobDownload(blob, fileName);
    toast.success("下载完成", { id: toastId });
    return;
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    received += value.length;

    if (contentLength) {
      const percent = Math.round((received / Number(contentLength)) * 100);
      toast.loading(`下载 ${percent}%`, { id: toastId });
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });

  triggerBlobDownload(blob, fileName);

  toast.success("下载完成", { id: toastId });
}

/* ================= 工具 ================= */

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function ensureDownloadDir(name: string) {
  const path = `Download/${name}`;

  try {
    await Filesystem.stat({
      directory: Directory.ExternalStorage,
      path,
    });
  } catch {
    // 目录不存在时尝试创建，若失败则抛出错误让上层处理
    await Filesystem.mkdir({
      directory: Directory.ExternalStorage,
      path,
      recursive: true,
    });
  }
}

function sanitize(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "").trim();
}

/**
 * 本地文件转 MusicTrack
 */
export const convertToMusicTrack = (file: LocalMusicFile): MusicTrack => {
  let album = file.album;

  if (album === DOWNLOAD_DIR) {
    album = "";
  }

  return {
    id: `local-${file.id}`,
    name: file.name || "未知歌曲",
    artist: file.artist ? [file.artist] : ["未知艺术家"],
    album: album || "",
    pic_id: "",
    url_id: file.localPath,
    lyric_id: "",
    source: "local" as MusicSource,
  };
};