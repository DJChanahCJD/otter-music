import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockConfig: any;
let mockCapacitor: any;
let mockBilibiliProxy: any;

beforeEach(() => {
  mockConfig = {
    fetchWithTimeout: vi.fn(),
    getApiUrl: vi.fn().mockReturnValue("https://otter-music.pages.dev"),
    IS_NATIVE: false,
  };
  mockCapacitor = {
    Capacitor: { isNativePlatform: vi.fn() },
    CapacitorHttp: { request: vi.fn() },
  };
  mockBilibiliProxy = {
    getProxyUrl: vi.fn(),
    isRunning: vi.fn(),
    startServer: vi.fn(),
  };
  vi.doMock("@/lib/api/config", () => mockConfig);
  vi.doMock("@capacitor/core", () => mockCapacitor);
  vi.doMock("@/plugins/bilibili-proxy", () => ({
    BilibiliProxy: mockBilibiliProxy,
  }));
});

afterEach(() => {
  vi.resetModules();
});

function makeSearchResponse() {
  return {
    code: 0,
    data: {
      numResults: 1,
      result: [
        {
          type: "video",
          bvid: "BV1xx411c7mD",
          title: "Song",
          author: "UP",
          pic: "https://example.com/cover.jpg",
        },
      ],
    },
  };
}

describe("searchBilibiliVideos", () => {
  // 全量并行运行时模块首次加载可能超过默认 5s，放宽超时
  it(
    "loads dev search results through the Vite Bilibili proxy",
    { timeout: 15000 },
    async () => {
      mockConfig.IS_NATIVE = false;
      mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
      mockConfig.fetchWithTimeout.mockResolvedValue(
        new Response(JSON.stringify(makeSearchResponse()), {
          status: 200,
        })
      );

      const { searchBilibiliVideos } = await import("./bilibili-api");
      const result = await searchBilibiliVideos("周杰伦", 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: "bilibili_BV1xx411c7mD",
        source: "bilibili",
      });
      expect(String(mockConfig.fetchWithTimeout.mock.calls[0][0])).toContain(
        "/api/bilibili/x/web-interface/search/type"
      );
    }
  );

  it("returns empty collections in dev search results", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            numResults: 2,
            result: [
              { type: "video", bvid: "BV1xx", title: "Song", author: "UP" },
              {
                type: "video",
                bvid: "BV1yy",
                title: "合集曲目1",
                author: "音乐UP",
              },
            ],
          },
        }),
        { status: 200 }
      )
    );

    const { searchBilibiliVideos } = await import("./bilibili-api");
    const result = await searchBilibiliVideos("周杰伦", 1, 20);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ id: "bilibili_BV1xx" });
    expect(result.items[1]).toMatchObject({ id: "bilibili_BV1yy" });
  });
});

describe("getBilibiliSongUrl", () => {
  it("returns proxy url via BilibiliProxy on native platform", async () => {
    mockBilibiliProxy.getProxyUrl.mockResolvedValue({
      success: true,
      url: "http://localhost:8080/stream",
    });
    mockBilibiliProxy.isRunning.mockResolvedValue({ running: false });
    mockBilibiliProxy.startServer.mockResolvedValue({
      success: true,
      port: 8080,
    });
    mockCapacitor.CapacitorHttp.request
      .mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          code: 0,
          data: { pages: [{ cid: 62131 }] },
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          code: 0,
          data: {
            dash: {
              audio: [{ baseUrl: "https://example.com/audio.m4s" }],
            },
          },
        }),
      });
    mockConfig.IS_NATIVE = true;
    mockCapacitor.Capacitor.isNativePlatform.mockReturnValue(true);
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();

    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(getBilibiliSongUrl("bilibili_BV1xx411c7mD")).resolves.toEqual({
      url: "http://localhost:8080/stream",
      format: "m4a",
    });
  });

  it("returns null on native when proxy fails to get stream url", async () => {
    mockBilibiliProxy.getProxyUrl.mockResolvedValue({
      success: false,
      url: "",
    });
    mockBilibiliProxy.isRunning.mockResolvedValue({ running: false });
    mockBilibiliProxy.startServer.mockResolvedValue({
      success: true,
      port: 8080,
    });
    mockCapacitor.CapacitorHttp.request
      .mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          code: 0,
          data: { pages: [{ cid: 62131 }] },
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          code: 0,
          data: {
            dash: {
              audio: [{ baseUrl: "https://example.com/audio.m4s" }],
            },
          },
        }),
      });
    mockConfig.IS_NATIVE = true;
    mockCapacitor.Capacitor.isNativePlatform.mockReturnValue(true);
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();

    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(
      getBilibiliSongUrl("bilibili_BV1xx411c7mD")
    ).resolves.toBeNull();
  });

  it("resolves dev song urls through view and playurl", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: { pages: [{ cid: 62131 }] },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              dash: {
                audio: [
                  {
                    baseUrl: "https://example.com/audio.m4s",
                    mimeType: "audio/mp4",
                  },
                ],
              },
            },
          }),
          { status: 200 }
        )
      );

    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(getBilibiliSongUrl("bilibili_BV1xx411c7mD")).resolves.toEqual({
      url: "/api/bilibili-audio?bvid=BV1xx411c7mD&url=https%3A%2F%2Fexample.com%2Faudio.m4s",
      format: "m4s",
    });
  });

  it("returns null for invalid Bilibili track ids", async () => {
    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(getBilibiliSongUrl("netease_1")).resolves.toBeNull();
  });
});

describe("getBilibiliCoverUrl", () => {
  it("wraps dev cover urls through the Vite Bilibili cover proxy", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();

    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    await expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).resolves.toBe(
      "/api/bilibili-cover?url=https%3A%2F%2Fi0.hdslb.com%2Fbfs%2Farchive%2Fcover.jpg"
    );
  });

  it("downloads native cover as blob via CapacitorHttp with Bilibili headers", async () => {
    mockCapacitor.CapacitorHttp.request.mockResolvedValue({
      status: 200,
      data: new Blob(),
      headers: { "Content-Type": "image/jpeg" },
    });
    mockConfig.IS_NATIVE = true;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:native-cover");

    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    await expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).resolves.toBe("blob:native-cover");

    const callOptions = mockCapacitor.CapacitorHttp.request.mock.calls[0][0];
    expect(callOptions.url).toBe("https://i0.hdslb.com/bfs/archive/cover.jpg");
    expect(callOptions.headers).toHaveProperty(
      "Referer",
      "https://www.bilibili.com/"
    );
  });

  it("converts base64 data to blob on native when cover request returns string", async () => {
    mockCapacitor.CapacitorHttp.request.mockResolvedValue({
      status: 200,
      data: "ZHVtbXk=",
      headers: { "Content-Type": "image/jpeg" },
    });
    mockConfig.IS_NATIVE = true;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();
    vi.spyOn(URL, "createObjectURL").mockReturnValue(
      "blob:native-cover-base64"
    );

    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    await expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).resolves.toBe("blob:native-cover-base64");
  });

  it("returns null for empty cover urls", async () => {
    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    await expect(getBilibiliCoverUrl("")).resolves.toBeNull();
  });
});

describe("searchBilibiliCollections", () => {
  it("returns empty collections in dev search results", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            numResults: 2,
            result: [
              { type: "video", bvid: "BV1aa", title: "Song 1", author: "UP1" },
              { type: "video", bvid: "BV1bb", title: "Song 2", author: "UP2" },
            ],
          },
        }),
        { status: 200 }
      )
    );

    const { searchBilibiliCollections } = await import("./bilibili-api");
    const result = await searchBilibiliCollections("合集", 1, 20);

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });
});

describe("getBilibiliCollectionDetail", () => {
  it("returns null for non-series album id", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();

    const { getBilibiliCollectionDetail } = await import("./bilibili-api");
    await expect(
      getBilibiliCollectionDetail("bilibili_BV1xx")
    ).resolves.toBeNull();
  });

  it("returns null for non-bilibili album id", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();

    const { getBilibiliCollectionDetail } = await import("./bilibili-api");
    await expect(
      getBilibiliCollectionDetail("netease_123")
    ).resolves.toBeNull();
  });
});

describe("getBilibiliLyric", () => {
  function playerResponse(subtitles: any[] = []) {
    return {
      data: {
        subtitle: {
          subtitles,
        },
      },
    };
  }

  function viewResponse(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      data: {
        aid: 252450658,
        pages: [{ cid: 62131, duration: 1800 }],
        ...overrides,
      },
    });
  }

  it("loads lyric subtitle from player/wbi/v2 via POST proxy (web)", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");

    mockConfig.fetchWithTimeout.mockReset();
    mockConfig.fetchWithTimeout
      .mockResolvedValueOnce(new Response(viewResponse(), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            playerResponse([
              {
                lan: "zh-CN",
                lan_doc: "中文",
                subtitle_url: "https://i0.hdslb.com/zh.json",
              },
            ])
          ),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            body: [
              { from: 0, to: 2, content: "第一句" },
              { from: 2.5, to: 4, content: "第二句" },
            ],
          }),
          { status: 200 }
        )
      );

    const { getBilibiliLyric } = await import("./bilibili-api");
    const result = await getBilibiliLyric("bilibili_BV1xx411c7mD");

    expect(result?.lyric).toContain("[00:00.00]第一句");
    expect(result?.lyric).toContain("[00:02.50]第二句");
    expect(result?.tlyric).toBeUndefined();
    const calls = mockConfig.fetchWithTimeout.mock.calls.map((c: any[]) =>
      String(c[0])
    );
    // 直接走 player 代理（POST），不再请求已废弃的 subtitle/web/view
    expect(
      calls.some((u: string) => u.includes("/music-api/bilibili/player"))
    ).toBe(true);
    expect(
      calls.some((u: string) => u.includes("/x/v2/subtitle/web/view"))
    ).toBe(false);
    // 仅抓取主歌词字幕，不请求翻译字幕
    expect(
      calls.filter((u: string) => u.includes("/music-api/bilibili/subtitle"))
    ).toHaveLength(1);
  });

  it("uses explicit cid from track id and returns null when player has no subtitle", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");

    mockConfig.fetchWithTimeout.mockReset();
    mockConfig.fetchWithTimeout
      .mockResolvedValueOnce(new Response(viewResponse(), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(playerResponse([])), { status: 200 })
      );

    const { getBilibiliLyric } = await import("./bilibili-api");
    const result = await getBilibiliLyric("bilibili_BV1xx411c7mD_62131");
    expect(result).toBeNull();
  });

  it("returns null when subtitle body exceeds current page duration (anti cross-talk)", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");

    mockConfig.fetchWithTimeout.mockReset();
    mockConfig.fetchWithTimeout
      .mockResolvedValueOnce(
        new Response(viewResponse({ pages: [{ cid: 62131, duration: 60 }] }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            playerResponse([
              {
                lan: "zh-CN",
                lan_doc: "中文",
                subtitle_url: "https://i0.hdslb.com/zh.json",
              },
            ])
          ),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            body: [{ from: 0, to: 600, content: "超出时长" }],
          }),
          { status: 200 }
        )
      );

    const { getBilibiliLyric } = await import("./bilibili-api");
    const result = await getBilibiliLyric("bilibili_BV1xx411c7mD");
    expect(result).toBeNull();
  });

  it("returns null for non-bilibili track id", async () => {
    const { getBilibiliLyric } = await import("./bilibili-api");
    await expect(getBilibiliLyric("netease_123")).resolves.toBeNull();
  });

  it("falls back to page0 when track id cid not in pages", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");

    mockConfig.fetchWithTimeout.mockReset();
    mockConfig.fetchWithTimeout
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { aid: 252450658, pages: [{ cid: 999 }] } }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(playerResponse([])), { status: 200 })
      );

    const { getBilibiliLyric } = await import("./bilibili-api");
    const result = await getBilibiliLyric("bilibili_BV1xx411c7mD_62131");
    expect(result).toBeNull();
    // 回退后 player 应使用 page0 的 cid=999（在请求体里）
    const playerOpts = mockConfig.fetchWithTimeout.mock.calls[1][1] as {
      body?: string;
    };
    expect(playerOpts.body).toContain("999");
  });
});

describe("fetchBilibiliJson cookie injection", () => {
  it("attaches stored bilibili cookie to native requests", async () => {
    mockConfig.IS_NATIVE = true;
    const { useBilibiliStore } = await import("@/store/bilibili-store");
    useBilibiliStore.setState({
      cookie: "SESSDATA=abc; DedeUserID=1",
      user: null,
    });
    mockCapacitor.CapacitorHttp.request.mockResolvedValue({
      status: 200,
      data: { code: 0, data: {} },
    });

    const { getBilibiliVideoDetail } = await import("./bilibili-api");
    await getBilibiliVideoDetail("bilibili_BV1xx411c7mD");

    const headers =
      mockCapacitor.CapacitorHttp.request.mock.calls[0][0].headers;
    expect(headers.Cookie).toContain("SESSDATA=abc");

    useBilibiliStore.setState({ cookie: "", user: null });
  });
});

describe("UP space (native)", () => {
  const NAV_RESPONSE = {
    status: 200,
    data: {
      code: 0,
      data: {
        wbi_img: {
          img_url:
            "https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png",
          sub_url:
            "https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png",
        },
      },
    },
  };
  const ACC_RESPONSE = {
    status: 200,
    data: { code: 0, data: { mid: 999, name: "音乐UP", face: "//face.jpg" } },
  };
  const ARC_RESPONSE = {
    status: 200,
    data: {
      code: 0,
      data: {
        list: {
          vlist: [
            {
              bvid: "BV1xx411c7mD",
              title: "歌",
              pic: "//p.jpg",
              author: "UP",
              mid: 999,
            },
          ],
        },
        page: { count: 42 },
      },
    },
  };
  const SEASONS_RESPONSE = {
    status: 200,
    data: {
      code: 0,
      data: {
        items_lists: {
          seasons_list: [
            {
              meta: {
                season_id: 3050068,
                name: "合集",
                cover: "//c.jpg",
                total: 30,
                mid: 999,
              },
            },
          ],
        },
      },
    },
  };

  it("getBilibiliUpInfo returns profile with WBI-signed request", async () => {
    mockConfig.IS_NATIVE = true;
    mockCapacitor.CapacitorHttp.request
      .mockResolvedValueOnce(NAV_RESPONSE)
      .mockResolvedValueOnce(ACC_RESPONSE);

    const { getBilibiliUpInfo } = await import("./bilibili-api");
    const profile = await getBilibiliUpInfo(999);

    expect(profile).toEqual({ mid: 999, name: "音乐UP", face: "//face.jpg" });
    const urls = mockCapacitor.CapacitorHttp.request.mock.calls.map(
      (c: any) => c[0].url
    );
    expect(urls[1]).toContain("/x/space/wbi/acc/info");
    expect(urls[1]).toContain("w_rid=");
  });

  it("searchBilibiliUpVideos returns parsed tracks", async () => {
    mockConfig.IS_NATIVE = true;
    mockCapacitor.CapacitorHttp.request
      .mockResolvedValueOnce(NAV_RESPONSE)
      .mockResolvedValueOnce(ARC_RESPONSE);

    const { searchBilibiliUpVideos } = await import("./bilibili-api");
    const result = await searchBilibiliUpVideos(999, 1, 30, "音乐UP");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].artist).toEqual(["音乐UP"]);
    expect(result.hasMore).toBe(true);
    const urls = mockCapacitor.CapacitorHttp.request.mock.calls.map(
      (c: any) => c[0].url
    );
    expect(urls[1]).toContain("/x/space/wbi/arc/search");
    expect(urls[1]).toContain("w_rid=");
  });

  it("returns empty on non-native", async () => {
    mockConfig.IS_NATIVE = false;

    const { searchBilibiliUpVideos, getBilibiliUpCollections } =
      await import("./bilibili-api");
    await expect(searchBilibiliUpVideos(999, 1)).resolves.toEqual({
      items: [],
      hasMore: false,
      total: 0,
    });
    await expect(getBilibiliUpCollections(999)).resolves.toEqual([]);
  });

  it("getBilibiliUpCollections parses seasons", async () => {
    mockConfig.IS_NATIVE = true;
    mockCapacitor.CapacitorHttp.request.mockResolvedValueOnce(SEASONS_RESPONSE);

    const { getBilibiliUpCollections } = await import("./bilibili-api");
    const entries = await getBilibiliUpCollections(999);

    expect(entries).toEqual([
      {
        id: "bilibili_S_3050068_999",
        name: "合集",
        cover: "https://c.jpg",
        count: 30,
      },
    ]);
    const urls = mockCapacitor.CapacitorHttp.request.mock.calls.map(
      (c: any) => c[0].url
    );
    expect(urls[0]).toContain("/x/polymer/web-space/seasons_series_list");
    expect(urls[0]).toContain("page_num=1");
    expect(urls[0]).toContain("page_size=20");
    expect(urls[0]).not.toContain("wts=");
    expect(urls[0]).not.toContain("w_rid=");
  });
});
