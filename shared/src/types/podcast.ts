export interface PodcastRssSource {
  id: string;
  name: string;
  rssUrl: string;
  author?: string;
  coverUrl?: string;
  description?: string;
  update_time?: number;
  is_deleted?: boolean;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  audioUrl: string | null;
  desc: string;
  pubDate: string | null;
  coverUrl: string | null;
}

export interface PodcastFeed {
  name: string;
  description: string;
  coverUrl: string | null;
  link: string | null;
  episodes: PodcastEpisode[];
}

export interface SearchPodcastItem {
  source: "apple" | "xyz" | "xmly";
  id: string;
  title: string;
  author: string;
  description?: string | null;
  cover: string | null;
  rssUrl: string | null;
  url: string | null;
}
