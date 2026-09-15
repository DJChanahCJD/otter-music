import type { MusicTrack } from "../../types/music";
import { forceHttps, normalizeResourceUrl } from "../url";
import type {
  MiguPlaylistDetail,
  MiguPlaylistInfoResponse,
  MiguPlaylistSongsResponse,
  MiguSongRaw,
  MiguSongUrlResponse,
  MiguV3SearchSongRaw,
} from "../../types/music-platforms";

// ============================================================
// 常量
// ============================================================

export const MIGU_PAGE_SIZE = 50;

/** 咪咕图片 CDN 域名：接口返回的歌曲封面常为 `/data/oss/...` 相对路径，需补全主机 */
const MIGU_CDN_ORIGIN = "https://d.musicapp.migu.cn";

/**
 * 归一化咪咕图片地址：相对路径补全 CDN 域名，协议相对补 https，其余强制 https
 * @param url 接口原始图片字段（可能是相对路径、协议相对路径或完整地址）
 * @returns 可直接用于 <img src> 的绝对地址；入参为空时返回空字符串
 */
export function normalizeMiguImageUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${MIGU_CDN_ORIGIN}${url}`;
  return forceHttps(url);
}

// ============================================================
// URL / 路径构建
// ============================================================

export function buildMiguPlaylistInfoPath(playlistId: string): string {
  return `/MIGUM2.0/v1.0/content/resourceinfo.do?needSimple=00&resourceType=2021&resourceId=${encodeURIComponent(playlistId)}`;
}

export function buildMiguPlaylistSongsPath(
  playlistId: string,
  page: number,
  pageSize = MIGU_PAGE_SIZE
): string {
  return `/MIGUM2.0/v1.0/user/queryMusicListSongs.do?musicListId=${encodeURIComponent(playlistId)}&pageNo=${page}&pageSize=${pageSize}`;
}

export function buildMiguSongUrlPath(
  copyrightId: string,
  contentId: string,
  br = 192
): string {
  const toneFlag = br >= 999 ? "SQ" : br >= 320 ? "HQ" : "PQ";
  return `/MIGUM3.0/strategy/pc/listen/v1.0?scene=&netType=01&resourceType=2&copyrightId=${encodeURIComponent(copyrightId)}&contentId=${encodeURIComponent(contentId)}&toneFlag=${toneFlag}`;
}

// ============================================================
// 请求头
// ============================================================

export function buildMiguHeaders(): Record<string, string> {
  return {
    channel: "0146951",
    uid: "1234",
  };
}

// ============================================================
// 解析
// ============================================================

export function parseMiguPlaylistInfoResponse(
  text: string
): MiguPlaylistInfoResponse {
  return JSON.parse(text) as MiguPlaylistInfoResponse;
}

export function parseMiguPlaylistSongsResponse(
  text: string
): MiguPlaylistSongsResponse {
  return JSON.parse(text) as MiguPlaylistSongsResponse;
}

export function parseMiguSongUrlResponse(
  response: MiguSongUrlResponse
): string | null {
  const url = response.data?.url || response.data?.playUrl || null;
  return url ? normalizeResourceUrl(url).replace(/\+/g, "%2B") : null;
}

export function parseMiguTrackId(
  trackId: string
): { copyrightId: string; contentId: string } | null {
  const match = trackId.match(/^migu_([^_]+)_([^_]+)$/);
  return match ? { copyrightId: match[1], contentId: match[2] } : null;
}

// ============================================================
// 歌曲转换
// ============================================================

function normalizeArtists(song: MiguSongRaw): string[] {
  const artists = song.artists?.map((artist) => artist.name).filter(Boolean) as
    | string[]
    | undefined;
  if (artists?.length) return artists;
  return (song.singer || "未知歌手")
    .split(/[|、/&]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function extractMiguFee(song: {
  copyright?: number | string;
}): number | undefined {
  if (song.copyright === 1 || song.copyright === "1") return 1;
  return undefined;
}

export function convertMiguSongToMusicTrack(song: MiguSongRaw): MusicTrack {
  const copyrightId = song.copyrightId || song.songId || "unknown";
  const contentId = song.contentId || "";
  const encodedId = contentId
    ? `migu_${copyrightId}_${contentId}`
    : `migu_${copyrightId}`;
  // 按 imgSizeType 降序排列，优先取高分辨率封面（03 > 02 > 01）
  const sortedImgs = (song.albumImgs || []).slice().sort((a, b) => {
    const sizeA = a.imgSizeType || "";
    const sizeB = b.imgSizeType || "";
    return sizeB.localeCompare(sizeA);
  });
  const coverUrl = sortedImgs.find((item) => item.img)?.img || "";

  return {
    id: encodedId,
    name: song.songName || "未知歌曲",
    artist: normalizeArtists(song),
    album: song.album || "",
    pic_id: normalizeMiguImageUrl(coverUrl),
    url_id: encodedId,
    lyric_id: forceHttps(song.lrcUrl || ""),
    source: "migu",
    artist_ids: song.artists?.map((artist) => artist.id).filter(Boolean) as
      | string[]
      | undefined,
    album_id: song.albumId,
    fee: extractMiguFee(song),
  };
}

// ============================================================
// I/O 抽象：分页拉取
// ============================================================

export async function fetchMiguPlaylistDetail(
  playlistId: string,
  fetchText: (path: string) => Promise<string>
): Promise<MiguPlaylistDetail> {
  const infoResponse = parseMiguPlaylistInfoResponse(
    await fetchText(buildMiguPlaylistInfoPath(playlistId))
  );
  if (infoResponse.code !== "000000") {
    throw new Error(infoResponse.info || "咪咕歌单信息接口返回异常");
  }

  const info = infoResponse.resource?.[0];
  const total = info?.musicNum || 0;
  const songs: MiguSongRaw[] = [];
  const pageCount = Math.max(1, Math.ceil(total / MIGU_PAGE_SIZE));

  for (let page = 1; page <= pageCount && page <= 100; page += 1) {
    const songsResponse = parseMiguPlaylistSongsResponse(
      await fetchText(buildMiguPlaylistSongsPath(playlistId, page))
    );
    if (songsResponse.code !== "000000") {
      throw new Error(songsResponse.info || "咪咕歌单歌曲接口返回异常");
    }
    const pageSongs = songsResponse.list || [];
    if (!pageSongs.length) break;
    songs.push(...pageSongs);
    if ((songsResponse.totalCount || total) <= songs.length) break;
  }

  if (!songs.length) throw new Error("歌单为空，无法导入");

  return {
    name: info?.title || `咪咕歌单 ${playlistId}`,
    coverUrl: normalizeMiguImageUrl(
      info?.imgItem?.img ||
        songs.find((song) => song.albumImgs?.length)?.albumImgs?.[0]?.img ||
        ""
    ),
    trackCount: total || songs.length,
    songs,
  };
}

// ============================================================
// 搜索 V3（app.u.nf.migu.cn，无需签名）
// ============================================================

export function buildMiguV3SearchPath(
  keyword: string,
  page: number,
  rows = 20
): string {
  const params = new URLSearchParams();
  params.set("text", keyword);
  params.set("pageNo", String(page));
  params.set("pageSize", String(rows));
  return `/pc/resource/song/item/search/v1.0?${params.toString()}`;
}

export function convertMiguV3SearchSongToMusicTrack(
  song: MiguV3SearchSongRaw
): MusicTrack {
  const copyrightId = song.copyrightId || "unknown";
  const contentId = song.contentId || "";
  const encodedId = contentId
    ? `migu_${copyrightId}_${contentId}`
    : `migu_${copyrightId}`;

  return {
    id: encodedId,
    name: song.songName || "未知歌曲",
    artist: (song.singerList || []).map((s) => s.name || "").filter(Boolean),
    album: song.album || "",
    // 优先使用 img3 > img2 > img1，获取最大可用封面
    pic_id: normalizeMiguImageUrl(song.img3 || song.img2 || song.img1),
    url_id: encodedId,
    lyric_id: forceHttps(song.ext?.lrcUrl || ""),
    source: "migu",
    artist_ids: (song.singerList || []).map((s) => s.id || "").filter(Boolean),
    album_id:
      typeof song.albumId === "number" ? String(song.albumId) : song.albumId,
    fee: extractMiguFee(song),
  };
}

export { type MiguV3SearchSongRaw };
