import { get, set } from "idb-keyval";

const DEVICE_KEY_NAME = "__oh_dk__";
const ALGO = "AES-GCM";
let memoryKey: CryptoKey | null = null;

/** 获取或生成设备密钥。优先 IndexedDB，不可用时回退到内存。 */
async function getDeviceKey(): Promise<CryptoKey> {
  if (memoryKey) return memoryKey;

  const hasIDB = typeof indexedDB !== "undefined";

  if (hasIDB) {
    try {
      const raw = await get<ArrayBuffer>(DEVICE_KEY_NAME);
      if (raw) {
        return (memoryKey = await crypto.subtle.importKey("raw", raw, ALGO, false, ["encrypt", "decrypt"]));
      }
    } catch {
      return generateAndPersistDeviceKey(hasIDB);
    }
  }

  return generateAndPersistDeviceKey(hasIDB);
}

async function generateAndPersistDeviceKey(shouldPersist: boolean): Promise<CryptoKey> {
  memoryKey = await crypto.subtle.generateKey({ name: ALGO, length: 256 }, true, ["encrypt", "decrypt"]);

  if (shouldPersist) {
    // 异步持久化，不阻塞主流程返回
    crypto.subtle.exportKey("raw", memoryKey)
      .then((exported) => set(DEVICE_KEY_NAME, exported))
      .catch(() => undefined);
  }

  return memoryKey;
}

// 辅助函数：避免大数组使用扩展运算符(...)导致调用栈溢出
const toBase64 = (buf: Uint8Array) => btoa(Array.from(buf, (b) => String.fromCharCode(b)).join(""));
const fromBase64 = (str: string) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

/** 加密字符串，返回 base64 编码的 `iv:ciphertext` */
export async function encryptString(plaintext: string): Promise<string> {
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);

  const combined = new Uint8Array(12 + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), 12);
  
  return toBase64(combined);
}

/** 解密 encryptString 返回的字符串 */
export async function decryptString(ciphertext: string): Promise<string> {
  const key = await getDeviceKey();
  const bytes = fromBase64(ciphertext);
  
  const plain = await crypto.subtle.decrypt(
    { name: ALGO, iv: bytes.slice(0, 12) }, 
    key, 
    bytes.slice(12)
  );
  
  return new TextDecoder().decode(plain);
}
