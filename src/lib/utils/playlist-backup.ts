import { MusicTrack } from "@/types/music";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { toastUtils } from "@/lib/utils/toast";
import { DownloadPath } from "./download";

interface PlaylistBackup {
  name: string;
  tracks: MusicTrack[];
  createdAt: number;
}

/**
 * 导出歌单
 */
export async function exportPlaylist(name: string, tracks: MusicTrack[]) {
  if (!tracks || tracks.length === 0) {
    toastUtils.error("歌单为空，无法导出");
    return;
  }

  const backupData: PlaylistBackup = {
    name,
    tracks: tracks,
    createdAt: Date.now(),
  };

  const jsonContent = JSON.stringify(backupData, null, 2);
  const fileName = `${name.replace(/[\\/:*?"<>|]/g, '_')}.json`;
  const exportPath = `${DownloadPath}/Playlists/${fileName}`;

  if (Capacitor.isNativePlatform()) {
    try {
      // 移动端：写入 ExternalStorage/Download 目录
      await Filesystem.writeFile({
        path: exportPath,
        data: jsonContent,
        directory: Directory.ExternalStorage,
        encoding: Encoding.UTF8,
        recursive: true, // 自动创建目录
      });

      toastUtils.success(`导出成功：\n${exportPath}`, {
        duration: 4000,
      });
    } catch (error) {
      console.error("Export failed:", error);
      toastUtils.error("导出失败，请检查存储权限");
    }
  } else {
    // Web 端：Blob 下载
    try {
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastUtils.success("导出成功");
    } catch (error) {
      console.error("Web export failed:", error);
      toastUtils.error("导出失败");
    }
  }
}

/**
 * 导入歌单
 */
export async function importPlaylist(file: File): Promise<{ name: string, tracks: MusicTrack[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content) {
          throw new Error("文件内容为空");
        }

        const data = JSON.parse(content);
        
        // 校验数据格式
        let tracks: MusicTrack[] = [];
        let name = file.name.replace(/\.json$/i, "");

        if (Array.isArray(data)) {
          // 兼容纯数组格式
          tracks = data;
        } else if (data && typeof data === 'object') {
          // 标准备份格式
          if (Array.isArray(data.tracks)) {
            tracks = data.tracks;
            if (data.name) name = data.name;
          } else {
             // 尝试判断是否是单个 track
             if (data.id && data.name && data.source) {
                tracks = [data];
             }
          }
        }

        if (!tracks || tracks.length === 0) {
          throw new Error("未找到有效的歌曲数据");
        }

        // 简单的结构校验
        const isValidTrack = (t: any) => t && typeof t.id === 'string' && typeof t.name === 'string';
        if (!tracks.every(isValidTrack)) {
           // 过滤掉无效数据
           const validTracks = tracks.filter(isValidTrack);
           if (validTracks.length === 0) {
             throw new Error("歌曲数据格式不正确");
           }
           tracks = validTracks;
           toastUtils.error(`已过滤 ${tracks.length - validTracks.length} 条无效数据`);
        }

        resolve({ name, tracks });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("读取文件失败"));
    };

    reader.readAsText(file);
  });
}
