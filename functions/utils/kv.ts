import { KVNamespace } from "types/hono";

export async function kvGetJSON<T>(
  kv: KVNamespace,
  key: string,
  fallback: T
): Promise<T> {
  const value = await kv.get(key);
  return value ? JSON.parse(value) : fallback;
}

export async function kvPutJSON<T>(
  kv: KVNamespace,
  key: string,
  value: T
) {
  await kv.put(key, JSON.stringify(value));
}