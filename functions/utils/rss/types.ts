export type RssEpisode = {
  id: string;
  title: string;
  audioUrl: string | null;
  desc: string;
  link: string | null;
  pubDate: string | null;
  coverUrl: string | null;
};

export type RssFeedData = {
  name: string;
  description: string;
  coverUrl: string | null;
  link: string | null;
  episodes: RssEpisode[];
};
