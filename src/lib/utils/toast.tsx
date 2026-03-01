import { toast, ToastOptions } from "react-hot-toast";
import { Info, AlertTriangle } from "lucide-react";

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
      icon: <Info className="w-5 h-5 text-blue-500" />,
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
      icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
      ...options,
    });
  },
};

// 导出类型以便使用
export type ToastUtils = typeof toastUtils;
