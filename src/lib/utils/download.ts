import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { musicApi } from "@/services/music-api";
import { MusicTrack } from "@/types/music";
import toast from "react-hot-toast";

/**
 * 下载音乐轨道
 * 在移动端 App 环境下使用 FileTransfer 插件下载到本地 (替代已弃用的 Filesystem.downloadFile)
 * 在浏览器环境下使用 <a> 标签触发下载
 * @param track 音乐轨道信息
 */
export async function downloadMusicTrack(track: MusicTrack) {
  const toastId = toast.loading(`正在获取下载链接: ${track.name}`);
  try {
    const url = await musicApi.getUrl(track.id, track.source);
    if (!url) {
      toast.error("无法获取下载链接", { id: toastId });
      return;
    }
    
    // 生成安全的文件名
    const fileName = `${track.name} - ${track.artist.join(", ")}.mp3`.replace(/[\\/:*?"<>|]/g, "_");

    if (Capacitor.isNativePlatform()) {
      toast.loading(`准备下载: ${track.name}`, { id: toastId });
      
      try {
        // Android 10+ 实际上不需要对特定目录请求权限，但为了兼容性还是检查一下
        const permission = await Filesystem.checkPermissions();
        if (permission.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
        }

        // 1. 获取目标路径的 URI
        const fileInfo = await Filesystem.getUri({
          directory: Directory.Documents,
          path: `OtterMusic/${fileName}`
        });

        // 2. 添加进度监听
        const progressListener = await FileTransfer.addListener('progress', (progress) => {
          const percentage = Math.round((progress.bytes / progress.contentLength) * 100);
          if (!isNaN(percentage)) {
            toast.loading(`正在下载: ${percentage}%`, { id: toastId });
          }
        });

        // 3. 使用 FileTransfer 下载文件
        await FileTransfer.downloadFile({
          url: url,
          path: fileInfo.uri,
        });

        // 移除监听器
        await progressListener.remove();

        toast.success(`下载完成: 已保存到文档/OtterMusic 目录`, { id: toastId });
      } catch (err) {
        console.error("Native download failed", err);
        // 如果 OtterMusic 目录创建失败，尝试直接保存在根目录
        try {
          const rootInfo = await Filesystem.getUri({
            directory: Directory.Documents,
            path: fileName
          });
          
          await FileTransfer.downloadFile({
            url: url,
            path: rootInfo.uri,
          });
          toast.success(`下载完成: 已保存到文档目录`, { id: toastId });
        } catch (retryErr) {
          console.error("Native download retry failed", retryErr);
          toast.error("下载失败，请检查存储权限", { id: toastId });
        }
      }
    } else {
      // 浏览器环境 fallback
      const a = document.createElement('a');
      a.href = url;
      // 注意：跨域 URL 的 download 属性可能不起作用，但在同源或已处理 CORS 的情况下有效
      a.download = fileName; 
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast.success("开始下载 (浏览器已接管)", { id: toastId });
    }
  } catch (error) {
    console.error("Download failed", error);
    toast.error("下载失败", { id: toastId });
  }
}
