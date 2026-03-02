import { Directory } from "@capacitor/filesystem";

/**
 * 统一存储配置中心
 */
export const STORAGE_CONFIG = {
  // 根目录名称
  BASE_NAME: "OtterMusic",
  // 基础路径（相对于根）
  ROOT: "Download/OtterMusic",
  // 公共目录枚举
  BASE_DIR: Directory.ExternalStorage,
} as const;

/**
 * 集中管理所有业务路径
 */
export const AppPaths = {
  // 音乐文件存放处
  Music: STORAGE_CONFIG.ROOT,
  
  // 私有数据存放处（如 JSON 记录）
  Data: `${STORAGE_CONFIG.ROOT}/.data`,
  
  // 缓存存放处（如封面图片等）
  Cache: `${STORAGE_CONFIG.ROOT}/.cache`,

  // 歌单导出存放处
  Playlists: `${STORAGE_CONFIG.ROOT}/Playlists`,

  /**
   * 辅助方法：生成完整的文件路径
   */
  join: (base: string, fileName: string) => `${base}/${fileName}`,
};