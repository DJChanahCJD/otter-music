import { getApiUrl, IS_NATIVE } from "@/lib/api/config";
import {
  buildKugouAndroidHeaders,
  convertKugouSongToMusicTrack,
  fetchKugouGlobalPlaylistPages,
  fetchKugouPlaylistPages,
  isKugouGlobalCollectionId,
  KUGOU_PAGE_SIZE,
  parseKugouDeviceRegistrationResponse,
  buildKugouDeviceRegistrationPayload,
  withKugouPlaylistMeta,
  type KugouPlaylistDetail,
} from "@otter-music/shared";

const KUGOU_PROXY_PREFIX = "/music-api/kugou";
const NETWORK_TIMEOUT = 12000;
const DEVICE_MID_STORAGE_KEY = "otter_kugou_device_mid";
const DEVICE_DFID_STORAGE_KEY = "otter_kugou_device_dfid";

function getDeviceMid(): string {
  try {
    const stored = localStorage.getItem(DEVICE_MID_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    /* localStorage not available */
  }
  const mid = crypto.randomUUID().replace(/-/g, "");
  try {
    localStorage.setItem(DEVICE_MID_STORAGE_KEY, mid);
  } catch {
    /* ignore */
  }
  return mid;
}

function getDeviceDfid(): string | null {
  try {
    return localStorage.getItem(DEVICE_DFID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveDeviceDfid(dfid: string): void {
  try {
    localStorage.setItem(DEVICE_DFID_STORAGE_KEY, dfid);
  } catch {
    /* ignore */
  }
}

const DEVICE_MID = getDeviceMid();

export {
  convertKugouSongToMusicTrack,
  isKugouGlobalCollectionId,
  KUGOU_PAGE_SIZE,
};

// ============================================================
// 设备注册（使用 shared 的构建/解析函数 + 本地 fetch）
// ============================================================

async function registerKugouDevice(): Promise<string> {
  const payload = await buildKugouDeviceRegistrationPayload(DEVICE_MID);

  const res = await fetchWithTimeout(payload.url, {
    method: "POST",
    headers: payload.headers,
    body: payload.body,
  });

  if (!res.ok) throw new Error(`设备注册失败: ${res.status}`);

  const raw = new Uint8Array(await res.arrayBuffer());
  const { dfid } = await parseKugouDeviceRegistrationResponse(
    raw,
    payload.encryptKey,
    payload.iv
  );
  return dfid;
}

async function ensureDeviceDfid(): Promise<string> {
  const stored = getDeviceDfid();
  if (stored) return stored;
  const dfid = await registerKugouDevice();
  saveDeviceDfid(dfid);
  return dfid;
}

// ============================================================
// URL 解析（前端特有逻辑：短链、qrcode 递归）
// ============================================================

export function parseKugouPlaylistUrl(urlStr: string): string | null {
  try {
    const url = new URL(
      urlStr.startsWith("http") ? urlStr : `https://${urlStr}`
    );
    const pathMatch = url.pathname.match(
      /(?:special\/single|plist\/list)\/(\d+)/
    );
    if (pathMatch) return pathMatch[1];

    const globalPathMatch = url.pathname.match(
      /\/songlist\/(gcid_[a-z0-9]+)\/?/i
    );
    if (globalPathMatch) return globalPathMatch[1];

    const idParam =
      url.searchParams.get("specialid") || url.searchParams.get("id");
    if (idParam && /^\d+$/.test(idParam)) return idParam;
    if (idParam && /^gcid_[a-z0-9]+$/i.test(idParam)) return idParam;

    const qrcode = url.searchParams.get("qrcode");
    if (qrcode) return parseKugouPlaylistUrl(decodeURIComponent(qrcode));

    const globalIdParam = url.searchParams.get("global_collection_id");
    return globalIdParam && /^gcid_[a-z0-9]+$/i.test(globalIdParam)
      ? globalIdParam
      : null;
  } catch {
    return null;
  }
}

export async function resolveKugouPlaylistId(
  urlStr: string
): Promise<string | null> {
  try {
    const url = new URL(
      urlStr.startsWith("http") ? urlStr : `https://${urlStr}`
    );
    if (/^t\d+\.kugou\.com$/.test(url.hostname)) {
      const endpoint = !IS_NATIVE
        ? `/api/kugou-resolve${url.pathname}${url.search}`
        : `${getApiUrl()}${KUGOU_PROXY_PREFIX}/resolve-shortlink`;

      const isDevProxy = !IS_NATIVE;
      const res = isDevProxy
        ? await fetch(endpoint)
        : await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url.toString() }),
          });

      if (!res.ok) return null;
      const data = (await res.json()) as { resolvedUrl?: string };
      return data.resolvedUrl ? parseKugouPlaylistUrl(data.resolvedUrl) : null;
    }
    return parseKugouPlaylistUrl(urlStr);
  } catch {
    return null;
  }
}

// ============================================================
// 歌单获取（环境路由 + 调用 shared 的核心算法）
// ============================================================

export async function getKugouPlaylistDetail(
  playlistId: string
): Promise<KugouPlaylistDetail> {
  if (isKugouGlobalCollectionId(playlistId)) {
    return getKugouGlobalPlaylistDetail(playlistId);
  }

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const detail = await fetchKugouPlaylistPages(playlistId, async (path) => {
      const res = await CapacitorHttp.request({
        method: "GET",
        url: `http://mobilecdn.kugou.com${path}`,
      });
      if (res.status >= 400) throw new Error(`Kugou API error: ${res.status}`);
      return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    });
    return withKugouPlaylistMeta(playlistId, detail, async (url) => {
      const res = await CapacitorHttp.request({ method: "GET", url });
      if (res.status >= 400) return null;
      return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    });
  }

  const detail = await fetchKugouPlaylistPages(playlistId, async (path) => {
    const res = await fetchWithTimeout(`/api/kugou${path}`);
    if (!res.ok) throw new Error(`Kugou API error: ${res.status}`);
    return res.text();
  });
  return withKugouPlaylistMeta(playlistId, detail, async (url) => {
    const res = await fetchWithTimeout(
      `/api/kugou-page/${new URL(url).pathname}`
    );
    if (!res.ok) return null;
    return res.text();
  });
}

async function getKugouGlobalPlaylistDetail(
  playlistId: string
): Promise<KugouPlaylistDetail> {
  const dfid = await ensureDeviceDfid();

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    return fetchKugouGlobalPlaylistPages(
      playlistId,
      dfid,
      DEVICE_MID,
      async (url) => {
        const res = await CapacitorHttp.request({
          method: "GET",
          url,
          headers: buildKugouAndroidHeaders(url, dfid, DEVICE_MID),
        });
        if (res.status >= 400)
          throw new Error(`Kugou API error: ${res.status}`);
        return typeof res.data === "string"
          ? res.data
          : JSON.stringify(res.data);
      },
      async (url, body) => {
        const res = await CapacitorHttp.request({
          method: "POST",
          url,
          headers: {
            ...buildKugouAndroidHeaders(url, dfid, DEVICE_MID),
            "Content-Type": "application/json",
          },
          data: JSON.parse(body),
        });
        if (res.status >= 400) return null;
        return typeof res.data === "string"
          ? res.data
          : JSON.stringify(res.data);
      }
    );
  }

  return fetchKugouGlobalPlaylistPages(
    playlistId,
    dfid,
    DEVICE_MID,
    async (url) => {
      const parsed = new URL(url);
      const res = await fetchWithTimeout(
        `/api/kugou-global${parsed.pathname}${parsed.search}`,
        {
          headers: buildKugouAndroidHeaders(url, dfid, DEVICE_MID),
        }
      );
      if (!res.ok) throw new Error(`Kugou API error: ${res.status}`);
      return res.text();
    },
    async (url, body) => {
      const parsed = new URL(url);
      const res = await fetchWithTimeout(
        `/api/kugou-global${parsed.pathname}${parsed.search}`,
        {
          method: "POST",
          headers: {
            ...buildKugouAndroidHeaders(url, dfid, DEVICE_MID),
            "Content-Type": "application/json",
          },
          body,
        }
      );
      if (!res.ok) return null;
      return res.text();
    }
  );
}

// ============================================================
// 工具
// ============================================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = NETWORK_TIMEOUT
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}
