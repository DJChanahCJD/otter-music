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
