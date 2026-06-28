import {
  requestWeapi,
  requestEapi,
  buildCookie,
  getRandomDomesticIp,
  BASE_URL,
  EAPI_BASE_URL,
  PC_USER_AGENT,
} from "@otter-music/shared";
import type {
  QrKeyResponse,
  QrCheckResponse,
  UserProfile,
  UserPlaylist,
  PlaylistDetail,
  SongDetail,
  SearchResult,
  RecommendPlaylist,
  Toplist,
  AlbumDetail,
  ArtistDetail,
  ResolveUrlResult,
} from "./netease-types";

/* =========================================================
 * 业务 API
 * ========================================================= */

/**
 * 获取歌曲播放 URL (核心：EAPI/WEAPI 双轨降级)
 */
export async function getSongUrl(
  id: string,
  br: number = 999000,
  cookie: string = ""
) {
  const realId = id.replace(/^(netrack_|ne_track_)/, "");

  // // 方案 1: 尝试 EAPI (获取无损/高解析度音频)
  // try {
  //   const eapiRes = await requestEapi<{
  //     data: { url: string; br: number; size: number }[];
  //   }>(
  //     `${EAPI_BASE_URL}/eapi/song/enhance/player/url`,
  //     "/api/song/enhance/player/url",
  //     { ids: `[${realId}]`, br, header: { os: "pc", appver: "2.9.7" } },
  //     cookie
  //   );

  //   if (eapiRes.data?.data?.[0]?.url) return eapiRes;
  //   console.warn(
  //     `[NetEase] EAPI empty URL for ${realId}, falling back to WEAPI...`
  //   );
  // } catch (e) {
  //   console.warn(`[NetEase] EAPI failed for ${realId}:`, e);
  // }

  // 方案 2: 降级 WEAPI (Web 端接口风控极松，确保能播)
  const weapiData = {
    ids: `[${realId}]`,
    level: br >= 320000 ? "higher" : "standard",
    encodeType: "mp3",
    csrf_token: "",
  };

  return requestWeapi<{ data: { url: string; br: number; size: number }[] }>(
    `${BASE_URL}/weapi/song/enhance/player/url/v1`,
    weapiData,
    cookie
  );
}

// ---------- 下方全线使用 requestWeapi 替代原本脆弱的 request ----------

export async function getQrKey() {
  return requestWeapi<QrKeyResponse>(`${BASE_URL}/weapi/login/qrcode/unikey`, {
    type: 1,
  });
}

export async function checkQrStatus(key: string) {
  return requestWeapi<QrCheckResponse>(
    `${BASE_URL}/weapi/login/qrcode/client/login`,
    { key, type: 1 }
  );
}

export async function getMyInfo(cookie: string) {
  return requestWeapi<{ profile: UserProfile }>(
    `${BASE_URL}/api/nuser/account/get`,
    {},
    cookie
  );
}

export async function getUserPlaylists(userId: string, cookie: string) {
  const url = `${BASE_URL}/api/user/playlist`;
  const params = new URLSearchParams({
    uid: userId,
    limit: "1000",
    offset: "0",
    includeVideo: "true",
  });
  const fakeIp = getRandomDomesticIp();

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": PC_USER_AGENT,
    Referer: BASE_URL,
    Origin: BASE_URL,
    "X-Real-IP": fakeIp,
    "X-Forwarded-For": fakeIp,
    Cookie: buildCookie(cookie),
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: params.toString(),
  });
  const json = await response.json();
  return json as { playlist: UserPlaylist[]; code: number };
}

export async function getPlaylistDetail(
  playlistId: string,
  cookie: string
): Promise<PlaylistDetail> {
  const realId = playlistId.replace(/^(neplaylist_|ne_playlist_)/, "");
  const data = {
    id: realId,
    offset: 0,
    total: true,
    limit: 1000,
    n: 1000,
    csrf_token: "",
  };
  const res = await requestWeapi<{ playlist: any }>(
    `${BASE_URL}/weapi/v3/playlist/detail`,
    data,
    cookie
  );

  const playlist = res.data.playlist;
  const trackIds = playlist.trackIds.map((t: any) => t.id);
  const tracks = await getTracksDetail(trackIds, cookie);

  return { ...playlist, tracks } as PlaylistDetail;
}

async function getTracksDetail(trackIds: number[], cookie: string) {
  const url = `${BASE_URL}/weapi/v3/song/detail`;
  const BATCH_SIZE = 500;
  const result: SongDetail[] = [];

  for (let i = 0; i < trackIds.length; i += BATCH_SIZE) {
    const batch = trackIds.slice(i, i + BATCH_SIZE);
    const c = "[" + batch.map((id) => `{"id":${id}}`).join(",") + "]";
    const ids = "[" + batch.join(",") + "]";

    const res = await requestWeapi<{ songs: SongDetail[] }>(
      url,
      { c, ids },
      cookie
    );
    if (res.data.songs) result.push(...res.data.songs);
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
  const offset = (page - 1) * limit;
  const fakeIp = getRandomDomesticIp();

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": PC_USER_AGENT,
    Referer: BASE_URL,
    Origin: BASE_URL,
    "X-Real-IP": fakeIp,
    "X-Forwarded-For": fakeIp,
    Cookie: buildCookie(cookie),
  };

  const params = new URLSearchParams({
    s: keyword,
    type: String(type),
    offset: String(offset),
    limit: String(limit),
  });
  const response = await fetch(`${BASE_URL}/api/search/pc`, {
    method: "POST",
    headers,
    body: params.toString(),
  });

  if (!response.ok)
    throw new Error(`NetEase Search API Error: ${response.status}`);
  const json = await response.json();
  return { data: json as { result: SearchResult; code: number } };
}

export async function getLyric(id: string, cookie: string = "") {
  const realId = id.replace(/^(netrack_|ne_track_)/, "");
  return requestWeapi<{ lrc: { lyric: string }; tlyric: { lyric: string } }>(
    `${BASE_URL}/weapi/song/lyric`,
    { id: realId, lv: -1, tv: -1 },
    cookie
  );
}

export async function getSongDetail(id: string, cookie: string = "") {
  const realId = id.replace(/^(netrack_|ne_track_)/, "");
  const tracks = await getTracksDetail([parseInt(realId)], cookie);
  return tracks[0];
}

export async function getRecommendPlaylists(cookie: string) {
  return requestWeapi<{ result: RecommendPlaylist[] }>(
    `${BASE_URL}/weapi/personalized/playlist`,
    { limit: 20, total: true, n: 1000 },
    cookie
  );
}

export async function getToplist(cookie: string = "") {
  return requestWeapi<{ list: Toplist[] }>(
    `${BASE_URL}/weapi/toplist/detail`,
    {},
    cookie
  );
}

export async function getAlbum(id: string, cookie: string = "") {
  const realId = id.replace(/^(nealbum_|ne_album_)/, "");
  return requestWeapi<AlbumDetail>(
    `${BASE_URL}/weapi/v1/album/${realId}`,
    {},
    cookie
  );
}

export async function getArtist(id: string, cookie: string = "") {
  const realId = id.replace(/^(neartist_|ne_artist_)/, "");
  return requestWeapi<ArtistDetail>(
    `${BASE_URL}/weapi/v1/artist/${realId}`,
    {},
    cookie
  );
}

export async function getPlaylists(
  cat: string = "全部",
  order: string = "hot",
  limit: number = 35,
  offset: number = 0,
  cookie: string = ""
) {
  return requestWeapi<{ playlists: UserPlaylist[] }>(
    `${BASE_URL}/weapi/playlist/list`,
    { cat, order, limit, offset, total: true },
    cookie
  );
}

export async function getPlaylistDynamicDetail(
  id: string,
  cookie: string = ""
) {
  const realId = id.replace(/^(neplaylist_|ne_playlist_)/, "");
  return requestWeapi(
    `${BASE_URL}/weapi/playlist/detail/dynamic`,
    { id: realId },
    cookie
  );
}

export async function getAlbumDynamicDetail(id: string, cookie: string = "") {
  const realId = id.replace(/^(nealbum_|ne_album_)/, "");
  return requestWeapi(
    `${BASE_URL}/weapi/album/detail/dynamic`,
    { id: realId },
    cookie
  );
}

export async function getArtistDynamicDetail(id: string, cookie: string = "") {
  const realId = id.replace(/^(neartist_|ne_artist_)/, "");
  return requestWeapi(
    `${BASE_URL}/weapi/artist/detail/dynamic`,
    { id: realId },
    cookie
  );
}

export async function getArtistSongs(
  id: string,
  limit: number = 50,
  offset: number = 0,
  order: string = "hot",
  cookie: string = ""
) {
  const realId = id.replace(/^(neartist_|ne_artist_)/, "");
  return requestWeapi<{ songs: SongDetail[]; total: number; more: boolean }>(
    `${BASE_URL}/weapi/v1/artist/songs`,
    { id: realId, limit, offset, order, total: true },
    cookie
  );
}

export async function getArtistAlbums(
  id: string,
  limit: number = 30,
  offset: number = 0,
  cookie: string = ""
) {
  const realId = id.replace(/^(neartist_|ne_artist_)/, "");
  return requestWeapi(
    `${BASE_URL}/weapi/artist/albums/${realId}`,
    { limit, offset, total: true },
    cookie
  );
}

export async function getSubscribedAlbums(
  limit: number = 25,
  offset: number = 0,
  cookie: string = ""
) {
  return requestWeapi(
    `${BASE_URL}/weapi/album/sublist`,
    { limit, offset, total: true },
    cookie
  );
}

export async function getSubscribedArtists(
  limit: number = 25,
  offset: number = 0,
  cookie: string = ""
) {
  return requestWeapi(
    `${BASE_URL}/weapi/artist/sublist`,
    { limit, offset, total: true },
    cookie
  );
}

export async function searchSuggest(keyword: string, cookie: string = "") {
  return requestWeapi(
    `${BASE_URL}/weapi/search/suggest/web`,
    { s: keyword },
    cookie
  );
}

export async function getHotComments(
  id: string,
  limit: number = 20,
  offset: number = 0,
  cookie: string = ""
) {
  const realId = id.replace(/^(netrack_|ne_track_)/, "");
  const rid = `R_SO_4_${realId}`;

  return requestWeapi(
    `${BASE_URL}/weapi/v1/resource/hotcomments/${rid}`,
    { rid, limit, offset, beforeTime: 0 },
    cookie
  );
}

export async function getNewComments(
  id: string,
  pageNo: number = 1,
  pageSize: number = 20,
  sortType: number = 2,
  cursor: string | number = 0,
  cookie: string = ""
) {
  const realId = id.replace(/^(netrack_|ne_track_)/, "");

  return requestWeapi(
    `${BASE_URL}/weapi/comment/new`,
    {
      type: 0,
      id: realId,
      sortType,
      cursor,
      pageSize,
      pageNo,
    },
    cookie
  );
}

export async function getMusicComments(
  id: string,
  limit: number = 20,
  offset: number = 0,
  cookie: string = ""
) {
  return getHotComments(id, limit, offset, cookie);
}

export function resolveUrl(url: string): ResolveUrlResult | null {
  let result: ResolveUrlResult | null = null;
  let id = "";

  url = url.replace(
    "music.163.com/#/discover/toplist?",
    "music.163.com/#/playlist?"
  );
  url = url.replace("music.163.com/#/my/m/music/", "music.163.com/");
  url = url.replace("music.163.com/#/m/", "music.163.com/");
  url = url.replace("music.163.com/#/", "music.163.com/");

  const getParameterByName = (name: string, url: string) => {
    if (!url) url = "";
    name = name.replace(/[[\]]/g, "$&");
    const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
    const results = regex.exec(url);
    if (!results || !results[2]) return "";
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  };

  if (url.search("//music.163.com/playlist") !== -1) {
    const match = /\/\/music.163.com\/playlist\/([0-9]+)/.exec(url);
    id = match ? match[1] : getParameterByName("id", url);
    if (id) result = { type: "playlist", id: `neplaylist_${id}` };
  } else if (url.search("//music.163.com/artist") !== -1) {
    const match = /\/\/music.163.com\/artist\?id=([0-9]+)/.exec(url);
    id = match ? match[1] : getParameterByName("id", url);
    if (id) result = { type: "artist", id: `neartist_${id}` };
  } else if (url.search("//music.163.com/album") !== -1) {
    const match = /\/\/music.163.com\/album\/([0-9]+)/.exec(url);
    id = match ? match[1] : getParameterByName("id", url);
    if (id) result = { type: "album", id: `nealbum_${id}` };
  } else if (url.search("//music.163.com/song") !== -1) {
    const match = /\/\/music.163.com\/song\/([0-9]+)/.exec(url);
    id = match ? match[1] : getParameterByName("id", url);
    if (id) result = { type: "song", id: `netrack_${id}` };
  }

  return result;
}

export const toggleSubArtist = async (
  id: string,
  shouldSub: boolean,
  cookie: string = ""
) => {
  const realId = id.replace(/^(neartist_|ne_artist_)/, "");
  const action = shouldSub ? "sub" : "unsub";
  return requestWeapi<{ code: number; message?: string }>(
    `${BASE_URL}/weapi/artist/${action}`,
    { artistId: realId, artistIds: [realId] }, // !  TODO:当前收藏歌手会报 250 系统错误, 暂时无法使用
    cookie
  );
};

export const toggleSubAlbum = async (
  id: string,
  shouldSub: boolean,
  cookie: string = ""
) => {
  const realId = id.replace(/^(nealbum_|ne_album_)/, "");
  const action = shouldSub ? "sub" : "unsub";
  return requestWeapi<{ code: number; message?: string }>(
    `${BASE_URL}/weapi/album/${action}`,
    { id: realId, t: shouldSub ? 1 : 0 },
    cookie
  );
};

export const toggleSubPlaylist = async (
  id: string,
  shouldSub: boolean,
  cookie: string = ""
) => {
  const realId = id.replace(/^(neplaylist_|ne_playlist_)/, "");
  return requestWeapi<{ code: number; message?: string }>(
    `${BASE_URL}/weapi/playlist/subscribe`,
    { id: realId, t: shouldSub ? 1 : 2 },
    cookie
  );
};

export const convertSongToMusicTrack = (song: any) => {
  const artists = song.ar || song.artists || [];
  const album = song.al || song.album || {};
  const songId = String(song.id || "");

  return {
    id: songId,
    name: song.name || "",
    artist: artists.map((a: { name: string }) => a.name),
    album: album.name || "",
    pic_id: album.picUrl || songId,
    url_id: songId,
    lyric_id: songId,
    source: "_netease" as const,
  };
};
