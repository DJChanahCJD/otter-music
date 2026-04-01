import { get, set } from "idb-keyval";

const DEVICE_KEY_NAME = "__oh_dk__";

/** 获取或生成设备密钥（AES-GCM 256 位）。密钥存在 IndexedDB，不可导出。 */
async function getDeviceKey(): Promise<CryptoKey> {
  const raw: ArrayBuffer | undefined = await get(DEVICE_KEY_NAME);
  if (raw) {
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const exported = await crypto.subtle.exportKey("raw", key);
  await set(DEVICE_KEY_NAME, exported);
  return key;
}

/** 加密字符串，返回 base64 编码的 `iv:ciphertext` */
export async function encryptString(plaintext: string): Promise<string> {
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

/** 解密 encryptString 返回的字符串 */
export async function decryptString(ciphertext: string): Promise<string> {
  const key = await getDeviceKey();
  const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}
