export interface KVNamespace {
  get(key: string, options?: any): Promise<any>;
  put(key: string, value: any, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<any>;
  getWithMetadata<T = unknown>(
    key: string,
    options?: { type?: "text" | "json" | "arrayBuffer" | "stream" }
  ): Promise<{ value: any; metadata: T | null }>;
}

/** Workers Static Assets binding，由 wrangler.jsonc 的 assets.binding = "ASSETS" 注入。 */
export interface AssetsFetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

export type Env = {
  // Pages 部署时不存在（走 ctx.next() 回退）；Workers 部署时由 ASSETS binding 提供。
  ASSETS?: AssetsFetcher;
  oh_file_url: KVNamespace;
  PASSWORD?: string;
  GITHUB_TOKEN?: string;
};
