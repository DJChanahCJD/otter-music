import { describe, expect, it } from "vitest";
import { parseRssXml } from "./rss-parser";

const FEED_URL = "https://example.com/feed.xml";

/**
 * 构造一个包含 count 个条目的 RSS 2.0 文档
 * @param count 条目数量
 */
function buildRssXml(count: number): string {
  const items = Array.from(
    { length: count },
    (_, i) => `
    <item>
      <title>Episode ${i}</title>
      <enclosure url="https://example.com/ep${i}.mp3"/>
      <guid>ep-${i}</guid>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>`
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Test Podcast</title>
  <description>Test feed</description>
  ${items}
</channel></rss>`;
}

describe("parseRssXml", () => {
  it("完整解析全部条目，不在解析阶段截断", () => {
    const feed = parseRssXml(buildRssXml(350), FEED_URL);

    expect(feed.episodes).toHaveLength(350);
    expect(feed.episodes[0].id).toBe("ep-0");
    expect(feed.episodes[349].id).toBe("ep-349");
  });

  it("Atom 频道从 link 的 href 属性读取站点地址", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Podcast</title>
  <subtitle>Atom feed</subtitle>
  <link rel="alternate" href="https://example.com/atom"/>
  <entry>
    <title>Episode A</title>
    <id>ep-a</id>
    <link rel="enclosure" href="https://example.com/a.mp3"/>
    <published>2024-01-01T00:00:00Z</published>
  </entry>
</feed>`;

    const feed = parseRssXml(xml, FEED_URL);

    expect(feed.link).toBe("https://example.com/atom");
    expect(feed.episodes).toHaveLength(1);
    expect(feed.episodes[0].audioUrl).toBe("https://example.com/a.mp3");
  });

  it("Atom 频道 link 缺省 rel 时按 alternate 处理", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Podcast</title>
  <link href="https://example.com/no-rel"/>
  <entry>
    <title>Episode A</title>
    <id>ep-a</id>
    <link rel="enclosure" href="https://example.com/a.mp3"/>
  </entry>
</feed>`;

    expect(parseRssXml(xml, FEED_URL).link).toBe("https://example.com/no-rel");
  });

  it("读取 RSS 2.0 标准封面 <image><url>", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Test Podcast</title>
  <image><url>https://example.com/cover.jpg</url></image>
  <item>
    <title>Episode 0</title>
    <enclosure url="https://example.com/ep0.mp3"/>
  </item>
</channel></rss>`;

    expect(parseRssXml(xml, FEED_URL).coverUrl).toBe(
      "https://example.com/cover.jpg"
    );
  });
});
