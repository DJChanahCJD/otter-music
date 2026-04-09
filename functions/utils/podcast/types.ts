import { SearchPodcastItem } from '@otter-music/shared';

export interface PodcastSearchOptions {
  q: string;
  limit?: number;
  country?: string; // for Apple
  lang?: string;    // for Apple
}

export interface PodcastSearchProvider {
  name: 'apple' | 'xyz' | 'xmly';
  search(options: PodcastSearchOptions): Promise<SearchPodcastItem[]>;
}
