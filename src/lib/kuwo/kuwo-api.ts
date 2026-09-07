import { fetchWithTimeout, IS_NATIVE } from "@/lib/api/config";
import {
  convertKuwoSongToMusicTrack,
  fetchKuwoPlaylistDetail,
  KUWO_PAGE_SIZE,
  type KuwoPlaylistDetail,
} from "@otter-music/shared";

const NETWORK_TIMEOUT = 12000;

export { convertKuwoSongToMusicTrack, KUWO_PAGE_SIZE };

// ============================================================
// URL 解析（前端特有逻辑）
// ============================================================

export function parseKuwoPlaylistUrl(urlStr: string): string | null {
  try {
    const url = new URL(
      urlStr.startsWith("http") ? urlStr : `https://${urlStr}`
    );
    const pathMatch = url.pathname.match(/playlist_detail\/(\d+)/);
    if (pathMatch) return pathMatch[1];

    const idParam =
      url.searchParams.get("pid") ||
      url.searchParams.get("id") ||
      url.searchParams.get("playlistId");
    return idParam && /^\d+$/.test(idParam) ? idParam : null;
  } catch {
    return null;
  }
}

// ============================================================
// 歌单获取（环境路由 + 调用 shared 核心算法）
// ============================================================

export async function getKuwoPlaylistDetail(
  playlistId: string
): Promise<KuwoPlaylistDetail> {
  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    return fetchKuwoPlaylistDetail(playlistId, async (path) => {
      const res = await CapacitorHttp.request({
        method: "GET",
        url: `http://nplserver.kuwo.cn${path}`,
      });
      if (res.status >= 400) throw new Error(`Kuwo API error: ${res.status}`);
      return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    });
  }

  return fetchKuwoPlaylistDetail(playlistId, async (path) => {
    const res = await fetchWithTimeout(`/api/kuwo${path}`, {}, NETWORK_TIMEOUT);
    if (!res.ok) throw new Error(`Kuwo API error: ${res.status}`);
    return res.text();
  });
}
