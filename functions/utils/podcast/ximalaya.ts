import { SearchPodcastItem } from '@otter-music/shared';
import { PodcastSearchOptions, PodcastSearchProvider } from './types';

//! TODO: 暂时不可用
// 喜马拉雅 Web API
// Endpoint: https://www.ximalaya.com/revision/search/main
// Method: GET

type XMLYResult = {
  data?: {
    album?: {
      docs?: Array<{
        albumId: number;
        title: string;
        nickname: string; // author
        coverPath: string;
        intro: string;
        playCount: number;
        tracks: number;
        isFinished: number;
        link?: string; // /album/12345
      }>;
    };
  };
};

export const xmlyProvider: PodcastSearchProvider = {
  name: 'xmly',
  async search(params: PodcastSearchOptions): Promise<SearchPodcastItem[]> {
    try {
      const url = new URL('https://www.ximalaya.com/revision/search/main');
      url.searchParams.set('core', 'album');
      url.searchParams.set('kw', params.q);
      url.searchParams.set('spellchecker', 'true');
      url.searchParams.set('rows', String(params.limit ?? 20));
      url.searchParams.set('condition', 'relation');
      url.searchParams.set('device', 'iPhone');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[Ximalaya] Search failed: ${response.status}`);
        return [];
      }
      console.log(response.json())

      const json = (await response.json()) as XMLYResult;
      const albums = json.data?.album?.docs ?? [];

      return albums.map((item) => {
        const link = item.link || `/album/${item.albumId}`;
        return {
          source: 'xmly',
          id: String(item.albumId),
          title: item.title,
          author: item.nickname,
          cover: item.coverPath,
          rssUrl: null, 
          url: `https://www.ximalaya.com${link}`,
        };
      });
    } catch (error) {
      console.error('[Ximalaya] Search error:', error);
      return [];
    }
  },
};
