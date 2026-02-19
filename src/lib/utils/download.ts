import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, FileInfo } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { AppLauncher } from "@capacitor/app-launcher";
import { musicApi } from "@/lib/music-api";
import type { LocalMusicTrack } from "@/types/music";
import { MusicTrack } from "@/types/music";
import { v4 as uuidv4 } from 'uuid';
import toast from "react-hot-toast";

const DOWNLOAD_DIR = "OtterMusic";
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'];

/**
 * 权限检查结果
 */
export interface PermissionResult {
  granted: boolean;
  needManualGrant?: boolean; // Android 11+ 需要手动在设置中授权
}

/**
 * 打开应用设置页面（用于手动授权）
 */
export async function openAppSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Android: 打开应用详情页
    await AppLauncher.openUrl({ 
      url: 'android.settings.APPLICATION_DETAILS_SETTINGS'
    });
  } catch (error) {
    console.error("打开设置失败:", error);
    toast.error("无法打开设置页面");
  }
}

/**
 * 检查并请求存储权限
 * 返回权限检查结果
 */
export async function ensureStoragePermission(): Promise<PermissionResult> {
  if (!Capacitor.isNativePlatform()) return { granted: true };

  try {
    const status = await Filesystem.checkPermissions();
    
    if (status.publicStorage === 'granted') {
      return { granted: true };
    }
    
    const result = await Filesystem.requestPermissions();
    
    if (result.publicStorage === 'granted') {
      return { granted: true };
    }
    
    // 用户拒绝权限，需要手动去设置开启
    if (result.publicStorage === 'denied') {
      return { granted: false, needManualGrant: true };
    }
    
    return { granted: false };
  } catch (error) {
    console.error("权限检查失败:", error);
    return { granted: false };
  }
}


/**
 * 扫描本地音乐文件
 */
export async function scanLocalMusicFiles(): Promise<LocalMusicTrack[]> {
  const toastId = toast.loading("正在扫描本地音乐...");

  try {
    // 先检查权限
    const permissionResult = await ensureStoragePermission();
    if (!permissionResult.granted) {
      if (permissionResult.needManualGrant) {
        toast.error("请在设置中授予存储权限", { 
          id: toastId, 
          duration: 4000 
        });
      } else {
        toast.error("需要存储权限才能扫描本地音乐", { id: toastId });
      }
      return [];
    }

    const tracks: LocalMusicTrack[] = [];
    const files = await getAudioFilesInDir(DOWNLOAD_DIR);

    for (const file of files) {
      const track = await parseAudioFile(file);
      if (track) {
        tracks.push(track);
      }
    }

    toast.success(`找到 ${tracks.length} 首本地音乐`, { id: toastId });
    return tracks;
  } catch (error) {
    console.error("扫描本地音乐失败:", error);
    toast.error("扫描失败", { id: toastId });
    return [];
  }
}

/**
 * 获取目录中的音频文件
 */
async function getAudioFilesInDir(dirName: string): Promise<FileInfo[]> {
  const dirPath = `Download/${dirName}`;
  const files: FileInfo[] = [];

  try {
    // 确保目录存在
    await Filesystem.mkdir({
      directory: Directory.ExternalStorage,
      path: dirPath,
      recursive: true
    });

    // 读取目录内容
    const result = await Filesystem.readdir({
      directory: Directory.ExternalStorage,
      path: dirPath
    });

    // 过滤音频文件
    for (const file of result.files) {
      if (file.type === 'file' && isAudioFile(file.name)) {
        files.push(file);
      }
    }
  } catch (error) {
    console.error("读取目录失败:", error);
  }

  return files;
}

/**
 * 检查是否为音频文件
 */
export function isAudioFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return AUDIO_EXTENSIONS.includes(ext);
}

/**
 * 解析音频文件为 LocalMusicTrack
 */
async function parseAudioFile(file: FileInfo): Promise<LocalMusicTrack | null> {
  try {
    const filePath = `Download/${DOWNLOAD_DIR}/${file.name}`;
    const fileUri = await Filesystem.getUri({
      directory: Directory.ExternalStorage,
      path: filePath
    });

    // 从文件名解析标题和艺术家
    const { title, artist } = parseFileName(file.name);

    return {
      id: uuidv4(),
      name: title,
      artist: artist,
      album: "本地音乐",
      pic_id: "",
      url_id: "",
      lyric_id: "",
      source: "local",
      localPath: fileUri.uri,
      fileSize: file.size,
      lastModified: file.mtime
    };
  } catch (error) {
    console.error("解析音频文件失败:", error);
    return null;
  }
}

/**
 * 从文件名解析标题和艺术家
 * 格式: "艺术家 - 标题.mp3"
 */
function parseFileName(filename: string): { title: string; artist: string[] } {
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
  const parts = nameWithoutExt.split(' - ');

  if (parts.length >= 2) {
    const artist = parts[0].split(' / ');
    const title = parts.slice(1).join(' - ');
    return { title, artist };
  }

  return {
    title: nameWithoutExt,
    artist: ["未知艺术家"]
  };
}

/**
 * 删除本地音乐文件
 */
export async function deleteLocalFile(filePath: string): Promise<boolean> {
  try {
    // 从完整路径提取相对路径
    const relativePath = filePath.includes(`Download/${DOWNLOAD_DIR}/`) 
      ? filePath.split(`Download/${DOWNLOAD_DIR}/`)[1]
      : filePath;

    await Filesystem.deleteFile({
      directory: Directory.ExternalStorage,
      path: `Download/${DOWNLOAD_DIR}/${relativePath}`
    });
    return true;
  } catch (error) {
    console.error("删除文件失败:", error);
    return false;
  }
}

/**
 * 批量删除本地音乐文件
 */
export async function deleteLocalFiles(filePaths: string[]): Promise<boolean> {
  let allSuccess = true;

  for (const filePath of filePaths) {
    const success = await deleteLocalFile(filePath);
    if (!success) {
      allSuccess = false;
    }
  }

  return allSuccess;
}

/**
 * 获取下载目录路径
 */
export async function getDownloadDirPath(): Promise<string> {
  try {
    const dirPath = `Download/${DOWNLOAD_DIR}`;
    const dirUri = await Filesystem.getUri({
      directory: Directory.ExternalStorage,
      path: dirPath
    });
    return dirUri.uri;
  } catch (error) {
    console.error("获取下载目录失败:", error);
    return "";
  }
}

/**
 * 下载音乐文件
 */
export async function downloadMusicTrack(track: MusicTrack, br = 192) {
  const toastId = toast.loading(`准备下载: ${track.name}`);

  try {
    const url = await musicApi.getUrl(track.id, track.source, br);
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
  const dirPath = `Download/${DOWNLOAD_DIR}`;
  // 确保目录存在
  await ensureDownloadDir(DOWNLOAD_DIR);

  const fileUri = await Filesystem.getUri({
    directory: Directory.ExternalStorage,
    path: `${dirPath}/${fileName}`
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

  toast.success(`已保存到目录:\n${dirPath}`, { id: toastId });
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

async function ensureDownloadDir(name: string) {
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
