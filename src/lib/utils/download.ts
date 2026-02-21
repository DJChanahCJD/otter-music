import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { musicApi } from "@/lib/music-api";
import { MusicSource, MusicTrack } from "@/types/music";
import toast from "react-hot-toast";
import { LocalMusicFile } from "@/plugins/local-music";
import { getAudioCache, saveAudioCache } from "@/lib/utils/audio-cache";
import { useMusicStore } from "@/store/music-store";

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
    const fileName = sanitize(
      `${track.name} - ${track.artist?.join(" / ") || "Unknown"}.mp3`,
    );

    // 检查缓存
    const cacheResult = await getAudioCache(track.source, track.id, br);

    if (cacheResult.exists) {
      // 从缓存保存文件
      if (Capacitor.isNativePlatform()) {
        await saveFromNativeCache(cacheResult.path!, fileName, toastId);
      } else {
        await saveFromWebCache(cacheResult.blobUrl!, fileName, toastId);
      }
    } else {
      // 缓存不存在，下载并缓存
      const url = await musicApi.getUrl(track.id, track.source, br);
      if (!url) throw new Error("无法获取下载链接");

      if (Capacitor.isNativePlatform()) {
        await downloadAndCacheNative(url, fileName, track.source, track.id, br, toastId);
      } else {
        await downloadAndCacheWeb(url, fileName, track.source, track.id, br, toastId);
      }
    }

    // 更新缓存统计
    await useMusicStore.getState().updateCacheStats();
  } catch (err) {
    console.error(err);
    toast.error("下载失败", { id: toastId });
  }
}

/* ================= 原生平台：从缓存保存文件 ================= */

async function saveFromNativeCache(cachePath: string, fileName: string, toastId: string) {
  const dirPath = `Download/${DOWNLOAD_DIR}`;

  await ensureDownloadDir(DOWNLOAD_DIR);

  const targetPath = `${dirPath}/${fileName}`;

  // 从缓存读取文件内容
  const { data } = await Filesystem.readFile({
    path: cachePath,
  });

  // 写入到下载目录
  await Filesystem.writeFile({
    path: targetPath,
    directory: Directory.ExternalStorage,
    data: data as string,
  });

  toast.success(`从缓存保存到:\n${dirPath}`, { id: toastId });
}

/* ================= 原生平台：下载并缓存 ================= */

async function downloadAndCacheNative(
  url: string,
  fileName: string,
  source: MusicSource,
  id: string,
  br: number,
  toastId: string
) {
  const dirPath = `Download/${DOWNLOAD_DIR}`;

  await ensureDownloadDir(DOWNLOAD_DIR);

  const fileUri = await Filesystem.getUri({
    directory: Directory.ExternalStorage,
    path: `${dirPath}/${fileName}`,
  });

  const listener = await FileTransfer.addListener("progress", (p) => {
    if (!p.contentLength) return;

    const percent = Math.round((p.bytes / p.contentLength) * 100);
    toast.loading(`下载并缓存 ${percent}%`, { id: toastId });
  });

  await FileTransfer.downloadFile({
    url,
    path: fileUri.uri,
  });

  await listener.remove();

  // 下载完成后，读取文件并保存到缓存
  const { data } = await Filesystem.readFile({
    path: fileUri.uri,
  });

  const base64Data = data as string;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const arrayBuffer = bytes.buffer;

  // 保存到缓存
  await saveAudioCache(source, id, br, arrayBuffer, arrayBuffer.byteLength);

  toast.success(`下载并缓存完成:\n${dirPath}`, { id: toastId });
}

/* ================= Web 平台：从缓存保存文件 ================= */

async function saveFromWebCache(blobUrl: string, fileName: string, toastId: string) {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    triggerBlobDownload(blob, fileName);
    toast.success("从缓存保存完成", { id: toastId });
  } catch (err) {
    console.error(err);
    throw new Error("从缓存保存失败");
  }
}

/* ================= Web 平台：下载并缓存 ================= */

async function downloadAndCacheWeb(
  url: string,
  fileName: string,
  source: MusicSource,
  id: string,
  br: number,
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
    await saveAudioCache(source, id, br, blob, blob.size);
    triggerBlobDownload(blob, fileName);
    toast.success("下载并缓存完成", { id: toastId });
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
      toast.loading(`下载并缓存 ${percent}%`, { id: toastId });
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: "audio/mpeg" });

  // 保存到缓存
  await saveAudioCache(source, id, br, blob, blob.size);

  // 触发浏览器下载
  triggerBlobDownload(blob, fileName);

  toast.success("下载并缓存完成", { id: toastId });
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