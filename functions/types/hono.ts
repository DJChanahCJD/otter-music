
export interface KVNamespace {
  get(key: string, options?: any): Promise<any>;
  put(key: string, value: any, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<any>;
  getWithMetadata<T = unknown>(key: string, options?: { type?: "text" | "json" | "arrayBuffer" | "stream" }): Promise<{ value: any; metadata: T | null }>;
}

export type Env = {
  oh_file_url: KVNamespace;
  PASSWORD?: string;
  GITHUB_TOKEN?: string;
};
