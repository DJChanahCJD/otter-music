import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMiguLyric,
  parseMiguPlaylistUrl,
  resolveMiguPlaylistId,
} from "./migu-api";
import {
  buildMiguPlaylistInfoPath,
  buildMiguPlaylistSongsPath,
  buildMiguSongUrlPath,
  buildMiguV3SearchPath,
  convertMiguSongToMusicTrack,
  convertMiguV3SearchSongToMusicTrack,
  fetchMiguPlaylistDetail,
  parseMiguPlaylistInfoResponse,
  parseMiguPlaylistSongsResponse,
  parseMiguSongUrlResponse,
  parseMiguTrackId,
} from "@otter-music/shared";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/api/config");
  vi.doUnmock("@capacitor/core");
  vi.doUnmock("../music-provider");
  vi.resetModules();
});

describe("parseMiguPlaylistUrl", () => {
  it("extracts playlist id from PC links", () => {
    expect(
      parseMiguPlaylistUrl("https://music.migu.cn/v3/music/playlist/127623862")
    ).toBe("127623862");
  });

  it("extracts playlist id from mobile links", () => {
    expect(
      parseMiguPlaylistUrl(
        "https://m.music.migu.cn/v3/music/playlist/127623862"
      )
    ).toBe("127623862");
  });

  it("extracts playlist id from my playlist links", () => {
    expect(
      parseMiguPlaylistUrl("https://music.migu.cn/v3/my/playlist/127623862")
    ).toBe("127623862");
  });

  it("rejects invalid links", () => {
    expect(
      parseMiguPlaylistUrl("https://music.migu.cn/v3/music/song/1")
    ).toBeNull();
    expect(parseMiguPlaylistUrl("not a url")).toBeNull();
  });
});

describe("resolveMiguPlaylistId", () => {
  it("returns direct playlist IDs without issuing a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resolveMiguPlaylistId("https://music.migu.cn/v3/music/playlist/127623862")
    ).resolves.toBe("127623862");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves c.migu.cn short links through the Migu API route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ playlistId: "234235348" }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resolveMiguPlaylistId("https://c.migu.cn/00CQck?ifrom=share")
    ).resolves.toBe("234235348");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/migu-resolve");
  });

  it("returns null when short-link resolution fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 400 }))
    );

    await expect(
      resolveMiguPlaylistId("https://c.migu.cn/00CQck")
    ).resolves.toBeNull();
  });
});

describe("build migu paths", () => {
  it("builds V3 search path", () => {
    const path = buildMiguV3SearchPath("周杰伦", 1, 20);
    expect(path).toContain("/pc/resource/song/item/search/v1.0?");
    expect(path).toContain("text=" + encodeURIComponent("周杰伦"));
    expect(path).toContain("pageNo=1");
    expect(path).toContain("pageSize=20");
  });

  it("builds playlist info endpoint", () => {
    const path = buildMiguPlaylistInfoPath("127623862");
    expect(path).toContain("/MIGUM2.0/v1.0/content/resourceinfo.do?");
    expect(path).toContain("resourceType=2021");
    expect(path).toContain("resourceId=127623862");
  });

  it("builds playlist songs endpoint", () => {
    const path = buildMiguPlaylistSongsPath("127623862", 2, 50);
    expect(path).toContain("/MIGUM2.0/v1.0/user/queryMusicListSongs.do?");
    expect(path).toContain("musicListId=127623862");
    expect(path).toContain("pageNo=2");
    expect(path).toContain("pageSize=50");
  });

  it("builds song url endpoint with quality", () => {
    expect(buildMiguSongUrlPath("c1", "p1", 192)).toContain("toneFlag=PQ");
    expect(buildMiguSongUrlPath("c1", "p1", 320)).toContain("toneFlag=HQ");
    expect(buildMiguSongUrlPath("c1", "p1", 999)).toContain("toneFlag=SQ");
  });
});

describe("migu V3 search path", () => {
  it("buildMiguV3SearchPath produces correct endpoint", () => {
    const path = buildMiguV3SearchPath("测试", 3, 30);
    expect(path).toBe(
      "/pc/resource/song/item/search/v1.0?text=" +
        encodeURIComponent("测试") +
        "&pageNo=3&pageSize=30"
    );
  });
});

describe("parse migu responses", () => {
  it("parses playlist info JSON", () => {
    const res = parseMiguPlaylistInfoResponse(
      '{"code":"000000","resource":[{"title":"歌单"}]}'
    );
    expect(res.resource?.[0].title).toBe("歌单");
  });

  it("parses playlist songs JSON", () => {
    const res = parseMiguPlaylistSongsResponse(
      '{"code":"000000","totalCount":1,"list":[{"songName":"歌曲"}]}'
    );
    expect(res.totalCount).toBe(1);
    expect(res.list?.[0].songName).toBe("歌曲");
  });

  it("parses song url JSON", () => {
    const url = parseMiguSongUrlResponse({
      data: { url: "//example.com/a+b.mp3" },
    });
    expect(url).toBe("https://example.com/a%2Bb.mp3");
  });
});

describe("getMiguLyric", () => {
  it("loads web lyrics through the generic proxy", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("[00:00.00]歌词", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getMiguLyric("https://d.musicapp.migu.cn/lrc")
    ).resolves.toEqual({
      lyric: "[00:00.00]歌词",
      tlyric: "",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/proxy?url=https%3A%2F%2Fd.musicapp.migu.cn%2Flrc"
    );
  });

  it("loads native lyrics directly through CapacitorHttp", async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ status: 200, data: "[00:00.00]歌词" });
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: true,
    }));
    vi.doMock("../music-provider", () => ({
      forceHttps: (url: string) => url.replace(/^http:\/\//i, "https://"),
    }));
    vi.doMock("@capacitor/core", () => ({ CapacitorHttp: { request } }));

    const { getMiguLyric: getNativeMiguLyric } = await import("./migu-api");
    await expect(
      getNativeMiguLyric("http://d.musicapp.migu.cn/lrc")
    ).resolves.toEqual({
      lyric: "[00:00.00]歌词",
      tlyric: "",
    });
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      url: "https://d.musicapp.migu.cn/lrc",
    });
  });

  it("returns null for invalid lyric URLs", async () => {
    await expect(getMiguLyric("")).resolves.toBeNull();
  });
});

describe("convertMiguSongToMusicTrack", () => {
  it("converts Migu songs to MusicTrack", () => {
    const track = convertMiguSongToMusicTrack({
      copyrightId: "60054704083",
      contentId: "600908000006663347",
      songName: "等你下课(with 杨瑞代)",
      artists: [{ id: "112", name: "周杰伦" }],
      album: "最伟大的作品",
      albumId: "1139846638",
      albumImgs: [{ img: "https://d.musicapp.migu.cn/cover.webp" }],
      lrcUrl: "https://d.musicapp.migu.cn/lyric",
    });

    expect(track).toMatchObject({
      id: "migu_60054704083_600908000006663347",
      name: "等你下课(with 杨瑞代)",
      artist: ["周杰伦"],
      album: "最伟大的作品",
      pic_id: "https://d.musicapp.migu.cn/cover.webp",
      url_id: "migu_60054704083_600908000006663347",
      lyric_id: "https://d.musicapp.migu.cn/lyric",
      source: "migu",
      artist_ids: ["112"],
      album_id: "1139846638",
    });
  });

  it("splits singer fallback", () => {
    const track = convertMiguSongToMusicTrack({
      copyrightId: "1",
      contentId: "2",
      songName: "Song",
      singer: "A|B",
    });

    expect(track.artist).toEqual(["A", "B"]);
  });
});

describe("convertMiguV3SearchSongToMusicTrack", () => {
  it("converts V3 search results to MusicTrack", () => {
    const track = convertMiguV3SearchSongToMusicTrack({
      copyrightId: "6902739Z0BT",
      contentId: "600919000007823377",
      songName: "太阳之子",
      singerList: [{ id: "112", name: "周杰伦" }],
      album: "太阳之子",
      albumId: "1142521343",
      ext: { lrcUrl: "https://d.musicapp.migu.cn/lyric" },
      img1: "https://d.musicapp.migu.cn/cover.webp",
    });

    expect(track).toMatchObject({
      id: "migu_6902739Z0BT_600919000007823377",
      name: "太阳之子",
      artist: ["周杰伦"],
      album: "太阳之子",
      pic_id: "https://d.musicapp.migu.cn/cover.webp",
      url_id: "migu_6902739Z0BT_600919000007823377",
      lyric_id: "https://d.musicapp.migu.cn/lyric",
      source: "migu",
      artist_ids: ["112"],
      album_id: "1142521343",
    });
  });

  it("handles missing fields gracefully", () => {
    const track = convertMiguV3SearchSongToMusicTrack({});
    expect(track).toMatchObject({
      name: "未知歌曲",
      artist: [],
      album: "",
      source: "migu",
    });
  });
});

describe("fetchMiguPlaylistDetail", () => {
  it("fetches playlist info and songs", async () => {
    const detail = await fetchMiguPlaylistDetail(
      "127623862",
      async (path: string) => {
        if (path.includes("resourceinfo.do")) {
          return JSON.stringify({
            code: "000000",
            resource: [
              {
                title: "咪咕歌单",
                musicNum: 1,
                imgItem: { img: "https://example.com/cover.webp" },
              },
            ],
          });
        }
        return JSON.stringify({
          code: "000000",
          totalCount: 1,
          list: [{ copyrightId: "1", contentId: "2", songName: "Song" }],
        });
      }
    );

    expect(detail.name).toBe("咪咕歌单");
    expect(detail.coverUrl).toBe("https://example.com/cover.webp");
    expect(detail.trackCount).toBe(1);
    expect(detail.songs).toHaveLength(1);
  });

  it("throws for empty playlists", async () => {
    await expect(
      fetchMiguPlaylistDetail("1", async (path: string) => {
        if (path.includes("resourceinfo.do")) {
          return JSON.stringify({
            code: "000000",
            resource: [{ musicNum: 0 }],
          });
        }
        return JSON.stringify({ code: "000000", list: [] });
      })
    ).rejects.toThrow("歌单为空");
  });
});

describe("parseMiguTrackId", () => {
  it("parses internal migu track ids", () => {
    expect(parseMiguTrackId("migu_60054704083_600908000006663347")).toEqual({
      copyrightId: "60054704083",
      contentId: "600908000006663347",
    });
  });
});

// ============================================================
// searchMiguSongs — app.u.nf.migu.cn V3 搜索集成测试
// ============================================================

const sampleV3SearchSong = {
  copyrightId: "6902739Z0BT",
  contentId: "600919000007823377",
  songName: "太阳之子",
  singerList: [{ id: "112", name: "周杰伦" }],
  album: "太阳之子",
  albumId: "1142521343",
  ext: { lrcUrl: "https://d.musicapp.migu.cn/lyric" },
  img1: "https://d.musicapp.migu.cn/cover.webp",
};

describe("searchMiguSongs (dev)", () => {
  it("uses simple headers to app.u.nf.migu.cn", async () => {
    const fetchWithTimeout = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([sampleV3SearchSong]), { status: 200 })
      );
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout,
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: false,
    }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("周杰伦", 1);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "migu_6902739Z0BT_600919000007823377",
      name: "太阳之子",
      artist: ["周杰伦"],
      source: "migu",
    });
    expect(result.hasMore).toBe(false);
    const url = String(fetchWithTimeout.mock.calls[0][0]);
    expect(url).toContain("/api/migu-v3/pc/resource/song/item/search/v1.0");
    const opts = fetchWithTimeout.mock.calls[0][1];
    // V3 搜索接口不兼容 channel/uid 请求头，携带会返回 860002
    expect(opts.headers?.channel).toBeUndefined();
    expect(opts.headers?.uid).toBeUndefined();
  });

  it("returns empty on non-ok response", async () => {
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi
        .fn()
        .mockResolvedValue(new Response("[]", { status: 500 })),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: false,
    }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("test", 1);

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it("returns empty on network error", async () => {
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn().mockRejectedValue(new Error("network error")),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: false,
    }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("test", 1);

    expect(result.items).toHaveLength(0);
  });

  it("returns empty when response is empty array", async () => {
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: false,
    }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("test", 1);

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });
});

describe("searchMiguSongs (native)", () => {
  it("uses CapacitorHttp with simple headers to app.u.nf.migu.cn", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 200,
      data: [sampleV3SearchSong],
    });
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: true,
    }));
    vi.doMock("@capacitor/core", () => ({ CapacitorHttp: { request } }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("周杰伦", 1);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("太阳之子");
    const call = request.mock.calls[0][0];
    expect(call.url).toContain(
      "https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0"
    );
    // V3 搜索接口不兼容 channel/uid 请求头，携带会返回 860002
    expect(call.headers?.channel).toBeUndefined();
  });

  it("returns empty on native HTTP error", async () => {
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: true,
    }));
    vi.doMock("@capacitor/core", () => ({
      CapacitorHttp: {
        request: vi.fn().mockResolvedValue({ status: 500, data: "[]" }),
      },
    }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("test", 1);

    expect(result.items).toHaveLength(0);
  });
});
