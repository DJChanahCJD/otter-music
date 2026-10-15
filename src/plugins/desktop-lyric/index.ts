import { registerPlugin } from "@capacitor/core";

/**
 * 桌面歌词悬浮窗插件（仅 Android 原生实现）。
 *
 * 悬浮药丸水平居中、默认紧贴状态栏下方，仅可上下拖动；本应用前台时原生自动隐藏。
 * 需要特殊权限 SYSTEM_ALERT_WINDOW，先 checkOverlayPermission /
 * requestOverlayPermission 引导授权，再 show()。逐行歌词由
 * useDesktopLyric 通过 setLyric 推送；双击药丸拉起本应用并跳转桌面歌词设置项。
 */
export interface DesktopLyricPlugin {
  /** 是否已授予"显示在其他应用上层"权限 */
  checkOverlayPermission(): Promise<{ granted: boolean }>;
  /** 跳转系统悬浮窗授权页 */
  requestOverlayPermission(): Promise<void>;
  /** 显示悬浮歌词条（幂等） */
  show(): Promise<void>;
  /** 隐藏悬浮歌词条 */
  hide(): Promise<void>;
  /** 更新当前歌词行 */
  setLyric(options: { text: string }): Promise<void>;
  /** 调整歌词字号（单位 sp） */
  setSize(options: { size: number }): Promise<void>;
  /** 调整歌词字色（hex，如 "#FFFFFF"） */
  setColor(options: { color: string }): Promise<void>;
  /** 消费"双击歌词打开设置"请求：返回并清除 pending 标记 */
  consumeOpenSettings(): Promise<{ pending: boolean }>;
}

const DesktopLyric = registerPlugin<DesktopLyricPlugin>("DesktopLyric");

export { DesktopLyric };
