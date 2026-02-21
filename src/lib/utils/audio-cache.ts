import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { MusicSource } from "@/types/music";

/* ================= 类型定义 ================= */

/**
 * 音频缓存元数据
 */
interface AudioCacheMetadata {
  key: string;
  source: MusicSource;
  id: string;
  br: number;
  size: number;
  createdAt: number;
  lastAccessed: number;
}

/**
 * 缓存结果
 */
interface CacheResult {
  exists: boolean;
  path?: string;
  blobUrl?: string;
  metadata?: AudioCacheMetadata;
}

/**
 * 缓存统计信息
 */
interface CacheStats {
  totalSize: number;
  totalCount: number;
}

/* ================= 常量定义 ================= */

const CACHE_DIR = "Data/OtterMusic/cache";
const METADATA_KEY = "audio-cache-metadata";
const MAX_CACHE_SIZE = 500 * 1024 * 1024;
const EXPIRE_DAYS = 30;
const EXPIRE_MS = EXPIRE_DAYS * 24 * 60 * 60 * 1000;

/* ================= IndexedDB 相关 ================= */

const DB_NAME = "OtterMusicAudioCache";
const DB_VERSION = 1;
const STORE_NAME = "audio";

/**
 * 打开 IndexedDB
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * 保存音频 Blob 到 IndexedDB
 */
async function saveBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 从 IndexedDB 读取音频 Blob
 */
async function getBlob(key: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * 从 IndexedDB 删除音频 Blob
 */
async function deleteBlob(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 获取 IndexedDB 中所有键
 */
async function getAllBlobKeys(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as string[]);
  });
}

/* ================= 元数据管理 ================= */

/**
 * 读取缓存元数据
 */
async function readMetadata(): Promise<Map<string, AudioCacheMetadata>> {
  try {
    const { data } = await Filesystem.readFile({
      path: `${CACHE_DIR}/${METADATA_KEY}.json`,
      directory: Directory.Data,
    });
    if (typeof data === 'string') {
      const decoded = atob(data);
      const parsed = JSON.parse(decoded);
      return new Map(Object.entries(parsed));
    }
    return new Map();
  } catch {
    return new Map();
  }
}

/**
 * 保存缓存元数据
 */
async function saveMetadata(metadata: Map<string, AudioCacheMetadata>): Promise<void> {
  try {
    const data = Object.fromEntries(metadata);
    await Filesystem.writeFile({
      path: `${CACHE_DIR}/${METADATA_KEY}.json`,
      data: btoa(JSON.stringify(data)),
      directory: Directory.Data,
      recursive: true,
    });
  } catch (e) {
    console.warn("[AudioCache] 保存元数据失败", e);
  }
}

/**
 * 读取 Web 平台缓存元数据
 */
async function readWebMetadata(): Promise<Map<string, AudioCacheMetadata>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(METADATA_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        try {
          const data = request.result;
          if (data) {
            const text = await data.text();
            const parsed = JSON.parse(text);
            resolve(new Map(Object.entries(parsed)));
          } else {
            resolve(new Map());
          }
        } catch (e) {
          reject(e);
        }
      };
    });
  } catch {
    return new Map();
  }
}

/**
 * 保存 Web 平台缓存元数据
 */
async function saveWebMetadata(metadata: Map<string, AudioCacheMetadata>): Promise<void> {
  try {
    const db = await openDB();
    const data = JSON.stringify(Object.fromEntries(metadata));
    const blob = new Blob([data], { type: "application/json" });

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(blob, METADATA_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.warn("[AudioCache] 保存元数据失败", e);
  }
}

/* ================= 核心功能 ================= */

/**
 * 生成缓存键
 */
function generateCacheKey(source: MusicSource, id: string, br: number): string {
  return `cache:${source}:${id}:${br}`;
}

/**
 * 确保缓存目录存在
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: CACHE_DIR,
      directory: Directory.Data,
      recursive: true,
    });
  } catch {
    console.log("[AudioCache] 缓存目录已存在");
  }
}

/**
 * 保存音频到缓存
 */
export async function saveAudioCache(
  source: MusicSource,
  id: string,
  br: number,
  audioData: ArrayBuffer | Blob,
  size: number
): Promise<void> {
  const key = generateCacheKey(source, id, br);
  const now = Date.now();

  const metadata: AudioCacheMetadata = {
    key,
    source,
    id,
    br,
    size,
    createdAt: now,
    lastAccessed: now,
  };

  if (Capacitor.isNativePlatform()) {
    await ensureCacheDir();

    const fileName = `${key}.mp3`;
    const base64 = btoa(
      new Uint8Array(audioData as ArrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    await Filesystem.writeFile({
      path: `${CACHE_DIR}/${fileName}`,
      data: base64,
      directory: Directory.Data,
    });

    const allMetadata = await readMetadata();
    allMetadata.set(key, metadata);
    await saveMetadata(allMetadata);
  } else {
    const blob = audioData instanceof Blob ? audioData : new Blob([audioData]);
    await saveBlob(key, blob);

    const allMetadata = await readWebMetadata();
    allMetadata.set(key, metadata);
    await saveWebMetadata(allMetadata);
  }

  await cleanupCache();
}

/**
 * 从缓存获取音频
 */
export async function getAudioCache(
  source: MusicSource,
  id: string,
  br: number
): Promise<CacheResult> {
  const key = generateCacheKey(source, id, br);

  if (Capacitor.isNativePlatform()) {
    try {
      const fileName = `${key}.mp3`;
      const filePath = `${CACHE_DIR}/${fileName}`;

      // 检查文件是否存在
      try {
        await Filesystem.stat({
          path: filePath,
          directory: Directory.Data,
        });
      } catch {
        return { exists: false };
      }

      // 获取完整 URI
      const { uri } = await Filesystem.getUri({
        path: filePath,
        directory: Directory.Data,
      });

      // 转换为 WebView 可访问的 URL
      const convertedUrl = Capacitor.convertFileSrc(uri);

      const allMetadata = await readMetadata();
      const metadata = allMetadata.get(key);

      if (metadata) {
        metadata.lastAccessed = Date.now();
        allMetadata.set(key, metadata);
        await saveMetadata(allMetadata);
      }

      return {
        exists: true,
        path: convertedUrl,
        metadata,
      };
    } catch {
      return { exists: false };
    }
  } else {
    try {
      const blob = await getBlob(key);
      if (!blob) {
        return { exists: false };
      }

      const allMetadata = await readWebMetadata();
      const metadata = allMetadata.get(key);

      if (metadata) {
        metadata.lastAccessed = Date.now();
        allMetadata.set(key, metadata);
        await saveWebMetadata(allMetadata);
      }

      const blobUrl = URL.createObjectURL(blob);

      return {
        exists: true,
        blobUrl,
        metadata,
      };
    } catch {
      return { exists: false };
    }
  }
}

/**
 * 删除指定缓存
 */
export async function deleteAudioCache(
  source: MusicSource,
  id: string,
  br: number
): Promise<void> {
  const key = generateCacheKey(source, id, br);

  if (Capacitor.isNativePlatform()) {
    try {
      const fileName = `${key}.mp3`;
      await Filesystem.deleteFile({
        path: `${CACHE_DIR}/${fileName}`,
        directory: Directory.Data,
      });

      const allMetadata = await readMetadata();
      allMetadata.delete(key);
      await saveMetadata(allMetadata);
    } catch (e) {
      console.warn("[AudioCache] 删除缓存失败", e);
    }
  } else {
    try {
      await deleteBlob(key);

      const allMetadata = await readWebMetadata();
      allMetadata.delete(key);
      await saveWebMetadata(allMetadata);
    } catch (e) {
      console.warn("[AudioCache] 删除缓存失败", e);
    }
  }
}

/**
 * 清理过期缓存
 */
async function cleanupExpiredCache(): Promise<void> {
  const now = Date.now();
  const expiredKeys: string[] = [];

  if (Capacitor.isNativePlatform()) {
    const allMetadata = await readMetadata();

    for (const [key, metadata] of allMetadata.entries()) {
      if (now - metadata.lastAccessed > EXPIRE_MS) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      try {
        const fileName = `${key}.mp3`;
        await Filesystem.deleteFile({
          path: `${CACHE_DIR}/${fileName}`,
          directory: Directory.Data,
        });
        allMetadata.delete(key);
      } catch (e) {
        console.warn("[AudioCache] 删除过期缓存失败", e);
      }
    }

    if (expiredKeys.length > 0) {
      await saveMetadata(allMetadata);
    }
  } else {
    const allMetadata = await readWebMetadata();

    for (const [key, metadata] of allMetadata.entries()) {
      if (now - metadata.lastAccessed > EXPIRE_MS) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      try {
        await deleteBlob(key);
        allMetadata.delete(key);
      } catch (e) {
        console.warn("[AudioCache] 删除过期缓存失败", e);
      }
    }

    if (expiredKeys.length > 0) {
      await saveWebMetadata(allMetadata);
    }
  }
}

/**
 * 清理空间（LRU 策略）
 */
async function cleanupSpace(): Promise<void> {
  let currentSize = 0;

  if (Capacitor.isNativePlatform()) {
    const allMetadata = await readMetadata();

    for (const metadata of allMetadata.values()) {
      currentSize += metadata.size;
    }

    if (currentSize <= MAX_CACHE_SIZE) {
      return;
    }

    const entries = Array.from(allMetadata.entries()).sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed
    );

    for (const [key, metadata] of entries) {
      if (currentSize <= MAX_CACHE_SIZE) {
        break;
      }

      try {
        const fileName = `${key}.mp3`;
        await Filesystem.deleteFile({
          path: `${CACHE_DIR}/${fileName}`,
          directory: Directory.Data,
        });
        currentSize -= metadata.size;
        allMetadata.delete(key);
      } catch (e) {
        console.warn("[AudioCache] 删除旧缓存失败", e);
      }
    }

    await saveMetadata(allMetadata);
  } else {
    const allMetadata = await readWebMetadata();

    for (const metadata of allMetadata.values()) {
      currentSize += metadata.size;
    }

    if (currentSize <= MAX_CACHE_SIZE) {
      return;
    }

    const entries = Array.from(allMetadata.entries()).sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed
    );

    for (const [key, metadata] of entries) {
      if (currentSize <= MAX_CACHE_SIZE) {
        break;
      }

      try {
        await deleteBlob(key);
        currentSize -= metadata.size;
        allMetadata.delete(key);
      } catch (e) {
        console.warn("[AudioCache] 删除旧缓存失败", e);
      }
    }

    await saveWebMetadata(allMetadata);
  }
}

/**
 * 清理缓存（过期 + 空间限制）
 */
export async function cleanupCache(): Promise<void> {
  await cleanupExpiredCache();
  await cleanupSpace();
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats(): Promise<CacheStats> {
  let totalSize = 0;
  let totalCount = 0;

  if (Capacitor.isNativePlatform()) {
    const allMetadata = await readMetadata();

    for (const metadata of allMetadata.values()) {
      totalSize += metadata.size;
      totalCount++;
    }
  } else {
    const allMetadata = await readWebMetadata();

    for (const metadata of allMetadata.values()) {
      totalSize += metadata.size;
      totalCount++;
    }
  }

  return {
    totalSize,
    totalCount,
  };
}

/**
 * 清空所有缓存
 */
export async function clearAllCache(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const allMetadata = await readMetadata();

      for (const key of allMetadata.keys()) {
        try {
          const fileName = `${key}.mp3`;
          await Filesystem.deleteFile({
            path: `${CACHE_DIR}/${fileName}`,
            directory: Directory.Data,
          });
        } catch (e) {
          console.warn("[AudioCache] 删除缓存失败", e);
        }
      }

      await saveMetadata(new Map());
    } catch (e) {
      console.warn("[AudioCache] 清空缓存失败", e);
    }
  } else {
    try {
      const allKeys = await getAllBlobKeys();
      const metadataKey = METADATA_KEY;

      for (const key of allKeys) {
        if (key !== metadataKey) {
          try {
            await deleteBlob(key);
          } catch (e) {
            console.warn("[AudioCache] 删除缓存失败", e);
          }
        }
      }

      await saveWebMetadata(new Map());
    } catch (e) {
      console.warn("[AudioCache] 清空缓存失败", e);
    }
  }
}
