import type { MusicTrack, SearchPageResult } from "../../types/music";
import type {
  QqAlbumDetail,
  QqAlbumInfoResponse,
  QqAlbumInfoSongRaw,
  QqAlbumMusicuResponse,
  QqAlbumSongInfoRaw,
  QqPlaylistResponse,
  QqSongRaw,
  QqSearchSongRaw,
  QqSosoSearchResponse,
  QqVkeyResponse,
} from "../../types/music-platforms";

// ─────────────────────────────────────
// 常量
// ─────────────────────────────────────

export const QQ_BASE_URL = "https://i.y.qq.com";
export const QQ_API_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";
export const QQ_LYRIC_URL =
  "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg";
export const QQ_REFERER = "https://y.qq.com/";

/** vkey API 文件名前缀与质量映射 */
export const QQ_FILE_CONFIG = [
  { key: "320k", prefix: "M800", ext: ".mp3" },
  { key: "128k", prefix: "M500", ext: ".mp3" },
  { key: "m4a", prefix: "C400", ext: ".m4a" },
] as const;

/**
 * 将全局音质档位 (br, kbps) 映射为 QQ 首选质量键。
 * QQ 无 192 档，就近降到 128k；最高 320k 封顶。
 */
export function qqBrToQualityKey(br = 320): string {
  return br < 320 ? "128k" : "320k";
}

/**
 * 按首选质量键返回优先级排列的质量键列表（用于 vkey 请求降级）。
 * 首选键无效时回退默认顺序。
 */
export function orderQqQualityKeys(preferred: string): string[] {
  const all = QQ_FILE_CONFIG.map((c) => c.key) as string[];
  return all.includes(preferred)
    ? [preferred, ...all.filter((k) => k !== preferred)]
    : all;
}

// ─────────────────────────────────────
// 歌单
// ─────────────────────────────────────

/**
 * 构建 QQ 音乐歌单 API 请求路径（不含域名/代理前缀）。
 */
export function buildQqPlaylistApiPath(playlistId: string): string {
  return `/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&nosign=1&disstid=${encodeURIComponent(playlistId)}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=GB2312&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`;
}

/**
 * 解析 QQ 音乐接口响应，优先按纯 JSON 处理，失败后兼容 JSONP 包装。
 */
export function parseQqPlaylistResponse(text: string): QqPlaylistResponse {
  try {
    return JSON.parse(text) as QqPlaylistResponse;
  } catch (jsonError) {
    const jsonpMatch = text.trim().match(/^[\w$.]+\s*\(([\s\S]*)\)\s*;?$/);
    if (!jsonpMatch) throw jsonError;
    return JSON.parse(jsonpMatch[1]) as QqPlaylistResponse;
  }
}

function extractQqFee(song: {
  pay?: {
    payplay?: number;
    paydownload?: number;
    pay_play?: number;
    pay_down?: number;
  };
}): number | undefined {
  const payPlay = song.pay?.payplay ?? song.pay?.pay_play;
  if (payPlay === 1) return 1;
  return undefined;
}

/**
 * 将 QQ 音乐歌单中的歌曲对象转换为 MusicTrack。
 */
export function convertQqSongToMusicTrack(song: QqSongRaw): MusicTrack {
  const picUrl = song.albummid
    ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.albummid}.jpg`
    : "";

  return {
    id: `qq_${song.songmid}`,
    name: song.songname,
    artist: song.singer.map((s) => s.name),
    album: song.albumname,
    pic_id: picUrl,
    url_id: song.songmid,
    lyric_id: song.songmid,
    source: "qq",
    fee: extractQqFee(song),
    album_id: song.albummid || undefined,
  };
}

// ─────────────────────────────────────
// 搜索
// ─────────────────────────────────────

/** QQ 音乐搜索接口域名 (soso 端点, 匿名可用) */
export const QQ_SEARCH_BASE_URL = "https://c.y.qq.com";

/**
 * 构建 QQ 音乐搜索 API 请求路径 (不含域名)。
 * 注意: 不能携带 new_json=1 参数, 上游在该参数下会静默返回空列表。
 */
export function buildQqSearchApiPath(
  query: string,
  page: number,
  count: number
): string {
  const params = new URLSearchParams({
    ct: "24",
    qqmusic_ver: "1298",
    remoteplace: "txt.yqq.top",
    t: "0",
    aggr: "1",
    cr: "1",
    catZhida: "1",
    lossless: "0",
    flag_qc: "0",
    p: String(page),
    n: String(count),
    w: query,
    g_tk: "5381",
    loginUin: "0",
    hostUin: "0",
    format: "json",
    inCharset: "utf8",
    outCharset: "utf-8",
    notice: "0",
    platform: "yqq.json",
    needNewCode: "0",
  });
  return `/soso/fcgi-bin/client_search_cp?${params.toString()}`;
}

/**
 * 解析 soso 搜索响应并转换为统一搜索分页结果。
 * code 非 0 或结构缺失时返回空结果。
 */
export function parseQqSosoSearchResponse(
  data: QqSosoSearchResponse,
  page: number,
  count: number
): SearchPageResult<MusicTrack> {
  if (data.code !== 0) return { items: [], hasMore: false };
  const list = data.data?.song?.list || [];
  const total = data.data?.song?.totalnum || 0;
  return {
    items: list.map(convertQqSearchSongToMusicTrack),
    hasMore: page * count < total,
  };
}

/**
 * 将 QQ 音乐搜索结果中的歌曲对象转换为 MusicTrack。
 */
export function convertQqSearchSongToMusicTrack(
  song: QqSearchSongRaw
): MusicTrack {
  const songmid = song.mid || song.songmid || "";
  const albummid = song.album?.mid || song.albummid || "";
  const picUrl = albummid
    ? `https://y.gtimg.cn/music/photo_new/T002R800x800M000${albummid}.jpg`
    : "";
  return {
    id: `qq_${songmid}`,
    name: song.title || song.songname || "",
    artist: (song.singer || []).map((s) => s.name),
    album: song.album?.title || song.albumname || "",
    pic_id: picUrl,
    url_id: songmid,
    lyric_id: songmid,
    source: "qq",
    fee: extractQqFee(song),
    album_id: albummid || undefined,
  };
}

// ─────────────────────────────────────
// vkey 音频 URL
// ─────────────────────────────────────

/**
 * 构建 vkey 请求体
 * @param songmid 歌曲 mid
 * @param qualityKeys 按优先级排列的质量配置键名
 */
export function buildVkeyRequestBody(
  songmid: string,
  qualityKeys: readonly string[],
  uin = "0"
) {
  const filenames = qualityKeys
    .map((key) => {
      const cfg = QQ_FILE_CONFIG.find((c) => c.key === key);
      return cfg ? `${cfg.prefix}${songmid}${songmid}${cfg.ext}` : "";
    })
    .filter(Boolean);

  return {
    req_1: {
      module: "vkey.GetVkeyServer",
      method: "CgiGetVkey",
      param: {
        filename: filenames,
        guid: "10000",
        songmid: qualityKeys.map(() => songmid),
        songtype: qualityKeys.map(() => 0),
        uin,
        loginflag: 1,
        platform: "20",
      },
    },
    loginUin: uin,
    comm: {
      uin,
      format: "json",
      ct: 24,
      cv: 0,
    },
  };
}

/**
 * 从 vkey 响应中提取可用音频 URL，返回第一个 purl 非空的链接。
 * 优先选用 https 镜像；若仅有 http 镜像则强制升级为 https，
 * 避免 Android WebView 明文流媒体缓冲不稳/被运营商干扰。
 */
export function extractVkeyUrl(data: QqVkeyResponse): string | null {
  const sip = data.req_1?.data?.sip;
  const midurlinfo = data.req_1?.data?.midurlinfo;
  if (!sip?.length || !midurlinfo?.length) return null;

  const base =
    sip.find((s) => s.startsWith("https://")) ||
    sip[0].replace(/^http:\/\//i, "https://");

  for (const info of midurlinfo) {
    if (info.purl) {
      return base + info.purl;
    }
  }
  return null;
}

// ─────────────────────────────────────
// 歌词
// ─────────────────────────────────────

/**
 * 解码 HTML 实体（歌词文本中使用）。
 * 支持 数字实体引用 (&#NNN;, &#xHH;) 和 命名实体。
 */
export function decodeQqHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ─────────────────────────────────────
// 专辑（详情 + 曲目 / 名称解析）
// ─────────────────────────────────────

/** 专辑曲目单页上限：绝大多数专辑一次取完，避免额外分页 */
const QQ_ALBUM_SONG_PAGE_SIZE = 100;

/** smartbox 名称解析接口域名 */
export const QQ_SMARTBOX_BASE_URL = "https://c.y.qq.com";

/**
 * 构建 QQ 专辑详情 musicu 请求体。
 * req_0 取专辑元信息、req_1 取曲目，一次请求并行返回。
 */
export function buildQqAlbumMusicuData(albumMid: string) {
  return {
    comm: { ct: 24, cv: 0, uin: "0", format: "json" },
    req_0: {
      module: "music.musichallAlbum.AlbumInfoServer",
      method: "GetAlbumDetail",
      param: { AlbumMid: albumMid },
    },
    req_1: {
      module: "music.musichallAlbum.AlbumSongList",
      method: "GetAlbumSongList",
      param: {
        albumMid,
        begin: 0,
        num: QQ_ALBUM_SONG_PAGE_SIZE,
        order: 2,
      },
    },
  };
}

/**
 * 构建 QQ 专辑详情请求路径（不含域名/代理前缀）。
 */
export function buildQqAlbumApiPath(albumMid: string): string {
  const data = encodeURIComponent(
    JSON.stringify(buildQqAlbumMusicuData(albumMid))
  );
  return `/cgi-bin/musicu.fcg?data=${data}`;
}

/**
 * 构建 smartbox 名称解析请求路径（不含域名/代理前缀）。
 * 注意：key 只传专辑名。实测把歌手一起拼进去会让 album 分组直接返回 0 条
 * （smartbox 对多词组合只走单曲匹配），歌手校验放在调用方做。
 */
export function buildQqSmartboxApiPath(albumName: string): string {
  return (
    "/splcloud/fcgi-bin/smartbox_new.fcg" +
    `?key=${encodeURIComponent(albumName)}` +
    "&format=json&inCharset=utf-8&outCharset=utf-8&platform=yqq"
  );
}

/**
 * 按 albummid 拼接封面 URL。
 */
export function buildQqAlbumCoverUrl(albumMid: string, size = 800): string {
  if (!albumMid) return "";
  return `https://y.gtimg.cn/music/photo_new/T002R${size}x${size}M000${albumMid}.jpg`;
}

/**
 * 将 QQ 专辑曲目对象转换为 MusicTrack。
 */
export function convertQqAlbumSongToMusicTrack(
  song: QqAlbumSongInfoRaw
): MusicTrack {
  const songmid = song.mid || "";
  return {
    id: `qq_${songmid}`,
    name: song.name || "",
    artist: (song.singer || [])
      .map((s) => s.name || "")
      .filter((name) => !!name),
    album: song.album?.name || "",
    pic_id: buildQqAlbumCoverUrl(song.album?.mid || ""),
    url_id: songmid,
    lyric_id: songmid,
    source: "qq",
    fee: song.pay?.pay_play === 1 ? 1 : undefined,
    album_id: song.album?.mid || undefined,
  };
}

/**
 * 解析 musicu 专辑响应。
 * 编码异常或专辑不存在时抛错，交由调用方回退到默认搜索。
 */
export function parseQqAlbumResponse(
  json: QqAlbumMusicuResponse,
  albumMid: string
): QqAlbumDetail {
  if (json.code !== 0) {
    throw new Error(`QQ 专辑接口返回异常: code=${json.code}`);
  }

  const basic = json.req_0?.data?.basicInfo;
  const mid = basic?.albumMid || albumMid;
  const name = basic?.albumName;
  if (!name) throw new Error("QQ 专辑不存在或已下架");

  const tracks = (json.req_1?.data?.songList ?? [])
    .map((item) => item.songInfo)
    .filter((info): info is QqAlbumSongInfoRaw => !!info?.mid)
    .map(convertQqAlbumSongToMusicTrack);

  return {
    albumMid: mid,
    name,
    coverUrl: buildQqAlbumCoverUrl(mid),
    creator:
      (json.req_0?.data?.singer?.singerList ?? [])
        .map((s) => s.name || "")
        .filter((n) => !!n)
        .join(" / ") || undefined,
    description: basic?.desc || undefined,
    publishDate: basic?.publishDate || undefined,
    trackCount: json.req_1?.data?.totalNum ?? tracks.length,
    tracks,
  };
}

/**
 * 构建 QQ 旧版专辑接口请求路径（不含域名/代理前缀）。
 * 该接口参数简单、单请求即返回专辑元信息 + 全部曲目（按音轨顺序），
 * 作为 musicu 之外的第二条通路。
 */
export function buildQqAlbumInfoApiPath(albumMid: string): string {
  const params = new URLSearchParams({
    albummid: albumMid,
    g_tk: "5381",
    uin: "0",
    format: "json",
    inCharset: "utf-8",
    outCharset: "utf-8",
    notice: "0",
    platform: "h5",
    needNewCode: "1",
  });
  return `/v8/fcg-bin/fcg_v8_album_info_cp.fcg?${params.toString()}`;
}

/**
 * 将旧版专辑接口的曲目对象转换为 MusicTrack。
 */
export function convertQqAlbumInfoSongToMusicTrack(
  song: QqAlbumInfoSongRaw
): MusicTrack {
  const songmid = song.songmid || "";
  return {
    id: `qq_${songmid}`,
    name: song.songname || "",
    artist: (song.singer || [])
      .map((s) => s.name || "")
      .filter((name) => !!name),
    album: song.albumname || "",
    pic_id: buildQqAlbumCoverUrl(song.albummid || ""),
    url_id: songmid,
    lyric_id: songmid,
    source: "qq",
    fee: song.pay?.payplay === 1 ? 1 : undefined,
    album_id: song.albummid || undefined,
  };
}

/**
 * 解析旧版专辑接口响应。
 * 编码异常或专辑不存在时抛错，交由调用方切换通路。
 */
export function parseQqAlbumInfoResponse(
  json: QqAlbumInfoResponse,
  albumMid: string
): QqAlbumDetail {
  if (json.code !== 0) {
    throw new Error(`QQ 专辑接口返回异常: code=${json.code}`);
  }

  const data = json.data;
  const name = data?.name;
  if (!name) throw new Error("QQ 专辑不存在或已下架");

  const mid = data?.mid || albumMid;
  const tracks = (data?.list ?? [])
    .filter((song): song is QqAlbumInfoSongRaw => !!song.songmid)
    .map(convertQqAlbumInfoSongToMusicTrack);

  return {
    albumMid: mid,
    name,
    coverUrl: buildQqAlbumCoverUrl(mid),
    creator: data?.singername || undefined,
    description: data?.desc || undefined,
    publishDate: data?.aDate || undefined,
    trackCount: data?.total_song_num ?? tracks.length,
    tracks,
  };
}
