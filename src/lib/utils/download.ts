import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { musicApi } from "@/lib/music-api";
import { MusicSource, MusicTrack } from "@/types/music";
import toast from "react-hot-toast";
import { LocalMusicFile } from "@/plugins/local-music";

const DOWNLOAD_DIR = "OtterMusic";

/**
 * 主下载入口（保留原方法名）
 */
export async function downloadMusicTrack(track: MusicTrack, br = 192) {
  if (track.source === "local") {
    toast("本地音乐，无需下载", { icon: "ℹ️" });
    return;
  }

  const toastId = toast.loading(`准备下载: ${track.name}`);

  try {
    const url = await musicApi.getUrl(track.id, track.source, br);
    if (!url) throw new Error("无法获取下载链接");

    const fileName = sanitize(
      `${track.name} - ${track.artist?.join(" / ") || "Unknown"}.mp3`,
    );

    if (Capacitor.isNativePlatform()) {
      await nativeDownload(url, fileName, toastId);
    } else {
      await browserBlobDownload(url, fileName, toastId);
    }
  } catch (err) {
    console.error(err);
    toast.error("下载失败", { id: toastId });
  }
}

/* ================= 原生下载 ================= */

async function nativeDownload(url: string, fileName: string, toastId: string) {
  const dirPath = `Download/${DOWNLOAD_DIR}`;

  await ensureDownloadDir(DOWNLOAD_DIR);

  const fileUri = await Filesystem.getUri({
    directory: Directory.ExternalStorage,
    path: `${dirPath}/${fileName}`,
  });

  const listener = await FileTransfer.addListener("progress", (p) => {
    if (!p.contentLength) return;

    const percent = Math.round((p.bytes / p.contentLength) * 100);
    toast.loading(`下载中 ${percent}%`, { id: toastId });
  });

  await FileTransfer.downloadFile({
    url,
    path: fileUri.uri,
  });

  await listener.remove();

  toast.success(`已保存到目录:\n${dirPath}`, { id: toastId });
}

/* ================= 浏览器 Blob 下载 ================= */

async function browserBlobDownload(
  url: string,
  fileName: string,
  toastId: string,
) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  const reader = response.body?.getReader();

  if (!reader) {
    // fallback
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
      toast.loading(`下载中 ${percent}%`, { id: toastId });
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
  try {
    await Filesystem.mkdir({
      directory: Directory.ExternalStorage,
      path: `Download/${name}`,
      recursive: true,
    });
  } catch {
    console.log("目录已存在或创建失败");
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