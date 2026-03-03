import { toast, ToastOptions } from "react-hot-toast";

/**
 * Toast 工具类
 */
export const toastUtils = {

  /**
   * 信息提示 (原有 toast 没有专门的 info 类型，这里封装一个)
   * @param message 提示内容
   * @param options 配置项
   */
  info: (message: string, options?: ToastOptions) => {
    return toast(message, {
      icon: "ℹ️",
      ...options,
    });
  },

  /**
   * 警告提示 (原有 toast 没有专门的 warning 类型)
   * @param message 提示内容
   * @param options 配置项
   */
  warning: (message: string, options?: ToastOptions) => {
    return toast(message, {
      icon: "⚠️",
      ...options,
    });
  },

  /**
   * 未找到结果提示
   * @param message 提示内容
   * @param options 配置项
   */
  notFound: (message: string, options?: ToastOptions) => {
    return toast(message, {
      icon: "👻",
      ...options,
    });
  },

  success: (message: string, options?: ToastOptions) => toast.success(message, options),
  error: (message: string, options?: ToastOptions) => toast.error(message, options),
  loading: (message: string, options?: ToastOptions) => toast.loading(message, options),
};

// 导出类型以便使用
export type ToastUtils = typeof toastUtils;
