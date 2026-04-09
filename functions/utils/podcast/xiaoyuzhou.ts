import { SearchPodcastItem } from '@otter-music/shared';
import { PodcastSearchOptions, PodcastSearchProvider } from './types';

//! TODO: 暂时不可用
export const xyzProvider: PodcastSearchProvider = {
  name: 'xyz',
  async search(params: PodcastSearchOptions): Promise<SearchPodcastItem[]> {
    try {
      const url = 'https://api.xiaoyuzhoufm.com/v1/search/web';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'x-jwt-token': 'anonymous',
          'x-client-id': 'web-anonymous',
        },
        body: JSON.stringify({
          keyword: params.q,
          limit: params.limit ?? 20,
          offset: 0,
        }),
      });

      if (!response.ok) {
        console.warn(`[Xiaoyuzhou] Search failed: ${response.status}`);
        return [];
      }

      const json = await response.json();

      const list = json.data?.podcasts || [];

      return list.map((item: any) => ({
        source: 'xyz',
        id: item.pid,
        title: item.title,
        author: item.podcastAuthor?.nickname || '未知',
        cover: item.image?.picUrl || null,
        rssUrl: null,
        url: `https://www.xiaoyuzhoufm.com/podcast/${item.pid}`,
      }));
    } catch (error) {
      console.error('[Xiaoyuzhou] Error:', error);
      return [];
    }
  },
};
