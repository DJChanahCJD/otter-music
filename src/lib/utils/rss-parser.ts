import type { PodcastFeed, PodcastEpisode } from "@otter-music/shared";

const HTML_ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
};

/**
 * 清洗 HTML 标签和实体
 */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/gi, (m, p1: string) => {
      return HTML_ENTITY_MAP[p1.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 标准化 URL（相对路径转绝对路径）
 */
function normalizeUrl(url?: string, baseUrl?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * 获取元素的文本内容
 */
function getTextContent(el: Element | null): string {
  if (!el) return "";
  return el.textContent?.trim() || "";
}

/**
 * 从 RSS/Atom XML 解析播客数据（始终完整解析，不做截断）
 * @param xmlText 原始 XML 文本
 * @param feedUrl 用于把相对 URL 解析为绝对 URL 的源地址
 */
export function parseRssXml(xmlText: string, feedUrl: string): PodcastFeed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  // 检查解析错误
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("RSS XML 解析失败");
  }

  const feed: PodcastFeed = {
    name: "",
    description: "",
    coverUrl: null,
    link: null,
    episodes: [],
  };

  // 判断是 RSS 还是 Atom
  const isAtom = doc.documentElement.nodeName === "feed";

  if (isAtom) {
    // Atom 格式
    feed.name = stripHtml(getTextContent(doc.querySelector("feed > title")));
    feed.description = stripHtml(
      getTextContent(doc.querySelector("feed > subtitle"))
    );
    // Atom 的链接在 href 属性上（textContent 为空）；rel 缺省时按 alternate 处理
    const atomLink =
      doc.querySelector("feed > link[rel='alternate'][href]") ||
      doc.querySelector("feed > link[href]:not([rel])");
    feed.link = normalizeUrl(atomLink?.getAttribute("href") || "", feedUrl);

    // Atom 封面
    const logo = doc.querySelector("feed > logo, feed > icon");
    if (logo) {
      feed.coverUrl = normalizeUrl(getTextContent(logo), feedUrl);
    }

    // itunes:image
    const itunesImage = doc.querySelector("feed > image[href]");
    if (itunesImage) {
      const href = itunesImage.getAttribute("href");
      if (href) feed.coverUrl = normalizeUrl(href, feedUrl);
    }

    // 解析条目
    const entries = doc.querySelectorAll("feed > entry");
    for (let i = 0; i < entries.length; i++) {
      const episode = parseAtomEntry(entries[i], feedUrl, feed.coverUrl);
      if (episode) feed.episodes.push(episode);
    }
  } else {
    // RSS 2.0 格式
    feed.name = stripHtml(getTextContent(doc.querySelector("channel > title")));
    feed.description = stripHtml(
      getTextContent(doc.querySelector("channel > description"))
    );
    feed.link = normalizeUrl(
      getTextContent(doc.querySelector("channel > link")),
      feedUrl
    );

    // RSS 封面
    const itunesImage = doc.querySelector("channel > image[url]");
    if (itunesImage) {
      const url = itunesImage.getAttribute("url");
      if (url) feed.coverUrl = normalizeUrl(url, feedUrl);
    }

    // itunes:image (namespace)
    if (!feed.coverUrl) {
      const itunesImg = doc.querySelector(
        "channel > itunes\\:image, channel > image"
      );
      if (itunesImg) {
        const href =
          itunesImg.getAttribute("href") || itunesImg.getAttribute("url");
        if (href) feed.coverUrl = normalizeUrl(href, feedUrl);
      }
    }

    // RSS 2.0 标准封面 <image><url>...</url></image>
    if (!feed.coverUrl) {
      const url = getTextContent(doc.querySelector("channel > image > url"));
      if (url) feed.coverUrl = normalizeUrl(url, feedUrl);
    }

    // 解析条目
    const items = doc.querySelectorAll("channel > item");
    for (let i = 0; i < items.length; i++) {
      const episode = parseRssItem(items[i], feedUrl, feed.coverUrl);
      if (episode) feed.episodes.push(episode);
    }
  }

  return feed;
}

/**
 * 解析 RSS item
 */
function parseRssItem(
  item: Element,
  feedUrl: string,
  feedCoverUrl: string | null
): PodcastEpisode | null {
  const title = getTextContent(item.querySelector("title"));
  if (!title) return null;

  // 音频 URL（enclosure）
  let audioUrl: string | null = null;
  const enclosure = item.querySelector("enclosure[url]");
  if (enclosure) {
    audioUrl = normalizeUrl(enclosure.getAttribute("url") || "", feedUrl);
  }

  // 兼容 Atom link[rel=enclosure]
  if (!audioUrl) {
    const atomLink = item.querySelector("link[rel='enclosure'][href]");
    if (atomLink) {
      audioUrl = normalizeUrl(atomLink.getAttribute("href") || "", feedUrl);
    }
  }

  if (!audioUrl) return null;

  // 发布日期
  const pubDate =
    getTextContent(item.querySelector("pubDate")) ||
    getTextContent(item.querySelector("dc\\:date")) ||
    null;

  // 封面
  let coverUrl: string | null = null;
  const itunesImage = item.querySelector("itunes\\:image[href]");
  if (itunesImage) {
    coverUrl = normalizeUrl(itunesImage.getAttribute("href") || "", feedUrl);
  }
  if (!coverUrl) coverUrl = feedCoverUrl;

  // ID
  const id = getTextContent(item.querySelector("guid")) || audioUrl || title;

  return {
    id: id.slice(0, 200),
    title: stripHtml(title),
    audioUrl,
    pubDate,
    coverUrl,
  };
}

/**
 * 解析 Atom entry
 */
function parseAtomEntry(
  entry: Element,
  feedUrl: string,
  feedCoverUrl: string | null
): PodcastEpisode | null {
  const title = getTextContent(entry.querySelector("title"));
  if (!title) return null;

  // 音频 URL
  let audioUrl: string | null = null;
  const enclosure = entry.querySelector("link[rel='enclosure'][href]");
  if (enclosure) {
    audioUrl = normalizeUrl(enclosure.getAttribute("href") || "", feedUrl);
  }

  // 兼容 media:content
  if (!audioUrl) {
    const media = entry.querySelector("media\\:content[url]");
    if (media) {
      audioUrl = normalizeUrl(media.getAttribute("url") || "", feedUrl);
    }
  }

  if (!audioUrl) return null;

  // 发布日期
  const pubDate =
    getTextContent(entry.querySelector("published")) ||
    getTextContent(entry.querySelector("updated")) ||
    null;

  // 封面
  let coverUrl: string | null = null;
  const itunesImage = entry.querySelector("itunes\\:image[href]");
  if (itunesImage) {
    coverUrl = normalizeUrl(itunesImage.getAttribute("href") || "", feedUrl);
  }
  if (!coverUrl) coverUrl = feedCoverUrl;

  // ID
  const id = getTextContent(entry.querySelector("id")) || audioUrl || title;

  return {
    id: id.slice(0, 200),
    title: stripHtml(title),
    audioUrl,
    pubDate,
    coverUrl,
  };
}
