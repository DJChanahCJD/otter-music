import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types/hono";
import { ok, fail } from "@utils/response";
import { authMiddleware } from "middleware/auth";
import { SYNC_KEY_PREFIX, SyncKeyMetadata } from "@otter-music/shared";

// ================================================================
// 类型 & 常量
// ================================================================

type Variables = { syncKey: string; kvKey: string };
export const syncRoutesV2 = new Hono<{ Bindings: Env; Variables: Variables }>();

type SyncRecord = { id: string; update_time: number; is_deleted: boolean; [k: string]: any };
type SyncPlaylist = SyncRecord & { tracks: SyncRecord[] };

const TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 墓碑保留 7 天
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const COMPRESS_THRESHOLD = 1024; // 小于此字节数不压缩
const MAGIC_RAW = 0x00; // 小于 COMPRESS_THRESHOLD，直接存 JSON 的二进制，并在开头放一个 0x00
const MAGIC_DEFLATE = 0x7a; // 0x7a = 122 = 'z'

const toArrayBuffer = (input: Uint8Array): ArrayBuffer =>
  input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;

// ================================================================
// KV 序列化：写入格式 = [1字节魔术头 | payload]
// ================================================================

// 利用 Response 收集 ReadableStream 到 Uint8Array
const streamToU8 = (s: ReadableStream) =>
  new Response(s).arrayBuffer().then((b) => new Uint8Array(b));

async function deflate(input: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate-raw");
  const w = cs.writable.getWriter();
  await w.write(toArrayBuffer(input)).finally(() => w.close());
  return streamToU8(cs.readable);
}

async function inflate(input: Uint8Array): Promise<string> {
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter();
  await w.write(toArrayBuffer(input)).finally(() => w.close());
  return new TextDecoder().decode(await streamToU8(ds.readable));
}

async function serializeForKV(data: unknown): Promise<ArrayBuffer> {
  const utf8 = new TextEncoder().encode(JSON.stringify(data));
  const isRaw = utf8.length < COMPRESS_THRESHOLD;
  const payload = isRaw ? utf8 : await deflate(utf8);

  const out = new Uint8Array(1 + payload.length);
  out[0] = isRaw ? MAGIC_RAW : MAGIC_DEFLATE;
  out.set(payload, 1);
  return out.buffer;
}

async function deserializeFromKV(buf: ArrayBuffer | null): Promise<any> {
  if (!buf || buf.byteLength === 0) return {};
  const bytes = new Uint8Array(buf);
  const magic = bytes[0];
  const payload = bytes.slice(1);

  if (magic === MAGIC_DEFLATE) return JSON.parse(await inflate(payload));
  if (magic === MAGIC_RAW) return JSON.parse(new TextDecoder().decode(payload));

  // 兼容旧格式 "z1:<base64>"
  const str = new TextDecoder().decode(bytes);
  if (str.startsWith("z1:")) {
    const raw = Uint8Array.from(atob(str.slice(3)), (c) => c.charCodeAt(0));
    return JSON.parse(await inflate(raw));
  }
  return str ? JSON.parse(str) : {};
}

// ================================================================
// 数据处理：规范化 / GC / LWW 合并
// ================================================================

// 补全缺失字段，过滤无效条目
const sanitizeObj = (v: any): SyncRecord | null =>
  v?.id && typeof v.id === "string"
    ? { ...v, update_time: v.update_time || 0, is_deleted: !!v.is_deleted }
    : null;

const sanitizeList = <T>(v: any): T[] =>
  Array.isArray(v) ? (v.map(sanitizeObj).filter(Boolean) as T[]) : [];

// 保证 favorites / playlists 结构完整
const formatData = (v: any) => ({
  ...(v || {}),
  favorites: sanitizeList<SyncRecord>(v?.favorites),
  playlists: sanitizeList<SyncPlaylist>(v?.playlists).map((p) => ({
    ...p,
    tracks: sanitizeList<SyncRecord>(p.tracks),
  })),
});

// 清理超过 TTL 的墓碑记录
const gcData = (data: ReturnType<typeof formatData>, now: number) => {
  const gc = <T extends SyncRecord>(list: T[]) =>
    list.filter((r) => !(r.is_deleted && now - r.update_time > TOMBSTONE_TTL_MS));
  return {
    ...data,
    favorites: gc(data.favorites),
    playlists: gc(data.playlists).map((p) => ({ ...p, tracks: gc(p.tracks) })),
  };
};

// Last-Write-Wins 合并：相同 id 保留 update_time 更大的版本；新增条目追加到头部
function mergeLWW<T extends SyncRecord>(server: T[], client: T[]): T[] {
  const map = new Map<string, T>(server.map((item) => [item.id, item]));
  for (const c of client) {
    const s = map.get(c.id);
    if (!s || c.update_time >= s.update_time) map.set(c.id, c);
  }
  const serverIds = new Set(server.map((i) => i.id));
  return [
    ...client.filter((c) => !serverIds.has(c.id)).map((c) => map.get(c.id)!),
    ...server.map((s) => map.get(s.id)!),
  ];
}

// count:maxUpdateTime 轻量指纹（仅用于 pull 时检测 GC 是否产生变化）
const getFingerprint = (d: ReturnType<typeof formatData>): string => {
  let count = d.favorites.length,
    maxT = 0;
  for (const f of d.favorites) {
    if (f.update_time > maxT) maxT = f.update_time;
  }
  for (const p of d.playlists) {
    count += 1 + p.tracks.length;
    if (p.update_time > maxT) maxT = p.update_time;
    for (const t of p.tracks) {
      if (t.update_time > maxT) maxT = t.update_time;
    }
  }
  return `${count}:${maxT}`;
};

// 生成随机 syncKey，可携带自定义前缀
const generateKey = (prefix?: string) => {
  const code = Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (b) => ALPHABET[b % ALPHABET.length],
  ).join("");
  return prefix ? `${prefix}_${code}` : code;
};

// ================================================================
// 路由
// ================================================================

// Bearer Token 中间件（跳过管理端路径）
syncRoutesV2.use("/*", async (c, next) => {
  if (c.req.path.includes("/keys") || c.req.path.includes("/create-key")) return next();

  const token = c.req.header("Authorization")?.match(/^Bearer\s+(\S+)$/)?.[1];
  if (!token) return fail(c, "Invalid Authorization", 401);

  c.set("syncKey", token);
  c.set("kvKey", `${SYNC_KEY_PREFIX}${token}`);
  return next();
});

// GET /check — 检查 syncKey 是否存在及上次同步时间
syncRoutesV2.get("/check", async (c) => {
  const { metadata } = await c.env.oh_file_url.getWithMetadata<SyncKeyMetadata>(c.get("kvKey"));
  return metadata === null
    ? fail(c, "Sync key not found", 404)
    : ok(c, { lastSyncTime: metadata.lastSyncTime || 0 });
});

// GET /pull — 拉取数据（自动 GC 墓碑，有变化时异步写回）
syncRoutesV2.get("/pull", async (c) => {
  const kv = c.env.oh_file_url;
  const { value, metadata } = await kv.getWithMetadata<SyncKeyMetadata>(c.get("kvKey"), {
    type: "arrayBuffer",
  });
  if (value === null) return fail(c, "Sync key not found", 404);

  const raw = formatData(await deserializeFromKV(value));
  const now = Date.now();
  const data = gcData(raw, now);

  // GC 有条目被清理时，异步写回（lastSyncTime 保持原值，不触发客户端拉取）
  if (getFingerprint(data) !== getFingerprint(raw)) {
    c.executionCtx.waitUntil(
      serializeForKV(data).then((buf) =>
        kv.put(c.get("kvKey"), buf, {
          metadata: { lastSyncTime: metadata?.lastSyncTime || 0 } satisfies SyncKeyMetadata,
        }),
      ),
    );
  }

  return ok(c, { data, lastSyncTime: metadata?.lastSyncTime || 0 });
});

// POST / — 推送并合并（LWW），返回合并结果
syncRoutesV2.post(
  "/",
  zValidator("json", z.object({ data: z.any() })),
  async (c) => {
    const kv = c.env.oh_file_url;
    const kvKey = c.get("kvKey");
    const stored = await kv.get(kvKey, "arrayBuffer");
    if (stored === null) return fail(c, "Sync key not found", 404);

    const { data: clientData } = c.req.valid("json");
    const now = Date.now();

    const serverData = gcData(formatData(await deserializeFromKV(stored)), now);
    const client = gcData(formatData(clientData), now);
    const merged = {
      ...serverData,
      ...client,
      favorites: mergeLWW(serverData.favorites, client.favorites),
      playlists: mergeLWW(serverData.playlists, client.playlists),
    };

    await kv.put(kvKey, await serializeForKV(merged), {
      metadata: { lastSyncTime: now } satisfies SyncKeyMetadata,
    });

    return ok(c, { data: merged, lastSyncTime: now }, "Sync successful");
  },
);

// ---- 管理端（需 Cookie 认证）----

// POST /create-key — 创建新 syncKey
syncRoutesV2.post(
  "/create-key",
  authMiddleware,
  zValidator(
    "json",
    z.object({ prefix: z.string().regex(/^[a-z0-9_-]+$/i).max(20).optional() }),
  ),
  async (c) => {
    const kv = c.env.oh_file_url;
    const { prefix } = c.req.valid("json");
    for (let i = 0; i < 5; i++) {
      const syncKey = generateKey(prefix);
      const kvKey = `${SYNC_KEY_PREFIX}${syncKey}`;
      if (!(await kv.get(kvKey, "arrayBuffer"))) {
        await kv.put(kvKey, new ArrayBuffer(0), { metadata: { lastSyncTime: 0 } });
        return ok(c, { syncKey }, "Sync key created");
      }
    }
    return fail(c, "Failed to generate unique key", 500);
  },
);

// GET /keys — 列出所有 syncKey
syncRoutesV2.get("/keys", authMiddleware, async (c) => {
  const kv = c.env.oh_file_url;
  const keys: { key: string; lastSyncTime: number }[] = [];
  let cursor: string | undefined;

  do {
    const result = await kv.list({ prefix: SYNC_KEY_PREFIX, cursor });
    keys.push(
      ...result.keys.map((k: { name: string; metadata: unknown }) => ({
        key: k.name.replace(SYNC_KEY_PREFIX, ""),
        lastSyncTime: (k.metadata as SyncKeyMetadata)?.lastSyncTime || 0,
      })),
    );
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return ok(c, { keys });
});

// DELETE /keys/:key — 删除指定 syncKey
syncRoutesV2.delete("/keys/:key", authMiddleware, async (c) => {
  const kv = c.env.oh_file_url;
  const kvKey = `${SYNC_KEY_PREFIX}${c.req.param("key")}`;
  if ((await kv.get(kvKey)) === null) return fail(c, "Sync key not found", 404);

  await kv.delete(kvKey);
  return ok(c, null, "Sync key deleted");
});
