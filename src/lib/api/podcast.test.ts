import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PodcastFeed } from "@/types/podcast";

const mockFeed: PodcastFeed = {
  name: "Test Podcast",
  description: "A test feed",
  coverUrl: "https://example.com/cover.jpg",
  link: "https://example.com",
  episodes: [
    {
      id: "ep1",
      title: "Episode 1",
      audioUrl: "https://example.com/ep1.mp3",
      pubDate: "Mon, 01 Jan 2024 00:00:00 GMT",
      coverUrl: "https://example.com/cover.jpg",
    },
  ],
};

const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0">
  <channel>
    <title>Test Podcast</title>
    <description>A test feed</description>
    <itunes:image href="https://example.com/cover.jpg"/>
    <link>https://example.com</link>
    <item>
      <title>Episode 1</title>
      <enclosure url="https://example.com/ep1.mp3"/>
      <description>First episode</description>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      <guid>ep1</guid>
    </item>
  </channel>
</rss>`;

const setupMocks = () => {
  const requestMock = vi.fn();
  const fetchMock = vi.fn();
  const warnMock = vi.fn();

  vi.stubGlobal("fetch", fetchMock);
  vi.doMock("@capacitor/core", () => ({
    CapacitorHttp: { request: requestMock },
  }));
  vi.doMock("@/lib/logger", () => ({
    logger: { warn: warnMock, error: vi.fn(), info: vi.fn() },
  }));
  vi.doMock("@/lib/utils/cache", () => ({
    cachedFetch: vi.fn(
      async (_key: string, fetcher: () => Promise<PodcastFeed | null>) =>
        fetcher()
    ),
  }));

  return { requestMock, fetchMock, warnMock };
};

const importParsePodcastRss = async (isNative: boolean) => {
  vi.doMock("@/lib/api/config", () => ({
    IS_NATIVE: isNative,
    getApiUrl: () => "https://otter-music.pages.dev",
  }));
  const mod = await import("./podcast");
  return mod.parsePodcastRss;
};

/** 导入完整模块，用于测试小宇宙相关导出 */
const importPodcastModule = async (isNative: boolean) => {
  vi.doMock("@/lib/api/config", () => ({
    IS_NATIVE: isNative,
    getApiUrl: () => "https://otter-music.pages.dev",
  }));
  return await import("./podcast");
};

/** 构造小宇宙播客页 HTML（含 __NEXT_DATA__） */
const buildXyzHtml = (podcast: Record<string, unknown>): string =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    { props: { pageProps: { podcast } } }
  )}</script></body></html>`;

const xyzPodcastFixture = {
  pid: "68de6ebd694df8ca73672a04",
  title: "墨湖电波",
  author: "一只橙子橙",
  brief: "讲述悬疑案件的罪案播客",
  description: "完整简介",
  image: { picUrl: "https://image.xyzcdn.net/cover.jpg" },
  episodes: [
    {
      eid: "ep1",
      title: "EP13.水中涟漪",
      pubDate: "2026-09-16T16:00:00.000Z",
      enclosure: { url: "https://media.xyzcdn.net/a.m4a" },
    },
    {
      // 无 enclosure，回退 media.source.url
      eid: "ep2",
      title: "EP12.利在而祸伏",
      pubDate: "2026-09-09T16:00:00.000Z",
      media: { source: { url: "https://media.xyzcdn.net/b.m4a" } },
    },
  ],
};

describe("parseXyzPid", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("提取标准小宇宙播客链接的 pid", async () => {
    const { parseXyzPid } = await importPodcastModule(true);
    expect(
      parseXyzPid(
        "https://www.xiaoyuzhoufm.com/podcast/68de6ebd694df8ca73672a04"
      )
    ).toBe("68de6ebd694df8ca73672a04");
  });

  it("兼容带查询参数的链接", async () => {
    const { parseXyzPid } = await importPodcastModule(true);
    expect(
      parseXyzPid(
        "https://www.xiaoyuzhoufm.com/podcast/68de6ebd694df8ca73672a04?utm_source=rss"
      )
    ).toBe("68de6ebd694df8ca73672a04");
  });

  it("非小宇宙链接返回 null", async () => {
    const { parseXyzPid } = await importPodcastModule(true);
    expect(parseXyzPid("https://example.com/feed.xml")).toBeNull();
    // 单集链接不应被识别为播客
    expect(
      parseXyzPid("https://www.xiaoyuzhoufm.com/episode/abc123")
    ).toBeNull();
  });
});

describe("resolveXyzPodcast", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("原生端抓取详情页并转换为可订阅项", async () => {
    const { requestMock } = setupMocks();
    requestMock.mockResolvedValue({
      status: 200,
      data: buildXyzHtml(xyzPodcastFixture),
    });

    const { resolveXyzPodcast } = await importPodcastModule(true);
    const item = await resolveXyzPodcast("68de6ebd694df8ca73672a04");

    expect(item.source).toBe("xyz");
    expect(item.title).toBe("墨湖电波");
    expect(item.author).toBe("一只橙子橙");
    expect(item.cover).toBe("https://image.xyzcdn.net/cover.jpg");
    // 复用 rssUrl 字段存储播客页链接
    expect(item.rssUrl).toBe(
      "https://www.xiaoyuzhoufm.com/podcast/68de6ebd694df8ca73672a04"
    );
  });

  it("解析详情页得到的 feed 含全部单集与音频直链", async () => {
    const { requestMock } = setupMocks();
    requestMock.mockResolvedValue({
      status: 200,
      data: buildXyzHtml(xyzPodcastFixture),
    });

    const { parsePodcastRss } = await importPodcastModule(true);
    const feed = await parsePodcastRss(
      "https://www.xiaoyuzhoufm.com/podcast/68de6ebd694df8ca73672a04"
    );

    expect(feed.name).toBe("墨湖电波");
    expect(feed.episodes).toHaveLength(2);
    expect(feed.episodes[0].audioUrl).toBe("https://media.xyzcdn.net/a.m4a");
    // 无 enclosure 时回退 media.source.url
    expect(feed.episodes[1].audioUrl).toBe("https://media.xyzcdn.net/b.m4a");
  });

  it("Web 端拒绝小宇宙订阅", async () => {
    setupMocks();
    const { resolveXyzPodcast } = await importPodcastModule(false);
    await expect(resolveXyzPodcast("68de6ebd694df8ca73672a04")).rejects.toThrow(
      "仅支持 Android 端"
    );
  });

  it("页面结构变化时抛出可读错误", async () => {
    const { requestMock } = setupMocks();
    requestMock.mockResolvedValue({
      status: 200,
      data: "<html>no data</html>",
    });

    const { resolveXyzPodcast } = await importPodcastModule(true);
    await expect(resolveXyzPodcast("68de6ebd694df8ca73672a04")).rejects.toThrow(
      "页面结构已变化"
    );
  });
});

describe("parsePodcastRss", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("原生端直连成功时直接返回解析结果", async () => {
    const { requestMock, fetchMock } = setupMocks();
    requestMock.mockResolvedValue({ status: 200, data: mockXml });

    const parsePodcastRss = await importParsePodcastRss(true);
    const result = await parsePodcastRss("https://example.com/feed.xml");

    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "https://example.com/feed.xml",
        headers: expect.objectContaining({
          accept: "application/rss+xml, application/xml, text/xml, */*",
        }),
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.name).toBe("Test Podcast");
    expect(result.episodes).toHaveLength(1);
  });

  it("原生端直连失败时回退到后端代理", async () => {
    const { requestMock, fetchMock, warnMock } = setupMocks();
    requestMock.mockRejectedValue(new Error("network failed"));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: mockFeed }), {
        status: 200,
      })
    );

    const parsePodcastRss = await importParsePodcastRss(true);
    const result = await parsePodcastRss("https://example.com/feed.xml");

    expect(requestMock).toHaveBeenCalledTimes(1); // HEAD 预检一次，失败后直连短路不再 GET + retry
    expect(fetchMock).toHaveBeenCalledWith(
      "https://otter-music.pages.dev/podcast-api/rss?url=https%3A%2F%2Fexample.com%2Ffeed.xml",
      expect.anything()
    );
    expect(warnMock).toHaveBeenCalledWith(
      "podcast",
      expect.stringContaining("RSS 直连失败，回退代理"),
      expect.any(String)
    );
    expect(result.name).toBe("Test Podcast");
  });

  it("原生端取消时不触发代理回退", async () => {
    const { requestMock, fetchMock, warnMock } = setupMocks();
    requestMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    const parsePodcastRss = await importParsePodcastRss(true);
    await expect(
      parsePodcastRss("https://example.com/feed.xml")
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("Web 端仅走代理", async () => {
    const { requestMock, fetchMock } = setupMocks();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: mockFeed }), {
        status: 200,
      })
    );

    const parsePodcastRss = await importParsePodcastRss(false);
    const result = await parsePodcastRss("https://example.com/feed.xml");

    expect(requestMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://otter-music.pages.dev/podcast-api/rss?url=https%3A%2F%2Fexample.com%2Ffeed.xml",
      expect.anything()
    );
    expect(result.name).toBe("Test Podcast");
  });

  it("代理返回空数据时抛出解析失败", async () => {
    const { fetchMock } = setupMocks();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
      })
    );

    const parsePodcastRss = await importParsePodcastRss(false);
    await expect(
      parsePodcastRss("https://example.com/feed.xml")
    ).rejects.toThrow("RSS 解析失败");
  });
});
