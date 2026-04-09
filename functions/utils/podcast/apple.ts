import { SearchPodcastItem } from '@otter-music/shared';
import { PodcastSearchOptions, PodcastSearchProvider } from './types';

type ApplePodcastResult = {
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  feedUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  collectionViewUrl?: string;
  genres?: string[];
};

type CloudflareRequestInit = RequestInit & {
  cf?: {
    cacheTtl?: number;
    cacheEverything?: boolean;
  };
};

function normalizeAppleResult(item: ApplePodcastResult): SearchPodcastItem {
  return {
    source: 'apple',
    id: String(item.collectionId ?? ''),
    title: item.collectionName?.trim() ?? '',
    author: item.artistName?.trim() ?? '',
    cover: item.artworkUrl600?.trim() || item.artworkUrl100?.trim() || null,
    rssUrl: item.feedUrl?.trim() || null,
    url: item.collectionViewUrl?.trim() || null,
  };
}

export const appleProvider: PodcastSearchProvider = {
  name: 'apple',
  async search(params: PodcastSearchOptions): Promise<SearchPodcastItem[]> {
    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', params.q);
    url.searchParams.set('media', 'podcast');
    url.searchParams.set('entity', 'podcast');
    url.searchParams.set('limit', String(params.limit ?? 20));
    url.searchParams.set('country', (params.country || 'CN').toUpperCase());
    url.searchParams.set('lang', (params.lang || 'zh_cn').toLowerCase());

    const requestInit: CloudflareRequestInit = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': 'OtterMusic/2.0',
      },
      cf: {
        cacheTtl: 60 * 60,
        cacheEverything: true,
      },
    };
    const response = await fetch(url.toString(), requestInit as RequestInit);

    if (!response.ok) {
      throw new Error(`Apple search failed: HTTP ${response.status}`);
    }

    const json = (await response.json()) as {
      results?: ApplePodcastResult[];
    };

    return (json.results ?? [])
      .map(normalizeAppleResult)
      .filter((item) => item.id && item.title);
  },
};
