import { SearchPodcastItem } from '@otter-music/shared';
import { appleProvider } from './apple';
import { xyzProvider } from './xiaoyuzhou';
import { xmlyProvider } from './ximalaya';
import { PodcastSearchOptions, PodcastSearchProvider } from './types';

const providers: Record<string, PodcastSearchProvider> = {
  apple: appleProvider,
  xyz: xyzProvider,
  xmly: xmlyProvider,
};

export async function searchPodcasts(
  params: PodcastSearchOptions & { sources?: string[] }
): Promise<SearchPodcastItem[]> {
  // 默认仅使用 apple，除非明确指定其他源
  const sources = params.sources?.length ? params.sources : ['apple'];
  
  const activeProviders = sources
    .map((s) => providers[s])
    .filter((p) => !!p);

  if (activeProviders.length === 0) {
    // 如果没有有效的 provider，回退到 apple
    activeProviders.push(appleProvider);
  }

  // 并发请求所有源
  const results = await Promise.allSettled(
    activeProviders.map((p) => p.search(params))
  );

  const allItems: SearchPodcastItem[] = [];

  results.forEach((result, index) => {
    const providerName = activeProviders[index].name;
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    } else {
      console.error(
        `[Search] Provider ${providerName} failed:`,
        result.reason
      );
    }
  });

  return allItems;
}
