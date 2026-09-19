import { describe, expect, it } from "vitest";
import { parseOpml } from "./opml";

/**
 * 构造 OPML 文档
 * @param body outline 内容
 */
const buildOpml = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>订阅列表</title></head>
  <body>${body}</body>
</opml>`;

describe("parseOpml", () => {
  it("提取全部 xmlUrl 并保留标题", () => {
    const result = parseOpml(
      buildOpml(`
        <outline text="Founder 100" title="Founder 100" type="rss"
          xmlUrl="https://feed.xyzfm.space/vajnxfly9gue" htmlUrl="https://www.xiaoyuzhoufm.com/podcast/622701424c3a80569d388a0b"/>
        <outline text="The Daily" title="The Daily" type="rss"
          xmlUrl="https://feeds.simplecast.com/54nAGcIl"/>
      `)
    );

    expect(result.feeds).toEqual([
      { title: "Founder 100", xmlUrl: "https://feed.xyzfm.space/vajnxfly9gue" },
      { title: "The Daily", xmlUrl: "https://feeds.simplecast.com/54nAGcIl" },
    ]);
    expect(result.skipped).toBe(0);
  });

  it("递归解析嵌套分组，并统计无 RSS 地址的条目", () => {
    const result = parseOpml(
      buildOpml(`
        <outline text="中文播客">
          <outline text="声动早咖啡" xmlUrl="https://example.com/a.xml"/>
          <outline text="空分组"/>
        </outline>
        <outline text="资讯" xmlUrl="https://example.com/b.xml"/>
      `)
    );

    expect(result.feeds.map((f) => f.xmlUrl)).toEqual([
      "https://example.com/a.xml",
      "https://example.com/b.xml",
    ]);
    // 分组目录不计入，只有叶子条目「空分组」算无法导入
    expect(result.skipped).toBe(1);
  });

  it("按 xmlUrl 去重，忽略非 http(s) 地址", () => {
    const result = parseOpml(
      buildOpml(`
        <outline text="A" xmlUrl="https://example.com/a.xml"/>
        <outline text="A 副本" xmlUrl="https://example.com/a.xml"/>
        <outline text="本地文件" xmlUrl="file:///tmp/a.xml"/>
      `)
    );

    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].title).toBe("A");
    expect(result.skipped).toBe(1);
  });

  it("缺少 title/text 时回退到域名", () => {
    const result = parseOpml(
      buildOpml('<outline xmlUrl="https://example.com/a.xml"/>')
    );

    expect(result.feeds[0].title).toBe("example.com");
  });

  it("内容为空或非 XML 时抛错", () => {
    expect(() => parseOpml("   ")).toThrow("OPML 内容为空");
    expect(() => parseOpml("<opml><body>")).toThrow("OPML 解析失败");
  });
});
