import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { musicApi } from "@/services/music-api";
import { MusicTrack } from "@/types/music";
import toast from "react-hot-toast";

export async function downloadMusicTrack(track: MusicTrack) {
  const toastId = toast.loading(`准备下载: ${track.name}`);

  try {
    const url = await musicApi.getUrl(track.id, track.source);
    if (!url) throw new Error("无法获取下载链接");

    const fileName = sanitize(`${track.artist?.join(", ") || "Unknown"} - ${track.name}.mp3`);

    if (Capacitor.isNativePlatform()) {
      await nativeDownload(url, fileName, toastId);
    } else {
      browserDownload(url, fileName);
      toast.success("浏览器开始下载", { id: toastId });
    }

  } catch (err) {
    console.error(err);
    toast.error("下载失败", { id: toastId });
  }
}

/* ================= 原生下载 ================= */

async function nativeDownload(url: string, fileName: string, toastId: string) {

  // 确保目录存在
  await ensureDir("OtterMusic");

  const fileUri = await Filesystem.getUri({
    directory: Directory.ExternalStorage,
    path: `Download/OtterMusic/${fileName}`
  });

  const listener = await FileTransfer.addListener("progress", p => {
    if (!p.contentLength) return; // 避免 NaN
    const percent = Math.round((p.bytes / p.contentLength) * 100);
    toast.loading(`下载中 ${percent}%`, { id: toastId });
  });

  await FileTransfer.downloadFile({
    url,
    path: fileUri.uri
  });

  await listener.remove();

  toast.success("已保存到: 下载/OtterMusic", { id: toastId });
}

/* ================= 浏览器 ================= */

function browserDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ================= 工具 ================= */

async function ensureDir(name: string) {
  try {
    await Filesystem.mkdir({
      directory: Directory.ExternalStorage,
      path: `Download/${name}`,
      recursive: true
    });
  } catch {
    console.log("目录已存在或创建失败");
  }
}

function sanitize(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "").trim();
}
