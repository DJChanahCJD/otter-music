import type {
  PodcastFeed,
  SearchPodcastItem,
} from "@/types/podcast";
import { API_URL } from ".";

const parseJson = async (res: Response) => {
  if (!res.ok) {
    throw new Error((await res.text()) || "请求失败");
  }
  try {
    return await res.json();
  } catch {
    throw new Error("接口返回不是有效 JSON");
  }
};

const PODCAST_API_URL = `${API_URL}/podcast-api`;

export const searchPodcast = async (keyword: string): Promise<SearchPodcastItem[]> => {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return [];
  }

  const res = await parseJson(
    await fetch(`${PODCAST_API_URL}/search?q=${encodeURIComponent(normalizedKeyword)}`)
  );
  return res.data;
};

export const parsePodcastRss = async (rssUrl: string): Promise<PodcastFeed> => {
  const normalizedUrl = rssUrl.trim();
  if (!normalizedUrl) {
    throw new Error("RSS 地址不能为空");
  }

  const res = await parseJson(
    await fetch(`${PODCAST_API_URL}/rss?url=${encodeURIComponent(normalizedUrl)}`)
  );
  return res.data;
};
