/** OPML 中单个订阅源 */
export interface OpmlFeed {
  /** 播客名称，取自 outline 的 title/text 属性 */
  title: string;
  /** RSS 订阅地址 */
  xmlUrl: string;
}

export interface OpmlParseResult {
  /** 去重后的订阅源列表（保持文件中的顺序） */
  feeds: OpmlFeed[];
  /** 不含可用 RSS 地址的 outline 数量（多为分组目录） */
  skipped: number;
}

const HTTP_PROTOCOL = /^https?:\/\//i;

/**
 * 取 URL 的 hostname 作为兜底标题，URL 非法时原样返回
 * @param url RSS 地址
 */
const fallbackTitle = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/**
 * 解析 OPML 订阅列表，提取全部可用的 RSS 地址（支持任意层级嵌套）
 * @param xmlText OPML 文本内容
 * @returns 订阅源列表与无法导入的条目数
 */
export function parseOpml(xmlText: string): OpmlParseResult {
  if (!xmlText.trim()) {
    throw new Error("OPML 内容为空");
  }

  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("OPML 解析失败，请确认文件格式");
  }

  const feeds: OpmlFeed[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  doc.querySelectorAll("outline").forEach((outline) => {
    // 兼容大小写不一致的导出实现（标准为 xmlUrl）
    const xmlUrl = (
      outline.getAttribute("xmlUrl") ||
      outline.getAttribute("xmlurl") ||
      ""
    ).trim();

    if (!HTTP_PROTOCOL.test(xmlUrl)) {
      // 含子 outline 的条目是分组目录，只有叶子条目才算无法导入的订阅
      if (outline.getElementsByTagName("outline").length === 0) skipped++;
      return;
    }
    if (seen.has(xmlUrl)) return;
    seen.add(xmlUrl);

    const title = (
      outline.getAttribute("title") ||
      outline.getAttribute("text") ||
      ""
    ).trim();

    feeds.push({ title: title || fallbackTitle(xmlUrl), xmlUrl });
  });

  return { feeds, skipped };
}
