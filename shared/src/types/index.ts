// shared/src/types/index.ts
export * from "./music";
export * from "./netease";
export * from "./sync";
export * from "./podcast";

// 统一API响应类型
export type ApiResponse<T = any> = {
  success: boolean;      // 请求是否成功
  data?: T;              // 响应数据，成功时返回
  message?: string;      // 提示消息或错误消息
};


// Cloudflare KV list参数
export type ListOptions = {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

// kv list的结果
export type ListFilesResponse = {
  keys: any[];
  list_complete: boolean;
  cursor?: string;
  cacheStatus?: string | null;
}

export interface NetEaseStoreData {
  cookie: string;
  userId: string;
  profile: {
    nickname: string;
    avatarUrl: string;
    backgroundUrl: string;
    signature: string;
  } | null;
  updatedAt: number;
}
