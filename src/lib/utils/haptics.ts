import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

/**
 * 触觉反馈工具类
 * 自动处理平台检测，确保在非原生环境下优雅降级
 */
export const haptics = {
  /**
   * 触发轻微触感反馈（适用于按钮点击、列表项交互）
   */
  impact: async (style: ImpactStyle = ImpactStyle.Light) => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style });
    } catch (e) {
      console.warn('Haptics impact failed', e);
    }
  },

  /**
   * 触发通知反馈（适用于成功、警告、错误提示）
   */
  notification: async (type: NotificationType = NotificationType.Success) => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type });
    } catch (e) {
      console.warn('Haptics notification failed', e);
    }
  },

  /**
   * 触发选择器变化反馈（适用于滚动选择器、滑块）
   */
  selectionChanged: async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionChanged();
    } catch (e) {
      console.warn('Haptics selectionChanged failed', e);
    }
  },

  /**
   * 触发短暂振动（标准震动）
   */
  vibrate: async () => {
    if (!isNative) return;
    try {
      await Haptics.vibrate();
    } catch (e) {
      console.warn('Haptics vibrate failed', e);
    }
  }
};
