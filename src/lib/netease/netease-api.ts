import {
  weapi,
  getRandomDomesticIp,
  buildVisitorCookie,
  cleanCookie,
  PC_USER_AGENT,
} from "@otter-music/shared";
import type {
  AlbumDetail,
  AlbumDynamicDetail,
  ArtistDetail,
  ArtistAlbum,
  ArtistItem,
  NeteasePrivilege,
  PlaylistDetail,
  PlaylistDynamicDetail,
  RawQrCheckResponse,
  RawQrKeyData,
  RecommendPlaylist,
  ResolveUrlResult,
  SongDetail,
  Toplist,
  UserPlaylist,
  UserProfile,
  SearchSuggestResult,
  NeteaseCommentResult,
  NeteaseNewCommentResult,
} from "./netease-raw-types";
import type {
  MarketPlaylist,
  NeteaseSong,
  QrStatusResult,
} from "./netease-models";
import {
  normalizeQrStatus,
  toMarketPlaylistFromRecommend,
  toMarketPlaylistFromToplist,
  toMarketPlaylistFromUserPlaylist,
  unwrapMyInfoProfile,
} from "./netease-normalize";
import { MusicTrack } from "@/types/music";
import { cachedFetch } from "@/lib/utils/cache";
import { getApiUrl, IS_NATIVE } from "@/lib/api/config";
import { CapacitorHttp } from "@capacitor/core";
import { useNeteaseStore } from "@/store/netease-store";
import { logger } from "@/lib/logger";

const TTL_SHORT = 60 * 60 * 1000; // 1 hour
const TTL_MEDIUM = 24 * 60 * 60 * 1000; // 1 day
const TTL_LONG = 7 * 24 * 60 * 60 * 1000; // 7 days

// 确保移动端（即便是开发环境连着手机测）也能指向绝对路径，避免报错
const BASE_URL =
  import.meta.env.DEV && !IS_NATIVE ? "/api/netease" : "https://music.163.com"; // Web端，且开发环境，指向本地 Vite 代理

const NETWORK_TIMEOUT_MS = 12000;

type WrappedNeteaseResponse<T> = {
  data: T;
  cookie?: string;
};

/* =========================================================
 * 核心伪装工具集 (Cookie & IP)
 * ========================================================= */

export const getStoredCookie = () => useNeteaseStore.getState().cookie || "";

const getIpForRequest = (cookie: string) =>
  cookie.includes("MUSIC_U") ? "" : getRandomDomesticIp();

function buildCookie(rawCookie: string = ""): string {
  let finalCookie = (rawCookie || getStoredCookie()).trim();
  if (!finalCookie) finalCookie = buildVisitorCookie();
  else if (!finalCookie.includes("=")) finalCookie = `MUSIC_U=${finalCookie}`;
  else finalCookie = cleanCookie(finalCookie);

  return `os=pc; appver=2.9.7; mode=31; ${finalCookie}`;
}

function resolveRequestCookie(rawCookie: string = ""): string {
  const cookie = (rawCookie || getStoredCookie()).trim();
  if (!cookie) return buildCookie("");
  if (!cookie.includes("=")) return buildCookie(cookie);
  return buildCookie(cleanCookie(cookie));
}

// 移动端允许写入真实 Cookie 和 UA，不再需要 X-Real- 伪装
function buildHeaders(
  cookie: string,
  ua: string,
  forceIp?: string
): Record<string, string> {
  const ip = forceIp || getIpForRequest(cookie);
  const cookieStr = buildCookie(cookie);

  if (IS_NATIVE) {
    return {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieStr,
      "User-Agent": ua,
      Referer: "https://music.163.com",
      ...(ip ? { "X-Real-IP": ip, "X-Forwarded-For": ip } : {}),
    };
  }

  return {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Real-Cookie": cookieStr,
    "X-Real-UA": ua,
    ...(ip ? { "X-Real-IP": ip, "X-Forwarded-For": ip } : {}),
  };
}

/* =========================================================
 * 底层跨端请求函数 (核心逻辑)
 * ========================================================= */

async function crossFetch(
  url: string,
  options: { method: string; headers: Record<string, string>; body: string }
) {
  const withTimeout = <T>(promise: Promise<T>, timeout = NETWORK_TIMEOUT_MS) =>
    new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error(`Request timeout: ${timeout}ms`)),
        timeout
      );
      promise.then(
        (value) => {
          window.clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          window.clearTimeout(timer);
          reject(error);
        }
      );
    });

  const parseNativeJson = (payload: unknown) => {
    if (typeof payload !== "string") return payload;
    try {
      return JSON.parse(payload);
    } catch {
      throw new Error("Invalid JSON response from NetEase API");
    }
  };

  if (IS_NATIVE) {
    const res = await withTimeout(
      CapacitorHttp.request({
        method: options.method,
        url,
        headers: options.headers,
        data: options.body,
      })
    );

    if (res.status >= 400) throw new Error(`Native API Error: ${res.status}`);

    const rawCookie =
      res.headers["Set-Cookie"] || res.headers["set-cookie"] || "";
    const cookieStr = Array.isArray(rawCookie)
      ? rawCookie.join("; ")
      : rawCookie;

    return {
      data: parseNativeJson(res.data),
      setCookie: cleanCookie(cookieStr),
    };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timer));
  if (!response.ok) throw new Error(`Web API Error: ${response.status}`);

  return {
    data: await response.json(),
    setCookie: cleanCookie(response.headers.get("set-cookie")),
  };
}

async function requestWeapi<T = unknown>(
  url: string,
  data: Record<string, unknown>,
  cookie: string = ""
) {
  const finalCookie = resolveRequestCookie(cookie);
  const headers = buildHeaders(finalCookie, PC_USER_AGENT);
  const params = new URLSearchParams(
    weapi(data) as Record<string, string>
  ).toString();

  const { data: resData, setCookie } = await crossFetch(url, {
    method: "POST",
    headers,
    body: params,
  });
  return { data: resData as T, cookie: setCookie };
}

async function fetchLocalApi<T>(
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  const localApiBase = getApiUrl();
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${localApiBase}${endpoint}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timer));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Local API Error: ${res.status}`);
  }
  return res.json();
}

/* =========================================================
 * 业务 API
 * ========================================================= */

const LEVEL_MAP: Record<number, string> = {
  128000: "standard",
  192000: "higher",
  320000: "exhigh",
  999000: "lossless",
};

export async function getSongUrl(
  id: string,
  br: number = 999000,
  cookie: string = ""
): Promise<
  WrappedNeteaseResponse<{
    data: { url: string; br: number; size: number; freeTrialInfo?: unknown }[];
  }>
> {
  const realId = id.replace(/^(netrack_|ne_track_)/, "");
  const finalCookie = resolveRequestCookie(cookie);
  const level = LEVEL_MAP[br] || "standard";

  return requestWeapi<{ data: { url: string; br: number; size: number }[] }>(
    `${BASE_URL}/weapi/song/enhance/player/url/v1`,
    { ids: `[${realId}]`, level, encodeType: "flac", csrf_token: "" },
    finalCookie
  );
}

export const getQrKey = async (): Promise<string> => {
  const res = await requestWeapi<RawQrKeyData>(
    `${BASE_URL}/weapi/login/qrcode/unikey`,
    { type: 1 }
  );
  return res.data.unikey;
};

export const checkQrStatus = async (key: string): Promise<QrStatusResult> => {
  if (IS_NATIVE) {
    //  浏览器无法获取 Set-Cookie, 因此只能走代理
    const res = await requestWeapi<{
      code: number;
      message?: string;
      cookie?: string;
    }>(`${BASE_URL}/weapi/login/qrcode/client/login`, { key, type: 1 });
    // 移动端 CapacitorHttp 可读取 Set-Cookie 头，取不到时从响应体 fallback
    const cookie = res.cookie || (res.data as any).cookie || "";
    return { code: res.data.code, message: res.data.message ?? "", cookie };
  }
  const res = await fetchLocalApi<RawQrCheckResponse>(
    `/music-api/netease/login/qr/check?key=${key}&timestamp=${Date.now()}`
  );
  return normalizeQrStatus(res);
};

export const getMyInfo = async (
  cookie: string = ""
): Promise<UserProfile | null> => {
  const finalCookie = resolveRequestCookie(cookie);
  if (IS_NATIVE) {
    const res = await requestWeapi<{ profile: UserProfile }>(
      `${BASE_URL}/api/nuser/account/get`,
      {},
      finalCookie
    );
    return res.data?.profile ?? null;
  }
  const res = await cachedFetch<UserProfile | null>(
    `netease:v2:my-info:${finalCookie.slice(-16)}`,
    async () =>
      unwrapMyInfoProfile(
        await fetchLocalApi("/music-api/netease/my-info", {
          cookie: finalCookie,
        })
      ),
    TTL_SHORT
  );
  return res ?? null;
};

export const getUserPlaylists = async (
  userId: string,
  cookie: string = ""
): Promise<MarketPlaylist[]> => {
  const finalCookie = resolveRequestCookie(cookie);
  const res = await cachedFetch<MarketPlaylist[]>(
    `netease:v2:user-playlists:${userId}`,
    async () => {
      // 直连
      const params = new URLSearchParams({
        uid: userId,
        limit: "1000",
        offset: "0",
        includeVideo: "true",
      });
      const headers = buildHeaders(finalCookie, PC_USER_AGENT);
      const { data } = await crossFetch(`${BASE_URL}/api/user/playlist`, {
        method: "POST",
        headers,
        body: params.toString(),
      });
      const r = data as { playlist: UserPlaylist[]; code: number };
      if (r.code !== 200)
        throw new Error(`NetEase user playlists error: ${r.code}`);
      return r.playlist.map(toMarketPlaylistFromUserPlaylist);
    },
    TTL_SHORT
  );
  return res ?? [];
};

export const getRecommendPlaylists = async (
  cookie: string = ""
): Promise<MarketPlaylist[]> => {
  const finalCookie = resolveRequestCookie(cookie);
  const res = await cachedFetch<MarketPlaylist[]>(
    `netease:v2:recommend:${finalCookie.slice(-16)}`,
    async () => {
      // 直连
      const r = await requestWeapi<{ result: RecommendPlaylist[] }>(
        `${BASE_URL}/weapi/personalized/playlist`,
        { limit: 20, total: true, n: 1000 },
        finalCookie
      );
      return (r.data?.result || []).map(toMarketPlaylistFromRecommend);
    },
    TTL_SHORT
  );
  return res ?? [];
};

export const getPlaylistDetail = (playlistId: string, cookie: string = "") => {
  const realId = playlistId.replace(/^(neplaylist_|ne_playlist_)/, "");
  return cachedFetch<PlaylistDetail>(
    `netease:playlist:${playlistId}`,
    async () => {
      const finalCookie = resolveRequestCookie(cookie);
      const res = await requestWeapi<{
        playlist: PlaylistDetail & { trackIds: { id: number }[] };
      }>(
        `${BASE_URL}/weapi/v3/playlist/detail`,
        {
          id: realId,
          offset: 0,
          total: true,
          limit: 1000,
          n: 1000,
          csrf_token: "",
        },
        finalCookie
      );
      const tracks = await getTracksDetail(
        res.data.playlist.trackIds.map((t: { id: number }) => t.id),
        finalCookie
      );
      return { ...res.data.playlist, tracks } as PlaylistDetail;
    },
    TTL_SHORT
  );
};

export const getPlaylistDynamicDetail = async (
  id: string,
  cookie: string = ""
): Promise<PlaylistDynamicDetail | null> => {
  try {
    const finalCookie = resolveRequestCookie(cookie);
    const res = await requestWeapi<PlaylistDynamicDetail>(
      `${BASE_URL}/weapi/playlist/detail/dynamic`,
      { id: id.replace(/^(neplaylist_|ne_playlist_)/, "") },
      finalCookie
    );
    return res.data;
  } catch (e) {
    logger.warn(
      "NetEase",
      "getPlaylistDynamicDetail failed",
      e instanceof Error ? e : undefined
    );
    return null;
  }
};

async function getTracksDetail(trackIds: number[], cookie: string = "") {
  const result: SongDetail[] = [];
  for (let i = 0; i < trackIds.length; i += 500) {
    const batch = trackIds.slice(i, i + 500);
    const res = await requestWeapi<{
      songs: SongDetail[];
      privileges: NeteasePrivilege[];
    }>(
      `${BASE_URL}/weapi/v3/song/detail`,
      {
        c: `[${batch.map((id) => `{"id":${id}}`).join(",")}]`,
        ids: `[${batch.join(",")}]`,
      },
      cookie
    );

    if (res.data.songs) {
      const privMap = new Map(res.data.privileges?.map((p) => [p.id, p]));
      result.push(
        ...res.data.songs.map((song) => ({
          ...song,
          privilege: privMap.get(Number(song.id)),
        }))
      );
    }
  }
  return result;
}

export async function search(
  keyword: string,
  type: number = 1,
  page: number = 1,
  limit: number = 20,
  cookie: string = ""
) {
  const finalCookie = resolveRequestCookie(cookie);
  const headers = buildHeaders(
    finalCookie,
    PC_USER_AGENT,
    getRandomDomesticIp()
  );
  const params = new URLSearchParams({
    s: keyword,
    type: String(type),
    offset: String((page - 1) * limit),
    limit: String(limit),
  });

  const { data } = await crossFetch(`${BASE_URL}/api/search/pc`, {
    method: "POST",
    headers,
    body: params.toString(),
  });
  return {
    data: data as {
      result: {
        songs?: NeteaseSong[];
        albums?: RawSearchAlbum[];
        artists?: RawSearchArtist[];
        songCount?: number;
        hasMore?: boolean;
      };
      code: number;
    },
  };
}

/** 网易云搜索：专辑（type=10）结果条目 */
export type NeteaseSearchAlbumItem = {
  id: number;
  name: string;
  artistName: string;
};

/** 网易云搜索：歌手（type=100）结果条目 */
export type NeteaseSearchArtistItem = {
  id: number;
  name: string;
};

/** 原始搜索结果的专辑 / 歌手行（来自 /api/search/pc） */
type RawSearchAlbum = {
  id: number;
  name: string;
  artist?: { name?: string };
};
type RawSearchArtist = { id: number; name: string };

export const mapSearchAlbums = (
  albums: RawSearchAlbum[] = []
): NeteaseSearchAlbumItem[] =>
  albums
    .filter((a) => typeof a?.id === "number" && a.id > 0 && !!a?.name)
    .map((a) => ({ id: a.id, name: a.name, artistName: a.artist?.name ?? "" }));

export const mapSearchArtists = (
  artists: RawSearchArtist[] = []
): NeteaseSearchArtistItem[] =>
  artists
    .filter((a) => typeof a?.id === "number" && a.id > 0 && !!a?.name)
    .map((a) => ({ id: a.id, name: a.name }));

/** 按关键词搜索专辑（严格匹配用，返回精简条目） */
export async function searchAlbums(
  keyword: string,
  cookie: string = ""
): Promise<NeteaseSearchAlbumItem[]> {
  const res = await search(keyword, 10, 1, 20, cookie);
  return mapSearchAlbums(res.data?.result?.albums);
}

/** 按关键词搜索歌手（严格匹配用，返回精简条目） */
export async function searchArtists(
  keyword: string,
  cookie: string = ""
): Promise<NeteaseSearchArtistItem[]> {
  const res = await search(keyword, 100, 1, 20, cookie);
  return mapSearchArtists(res.data?.result?.artists);
}

export async function searchPlaylists(
  keyword: string,
  page: number = 1,
  limit: number = 30,
  cookie: string = ""
): Promise<MarketPlaylist[]> {
  const finalCookie = resolveRequestCookie(cookie);
  const res = await search(keyword, 1000, page, limit, finalCookie);
  return (
    (res.data?.result as { playlists?: UserPlaylist[] } | undefined)
      ?.playlists || []
  ).map(toMarketPlaylistFromUserPlaylist);
}

export const getLyric = (id: string, cookie: string = "") =>
  cachedFetch(
    `netease:lyric:${id.replace(/^(netrack_|ne_track_)/, "")}`,
    (): Promise<
      WrappedNeteaseResponse<{
        lrc: { lyric: string };
        tlyric: { lyric: string };
      }>
    > => {
      const finalCookie = resolveRequestCookie(cookie);
      return requestWeapi<{
        lrc: { lyric: string };
        tlyric: { lyric: string };
      }>(
        `${BASE_URL}/weapi/song/lyric`,
        { id: id.replace(/^(netrack_|ne_track_)/, ""), lv: -1, tv: -1 },
        finalCookie
      );
    },
    TTL_LONG // 歌词极少变动，使用长缓存
  );

export const getSongDetail = (id: string, cookie: string = "") =>
  cachedFetch(
    `netease:song:${id.replace(/^(netrack_|ne_track_)/, "")}`,
    async () => {
      const finalCookie = resolveRequestCookie(cookie);
      return (
        await getTracksDetail(
          [parseInt(id.replace(/^(netrack_|ne_track_)/, ""))],
          finalCookie
        )
      )[0];
    },
    TTL_LONG // 歌曲基础信息固定，但携带 VIP 鉴权，因此 key 加上 cookie 尾缀
  );

export const getToplist = async (
  cookie: string = ""
): Promise<MarketPlaylist[]> => {
  const finalCookie = resolveRequestCookie(cookie);
  const res = await cachedFetch<MarketPlaylist[]>(
    `netease:v2:toplist:${finalCookie.slice(-16)}`,
    async () => {
      const r = await requestWeapi<{ list: Toplist[] }>(
        `${BASE_URL}/weapi/toplist/detail`,
        {},
        finalCookie
      );
      return r.data.list.map(toMarketPlaylistFromToplist);
    },
    TTL_SHORT
  );
  return res ?? [];
};

export const getAlbum = (id: string, cookie: string = "") =>
  cachedFetch(
    `netease:album:${id.replace(/^(nealbum_|ne_album_)/, "")}`,
    async () => {
      const finalCookie = resolveRequestCookie(cookie);
      const res = await requestWeapi<AlbumDetail>(
        `${BASE_URL}/weapi/v1/album/${id.replace(/^(nealbum_|ne_album_)/, "")}`,
        {},
        finalCookie
      );
      return res.data;
    },
    TTL_LONG // 专辑发布后信息基本固定
  );

export const getAlbumDynamicDetail = async (
  id: string,
  cookie: string = ""
): Promise<AlbumDynamicDetail | null> => {
  try {
    const finalCookie = resolveRequestCookie(cookie);
    const res = await requestWeapi<AlbumDynamicDetail>(
      `${BASE_URL}/weapi/album/detail/dynamic`,
      { id: id.replace(/^(nealbum_|ne_album_)/, "") },
      finalCookie
    );
    return res.data;
  } catch (e) {
    logger.warn(
      "NetEase",
      "getAlbumDynamicDetail failed",
      e instanceof Error ? e : undefined
    );
    return null;
  }
};

export const getArtist = (id: string, cookie: string = "") =>
  cachedFetch(
    `netease:artist:${id.replace(/^(neartist_|ne_artist_)/, "")}`,
    async () => {
      const finalCookie = resolveRequestCookie(cookie);
      const res = await requestWeapi<ArtistDetail>(
        `${BASE_URL}/weapi/v1/artist/${id.replace(/^(neartist_|ne_artist_)/, "")}`,
        {},
        finalCookie
      );
      return res.data;
    },
    TTL_LONG // 歌手基础信息低频变动
  );

export const getArtistDynamicDetail = async (
  id: string,
  cookie: string = ""
): Promise<Record<string, unknown> | null> => {
  try {
    const finalCookie = resolveRequestCookie(cookie);
    const res = await requestWeapi<any>(
      `${BASE_URL}/weapi/artist/detail/dynamic`,
      { id: id.replace(/^(neartist_|ne_artist_)/, "") },
      finalCookie
    );
    return res.data;
  } catch (e) {
    logger.warn(
      "NetEase",
      "getArtistDynamicDetail failed",
      e instanceof Error ? e : undefined
    );
    return null;
  }
};

export const getArtistSongs = (
  id: string,
  limit: number = 50,
  offset: number = 0,
  order: string = "hot",
  cookie: string = ""
) =>
  cachedFetch(
    `netease:artist-songs:${id.replace(/^(neartist_|ne_artist_)/, "")}:${limit}:${offset}:${order}`,
    async () => {
      const finalCookie = resolveRequestCookie(cookie);
      const res = await requestWeapi<{
        songs: SongDetail[];
        total: number;
        more: boolean;
      }>(
        `${BASE_URL}/weapi/v1/artist/songs`,
        {
          id: id.replace(/^(neartist_|ne_artist_)/, ""),
          limit,
          offset,
          order,
          total: true,
        },
        finalCookie
      );
      return res.data;
    },
    TTL_MEDIUM
  );

export const getArtistAlbums = (
  id: string,
  limit: number = 30,
  offset: number = 0,
  cookie: string = ""
) =>
  cachedFetch(
    `netease:artist-albums:${id.replace(/^(neartist_|ne_artist_)/, "")}:${limit}:${offset}`,
    async () => {
      const finalCookie = resolveRequestCookie(cookie);
      const res = await requestWeapi<{
        hotAlbums: ArtistAlbum[];
        more: boolean;
      }>(
        `${BASE_URL}/weapi/artist/albums/${id.replace(/^(neartist_|ne_artist_)/, "")}`,
        { limit, offset, total: true },
        finalCookie
      );
      return res.data;
    },
    TTL_MEDIUM
  );

export const getSubscribedAlbums = async (
  limit: number = 25,
  offset: number = 0,
  cookie: string = ""
): Promise<ArtistAlbum[]> => {
  try {
    const finalCookie = resolveRequestCookie(cookie);
    const r = await requestWeapi<{ data: ArtistAlbum[]; count: number }>(
      `${BASE_URL}/weapi/album/sublist`,
      { limit, offset, total: true },
      finalCookie
    );

    return r.data.data ?? [];
  } catch (e) {
    logger.warn(
      "NetEase",
      "getSubscribedAlbums failed",
      e instanceof Error ? e : undefined
    );
    return [];
  }
};

export const getSubscribedArtists = async (
  limit: number = 25,
  offset: number = 0,
  cookie: string = ""
): Promise<ArtistItem[]> => {
  try {
    const finalCookie = resolveRequestCookie(cookie);
    const r = await requestWeapi<{ data: ArtistItem[]; count: number }>(
      `${BASE_URL}/weapi/artist/sublist`,
      { limit, offset, total: true },
      finalCookie
    );

    return r.data.data ?? [];
  } catch (e) {
    logger.warn(
      "NetEase",
      "getSubscribedArtists failed",
      e instanceof Error ? e : undefined
    );
    return [];
  }
};

export const toggleSubArtist = async (
  id: string,
  shouldSub: boolean,
  cookie: string = ""
) => {
  const finalCookie = resolveRequestCookie(cookie);
  const realId = id.replace(/^(neartist_|ne_artist_)/, "");
  const action = shouldSub ? "sub" : "unsub";
  return requestWeapi<{ code: number; message?: string }>(
    `${BASE_URL}/weapi/artist/${action}`,
    { artistId: realId, artistIds: [realId] }, // !  TODO:当前收藏歌手会报 250 系统错误, 暂时无法使用
    finalCookie
  );
};

export const toggleSubAlbum = async (
  id: string,
  shouldSub: boolean,
  cookie: string = ""
) => {
  const finalCookie = resolveRequestCookie(cookie);
  const realId = id.replace(/^(nealbum_|ne_album_)/, "");
  const action = shouldSub ? "sub" : "unsub";
  return requestWeapi<{ code: number; message?: string }>(
    `${BASE_URL}/weapi/album/${action}`,
    { id: realId, t: shouldSub ? 1 : 0 },
    finalCookie
  );
};

export const toggleSubPlaylist = async (
  id: string,
  shouldSub: boolean,
  cookie: string = ""
) => {
  const finalCookie = resolveRequestCookie(cookie);
  const realId = id.replace(/^(neplaylist_|ne_playlist_)/, "");
  return requestWeapi<{ code: number; message?: string }>(
    `${BASE_URL}/weapi/playlist/subscribe`,
    { id: realId, t: shouldSub ? 1 : 2 },
    finalCookie
  );
};

export const getPlaylists = (
  cat: string = "全部",
  order: string = "hot",
  limit: number = 30,
  offset: number = 0,
  cookie: string = ""
) =>
  cachedFetch(
    `netease:playlists:${cat}:${order}:${limit}:${offset}`,
    async () => {
      const finalCookie = resolveRequestCookie(cookie);
      const res = await requestWeapi<{ playlists: UserPlaylist[] }>(
        `${BASE_URL}/weapi/playlist/list`,
        { cat, order, limit, offset, total: true },
        finalCookie
      );
      return res.data.playlists.map(toMarketPlaylistFromUserPlaylist);
    },
    TTL_SHORT // 广场分类歌单变动较快
  );

export const searchSuggest = (keyword: string, cookie: string = "") =>
  cachedFetch<SearchSuggestResult>(
    `netease:suggest:${keyword}`,
    async () => {
      const finalCookie = resolveRequestCookie(cookie);
      const res = await requestWeapi<{ result: SearchSuggestResult }>(
        `${BASE_URL}/weapi/search/suggest/web`,
        { s: keyword },
        finalCookie
      );
      return res.data?.result || {};
    },
    TTL_SHORT
  );

export const getHotComments = (
  id: string,
  limit: number = 20,
  offset: number = 0,
  cookie: string = ""
) =>
  cachedFetch<NeteaseCommentResult>(
    `netease:comments:hot:${id.replace(/^(netrack_|ne_track_)/, "")}:${limit}:${offset}`,
    async () => {
      const finalCookie = resolveRequestCookie(cookie);
      const realId = id.replace(/^(netrack_|ne_track_)/, "");
      const rid = `R_SO_4_${realId}`;
      const res = await requestWeapi<NeteaseCommentResult>(
        `${BASE_URL}/weapi/v1/resource/hotcomments/${rid}`,
        { rid, limit, offset, beforeTime: 0 },
        finalCookie
      );
      return res.data;
    },
    TTL_SHORT
  );

export const getNewComments = (
  id: string,
  pageNo: number = 1,
  pageSize: number = 20,
  sortType: number = 2, // 1:推荐 2:热度 3:时间
  cursor: string | number = 0,
  cookie: string = ""
) =>
  cachedFetch<NeteaseNewCommentResult["data"]>(
    `netease:comments:new:${id.replace(/^(netrack_|ne_track_)/, "")}:${sortType}:${pageNo}:${cursor}`,
    async () => {
      const finalCookie = resolveRequestCookie(cookie);
      const realId = id.replace(/^(netrack_|ne_track_)/, "");
      const res = await requestWeapi<NeteaseNewCommentResult>(
        `${BASE_URL}/weapi/comment/new`,
        {
          type: 0, // 0: 歌曲
          id: realId,
          sortType,
          cursor,
          pageSize,
          pageNo,
        },
        finalCookie
      );
      return res.data?.data;
    },
    TTL_SHORT
  );

export const getMusicComments = (
  id: string,
  limit: number = 20,
  offset: number = 0,
  cookie: string = ""
) => {
  // 优先使用热门评论接口
  return getHotComments(id, limit, offset, cookie);
};

export function resolveUrl(urlStr: string): ResolveUrlResult | null {
  try {
    const normalized = urlStr.replace(
      /music\.163\.com\/(#\/)?(discover\/toplist\?|my\/m\/music\/|m\/|)/g,
      "music.163.com/"
    );
    const url = new URL(
      normalized.startsWith("http") ? normalized : `https://${normalized}`
    );
    const id = url.searchParams.get("id") || url.pathname.split("/").pop();

    if (!id) return null;
    if (url.pathname.includes("/playlist"))
      return { type: "playlist", id: `neplaylist_${id}` };
    if (url.pathname.includes("/artist"))
      return { type: "artist", id: `neartist_${id}` };
    if (url.pathname.includes("/album"))
      return { type: "album", id: `nealbum_${id}` };
    if (url.pathname.includes("/song"))
      return { type: "song", id: `netrack_${id}` };
  } catch {
    /* ignore parsing errors */
  }
  return null;
}

export const convertSongToMusicTrack = (
  song: NeteaseSong,
  includePrivilege: boolean = true
): MusicTrack => {
  // 兼容搜索接口返回的 artists 和 album
  const artists = song.ar || song.artists || [];
  const album = song.al || song.album || {};
  const songId = String(song.id);

  // 构造 privilege 对象（如果搜索结果缺失）
  let privilege: NeteasePrivilege | undefined;
  if (includePrivilege) {
    privilege = song.privilege;
    if (!privilege && song.fee !== undefined) {
      privilege = {
        id: Number(song.id),
        fee: song.fee,
        payed: 0,
        st: song.st ?? song.status ?? 0,
        pl: song.fee === 1 || song.fee === 4 ? 0 : 128000, // VIP/付费歌曲默认视为不可播放，触发 Badge 显示
        maxbr: 999000,
        plLevel: "standard",
        freeTrialPrivilege: { remainTime: 0 },
      };
    }
  }
  return {
    id: songId,
    name: song.name || "",
    artist: artists.map((a: { name: string }) => a.name),
    album: album.name || "",
    pic_id: album.picUrl || songId,
    url_id: songId,
    lyric_id: songId,
    source: "_netease",
    privilege,
    artist_ids: artists.map((a: { id?: string | number }) =>
      String(a.id || "")
    ),
    album_id: String(album.id || ""),
  };
};
